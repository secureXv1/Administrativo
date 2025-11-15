// src/routes/vehiculos.js
import express from 'express'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'

import { pool } from '../db.js'
import { logEvent, Actions } from '../audit.js'
import { requireSuperadmin } from '../middlewares.js' // opcional aquí
import crypto from 'crypto';   

const router = express.Router()

// ===== soporte __dirname en ESM =====
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ===== Upload básico (ajusta si tienes uno centralizado) =====
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
})

/* -------------------------------------------------------
   Auth local
------------------------------------------------------- */

// Inyecta req.user desde Authorization: Bearer <jwt>
const attachUser = (req, _res, next) => {
  if (req.user) return next()
  try {
    const h = req.headers.authorization || ''
    if (h.startsWith('Bearer ')) {
      const token = h.slice(7)
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || process.env.JWT_KEY || 'dev_secret'
      )
      req.user = payload // { uid, role, groupId, unitId, ... }
    }
  } catch { /* silencioso: requireAuth devolverá 401 */ }
  next()
}
router.use(attachUser)

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  const role = String(req.user.role || '').toLowerCase()
  const ok = allowed.map(r => String(r).toLowerCase()).includes(role)
  if (!ok) return res.status(403).json({ error: 'Forbidden' })
  next()
}

/* -------------------------------------------------------
   Helpers de negocio
------------------------------------------------------- */

// Alcance por rol para operaciones con agente
async function validateAgentScope(req, agentId) {
  const role = String(req.user?.role || '').toLowerCase();

  // ✅ Si el que consulta es el propio agente -> permitir
  const requesterAgentId = req.user?.agentId ?? req.user?.agent_id ?? null;
  if (role === 'agent' && requesterAgentId && Number(requesterAgentId) === Number(agentId)) {
    return true;
  }

  if (role === 'superadmin' || role === 'supervision') return true;

  if (role === 'leader_group') {
    const [[row]] = await pool.query('SELECT groupId FROM agent WHERE id=? LIMIT 1', [agentId]);
    return row && Number(row.groupId) === Number(req.user.groupId);
  }

  if (role === 'leader_unit') {
    const [[row]] = await pool.query('SELECT unitId FROM agent WHERE id=? LIMIT 1', [agentId]);
    return row && Number(row.unitId) === Number(req.user.unitId);
  }

  return false;
}

// Saber si un vehículo tiene uso abierto
async function vehicleHasOpenUse(vehicleId) {
  const [[row]] = await pool.query(
    'SELECT id FROM vehicle_uses WHERE vehicle_id=? AND ended_at IS NULL LIMIT 1',
    [vehicleId]
  )
  return row?.id || null
}

// Saber si un AGENTE tiene uso abierto
async function agentHasOpenUse(agentId) {
  const [[row]] = await pool.query(
    'SELECT id FROM vehicle_uses WHERE agent_id=? AND ended_at IS NULL LIMIT 1',
    [agentId]
  )
  return row?.id || null
}

/* -------------------------------------------------------
   VEHICLES
------------------------------------------------------- */

// GET /vehicles?query=&due_within=&page=1&pageSize=100&groupId=&unitId=&category=&estado=&onlyAssigned=1&hasOpenUse=1
router.get(
  '/',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    try {
      const {
        query,
        due_within,
        groupId,
        unitId,
        category,
        estado,
        onlyAssigned,
        hasOpenUse,
        page = 1,
        pageSize = 100
      } = req.query;

      const p  = Math.max(parseInt(page,10)||1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize,10)||100,1), 1000);
      const off = (p-1)*ps;

      const where = [];
      const args  = [];

      // Búsqueda por placa/estado (conserva tu comportamiento)
      if (query && String(query).trim()) {
        where.push('(v.code LIKE ? OR v.estado LIKE ?)');
        const q = `%${String(query).trim()}%`;
        args.push(q, q);
      }

      // Vencimientos dentro de N días (compatibilidad)
      if (!isNaN(parseInt(due_within,10))) {
        const n = Math.max(parseInt(due_within,10), 0);
        where.push('((v.soat_date IS NOT NULL AND v.soat_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)) OR (v.tecno_date IS NOT NULL AND v.tecno_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)))');
        args.push(n, n);
      }

      // === NUEVOS FILTROS ===
      if (groupId) {
        where.push('v.group_id = ?');
        args.push(Number(groupId));
      }
      if (unitId) {
        where.push('v.unit_id = ?');
        args.push(Number(unitId));
      }
      if (category) {
        where.push('v.category = ?');
        args.push(String(category));
      }
      if (estado) {
        where.push('v.estado = ?');
        args.push(String(estado));
      }

      // Vehículos con asignación vigente (hoy)
      if (Number(onlyAssigned) === 1) {
        where.push(`
          EXISTS (
            SELECT 1
            FROM vehicle_assignments va2
            WHERE va2.vehicle_id = v.id
              AND (va2.end_date IS NULL OR va2.end_date > CURDATE())
          )
        `);
      }

      // Vehículos con uso abierto
      if (Number(hasOpenUse) === 1) {
        where.push(`
          EXISTS (
            SELECT 1
            FROM vehicle_uses vu2
            WHERE vu2.vehicle_id = v.id
              AND vu2.ended_at IS NULL
          )
        `);
      }

      const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

      // Nota: dejamos el LEFT JOIN a la asignación vigente para devolver agentCode/nickname
      const selectSql = `
        SELECT
          v.id,
          v.code,
          v.estado,
          v.odometer,
          v.oil_last_km,
          v.oil_interval_km,
          v.soat_date  AS soatDate,
          v.tecno_date AS tecnoDate,
          v.category,
          g.id   AS groupId,
          g.code AS groupName,
          u.id   AS unitId,
          u.name AS unitName,
          a.code     AS agentCode,
          a.nickname AS agentNickname,
          EXISTS(
            SELECT 1 FROM vehicle_uses vu WHERE vu.vehicle_id = v.id AND vu.ended_at IS NULL
          ) AS hasOpenUse
        FROM vehicles v
        LEFT JOIN \`group\` g
               ON g.id = v.group_id
        LEFT JOIN unit u
               ON u.id = v.unit_id
        LEFT JOIN vehicle_assignments va
               ON va.vehicle_id = v.id
              AND (va.end_date IS NULL OR va.end_date > CURDATE())
        LEFT JOIN agent a
               ON a.id = va.agent_id
        ${whereSql}
        ORDER BY v.code
        LIMIT ? OFFSET ?`;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM vehicles v
        ${whereSql}`;

      const [rows]   = await pool.query(selectSql, [...args, ps, off]);
      const [[{ total }]] = await pool.query(countSql, args);

      for (const row of rows) {
        row.agentNickname = decNullable(row.agentNickname);
        row.hasOpenUse = !!row.hasOpenUse;
      }

      res.json({ page: p, pageSize: ps, total: Number(total)||0, items: rows });
    } catch (e) {
      console.error('[GET /vehicles] error', e);
      res.status(500).json({ error:'VehiclesListError', detail: e.message });
    }
  }
);

// POST /vehicles  (crear)
router.post(
  '/',
  requireAuth,
  requireRole('superadmin','supervision'),
  async (req, res) => {
    try {
      const {
        code,
        estado = 'SERVICIO',
        soatDate,
        tecnoDate,
        category,
        groupId,
        unitId,
        odometer,
        oil_last_km,
        oil_interval_km
      } = req.body;

      // ===== Validaciones =====
      if (!code || !estado || !soatDate || !tecnoDate || !category || !groupId || !unitId)
        return res.status(422).json({ error:'Campos requeridos: code, estado, soatDate, tecnoDate, category, groupId, unitId.' });

      // estado válido
      const ESTADOS = ['SERVICIO','EN TALLER','MANTENIMIENTO N.C','PENDIENTE BAJA'];
      if (!ESTADOS.includes(String(estado)))
        return res.status(422).json({ error:'Estado inválido. Use: SERVICIO, EN TALLER o MANTENIMIENTO N.C.' });

      // category válida (ahora con CM)
      const CATS = ['VH','MT','CM'];
      if (!CATS.includes(String(category)))
        return res.status(422).json({ error:'Categoría inválida. Use: VH, MT o CM.' });

      // odómetro requerido y ≥ 0
      const odoNum = Number(odometer);
      if (!Number.isFinite(odoNum) || odoNum < 0)
        return res.status(422).json({ error:'El odómetro es obligatorio y debe ser un número ≥ 0.' });

      // aceite (opcionales, pero si llegan deben ser válidos)
      let oilLast = oil_last_km ?? null;
      let oilInterval = oil_interval_km ?? null;

      if (oilLast !== null) {
        const n = Number(oilLast);
        if (!Number.isFinite(n) || n < 0)
          return res.status(422).json({ error:'oil_last_km debe ser un número ≥ 0.' });
        oilLast = n;
      }
      if (oilInterval !== null) {
        const n = Number(oilInterval);
        if (!Number.isFinite(n) || n <= 0)
          return res.status(422).json({ error:'oil_interval_km debe ser un número > 0.' });
        oilInterval = n;
      }

      // ===== Insert =====
      const [r] = await pool.query(
        `INSERT INTO vehicles
          (code, estado, soat_date, tecno_date, category, group_id, unit_id, odometer, oil_last_km, oil_interval_km)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          String(code).trim().toUpperCase(),
          estado,
          soatDate,
          tecnoDate,
          category,
          groupId,
          unitId,
          odoNum,
          oilLast,
          oilInterval
        ]
      );

      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.VEHICLE_CREATE,
        details: { code: String(code).trim().toUpperCase(), estado, category }
      });

      res.json({ ok: true, id: r.insertId });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ error:'Código duplicado' });
      res.status(500).json({ error:'VehicleCreateError', detail: e.message });
    }
  }
);

// PUT /vehicles/:id  (editar)
router.put(
  '/:id',
  requireAuth,
  requireRole('superadmin','supervision'),
  async (req, res) => {
    try {
      const { id } = req.params;
      let {
        code,
        estado,
        soatDate,
        tecnoDate,
        category,
        groupId,
        unitId,
        odometer,
        oil_last_km,
        oil_interval_km
      } = req.body;

      const sets = [];
      const args = [];

      if (code !== undefined) {
        sets.push('code=?');
        args.push(String(code).trim().toUpperCase());
      }
      if (estado !== undefined) {
        const ESTADOS = ['SERVICIO','EN TALLER','MANTENIMIENTO N.C','PENDIENTE BAJA'];
        if (!ESTADOS.includes(String(estado)))
          return res.status(422).json({ error:'Estado inválido. Use: SERVICIO, EN TALLER o MANTENIMIENTO N.C.' });
        sets.push('estado=?'); args.push(estado);
      }
      if (soatDate !== undefined) { sets.push('soat_date=?'); args.push(soatDate); }
      if (tecnoDate !== undefined) { sets.push('tecno_date=?'); args.push(tecnoDate); }

      if (category !== undefined) {
        const CATS = ['VH','MT','CM'];
        if (!CATS.includes(String(category)))
          return res.status(422).json({ error:'Categoría inválida. Use: VH, MT o CM.' });
        sets.push('category=?'); args.push(category);
      }

      if (groupId !== undefined) { sets.push('group_id=?'); args.push(groupId); }
      if (unitId !== undefined)  { sets.push('unit_id=?');  args.push(unitId);  }

      if (odometer !== undefined) {
        const n = Number(odometer);
        if (!Number.isFinite(n) || n < 0)
          return res.status(422).json({ error:'odometer debe ser un número ≥ 0.' });
        sets.push('odometer=?'); args.push(n);
      }

      if (oil_last_km !== undefined) {
        if (oil_last_km === null) {
          sets.push('oil_last_km=NULL');
        } else {
          const n = Number(oil_last_km);
          if (!Number.isFinite(n) || n < 0)
            return res.status(422).json({ error:'oil_last_km debe ser un número ≥ 0.' });
          sets.push('oil_last_km=?'); args.push(n);
        }
      }

      if (oil_interval_km !== undefined) {
        if (oil_interval_km === null) {
          sets.push('oil_interval_km=NULL');
        } else {
          const n = Number(oil_interval_km);
          if (!Number.isFinite(n) || n <= 0)
            return res.status(422).json({ error:'oil_interval_km debe ser un número > 0.' });
          sets.push('oil_interval_km=?'); args.push(n);
        }
      }

      if (!sets.length)
        return res.status(400).json({ error:'Nada para actualizar' });

      args.push(id);
      const [r] = await pool.query(`UPDATE vehicles SET ${sets.join(', ')} WHERE id=?`, args);
      if (!r.affectedRows)
        return res.status(404).json({ error:'Vehículo no encontrado' });

      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.VEHICLE_UPDATE,
        details: { vehicleId: Number(id), changes: Object.keys(req.body || {}) }
      });

      res.json({ ok:true });
    } catch (e) {
      res.status(500).json({ error:'VehicleUpdateError', detail: e.message });
    }
  }
);

// DELETE /vehicles/:id
router.delete(
  '/:id',
  requireAuth,
  requireRole('superadmin'),
  async (req, res) => {
    try {
      const { id } = req.params

      const [[veh]] = await pool.query('SELECT id FROM vehicles WHERE id=? LIMIT 1', [id])
      if (!veh) return res.status(404).json({ error: 'Vehículo no encontrado' })

      const [[assign]] = await pool.query(
        'SELECT id FROM vehicle_assignments WHERE vehicle_id=? AND (end_date IS NULL OR end_date > CURDATE()) LIMIT 1',
        [id]
      )
      if (assign) return res.status(409).json({ error: 'El vehículo tiene asignaciones activas. Libere antes de eliminar.' })

      const [[openUse]] = await pool.query(
        'SELECT id FROM vehicle_uses WHERE vehicle_id=? AND ended_at IS NULL LIMIT 1',
        [id]
      )
      if (openUse) return res.status(409).json({ error: 'El vehículo tiene usos abiertos. Cierre antes de eliminar.' })

      // borrar hijos (sin depender de assignment_id)
      await pool.query('DELETE FROM vehicle_novelties WHERE vehicle_id=?', [id])
      await pool.query('DELETE FROM vehicle_uses WHERE vehicle_id=?', [id])
      await pool.query('DELETE FROM vehicle_assignments WHERE vehicle_id=?', [id])

      const [r] = await pool.query('DELETE FROM vehicles WHERE id=?', [id])
      if (!r.affectedRows) return res.status(404).json({ error: 'Vehículo no encontrado' })

      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.VEHICLE_DELETE,
        details: { vehicleId: Number(id) }
      })

      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: 'VehicleDeleteError', detail: e.message })
    }
  }
)

// POST /vehicles/:id/state-change
router.post(
  '/:id/state-change',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params;
    const { new_status, odometer, note, changed_oil } = req.body; // changed_oil: boolean opcional

    try {
      // 1) Vehículo actual
      const [[veh]] = await pool.query(
        'SELECT estado, odometer FROM vehicles WHERE id=? LIMIT 1',
        [id]
      );
      if (!veh) {
        return res.status(404).json({ error: 'Vehículo no encontrado' });
      }

      const prev_status = veh.estado;
      const kmActual = Number(veh.odometer ?? 0);
      const kmNuevo  = Number(odometer ?? 0);
      const nota     = String(note || '').trim();

      // 2) Validaciones
      if (!nota) {
        return res.status(422).json({ error: 'La nota es obligatoria.' });
      }
      if (Number.isNaN(kmNuevo) || kmNuevo < kmActual) {
        return res.status(422).json({
          error: `El kilometraje no puede ser menor al actual (${kmActual}).`
        });
      }
      if (!['SERVICIO','EN TALLER','MANTENIMIENTO N.C','PENDIENTE BAJA'].includes(new_status)) {
        return res.status(422).json({ error: 'Estado inválido.' });
      }

      // 3) Armar SET del UPDATE
      const sets = ['estado=?','odometer=?'];
      const args = [new_status, kmNuevo];

      // Si quieres soportar "cambié aceite" solo en transiciones desde EN TALLER:
      const fromTaller =
        prev_status === 'EN TALLER' &&
        ['SERVICIO','MANTENIMIENTO N.C','PENDIENTE BAJA'].includes(new_status);

      let changedOilFlag = !!changed_oil && fromTaller;
      if (changedOilFlag) {
        sets.push('oil_last_km=?');
        args.push(kmNuevo);
      }

      args.push(id);

      // 4) UPDATE vehículo
      await pool.query(`UPDATE vehicles SET ${sets.join(', ')} WHERE id=?`, args);

      // 5) Insertar histórico en vehicles_status
      // a) Versión CON columna changed_oil en la tabla
      await pool.query(
        `INSERT INTO vehicles_status
           (vehicle_id, prev_status, new_status, odometer, note, changed_by, changed_oil)
         VALUES (?,?,?,?,?,?,?)`,
        [id, prev_status, new_status, kmNuevo, nota, req.user.uid ?? null, changedOilFlag ? 1 : 0]
      );

      // b) Si NO tienes columna changed_oil, usa este bloque en lugar del anterior:
      /*
      const notaConTag = (changedOilFlag ? '[ACEITE] ' : '') + nota;
      await pool.query(
        \`INSERT INTO vehicles_status
           (vehicle_id, prev_status, new_status, odometer, note, changed_by)
         VALUES (?,?,?,?,?,?)\`,
        [id, prev_status, new_status, kmNuevo, notaConTag, req.user.uid ?? null]
      );
      */

      res.json({ ok: true });
    } catch (e) {
      console.error('[POST /vehicles/:id/state-change] error', e);
      res.status(500).json({ error: 'No se pudo guardar el cambio de estado.' });
    }
  }
);

// GET /vehicles/:id/status-history?limit=50
router.get(
  '/:id/status-history',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit,10) || 50, 1), 200);

    const [rows] = await pool.query(
      `SELECT
         id,
         prev_status AS prevStatus,
         new_status  AS newStatus,
         odometer,
         note,
         changed_oil AS changedOil,
         DATE_FORMAT(changed_at,'%Y-%m-%d %H:%i:%s') AS changedAt,
         changed_by  AS changedBy
       FROM vehicles_status
       WHERE vehicle_id=?
       ORDER BY id DESC
       LIMIT ?`,
      [id, limit]
    );

    res.json({ items: rows });
  }
);


// GET /vehicles/:id/maintenances
router.get(
  '/:id/maintenances',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT id, prev_status, new_status, odometer, note,
              DATE_FORMAT(changed_at,'%Y-%m-%d %H:%i:%s') AS changed_at,
              changed_by
         FROM vehicles_status
        WHERE vehicle_id=? AND prev_status='EN TALLER' AND new_status='SERVICIO'
        ORDER BY changed_at DESC, id DESC`,
      [id]
    );
    res.json({ items: rows });
  }
);

/* -------------------------------------------------------
   Catálogos mínimos (grupos / unidades)
------------------------------------------------------- */

router.get('/catalogs/groups', requireAuth, async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, code FROM `group` ORDER BY name')
  res.json({ items: rows })
})

router.get('/catalogs/units', requireAuth, async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, groupId FROM unit ORDER BY name')
  res.json({ items: rows })
})

/* -------------------------------------------------------
   ASSIGNMENTS
------------------------------------------------------- */

// GET /vehicles/:id/assignments
router.get(
  '/:id/assignments',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params
    const [rows] = await pool.query(`
      SELECT 
        va.id, 
        va.vehicle_id                         AS vehicle_id,
        va.agent_id                           AS agentId, 
        a.code                                AS agentCode,
        DATE_FORMAT(va.start_date,'%Y-%m-%d') AS start_date,
        DATE_FORMAT(va.end_date  ,'%Y-%m-%d') AS end_date,
        va.odometer_start, 
        va.odometer_end,
        va.notes,
        -- ✅ Campos correctos que sí existen en tu tabla:
        va.agent_ack_at                       AS agent_ack_at,
        va.agent_ack_note                     AS agent_ack_note,
        va.agent_ack_locked                   AS agent_ack_locked,
        va.agent_ack_extra_note               AS agent_ack_extra_note,
        va.agent_ack_extra_at                 AS agent_ack_extra_at
      FROM vehicle_assignments va
      JOIN agent a ON a.id = va.agent_id
      WHERE va.vehicle_id=?
      ORDER BY (va.end_date IS NULL) DESC, va.start_date DESC, va.id DESC
    `,[id])
    // Formato que tu front entiende (items o array directo):
    res.json({ items: rows })
  }
)

// GET /agents/:agentId/assignments?active=1&pageSize=500
router.get(
  '/agents/:agentId/assignments',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { agentId } = req.params
    const { active } = req.query
    // Seguridad por alcance de rol
    const okScope = await validateAgentScope(req, Number(agentId))
    if (!okScope) return res.status(403).json({ error:'ForbiddenScope' })

    const where = ['va.agent_id = ?']
    const args  = [agentId]
    if (String(active) === '1') {
      where.push('(va.end_date IS NULL OR va.end_date > CURDATE())')
    }
    const whereSql = 'WHERE ' + where.join(' AND ')

    const [rows] = await pool.query(`
      SELECT 
        va.id,
        va.vehicle_id                         AS vehicle_id,
        v.code                                AS vehicle_code,
        DATE_FORMAT(va.start_date,'%Y-%m-%d') AS start_date,
        DATE_FORMAT(va.end_date  ,'%Y-%m-%d') AS end_date,
        va.odometer_start,
        va.odometer_end,
        va.notes,
        va.agent_ack_at                       AS agent_ack_at,
        va.agent_ack_note                     AS agent_ack_note,
        va.agent_ack_locked                   AS agent_ack_locked,
        va.agent_ack_extra_note               AS agent_ack_extra_note,
        va.agent_ack_extra_at                 AS agent_ack_extra_at
      FROM vehicle_assignments va
      JOIN vehicles v ON v.id = va.vehicle_id
      ${whereSql}
      ORDER BY (va.end_date IS NULL) DESC, va.start_date DESC, va.id DESC
    `, args)

    // Formato amigable para el front
    const items = rows.map(r => ({
      id: r.id,
      start_date: r.start_date,
      end_date: r.end_date,
      odometer_start: r.odometer_start,
      odometer_end: r.odometer_end,
      notes: r.notes,
      agent_ack_at: r.agent_ack_at,
      agent_ack_note: r.agent_ack_note,
      agent_ack_locked: r.agent_ack_locked,
      agent_ack_extra_note: r.agent_ack_extra_note,
      agent_ack_extra_at: r.agent_ack_extra_at,
      vehicle: { id: r.vehicle_id, code: r.vehicle_code }
    }))

    res.json({ items })
  }
)

// PATCH /vehicles/assignments/:id/accept  { note }
// Alias de "ack": marca aceptación del AGENTE con nota obligatoria (máx 300)
router.patch(
  '/assignments/:id/accept',
  requireAuth,
  requireRole('agent','leader_unit','leader_group','supervision','superadmin'),
  async (req, res) => {
    const { id }  = req.params;
    const noteRaw = String(req.body?.note || '').trim();

    if (!noteRaw)                return res.status(422).json({ error: 'La nota es obligatoria.' });
    if (noteRaw.length > 300)    return res.status(422).json({ error: 'La nota no puede superar 300 caracteres.' });

    // Traemos la asignación con las columnas correctas
    const [[row]] = await pool.query(
      `SELECT agent_id, end_date, agent_ack_at, agent_ack_locked
         FROM vehicle_assignments
        WHERE id=? LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Asignación no encontrada' });

    // Solo la puede aceptar el mismo agente (o un rol superior si lo permites)
    const isAgent = String(req.user?.role || '').toLowerCase() === 'agent';
    const requesterAgentId = req.user?.agentId ?? req.user?.agent_id ?? null;
    if (isAgent) {
      if (!requesterAgentId || Number(requesterAgentId) !== Number(row.agent_id)) {
        return res.status(403).json({ error: 'No puedes aceptar una asignación de otro agente.' });
      }
    }
    if (row.end_date)                   return res.status(409).json({ error: 'La asignación ya está cerrada.' });
    if (row.agent_ack_at)               return res.status(409).json({ error: 'La asignación ya fue aceptada previamente.' });
    if (Number(row.agent_ack_locked)===1) return res.status(409).json({ error: 'La aceptación está bloqueada.' });

    await pool.query(
      `UPDATE vehicle_assignments
          SET agent_ack_at = NOW(),
              agent_ack_note = ?
        WHERE id = ?`,
      [noteRaw, id]
    );

    try {
      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.VEHICLE_ASSIGN_ACCEPT ?? 'VEHICLE_ASSIGN_ACCEPT',
        details: { assignmentId: Number(id) }
      });
    } catch {}

    res.json({ ok: true });
  }
);

// PATCH /vehicles/assignments/:id/ack  { note }
router.patch(
  '/assignments/:id/ack',
  requireAuth,
  requireRole('agent','leader_unit','leader_group','supervision','superadmin'),
  async (req, res) => {
    const { id }   = req.params
    const noteRaw  = String(req.body?.note || '').trim()

    if (!noteRaw) return res.status(422).json({ error: 'La nota es obligatoria.' })
    if (noteRaw.length > 300) return res.status(422).json({ error: 'La nota no puede superar 300 caracteres.' })

    const [[row]] = await pool.query(
      `SELECT agent_id, end_date, agent_ack_at, agent_ack_locked
         FROM vehicle_assignments
        WHERE id=? LIMIT 1`, [id]
    )
    if (!row) return res.status(404).json({ error: 'Asignación no encontrada' })

    const isAgent = String(req.user?.role || '').toLowerCase() === 'agent'
    const requesterAgentId = req.user?.agentId ?? req.user?.agent_id ?? null
    if (isAgent) {
      if (!requesterAgentId || Number(requesterAgentId) !== Number(row.agent_id)) {
        return res.status(403).json({ error: 'No puedes aceptar una asignación de otro agente.' })
      }
    }

    if (row.end_date) return res.status(409).json({ error: 'La asignación ya está cerrada.' })
    if (row.agent_ack_at) return res.status(409).json({ error: 'La asignación ya fue aceptada previamente.' })
    if (Number(row.agent_ack_locked) === 1) return res.status(409).json({ error: 'La aceptación está bloqueada.' })

    await pool.query(
      `UPDATE vehicle_assignments
          SET agent_ack_at = NOW(), agent_ack_note = ?
        WHERE id = ?`,
      [noteRaw, id]
    )

    await logEvent({
      req,
      userId: req.user.uid,
      action: Actions.VEHICLE_ASSIGN_ACCEPT ?? 'VEHICLE_ASSIGN_ACCEPT',
      details: { assignmentId: Number(id) }
    })

    res.json({ ok: true })
  }
)

// PATCH /vehicles/assignments/:id/extra  { note }
router.patch(
  '/assignments/:id/extra',
  requireAuth,
  requireRole('agent','leader_unit','leader_group','supervision','superadmin'),
  async (req, res) => {
    const { id }   = req.params
    const noteRaw  = String(req.body?.note || '').trim()

    if (!noteRaw) return res.status(422).json({ error: 'La nota extra es obligatoria.' })
    if (noteRaw.length > 500) return res.status(422).json({ error: 'La nota extra no puede superar 500 caracteres.' })

    const [[row]] = await pool.query(
      `SELECT agent_id, end_date, agent_ack_at, agent_ack_extra_at
         FROM vehicle_assignments
        WHERE id=? LIMIT 1`, [id]
    )
    if (!row) return res.status(404).json({ error: 'Asignación no encontrada' })

    const isAgent = String(req.user?.role || '').toLowerCase() === 'agent'
    const requesterAgentId = req.user?.agentId ?? req.user?.agent_id ?? null
    if (isAgent) {
      if (!requesterAgentId || Number(requesterAgentId) !== Number(row.agent_id)) {
        return res.status(403).json({ error: 'No puedes anotar en asignaciones de otro agente.' })
      }
    }

    if (row.end_date) return res.status(409).json({ error: 'La asignación ya está cerrada.' })
    if (!row.agent_ack_at) return res.status(409).json({ error: 'Primero debes aceptar la asignación.' })
    if (row.agent_ack_extra_at) return res.status(409).json({ error: 'La nota extra ya fue registrada.' })

    await pool.query(
      `UPDATE vehicle_assignments
          SET agent_ack_extra_at = NOW(), agent_ack_extra_note = ?
        WHERE id = ?`,
      [noteRaw, id]
    )

    await logEvent({
      req,
      userId: req.user.uid,
      action: Actions.VEHICLE_ASSIGN_ACK_EXTRA ?? 'VEHICLE_ASSIGN_ACK_EXTRA',
      details: { assignmentId: Number(id) }
    })

    res.json({ ok: true })
  }
)

// POST /vehicles/:id/assignments { agent_id, odometer_start?, notes? }
router.post(
  '/:id/assignments',
  requireAuth,
  requireRole('superadmin','supervision'),
  async (req, res) => {
    const { id } = req.params;
    const { agent_id, odometer_start, notes } = req.body;

    if (!agent_id)
      return res.status(422).json({ error: 'agent_id requerido' });

    // buscar último km final cerrado o del vehículo
    const [[lastRow]] = await pool.query(`
      SELECT COALESCE(
        (SELECT odometer_end FROM vehicle_assignments
          WHERE vehicle_id=? AND end_date IS NOT NULL AND odometer_end IS NOT NULL
          ORDER BY end_date DESC, id DESC LIMIT 1),
        (SELECT odometer_end FROM vehicle_assignments
          WHERE vehicle_id=? AND odometer_end IS NOT NULL
          ORDER BY id DESC LIMIT 1),
        (SELECT odometer FROM vehicles WHERE id=? LIMIT 1)
      ) AS lastKm
    `, [id, id, id]);

    const lastKm = Number(lastRow?.lastKm ?? 0);
    const odoStart = Number(odometer_start ?? lastKm);

    if (Number.isNaN(odoStart) || odoStart < lastKm) {
      return res.status(422).json({
        error: `El odómetro inicial (${odoStart}) no puede ser menor al último registrado (${lastKm}).`
      });
    }

    // validar asignación abierta
    const [[open]] = await pool.query(
      `SELECT id FROM vehicle_assignments
       WHERE vehicle_id=? AND end_date IS NULL
       LIMIT 1`,
      [id]
    );
    if (open)
      return res.status(409).json({ error: 'Ya existe una asignación vigente' });

    // insertar
    await pool.query(
      `INSERT INTO vehicle_assignments
        (vehicle_id, agent_id, start_date, odometer_start, notes)
       VALUES (?, ?, CURDATE(), ?, ?)`,
      [id, agent_id, odoStart, (notes || '').trim() || null]
    );

    await logEvent({
      req, userId: req.user.uid,
      action: Actions.VEHICLE_ASSIGN_CREATE,
      details: { vehicleId: Number(id), agentId: Number(agent_id), odometer_start: odoStart }
    });

    res.json({ ok: true });
  }
);


// PATCH /vehicles/:vehicleId/assignments/:assignmentId
router.patch(
  '/:vehicleId/assignments/:assignmentId',
  requireAuth,
  requireRole('superadmin','supervision'),
  async (req, res) => {
    const { vehicleId, assignmentId } = req.params
    const { end_date, odometer_end, notes } = req.body
    let sets = []
    let args = []
    if (end_date !== undefined)     { sets.push('end_date=?');      args.push(end_date) }
    else                            { sets.push('end_date=CURDATE()') }
    if (odometer_end !== undefined) { sets.push('odometer_end=?');  args.push(odometer_end) }
    if (notes !== undefined)        { sets.push('notes=?');         args.push(notes) }
    if (!sets.length) return res.status(400).json({ error:'Nada para actualizar' })
    args.push(assignmentId, vehicleId)
    const [r] = await pool.query(
      `UPDATE vehicle_assignments SET ${sets.join(', ')} WHERE id=? AND vehicle_id=?`,
      args
    )
    if (!r.affectedRows) return res.status(404).json({ error:'Asignación no encontrada' })
    await logEvent({
      req,
      userId:req.user.uid,
      action: Actions.VEHICLE_ASSIGN_CLOSE,
      details:{ vehicleId:Number(vehicleId), assignmentId:Number(assignmentId), end_date, odometer_end }
    })
    res.json({ ok:true })
  }
)

// GET /vehicles/:id/last-assignment-odometer — último km FINAL de una asignación CERRADA
router.get(
  '/:id/last-assignment-odometer',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params;

    // 1) Última asignación CERRADA con odómetro final
    const [closed] = await pool.query(
      `SELECT odometer_end AS last
         FROM vehicle_assignments
        WHERE vehicle_id=? 
          AND end_date IS NOT NULL
          AND odometer_end IS NOT NULL
        ORDER BY end_date DESC, id DESC
        LIMIT 1`,
      [id]
    );
    if (closed.length && closed[0].last != null) {
      return res.json({ lastOdometer: Number(closed[0].last) });
    }

    // 2) Cualquier asignación con odómetro final (por si existen registros antiguos sin end_date)
    const [anyWithEnd] = await pool.query(
      `SELECT odometer_end AS last
         FROM vehicle_assignments
        WHERE vehicle_id=? 
          AND odometer_end IS NOT NULL
        ORDER BY id DESC
        LIMIT 1`,
      [id]
    );
    if (anyWithEnd.length && anyWithEnd[0].last != null) {
      return res.json({ lastOdometer: Number(anyWithEnd[0].last) });
    }

    // 3) Fallback: odómetro actual del vehículo (mejor que nada para prefilar)
    const [[veh]] = await pool.query(
      `SELECT odometer FROM vehicles WHERE id=? LIMIT 1`,
      [id]
    );
    return res.json({ lastOdometer: veh?.odometer != null ? Number(veh.odometer) : null });
  }
);

/* -------------------------------------------------------
   USES
------------------------------------------------------- */

// GET /vehicles/uses?vehicle_id=&agent_id=&open=1
router.get(
  '/uses',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { vehicle_id, agent_id, open } = req.query
    const where = [], args = []
    if (vehicle_id) { where.push('vu.vehicle_id=?'); args.push(vehicle_id) }
    if (agent_id)   { where.push('vu.agent_id=?');   args.push(agent_id)   }
    if (String(open||'0') === '1') where.push('vu.ended_at IS NULL')
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : ''
    const [rows] = await pool.query(`
      SELECT vu.id, vu.vehicle_id AS vehicleId, v.code AS vehicleCode, v.estado, v.odometer, v.oil_last_km,v.oil_interval_km,
             vu.agent_id AS agentId, a.code AS agentCode,
             DATE_FORMAT(vu.started_at,'%Y-%m-%d %H:%i:%s') AS started_at,
             DATE_FORMAT(vu.ended_at  ,'%Y-%m-%d %H:%i:%s') AS ended_at,
             vu.odometer_start, vu.odometer_end, vu.notes,
             vu.created_by
      FROM vehicle_uses vu
      JOIN vehicles v ON v.id = vu.vehicle_id
      JOIN agent a    ON a.id = vu.agent_id
      ${whereSql}
      ORDER BY vu.id DESC
    `, args)
    res.json({ items: rows })
  }
)

// POST /vehicles/uses/start
router.post(
  '/uses/start',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { vehicle_id, agent_id, odometer_start, notes } = req.body
    if (!vehicle_id || !agent_id) {
      return res.status(422).json({ error:'vehicle_id y agent_id requeridos' })
    }

    // 🔐 Alcance por rol
    const okScope = await validateAgentScope(req, Number(agent_id))
    if (!okScope) {
      return res.status(403).json({ error:'No autorizado para iniciar uso con ese agente' })
    }

    // 1) 🚫 Un agente no puede tener más de un uso abierto
    const agentOpenId = await agentHasOpenUse(agent_id)
    if (agentOpenId) {
      return res.status(409).json({
        error: 'El agente ya tiene un uso abierto. Debe cerrarlo antes de iniciar otro.',
        useId: agentOpenId
      })
    }

    // 2) 🚫 Un vehículo no puede tener dos usos abiertos (reforzamos)
    const openUseId = await vehicleHasOpenUse(vehicle_id)
    if (openUseId) {
      return res.status(409).json({
        error:'El vehículo ya tiene un uso abierto.',
        useId: openUseId
      })
    }

    // 3) Traer datos del vehículo (incluye ESTADO)
    const [[veh]] = await pool.query(
      `SELECT 
          id,
          estado,
          odometer,
          soat_date  AS soatDate,
          tecno_date AS tecnoDate,
          oil_last_km,
          oil_interval_km
        FROM vehicles
        WHERE id=? 
        LIMIT 1`,
      [vehicle_id]
    )

    if (!veh) {
      return res.status(404).json({ error: 'Vehículo no encontrado' })
    }

    // 👀 DEBUG (puedes dejarlo mientras pruebas)
    console.log('DEBUG /uses/start veh:', veh)

    // 3.1 ⛔ VEHÍCULO NO EN ESTADO SERVICIO
    if (veh.estado !== 'SERVICIO') {
      return res.status(409).json({
        error: `El vehículo está en estado "${veh.estado}" y no puede iniciar un uso. Solo vehículos en SERVICIO pueden iniciar usos.`
      })
    }

    // 3.2 ⛔ Bloqueo por SOAT / Tecnomecánica vencidos (usando DATEDIFF como antes)
    const [[exp]] = await pool.query(
      `SELECT 
          DATEDIFF(soat_date , CURDATE()) AS soatDiff,
          DATEDIFF(tecno_date, CURDATE()) AS tecnoDiff
        FROM vehicles
        WHERE id=? 
        LIMIT 1`,
      [vehicle_id]
    )

    const soatDiff  = exp?.soatDiff
    const tecnoDiff = exp?.tecnoDiff

    const soatVencido  = (soatDiff  !== null && soatDiff  < 0)
    const tecnoVencido = (tecnoDiff !== null && tecnoDiff < 0)

    if (soatVencido || tecnoVencido) {
      const partes = []
      if (soatVencido)  partes.push('SOAT')
      if (tecnoVencido) partes.push('Técnico-mecánica')
      return res.status(409).json({
        error: `No puedes iniciar el uso porque el ${partes.join(' y ')} está vencido.`
      })
    }

    // 4) ⚠️ Advertencia por cambio de aceite (NO bloquea)
    const OIL_THRESHOLD = 500 // km restantes para considerar "poco"
    let oil_warning = null

    // Odómetro actual: preferimos el que envía el front, si no el del vehículo
    let currentOdo = null
    if (odometer_start != null && odometer_start !== '') {
      currentOdo = Number(odometer_start)
    } else if (veh.odometer != null) {
      currentOdo = Number(veh.odometer)
    }

    let nextOil = null
    if (veh.oil_last_km != null && veh.oil_interval_km != null) {
      const last  = Number(veh.oil_last_km)
      const inter = Number(veh.oil_interval_km)
      if (Number.isFinite(last) && Number.isFinite(inter) && inter > 0) {
        nextOil = last + inter
      }
    }

    if (
      currentOdo != null && Number.isFinite(currentOdo) &&
      nextOil    != null && Number.isFinite(nextOil)
    ) {
      const remaining = nextOil - currentOdo
      if (remaining <= OIL_THRESHOLD) {
        oil_warning = {
          remaining,
          nextOil
        }
      }
    }

    // 5) Insertar el uso
    const [r] = await pool.query(
      `
      INSERT INTO vehicle_uses
        (vehicle_id, agent_id, started_at, odometer_start, notes, created_by)
      VALUES (?, ?, COALESCE(?, NOW()), ?, ?, ?)
      `,
      [
        vehicle_id,
        agent_id,
        req.body.started_at || null,
        currentOdo ?? null,
        notes || null,
        req.user.uid
      ]
    )
    const useId = r.insertId

    // 6) mover staging -> uso
    await pool.query(
      'UPDATE vehicle_novelties SET use_id=? WHERE vehicle_id=? AND use_id IS NULL',
      [useId, vehicle_id]
    )

    await logEvent({
      req,
      userId: req.user.uid,
      action: Actions.VEHICLE_USE_START,
      details: { vehicleId: Number(vehicle_id), agentId: Number(agent_id), useId }
    })

    // Mandamos también la advertencia (si existe) para que el front la muestre
    res.json({ id: useId, oil_warning })
  }
)


// PATCH /vehicles/uses/:id/end
router.patch(
  '/uses/:id/end',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params
    const { ended_at, odometer_end, notes } = req.body

    // Traemos datos del uso (incluye odómetro inicial)
    const [[useRow]] = await pool.query(
      'SELECT vehicle_id, agent_id, ended_at, odometer_start FROM vehicle_uses WHERE id=? LIMIT 1',
      [id]
    )
    if (!useRow) return res.status(404).json({ error:'Uso no encontrado' })
    if (useRow.ended_at) return res.status(409).json({ error:'El uso ya está cerrado' })

    const okScope = await validateAgentScope(req, Number(useRow.agent_id))
    if (!okScope) return res.status(403).json({ error:'No autorizado para cerrar este uso' })

    // ✅ Validar odómetro final obligatorio y no menor al inicial
    const startKm = useRow.odometer_start != null
      ? Number(useRow.odometer_start)
      : null

    const endKm = Number(odometer_end)

    if (!Number.isFinite(endKm)) {
      return res.status(422).json({ error: 'Debes ingresar un odómetro final válido.' })
    }

    if (startKm != null && Number.isFinite(startKm) && endKm < startKm) {
      return res.status(422).json({
        error: `El odómetro final (${endKm}) no puede ser menor al inicial (${startKm}).`
      })
    }

    const sets = []
    const args = []

    if (ended_at !== undefined) {
      sets.push('ended_at=?')
      args.push(ended_at)
    } else {
      sets.push('ended_at=NOW()')
    }

    sets.push('odometer_end=?')
    args.push(endKm)

    sets.push('notes=COALESCE(?, notes)')
    args.push(notes ?? null)

    args.push(id)

    await pool.query(`UPDATE vehicle_uses SET ${sets.join(', ')} WHERE id=?`, args)

    await logEvent({
      req,
      userId:req.user.uid,
      action: Actions.VEHICLE_USE_END,
      details:{ useId:Number(id), vehicleId:Number(useRow.vehicle_id), agentId:Number(useRow.agent_id), odometer_end: endKm }
    })
    res.json({ ok:true })
  }
)

// GET /vehicles/:id/last-use-odometer
router.get(
  '/:id/last-use-odometer',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params

    const [[row]] = await pool.query(
      `
      SELECT COALESCE(
        -- 1) Último uso CERRADO (ended_at no nulo) con odómetro final
        (SELECT odometer_end
           FROM vehicle_uses
          WHERE vehicle_id=? 
            AND ended_at IS NOT NULL
            AND odometer_end IS NOT NULL
          ORDER BY ended_at DESC, id DESC
          LIMIT 1),

        -- 2) Si nunca se ha cerrado un uso, tomamos el odómetro inicial del último uso
        (SELECT odometer_start
           FROM vehicle_uses
          WHERE vehicle_id=? 
            AND odometer_start IS NOT NULL
          ORDER BY started_at DESC, id DESC
          LIMIT 1),

        -- 3) Fallback: odómetro del propio vehículo
        (SELECT odometer FROM vehicles WHERE id=? LIMIT 1)
      ) AS last
      `,
      [id, id, id]
    )

    res.json({ lastOdometer: row?.last != null ? Number(row.last) : null })
  }
)

/* -------------------------------------------------------
   NOVELTIES
------------------------------------------------------- */

// GET /vehicles/:tipo/:id/novelties (tipo: uses | vehicle)
router.get(
  '/:tipo/:id/novelties',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { tipo, id } = req.params
    const limit = Math.min(Math.max(parseInt(req.query.limit,10) || 10, 1), 100)

    let refField = null
    if (tipo === 'uses') refField = 'use_id'
    else if (tipo === 'vehicle') refField = 'vehicle_id'
    else if (tipo === 'assignments') {
      return res.status(410).json({ error:'NoveltiesDisabledForAssignments' })
    } else {
      return res.status(400).json({ error: 'Tipo inválido' })
    }

    const [rows] = await pool.query(`
      SELECT vn.id, vn.${refField} AS refId, vn.description, vn.photo_url AS photoUrl,
             vn.created_by AS createdBy,
             DATE_FORMAT(vn.created_at,'%Y-%m-%d %H:%i:%s') AS created_at
      FROM vehicle_novelties vn
      WHERE vn.${refField}=?
      ORDER BY vn.id DESC
      LIMIT ?
    `, [id, limit])

    res.json({ items: rows })
  }
)

// POST /vehicles/:tipo/:id/novelties (solo tipo=vehicle)
router.post(
  '/:tipo/:id/novelties',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  upload.single('photo'),
  async (req, res) => {
    const { tipo, id } = req.params
    let refField = null

    if (tipo === 'uses') {
      return res.status(403).json({ error:'NoveltiesEditNotAllowedOnUses' })
    } else if (tipo === 'assignments') {
      return res.status(410).json({ error:'NoveltiesDisabledForAssignments' })
    } else if (tipo === 'vehicle') {
      refField = 'vehicle_id'
    } else {
      return res.status(400).json({ error: 'Tipo inválido' })
    }

    const description = String(req.body.description || '').trim()
    if (!description && !req.file) return res.status(422).json({ error: 'Debe enviar descripción o foto' })

    // Validaciones + bloqueo si hay uso abierto
    const [[exists]] = await pool.query('SELECT 1 FROM vehicles WHERE id=?', [id])
    if (!exists) return res.status(404).json({ error: 'Vehículo no encontrado' })

    const openUseId = await vehicleHasOpenUse(id)
    if (openUseId) return res.status(409).json({ error:'OpenUseExists', useId: openUseId })

    const photoUrl = req.file
      ? path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/')
      : null

    const [r] = await pool.query(
      `INSERT INTO vehicle_novelties (${refField}, description, photo_url, created_by)
       VALUES (?,?,?,?)`,
      [id, description || '(sin descripción)', photoUrl, req.user.uid]
    )

    await logEvent({
      req,
      userId: req.user.uid,
      action: Actions.VEHICLE_NOVELTY_CREATE,
      details: { [`${refField}`]: Number(id), noveltyId: r.insertId, hasPhoto: !!photoUrl },
    })

    res.json({ ok: true, id: r.insertId, photoUrl })
  }
)

// GET /vehicles/:id/novelties/recent
router.get(
  '/:id/novelties/recent',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params
    const limit = Math.min(Math.max(parseInt(req.query.limit,10) || 10, 1), 100)

    // 1) staging existentes
    const [staged] = await pool.query(`
      SELECT id, vehicle_id AS vehicleId, use_id AS useId, description, photo_url AS photoUrl,
             created_by AS createdBy, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
      FROM vehicle_novelties
      WHERE vehicle_id=? AND use_id IS NULL
      ORDER BY id DESC
      LIMIT ?`,
      [id, limit]
    )
    if (staged.length) return res.json({ items: staged, source: 'staging' })

    // 2) último uso del vehículo
    const [[lastUse]] = await pool.query(`
      SELECT id FROM vehicle_uses
      WHERE vehicle_id=?
      ORDER BY started_at DESC, id DESC
      LIMIT 1`,
      [id]
    )
    if (!lastUse) return res.json({ items: [], source: 'none' })

    // 3) copiar novedades del último uso a staging
    await pool.query(`
      INSERT INTO vehicle_novelties (vehicle_id, use_id, description, photo_url, created_by)
      SELECT ?, NULL, vn.description, vn.photo_url, ?
      FROM vehicle_novelties vn
      WHERE vn.use_id = ?
      ORDER BY vn.id DESC
      LIMIT ?`,
      [id, req.user.uid, lastUse.id, limit]
    )

    // 4) devolver staging recién creado
    const [seeded] = await pool.query(`
      SELECT id, vehicle_id AS vehicleId, use_id AS useId, description, photo_url AS photoUrl,
             created_by AS createdBy, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
      FROM vehicle_novelties
      WHERE vehicle_id=? AND use_id IS NULL
      ORDER BY id DESC
      LIMIT ?`,
      [id, limit]
    )
    res.json({ items: seeded, source: 'seeded_from_last_use', lastUseId: lastUse.id })
  }
)

// DELETE /vehicles/novelties/:id
router.delete(
  '/novelties/:id',
  requireAuth,
  requireRole('superadmin','supervision'),
  async (req, res) => {
    const { id } = req.params
    const [[row]] = await pool.query('SELECT id, use_id FROM vehicle_novelties WHERE id=?', [id])
    if (!row) return res.json({ ok:false })
    if (row.use_id) {
      return res.status(403).json({ error:'DeleteNotAllowedOnUseNovelties' })
    }
    const [r] = await pool.query('DELETE FROM vehicle_novelties WHERE id=?', [id])
    res.json({ ok: !!r.affectedRows })
  }
)

/* -------------------------------------------------------
   DUE (SOAT/TECNO)
------------------------------------------------------- */

// GET /vehicles/due?within=30
router.get(
  '/due',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    try {
      const within = Math.max(parseInt(req.query.within,10) || 30, 0)
      const [rows] = await pool.query(`
        SELECT id, code, estado,
               soat_date  AS soatDate,
               tecno_date AS tecnoDate,
               DATEDIFF(soat_date , CURDATE()) AS soat_in_days,
               DATEDIFF(tecno_date, CURDATE()) AS tecno_in_days
        FROM vehicles
        WHERE 
          (soat_date IS NOT NULL AND soat_date  <= DATE_ADD(CURDATE(), INTERVAL ? DAY))
          OR (tecno_date IS NOT NULL AND tecno_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY))
        ORDER BY LEAST(
          COALESCE(DATEDIFF(soat_date, CURDATE()), 99999),
          COALESCE(DATEDIFF(tecno_date, CURDATE()), 99999)
        )
      `, [within, within])
      res.json({ items: rows })
    } catch(e) {
      console.error('[vehicles/due ERROR]', e)
      res.status(500).json({ error:'VehicleDueError', detail: e.message })
    }
  }
)

/* =======================================================
   DESCIFRADO LOCAL (idéntico a server.js)
======================================================= */
const ENC_KEY_B64 = process.env.NOVELTY_ENC_KEY || '';
const ENC_KEY = Buffer.from(ENC_KEY_B64, 'base64'); // debe medir 32 bytes

function decNullable(maybeB64) {
  if (maybeB64 == null || maybeB64 === '') return null;
  // Si no hay clave válida, no intentes descifrar
  if (ENC_KEY.length !== 32) return String(maybeB64);

  try {
    const raw = Buffer.from(String(maybeB64), 'base64');
    // 12 (iv) + 16 (tag) + >=1 (ct) → mínimo 29; usamos 28 como umbral estricto (sin ct).
    if (raw.length < 28) {
      // No es nuestro formato → devolver tal cual
      return String(maybeB64);
    }
    const iv  = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct  = raw.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    // Si falla (clave/ct incorrecto), devolver original
    return String(maybeB64);
  }
}

// === Catálogo de agentes (descifra nickname, respeta scope por rol) ===
router.get('/catalogs/agents', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10000, 20000);
    const q     = (req.query.q || '').trim();

    const where = [];
    const args  = [];

    // Alcance por rol
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'leader_group') {
      where.push('a.groupId = ?'); args.push(req.user.groupId);
    } else if (role === 'leader_unit' || role === 'agent') {
      where.push('a.unitId = ?');  args.push(req.user.unitId);
    }

    // Búsqueda opcional SOLO por código (nickname está cifrado → no sirve LIKE)
    if (q) {
      where.push('(a.code LIKE ?)');
      args.push(`%${q}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT a.id, a.code, a.nickname, a.groupId, a.unitId
         FROM agent a
         ${whereSql}
        ORDER BY a.code
        LIMIT ?`,
      [...args, limit]
    );

    // Descifrar nickname con la misma util local
    for (const r of rows) {
      r.nickname = decNullable(r.nickname);
    }

    res.json({ items: rows });
  } catch (e) {
    console.error('[GET /catalogs/agents] error:', e);
    res.status(500).json({ error: 'AgentsCatalogError', detail: e.message });
  }
});



export default router
