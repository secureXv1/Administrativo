// src/routes/vehiculos.js
import express from 'express'
import path from 'path'
import multer from 'multer'
import { fileURLToPath } from 'url'
import jwt from 'jsonwebtoken'

import { pool } from '../db.js'
import { logEvent, Actions } from '../audit.js'
import { requireSuperadmin } from '../middlewares.js' // opcional aquí

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

// Helper “decNullable” local (si tienes uno real, impórtalo)
const decNullable = (val) => (val == null ? null : String(val))

/* -------------------------------------------------------
   Helpers de negocio
------------------------------------------------------- */

// Alcance por rol para operaciones con agente
async function validateAgentScope(req, agentId) {
  const role = String(req.user?.role || '').toLowerCase()
  if (role === 'superadmin' || role === 'supervision') return true

  if (role === 'leader_group') {
    const [[row]] = await pool.query('SELECT groupId FROM agent WHERE id=? LIMIT 1', [agentId])
    return row && Number(row.groupId) === Number(req.user.groupId)
  }

  if (role === 'leader_unit' || role === 'agent') {
    const [[row]] = await pool.query('SELECT unitId FROM agent WHERE id=? LIMIT 1', [agentId])
    return row && Number(row.unitId) === Number(req.user.unitId)
  }

  return false
}

// Saber si un vehículo tiene uso abierto
async function vehicleHasOpenUse(vehicleId) {
  const [[row]] = await pool.query(
    'SELECT id FROM vehicle_uses WHERE vehicle_id=? AND ended_at IS NULL LIMIT 1',
    [vehicleId]
  )
  return row?.id || null
}

/* -------------------------------------------------------
   VEHICLES
------------------------------------------------------- */

// GET /vehicles?query=&due_within=30&page=1&pageSize=100
router.get(
  '/vehicles',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    try {
      const { query, due_within, page = 1, pageSize = 100 } = req.query;
      const p = Math.max(parseInt(page,10)||1, 1);
      const ps = Math.min(Math.max(parseInt(pageSize,10)||100,1), 1000);
      const off = (p-1)*ps;

      const where = [];
      const args  = [];

      if (query && String(query).trim()) {
        where.push('(v.code LIKE ? OR v.estado LIKE ?)');
        const q = `%${String(query).trim()}%`;
        args.push(q, q);
      }
      if (!isNaN(parseInt(due_within,10))) {
        const n = Math.max(parseInt(due_within,10), 0);
        where.push('(v.soat_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) OR v.tecno_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY))');
        args.push(n, n);
      }

      const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

      const [rows] = await pool.query(
        `SELECT
            v.id,
            v.code,
            v.estado,
            v.odometer,
            v.oil_last_km,
            v.oil_interval_km,
            v.soat_date AS soatDate,
            v.tecno_date AS tecnoDate,
            v.category,
            g.id AS groupId,
            g.code AS groupName,
            u.id AS unitId,
            u.name AS unitName,
            a.code AS agentCode,
            a.nickname AS agentNickname,
            EXISTS(
              SELECT 1 FROM vehicle_uses vu WHERE vu.vehicle_id = v.id AND vu.ended_at IS NULL LIMIT 1
            ) AS hasOpenUse
          FROM vehicles v
          LEFT JOIN \`group\` g ON g.id = v.group_id
          LEFT JOIN unit u ON u.id = v.unit_id
          LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND (va.end_date IS NULL OR va.end_date > CURDATE())
          LEFT JOIN agent a ON a.id = va.agent_id
          ${whereSql}
          ORDER BY v.code
          LIMIT ? OFFSET ?`,
        [...args, ps, off]
      );

      for (const row of rows) {
        row.agentNickname = row.agentNickname == null ? null : String(row.agentNickname);
        row.hasOpenUse = !!row.hasOpenUse;
      }

      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM vehicles v
         ${whereSql}`, args
      );

      res.json({ page:p, pageSize:ps, total: Number(total)||0, items: rows });
    } catch (e) {
      res.status(500).json({ error:'VehiclesListError', detail: e.message });
    }
  }
);


// POST /vehicles  (crear)
router.post(
  '/vehicles',
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
      const ESTADOS = ['SERVICIO','EN TALLER','MANTENIMIENTO N.C'];
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
  '/vehicles/:id',
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
        const ESTADOS = ['SERVICIO','EN TALLER','MANTENIMIENTO N.C'];
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
  '/vehicles/:id',
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
  '/vehicles/:id/state-change',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params;
    const { new_status, odometer, note, changed_oil } = req.body; // changed_oil: boolean opcional

    // 1) Vehículo actual
    const [[veh]] = await pool.query(
      'SELECT estado, odometer FROM vehicles WHERE id=? LIMIT 1',
      [id]
    );
    if (!veh) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const prev_status = veh.estado;
    const kmActual = Number(veh.odometer ?? 0);
    const kmNuevo  = Number(odometer ?? 0);
    const nota     = String(note || '').trim();

    // 2) Validaciones
    if (!nota) {
      return res.status(422).json({ error: 'La nota es obligatoria.' });
    }
    if (Number.isNaN(kmNuevo) || kmNuevo < kmActual) {
      return res.status(422).json({ error: `El kilometraje no puede ser menor al actual (${kmActual}).` });
    }
    if (!['SERVICIO','EN TALLER','MANTENIMIENTO N.C'].includes(new_status)) {
      return res.status(422).json({ error: 'Estado inválido.' });
    }

    // 3) Actualizar vehículo (estado + odómetro) y opcional aceite
    const sets = ['estado=?','odometer=?'];
    const args = [new_status, kmNuevo];

    // Si quieres soportar "cambié aceite" solo en transiciones desde EN TALLER:
    const fromTaller = (prev_status === 'EN TALLER') &&
                       (new_status === 'SERVICIO' || new_status === 'MANTENIMIENTO N.C');

    // a) Versión RECOMENDADA (con columna changed_oil en vehicles_status)
    let changedOilFlag = !!changed_oil && fromTaller;
    if (changedOilFlag) {
      sets.push('oil_last_km=?');
      args.push(kmNuevo);
    }

    args.push(id);
    await pool.query(`UPDATE vehicles SET ${sets.join(', ')} WHERE id=?`, args);

    // 4) Insertar histórico en vehicles_status
    // a) Con columna changed_oil
    try {
      await pool.query(
        `INSERT INTO vehicles_status
         (vehicle_id, prev_status, new_status, odometer, note, changed_by, changed_oil)
         VALUES (?,?,?,?,?,?,?)`,
        [id, prev_status, new_status, kmNuevo, nota, req.user.uid ?? null, changedOilFlag ? 1 : 0]
      );
    } catch(e) {
      // b) MODO SIN MIGRAR (si NO tienes changed_oil):
      // Descomenta este bloque y comenta el INSERT anterior.
      /*
      const notaConTag = (changedOilFlag ? '[ACEITE] ' : '') + nota;
      await pool.query(
        `INSERT INTO vehicles_status
         (vehicle_id, prev_status, new_status, odometer, note, changed_by)
         VALUES (?,?,?,?,?,?)`,
        [id, prev_status, new_status, kmNuevo, notaConTag, req.user.uid ?? null]
      );
      */
      throw e;
    }

    res.json({ ok: true });
  }
);


// GET /vehicles/:id/status-history?limit=50
router.get(
  '/vehicles/:id/status-history',
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
  '/vehicles/:id/maintenances',
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
  '/vehicles/:id/assignments',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params
    const [rows] = await pool.query(`
      SELECT va.id, va.agent_id AS agentId, a.code AS agentCode,
             DATE_FORMAT(va.start_date,'%Y-%m-%d') AS start_date,
             DATE_FORMAT(va.end_date  ,'%Y-%m-%d') AS end_date,
             va.odometer_start, va.odometer_end,
             va.notes
      FROM vehicle_assignments va
      JOIN agent a ON a.id = va.agent_id
      WHERE va.vehicle_id=?
      ORDER BY (va.end_date IS NULL) DESC, va.start_date DESC, va.id DESC
    `,[id])
    res.json(rows)
  }
)

// POST /vehicles/:id/assignments { agent_id, odometer_start?, notes? }
router.post(
  '/vehicles/:id/assignments',
  requireAuth,
  requireRole('superadmin','supervision'),
  async (req, res) => {
    const { id } = req.params
    const { agent_id, odometer_start, notes } = req.body

    if (!agent_id) return res.status(422).json({ error:'agent_id requerido' })

    const [[open]] = await pool.query(
      `SELECT id FROM vehicle_assignments
       WHERE vehicle_id=? AND end_date IS NULL
       LIMIT 1`,
      [id]
    )
    if (open) return res.status(409).json({ error:'Ya existe una asignación vigente' })

    await pool.query(
      `INSERT INTO vehicle_assignments (vehicle_id, agent_id, start_date, end_date, odometer_start, odometer_end, notes)
       VALUES (?, ?, CURDATE(), NULL, ?, NULL, ?)`,
      [id, agent_id, odometer_start ?? null, (notes || '').trim() || null]
    )

    await logEvent({
      req, userId:req.user.uid,
      action: Actions.VEHICLE_ASSIGN_CREATE,
      details:{ vehicleId:Number(id), agentId:Number(agent_id) }
    })

    res.json({ ok:true })
  }
)

// PATCH /vehicles/:vehicleId/assignments/:assignmentId
router.patch(
  '/vehicles/:vehicleId/assignments/:assignmentId',
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

// GET /vehicles/:id/last-assignment-odometer
router.get(
  '/vehicles/:id/last-assignment-odometer',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params
    const [[row]] = await pool.query(
      `SELECT odometer_end AS last
       FROM vehicle_assignments
       WHERE vehicle_id=? AND odometer_end IS NOT NULL
       ORDER BY end_date DESC, id DESC
       LIMIT 1`,
      [id]
    )
    res.json({ lastOdometer: row?.last ?? null })
  }
)

/* -------------------------------------------------------
   USES
------------------------------------------------------- */

// GET /vehicles/uses?vehicle_id=&agent_id=&open=1
router.get(
  '/vehicles/uses',
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
  '/vehicles/uses/start',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { vehicle_id, agent_id, odometer_start, notes } = req.body
    if (!vehicle_id || !agent_id) return res.status(422).json({ error:'vehicle_id y agent_id requeridos' })

    const okScope = await validateAgentScope(req, Number(agent_id))
    if (!okScope) return res.status(403).json({ error:'No autorizado para iniciar uso con ese agente' })

    const openUseId = await vehicleHasOpenUse(vehicle_id)
    if (openUseId) return res.status(409).json({ error:'Uso abierto existente', useId: openUseId })

    const [r] = await pool.query(`
      INSERT INTO vehicle_uses
        (vehicle_id, agent_id, started_at, odometer_start, notes, created_by)
      VALUES (?, ?, COALESCE(?, NOW()), ?, ?, ?)`,
      [vehicle_id, agent_id, req.body.started_at || null, odometer_start ?? null, notes || null, req.user.uid]
    )
    const useId = r.insertId

    // mover staging -> uso
    await pool.query(
      'UPDATE vehicle_novelties SET use_id=? WHERE vehicle_id=? AND use_id IS NULL',
      [useId, vehicle_id]
    )

    await logEvent({
      req, userId:req.user.uid,
      action: Actions.VEHICLE_USE_START,
      details:{ vehicleId:Number(vehicle_id), agentId:Number(agent_id), useId }
    })
    res.json({ id: useId })
  }
)

// PATCH /vehicles/uses/:id/end
router.patch(
  '/vehicles/uses/:id/end',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params
    const { ended_at, odometer_end, notes } = req.body

    const [[useRow]] = await pool.query(
      'SELECT vehicle_id, agent_id, ended_at FROM vehicle_uses WHERE id=? LIMIT 1',[id]
    )
    if (!useRow) return res.status(404).json({ error:'Uso no encontrado' })
    if (useRow.ended_at) return res.status(409).json({ error:'El uso ya está cerrado' })

    const okScope = await validateAgentScope(req, Number(useRow.agent_id))
    if (!okScope) return res.status(403).json({ error:'No autorizado para cerrar este uso' })

    const sets = []
    const args = []
    if (ended_at !== undefined) { sets.push('ended_at=?'); args.push(ended_at) }
    else                        { sets.push('ended_at=NOW()') }
    sets.push('odometer_end=?'); args.push(odometer_end ?? null)
    sets.push('notes=COALESCE(?, notes)'); args.push(notes ?? null)
    args.push(id)
    await pool.query(`UPDATE vehicle_uses SET ${sets.join(', ')} WHERE id=?`, args)

    await logEvent({
      req, userId:req.user.uid,
      action: Actions.VEHICLE_USE_END,
      details:{ useId:Number(id), vehicleId:Number(useRow.vehicle_id), agentId:Number(useRow.agent_id) }
    })
    res.json({ ok:true })
  }
)

// GET /vehicles/:id/last-use-odometer
router.get(
  '/vehicles/:id/last-use-odometer',
  requireAuth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { id } = req.params
    const [[row]] = await pool.query(
      `
      SELECT COALESCE(
        (SELECT odometer_end
           FROM vehicle_uses
          WHERE vehicle_id=? AND odometer_end IS NOT NULL
          ORDER BY ended_at DESC, id DESC
          LIMIT 1),
        (SELECT odometer_start
           FROM vehicle_uses
          WHERE vehicle_id=? AND odometer_start IS NOT NULL
          ORDER BY started_at DESC, id DESC
          LIMIT 1)
      ) AS last
      `,
      [id, id]
    )
    res.json({ lastOdometer: row?.last ?? null })
  }
)

/* -------------------------------------------------------
   NOVELTIES
------------------------------------------------------- */

// GET /vehicles/:tipo/:id/novelties (tipo: uses | vehicle)
router.get(
  '/vehicles/:tipo/:id/novelties',
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
  '/vehicles/:tipo/:id/novelties',
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
  '/vehicles/:id/novelties/recent',
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
  '/vehicles/novelties/:id',
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
  '/vehicles/due',
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

export default router
