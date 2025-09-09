// src/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import bcrypt from 'bcryptjs';
import { initDb, pool } from './db.js'; // Si tu db.js NO tiene initDb, ignora y solo importa pool.
import { computeNovelties } from './utils.js';

// === INICIALIZACIÓN SEGURA DE LA DB ===
async function main() {
  if (typeof initDb === "function") {
    await initDb();
  }

  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  // ---------- AUTH ----------
  app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const [rows] = await pool.query(
      'SELECT id, username, passwordHash, role, groupId, unitId FROM `user` WHERE username=? LIMIT 1',
      [username]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash).catch(() => false);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { uid: user.id, username: user.username, role: user.role, groupId: user.groupId, unitId: user.unitId },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token });
  });

  function auth(req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : h;
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  function requireRole(...roles) {
    return (req, res, next) => {
      const userRole = String(req.user?.role || '').toLowerCase();
      if (!roles.map(r => r.toLowerCase()).includes(userRole)) {
        return res.status(403).json({ error: 'Forbidden', detail: 'No tiene permisos suficientes.' });
      }
      next();
    };
  }

  // ---------- ENDPOINTS USUARIO ----------
  app.get('/me', auth, (req, res) => {
    res.json({
      uid: req.user.uid,
      username: req.user.username,
      role: req.user.role,
      groupId: req.user.groupId,
      unitId: req.user.unitId
    });
  });

  app.get('/me/profile', auth, async (req, res) => {
    const [[user]] = await pool.query(
      `SELECT u.id, u.username, u.role, u.groupId, u.unitId, u.createdAt, g.code AS groupCode, un.name AS unitName
        FROM user u
        LEFT JOIN \`group\` g ON g.id = u.groupId
        LEFT JOIN unit un ON un.id = u.unitId
        WHERE u.id=? LIMIT 1`,
      [req.user.uid]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  });

  app.post('/me/change-password', auth, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Campos requeridos' });
    const [[user]] = await pool.query(
      'SELECT passwordHash FROM user WHERE id=? LIMIT 1', [req.user.uid]
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE user SET passwordHash=? WHERE id=?', [hash, req.user.uid]);
    res.json({ ok: true });
  });

  app.get('/catalogs/agents', auth, async (req, res) => {
  try {
    const { q, code, category, groupId, unitId, limit = 50 } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const params = [];
    let where = '1=1';

    if (category) { where += ' AND a.category=?'; params.push(String(category)); }
    if (groupId) { where += ' AND a.groupId=?'; params.push(Number(groupId)); }
    if (unitId) { where += ' AND a.unitId=?'; params.push(Number(unitId)); }
    if (code) { where += ' AND a.code=?'; params.push(String(code).toUpperCase().trim()); }
    else if (q) { where += ' AND a.code LIKE ?'; params.push(String(q).toUpperCase().trim() + '%'); }

    const [rows] = await pool.query(
      `SELECT 
          a.id, 
          a.code, 
          a.category, 
          a.groupId,
          a.unitId,
          a.status, 
          a.municipalityId, 
          m.dept, 
          m.name, 
          m.lat, 
          m.lon
        FROM agent a
        LEFT JOIN municipality m ON a.municipalityId = m.id
        WHERE ${where}
        ORDER BY a.code
        LIMIT ?`,
      [...params, take]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error:'CatalogError', detail:e.message });
  }
});

// ===== Mis agentes (del líder de unidad) =====
app.get('/my/agents', auth, requireRole('leader_unit', 'leader_group'), async (req, res) => {
  try {
    const role = String(req.user.role).toLowerCase();
    const dateParam = (req.query.date || new Date().toISOString().slice(0,10)).slice(0,10);

    if (role === 'leader_unit') {
  const unitId = req.user.unitId;
  const dateParam = (req.query.date || new Date().toISOString().slice(0,10)).slice(0,10);

  const [rows] = await pool.query(
    `
    SELECT 
      a.id, a.code, a.category, a.status AS status_agent, a.groupId, a.unitId,
      COALESCE(l.municipalityId, a.municipalityId) AS effectiveMunicipalityId,

      m_da.dept AS dept_da, m_da.name AS name_da,
      m_ag.dept AS dept_ag, m_ag.name AS name_ag,

      l.state AS da_state,
      DATE_FORMAT(l.novelty_start,'%Y-%m-%d') AS novelty_start,
      DATE_FORMAT(l.novelty_end  ,'%Y-%m-%d') AS novelty_end,
      l.novelty_description

    FROM agent a
    LEFT JOIN (
      SELECT da.*
      FROM dailyreport_agent da
      JOIN dailyreport dr ON dr.id = da.reportId
      WHERE dr.reportDate <= ?
        AND NOT EXISTS (
          SELECT 1
          FROM dailyreport_agent da2
          JOIN dailyreport dr2 ON dr2.id = da2.reportId
          WHERE da2.agentId = da.agentId
            AND dr2.reportDate <= ?
            AND dr2.reportDate > dr.reportDate
        )
    ) l ON l.agentId = a.id

    LEFT JOIN municipality m_da ON m_da.id = l.municipalityId
    LEFT JOIN municipality m_ag ON m_ag.id = a.municipalityId

    WHERE a.unitId = ?
    ORDER BY a.code
    `,
    [dateParam, dateParam, unitId]
  );

  const out = rows.map(r => {
    const status = r.da_state || r.status_agent || null;
    let municipalityName = '';
    if (r.da_state) {
      if (r.dept_da && r.name_da) municipalityName = `${r.dept_da} - ${r.name_da}`;
    } else {
      if (r.dept_ag && r.name_ag) municipalityName = `${r.dept_ag} - ${r.name_ag}`;
    }
    return {
      id: r.id,
      code: r.code,
      category: r.category,
      status,
      groupId: r.groupId,
      unitId: r.unitId,
      municipalityId: r.effectiveMunicipalityId || null,
      municipalityName,
      novelty_start: r.novelty_start || '',
      novelty_end: r.novelty_end || '',
      novelty_description: r.novelty_description || ''
    };
  });

  return res.json(out);
}


    // --- leader_group: puedes dejarlo como lo tienes ---
    const groupId = req.user.groupId;
    const [rows] = await pool.query(
      `SELECT 
         a.id, a.code, a.category, a.status, a.groupId, a.unitId, a.municipalityId,
         g.code AS groupCode, u.name AS unitName,
         m.dept, m.name
       FROM agent a
       JOIN \`group\` g ON g.id=a.groupId
       LEFT JOIN unit u ON u.id=a.unitId
       LEFT JOIN municipality m ON m.id=a.municipalityId
       WHERE a.groupId=?
       ORDER BY a.category='OF' DESC, a.category='SO' DESC, a.category='PT' DESC, a.code`,
      [groupId]
    );

    res.json(rows.map(r => ({
      ...r,
      municipalityName: r.municipalityId ? `${r.dept} - ${r.name}` : ''
    })));
  } catch (e) {
    console.error('GET /my/agents error:', e);
    res.status(500).json({ error:'MyAgentsError', detail:e.message });
  }
});



// Cambiar solo la unidad de un agente (LÍDER DE GRUPO)
app.put('/my/agents/:id/unit',
  auth,
  requireRole('leader_group'),
  async (req, res) => {
    const { id } = req.params;
    const { unitId } = req.body;

    // verifica que el agente pertenece a su grupo
    const [[ag]] = await pool.query(
      'SELECT id, groupId FROM agent WHERE id=? LIMIT 1', [id]
    );
    if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });
    if (ag.groupId !== req.user.groupId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // si envían unitId, debe existir y pertenecer a su grupo
    if (unitId) {
      const [[u]] = await pool.query(
        'SELECT id FROM unit WHERE id=? AND groupId=? LIMIT 1',
        [unitId, req.user.groupId]
      );
      if (!u) return res.status(404).json({ error: 'Unidad no existe en su grupo' });
    }

    await pool.query(
      'UPDATE agent SET unitId=? WHERE id=?',
      [unitId || null, id]
    );

    res.json({ ok: true });
  }
);



// Helper: asegúrate de tener el reporte del día (o créalo vacío)
async function ensureDailyReport(conn, date, groupId, unitId, leaderUserId) {
  const [[ex]] = await conn.query(
    'SELECT id FROM dailyreport WHERE reportDate=? AND groupId=? AND unitId=? LIMIT 1',
    [date, groupId, unitId]
  );
  if (ex) return ex.id;

  await conn.query(
    `INSERT INTO dailyreport
      (reportDate, groupId, unitId, leaderUserId,
       OF_effective,SO_effective,PT_effective,
       OF_available,SO_available,PT_available,
       OF_nov,SO_nov,PT_nov)
     VALUES (?, ?, ?, ?, 0,0,0, 0,0,0, 0,0,0)`,
    [date, groupId, unitId, leaderUserId]
  );
  const [[row]] = await conn.query(
    'SELECT id FROM dailyreport WHERE reportDate=? AND groupId=? AND unitId=? LIMIT 1',
    [date, groupId, unitId]
  );
  return row.id;
}


// --- Helper: recalcular KPIs (effective/available/nov) del dailyreport ---
async function recalcDailyReport(reportId, connArg = null) {
  const conn = connArg || pool;

  // Totales por categoría a partir de dailyreport_agent
  const [rows] = await conn.query(`
    SELECT a.category AS cat,
           COUNT(*) AS total,
           SUM(CASE WHEN da.state = 'SIN NOVEDAD' THEN 1 ELSE 0 END) AS disponibles
    FROM dailyreport_agent da
    JOIN agent a ON a.id = da.agentId
    WHERE da.reportId = ?
    GROUP BY a.category
  `, [reportId]);

  let feOF = 0, feSO = 0, fePT = 0;
  let fdOF = 0, fdSO = 0, fdPT = 0;

  for (const r of rows) {
    if (r.cat === 'OF') { feOF = r.total; fdOF = r.disponibles; }
    if (r.cat === 'SO') { feSO = r.total; fdSO = r.disponibles; }
    if (r.cat === 'PT') { fePT = r.total; fdPT = r.disponibles; }
  }

  const { OF_nov, SO_nov, PT_nov } = computeNovelties({
    OF_effective: feOF, SO_effective: feSO, PT_effective: fePT,
    OF_available: fdOF, SO_available: fdSO, PT_available: fdPT
  });

  await conn.query(`
    UPDATE dailyreport
       SET OF_effective=? , SO_effective=? , PT_effective=?,
           OF_available=? , SO_available=? , PT_available=?,
           OF_nov=?       , SO_nov=?       , PT_nov=?,
           updatedAt=CURRENT_TIMESTAMP(3)
     WHERE id=?
  `, [feOF, feSO, fePT, fdOF, fdSO, fdPT, OF_nov, SO_nov, PT_nov, reportId]);
}









app.put('/admin/agents/:id/novelty',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    const { id } = req.params;
    const { date, state, municipalityId, novelty_start, novelty_end, novelty_description } = req.body;

    if (!date)  return res.status(422).json({ error: 'Falta date' });
    if (!state) return res.status(422).json({ error: 'Falta state' });

    const [[ag]] = await pool.query('SELECT id, groupId, unitId FROM agent WHERE id=? LIMIT 1', [id]);
    if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });

    if (String(req.user.role).toLowerCase() === 'leader_group' && ag.groupId !== req.user.groupId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const estadosValidos = [
      "SIN NOVEDAD","SERVICIO","COMISIÓN DEL SERVICIO","FRANCO FRANCO",
      "VACACIONES","LICENCIA DE MATERNIDAD","LICENCIA DE LUTO",
      "LICENCIA REMUNERADA","LICENCIA NO REMUNERADA","EXCUSA DEL SERVICIO",
      "LICENCIA PATERNIDAD","PERMISO","COMISIÓN EXTERIOR"
    ];
    const s = String(state||'').toUpperCase().trim();
    if (!estadosValidos.includes(s)) {
      return res.status(422).json({ error: 'Estado inválido' });
    }

    // Normalización/validación
    let muniId = municipalityId ? Number(municipalityId) : null;
    let nStart = novelty_start || null;
    let nEnd   = novelty_end   || null;
    let nDesc  = novelty_description || null;

    if (s === 'SIN NOVEDAD') {
      muniId = 11001; nStart = null; nEnd = null; nDesc = null;
    } else if (s === 'SERVICIO') {
      muniId = 11001;
      if (!nStart) return res.status(422).json({ error:'Falta fecha inicio (SERVICIO)' });
      if (!nEnd)   return res.status(422).json({ error:'Falta fecha fin (SERVICIO)' });
      if (!nDesc)  return res.status(422).json({ error:'Falta descripción (SERVICIO)' });
    } else if (s === 'COMISIÓN DEL SERVICIO') {
      if (!muniId) return res.status(422).json({ error:'Falta municipio (COMISIÓN DEL SERVICIO)' });
      nStart = null; nEnd = null; nDesc = null;
    } else if (s === 'FRANCO FRANCO') {
      muniId = null; nStart = null; nEnd = null; nDesc = null;
    } else {
      // VACACIONES, EXCUSA, PERMISO, COMISIÓN EXTERIOR, LICENCIAS...
      if (!nStart) return res.status(422).json({ error:`Falta fecha inicio (${s})` });
      if (!nEnd)   return res.status(422).json({ error:`Falta fecha fin (${s})` });
      if (!nDesc)  return res.status(422).json({ error:`Falta descripción (${s})` });
      muniId = null;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // ¿ya hay un dailyreport para ese agente en esa fecha?
      const [[exist]] = await conn.query(`
        SELECT dr.id as reportId, dr.groupId, dr.unitId
        FROM dailyreport_agent da
        JOIN dailyreport dr ON dr.id = da.reportId
        WHERE da.agentId=? AND dr.reportDate=? 
        LIMIT 1
      `, [ag.id, date]);

      let reportId, useGroupId, useUnitId;

      if (exist) {
        reportId  = exist.reportId;
        useGroupId = exist.groupId;
        useUnitId  = exist.unitId;
      } else {
        useGroupId = ag.groupId;
        useUnitId  = ag.unitId;

        // UPSERT del dailyreport (clave única por fecha+grupo+unidad)
        await conn.query(`
          INSERT INTO dailyreport
            (reportDate, groupId, unitId,
             OF_effective, SO_effective, PT_effective,
             OF_available, SO_available, PT_available,
             OF_nov, SO_nov, PT_nov)
          VALUES (?, ?, ?, 0,0,0, 0,0,0, 0,0,0)
          ON DUPLICATE KEY UPDATE updatedAt=CURRENT_TIMESTAMP(3)
        `, [date, useGroupId, useUnitId]);

        const [[dr]] = await conn.query(`
          SELECT id FROM dailyreport WHERE reportDate=? AND groupId=? AND unitId=? LIMIT 1
        `, [date, useGroupId, useUnitId]);
        reportId = dr.id;
      }

      // UPSERT de la fila del agente
      await conn.query(`
        INSERT INTO dailyreport_agent
          (reportId, agentId, groupId, unitId, state, municipalityId, novelty_start, novelty_end, novelty_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          state=VALUES(state),
          municipalityId=VALUES(municipalityId),
          novelty_start=VALUES(novelty_start),
          novelty_end=VALUES(novelty_end),
          novelty_description=VALUES(novelty_description)
      `, [reportId, ag.id, useGroupId, useUnitId, s, muniId, nStart, nEnd, nDesc]);

      // Estado actual del agente
      await conn.query(`UPDATE agent SET status=?, municipalityId=? WHERE id=?`, [s, muniId, ag.id]);

      await recalcDailyReport(reportId, conn);

      await conn.commit();
      res.json({ ok: true, reportId });
    } catch (e) {
      await conn.rollback();
      res.status(500).json({ error:'NoveltySaveError', detail:e.message });
    } finally {
      conn.release();
    }
  }
);


// Leer la ÚLTIMA novedad registrada del agente.

// Leer la ÚLTIMA novedad registrada del agente (opcionalmente hasta una fecha)
app.get('/admin/agents/:id/novelty',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    const { id } = req.params;
    const { date } = req.query;

    // seguridad para líder de grupo
    const [[ag]] = await pool.query(
      'SELECT id, groupId, unitId, status, municipalityId FROM agent WHERE id=? LIMIT 1',
      [id]
    );
    if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });
    if (String(req.user.role).toLowerCase() === 'leader_group' && ag.groupId !== req.user.groupId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // filtro opcional por fecha (límite superior)
    const params = [id];
    let whereExtra = '';
    if (date) { whereExtra = ' AND dr.reportDate <= ?'; params.push(date); }

    // 👉 ¡sin da.updatedAt!
    const [rows] = await pool.query(`
      SELECT 
        da.state,
        da.municipalityId,
        DATE_FORMAT(da.novelty_start,'%Y-%m-%d') AS novelty_start,
        DATE_FORMAT(da.novelty_end  ,'%Y-%m-%d') AS novelty_end,
        da.novelty_description,
        m.name AS municipalityName, m.dept,
        dr.groupId, dr.unitId,
        DATE_FORMAT(dr.reportDate,'%Y-%m-%d') AS reportDate
      FROM dailyreport_agent da
      JOIN dailyreport dr ON dr.id = da.reportId
      LEFT JOIN municipality m ON m.id = da.municipalityId
      WHERE da.agentId = ? ${whereExtra}
      ORDER BY dr.reportDate DESC, da.reportId DESC
      LIMIT 1
    `, params);

    if (rows.length) return res.json(rows[0]);

    // Fallback si nunca tuvo novedad
    const [[mun]] = await pool.query(
      'SELECT name, dept FROM municipality WHERE id=? LIMIT 1',
      [ag.municipalityId || 0]
    );
    return res.json({
      state: ag.status || null,
      municipalityId: ag.municipalityId || null,
      novelty_start: null,
      novelty_end: null,
      novelty_description: null,
      municipalityName: mun?.name || null,
      dept: mun?.dept || null,
      groupId: ag.groupId,
      unitId: ag.unitId,
      reportDate: null
    });
  }
);






// Asignar un agente libre (sin grupo ni unidad) a mi unidad y grupo
app.post('/my/agents/add', auth, requireRole('leader_unit'), async (req, res) => {
  const { agentId } = req.body;
  const groupId = req.user.groupId;
  const unitId = req.user.unitId;
  const [r] = await pool.query(
    'UPDATE agent SET groupId = ?, unitId = ? WHERE id = ? AND (groupId IS NULL OR groupId = 0) AND (unitId IS NULL OR unitId = 0)',
    [groupId, unitId, agentId]
  );
  if (r.affectedRows === 0) {
    return res.status(409).json({ error: 'AgenteNoDisponible', detail: 'El agente no está libre (groupId/unitId ≠ 0)' });
  }
  res.json({ ok: true });
});

// Quitar un agente de mi unidad y grupo (dejarlo libre)
app.post('/my/agents/remove', auth, requireRole('leader_unit'), async (req, res) => {
  const { agentId } = req.body;
  const groupId = req.user.groupId;
  const unitId = req.user.unitId;
  const [r] = await pool.query(
    'UPDATE agent SET groupId = NULL, unitId = NULL WHERE id = ? AND groupId = ? AND unitId = ?',
    [agentId, groupId, unitId]
  );
  if (r.affectedRows === 0) {
    return res.status(404).json({ error: 'NoPertenece', detail: 'El agente no pertenece a tu unidad/grupo' });
  }
  res.json({ ok: true });
});

// Crear agente (incluye unitId)
app.post('/adminapi/agents', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { code, category, groupId, unitId } = req.body;
  if (!/^[A-Z][0-9]+$/.test(code)) return res.status(422).json({ error: 'Código inválido (LETRA + números)' });
  if (!['OF','SO','PT'].includes(category)) return res.status(422).json({ error: 'Categoría inválida' });
  try {
    await pool.query('INSERT INTO agent (code,category,groupId,unitId) VALUES (?,?,?,?)', [code, category, groupId ?? null, unitId ?? null]);
    res.json({ ok:true });
  } catch (e) {
    res.status(400).json({ error: 'No se pudo crear', detail: e?.message });
  }
});

app.get('/catalogs/municipalities', auth, async (req, res) => {
  const { q, limit } = req.query;
  let where = '1=1', params = [];

  if (q) {
    where = '(name LIKE ? OR dept LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  let sql = `SELECT id, dept, name FROM municipality WHERE ${where} ORDER BY dept, name`;

  if (limit && !isNaN(limit) && parseInt(limit, 10) > 0) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit, 10));
  }

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});




// ---------- Guardar reporte (actualiza solo agent y dailyreport) ----------
app.post('/reports', auth, requireRole('leader_unit', 'leader_group', 'superadmin', 'supervision'), async (req, res) => {
  const { reportDate, people = [] } = req.body;
  if (!reportDate) return res.status(422).json({ error:'FechaRequerida' });
  if (!Array.isArray(people) || !people.length) {
    return res.status(422).json({ error:'SinPersonas', detail:'Envía al menos un agente.' });
  }

  let groupId = req.user.groupId;
  let unitId = req.user.unitId;

  // Permitir que superadmin/supervision usen lo que viene en el body (si se envía)
  if (['superadmin','supervision'].includes(String(req.user.role))) {
    groupId = req.body.groupId || groupId;
    unitId = req.body.unitId || unitId;
  }

  // 1. Variables para los KPIs
  let feOF = 0, feSO = 0, fePT = 0, fdOF = 0, fdSO = 0, fdPT = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Consulta previa para obtener categorías y unidad de todos los agentes
    const codes = people.map(p => String(p.agentCode || '').toUpperCase().trim());
    const [agentsBD] = await conn.query(
      `SELECT id, code, category, unitId FROM agent WHERE code IN (${codes.map(_ => '?').join(',')})`,
      codes
    );
    const agentMap = {};
    for (const a of agentsBD) agentMap[a.code] = a;

    // ----------- BLOQUE PARA COPIAR NOVEDADES DEL REPORTE ANTERIOR -----------
    // Busca el último reporte anterior (no el actual)
    const [[prevReport]] = await conn.query(
  `SELECT id FROM dailyreport 
    WHERE groupId=? AND unitId=? AND reportDate<? 
    ORDER BY reportDate DESC 
    LIMIT 1`,
  [groupId, unitId, reportDate]
);

let prevNovedades = {};
if (prevReport) {
  // 👇 Nota: ahora traemos también 'novelty_description'
  const [prevRows] = await conn.query(
    `SELECT agentId, state, novelty_start, novelty_end, novelty_description
     FROM dailyreport_agent 
     WHERE reportId=?`,
    [prevReport.id]
  );
  const today = new Date(reportDate);
  for (const r of prevRows) {
    if (
      r.novelty_start &&
      (!r.novelty_end || new Date(r.novelty_end) >= today) &&
      ['VACACIONES','EXCUSA','PERMISO','COMISIÓN EN EL EXTERIOR'].includes(r.state)
    ) {
      prevNovedades[r.agentId] = {
        novelty_start: r.novelty_start,
        novelty_end: r.novelty_end,
        state: r.state,
        novelty_description: r.novelty_description // <<--- nuevo campo
      };
    }
  }
}

    // ----------- FIN BLOQUE COPIAR NOVEDADES -----------


const estadosValidos = [
  "SIN NOVEDAD",
  "SERVICIO",
  "COMISIÓN DEL SERVICIO",
  "FRANCO FRANCO",
  "VACACIONES",
  "LICENCIA DE MATERNIDAD",
  "LICENCIA DE LUTO",
  "LICENCIA REMUNERADA",
  "LICENCIA NO REMUNERADA",
  "EXCUSA DEL SERVICIO",
  "LICENCIA PATERNIDAD","PERMISO","COMISIÓN EN EL EXTERIOR"
];

for (const p of people) {
  const code = String(p.agentCode || '').toUpperCase().trim();
  const state = String(p.state || '').toUpperCase().trim();
  let muniId = p.municipalityId ? Number(p.municipalityId) : null;
  let novelty_start = p.novelty_start || null;
  let novelty_end = p.novelty_end || null;
  let novelty_description = p.novelty_description || null;

  const ag = agentMap[code];
  if (!ag) throw new Error(`No existe agente ${code}`);

  // FD solo si "SIN NOVEDAD"
  if (ag.category === 'OF') feOF++;
  if (ag.category === 'SO') feSO++;
  if (ag.category === 'PT') fePT++;
  if (state === 'SIN NOVEDAD') {
    if (ag.category === 'OF') fdOF++;
    if (ag.category === 'SO') fdSO++;
    if (ag.category === 'PT') fdPT++;
  }

  if (!estadosValidos.includes(state)) {
    throw new Error(`Estado inválido: ${state}`);
  }

  // SIN NOVEDAD: municipio Bogotá (id 11001), solo lectura, no pide nada más
  if (state === "SIN NOVEDAD") {
    muniId = 11001;
    novelty_start = null;
    novelty_end = null;
    novelty_description = null;
  }
  // SERVICIO: municipio Bogotá (id 11001), pide fechas y descripción
  else if (state === "SERVICIO") {
    muniId = 11001;
    if (!p.novelty_start) throw new Error(`Falta fecha de inicio para ${code} (SERVICIO)`);
    if (!p.novelty_end) throw new Error(`Falta fecha de fin para ${code} (SERVICIO)`);
    if (!p.novelty_description) throw new Error(`Falta descripción para ${code} (SERVICIO)`);
    novelty_start = p.novelty_start;
    novelty_end = p.novelty_end;
    novelty_description = p.novelty_description;
  }
  // COMISIÓN DEL SERVICIO: municipio requerido, NO fechas ni descripción
  else if (state === "COMISIÓN DEL SERVICIO") {
    if (!muniId) throw new Error(`Falta municipio para ${code} (COMISIÓN DEL SERVICIO)`);
    novelty_start = null;
    novelty_end = null;
    novelty_description = null;
  }
  // FRANCO FRANCO: no pide nada extra
  else if (state === "FRANCO FRANCO") {
    muniId = null;
    novelty_start = null;
    novelty_end = null;
    novelty_description = null;
  }
  // Otros: fecha inicio, fin, descripción requeridas, municipio null
  else {
    if (!p.novelty_start) throw new Error(`Falta fecha de inicio para ${code} (${state})`);
    if (!p.novelty_end) throw new Error(`Falta fecha de fin para ${code} (${state})`);
    if (!p.novelty_description) throw new Error(`Falta descripción para ${code} (${state})`);
    muniId = null;
    novelty_start = p.novelty_start;
    novelty_end = p.novelty_end;
    novelty_description = p.novelty_description;
  }

  // ---- Aquí puedes dejar la copia de fechas de reporte anterior, si aplica
    if (prevNovedades[ag.id] && state === prevNovedades[ag.id].state) {
      // Solo rellena si el campo está vacío y hay dato anterior:
      if (!novelty_start && prevNovedades[ag.id].novelty_start)
        novelty_start = prevNovedades[ag.id].novelty_start;
      if (!novelty_end && prevNovedades[ag.id].novelty_end)
        novelty_end = prevNovedades[ag.id].novelty_end;
      if (!novelty_description && prevNovedades[ag.id].novelty_description)
        novelty_description = prevNovedades[ag.id].novelty_description;
    }


  // Guarda lo que vas a insertar (puedes usar directamente o en el for siguiente)
  p._resolved = {
    state, muniId, novelty_start, novelty_end, novelty_description
  };
}

const { OF_nov, SO_nov, PT_nov } = computeNovelties({
  OF_effective: feOF,
  SO_effective: feSO,
  PT_effective: fePT,
  OF_available: fdOF,
  SO_available: fdSO,
  PT_available: fdPT
});

const leaderUserId = req.user.uid;
await conn.query(
  `
  INSERT INTO dailyreport
    (reportDate, groupId, unitId, leaderUserId,
    OF_effective, SO_effective, PT_effective,
    OF_available, SO_available, PT_available,
    OF_nov, SO_nov, PT_nov)
  VALUES
    (?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    leaderUserId=VALUES(leaderUserId),
    unitId=VALUES(unitId),
    OF_effective=VALUES(OF_effective), SO_effective=VALUES(SO_effective), PT_effective=VALUES(PT_effective),
    OF_available=VALUES(OF_available), SO_available=VALUES(SO_available), PT_available=VALUES(PT_available),
    OF_nov=VALUES(OF_nov), SO_nov=VALUES(SO_nov), PT_nov=VALUES(PT_nov),
    updatedAt=CURRENT_TIMESTAMP(3)
  `,
  [
    reportDate, groupId, unitId, leaderUserId,
    feOF, feSO, fePT,
    fdOF, fdSO, fdPT,
    OF_nov, SO_nov, PT_nov
  ]
);

const [[daily]] = await conn.query(
  `SELECT id FROM dailyreport WHERE reportDate=? AND groupId=? AND unitId=? LIMIT 1`,
  [reportDate, groupId, unitId]
);
const reportId = daily?.id;

await conn.query('DELETE FROM dailyreport_agent WHERE reportId=?', [reportId]);

for (const p of people) {
  const code = String(p.agentCode || '').toUpperCase().trim();
  const ag = agentMap[code];
  const { state, muniId, novelty_start, novelty_end, novelty_description } = p._resolved;

  await conn.query(
    `INSERT INTO dailyreport_agent 
      (reportId, agentId, groupId, unitId, state, municipalityId, novelty_start, novelty_end, novelty_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reportId,
      ag.id,
      groupId,
      ag.unitId,
      state,
      muniId,
      novelty_start,
      novelty_end,
      novelty_description
    ]
  );

  await conn.query(
    'UPDATE agent SET status=?, municipalityId=? WHERE id=?',
    [state, muniId, ag.id]
  );
}



   await conn.commit();
res.json({
  action: 'upserted',
  reportId,
  totals: { feOF, feSO, fePT, fdOF, fdSO, fdPT, OF_nov, SO_nov, PT_nov }
});

} catch (e) {
  await conn.rollback();
  console.error('POST /reports error', e);
  res.status(400).json({ error:'Cannot save report', detail: e?.message });
} finally {
  conn.release();
}
});

// ---------- Obtener reporte resumen por día ----------
app.get('/reports', auth, async (req, res) => {
  const { date, groupId, unitId } = req.query;
  let where = 'reportDate=?';
  const params = [date];
  if (groupId) { where += ' AND groupId=?'; params.push(groupId); }
  if (unitId) { where += ' AND unitId=?'; params.push(unitId); }
  const [rows] = await pool.query(
    `SELECT * FROM dailyreport WHERE ${where} ORDER BY reportDate`,
    params
  );
  res.json(rows);
});

// ---------- Listar agentes de mi grupo/unidad (con status/location actual) ----------
app.get('/group/agents', auth, requireRole('leader_group', 'leader_unit'), async (req, res) => {
  let where = '', params = [];
  if (req.user.role === 'leader_group') {
    where = 'groupId = ?';
    params = [req.user.groupId];
  } else if (req.user.role === 'leader_unit') {
    where = 'unitId = ?';
    params = [req.user.unitId];
  } else {
    return res.status(403).json({ error: 'No autorizado' });
  }
  const [rows] = await pool.query(
    `SELECT id, code, category, status, location FROM agent WHERE ${where} ORDER BY code`,
    params
  );
  res.json(rows);
});

// ---------- Dashboard y admin ----------
// ---------- Dashboard y admin ----------
app.get('/dashboard/reports', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  const { date_from, date_to, groupId, unitId } = req.query;
  const params = [];
  const where = [];

  if (req.user.role === 'leader_group') {
    where.push('r.groupId=?');
    params.push(req.user.groupId);
  } else {
    if (groupId) { where.push('r.groupId=?'); params.push(groupId); }
    if (unitId)  { where.push('r.unitId=?');  params.push(unitId);  }
  }

  if (date_from) { where.push('r.reportDate>=?'); params.push(date_from); }
  if (date_to)   { where.push('r.reportDate<=?'); params.push(date_to);   }

  const sql = `
    SELECT r.*, g.code AS groupCode, u.name AS unitName
    FROM dailyreport r
    JOIN \`group\` g ON g.id = r.groupId
    LEFT JOIN unit u ON u.id = r.unitId
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY r.reportDate DESC
  `;
  const [rows] = await pool.query(sql, params);

  const items = rows.map(r => ({
    id: r.id,
    // ✅ añadidos para que el frontend pueda navegar por grupo/unidad
    groupId: r.groupId,
    unitId:  r.unitId,

    date: (r.reportDate instanceof Date)
      ? r.reportDate.toISOString().slice(0,10)
      : String(r.reportDate).slice(0,10),

    groupCode: r.groupCode,
    unitName:  r.unitName || '',

    OF_effective: r.OF_effective, SO_effective: r.SO_effective, PT_effective: r.PT_effective,
    OF_available: r.OF_available, SO_available: r.SO_available, PT_available: r.PT_available,
    OF_nov: r.OF_nov, SO_nov: r.SO_nov, PT_nov: r.PT_nov,

    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    notes: r.notes || ''
  }));

  res.json({ items });
});






// ---------- Admin: grupos y usuarios ----------
// Obtener todos los grupos
app.get('/admin/groups', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  if (req.user.role === 'leader_group') {
    // Solo ve su grupo
    const [rows] = await pool.query('SELECT id, code, name FROM `group` WHERE id=? ORDER BY code', [req.user.groupId]);
    res.json(rows);
  } else {
    const [rows] = await pool.query('SELECT id, code, name FROM `group` ORDER BY code');
    res.json(rows);
  }
});


// Crear grupo
app.post('/admin/groups', auth, requireRole('superadmin'), async (req, res) => {
  const { code, name } = req.body;
  if (!code) return res.status(422).json({ error: 'Falta código' });
  try {
    await pool.query('INSERT INTO `group` (code, name) VALUES (?, ?)', [code, name]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'No se pudo crear', detail: e?.message });
  }
});

// Editar grupo
app.put('/admin/groups/:id', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  const { code, name } = req.body;
  try {
    await pool.query('UPDATE `group` SET code=?, name=? WHERE id=?', [code, name, id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'No se pudo editar', detail: e?.message });
  }
});

// Eliminar grupo
app.delete('/admin/groups/:id', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM `group` WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'No se pudo eliminar', detail: e?.message });
  }
});

// ---------- CRUD Usuarios Admin ----------

// Listar todos los usuarios
app.get('/admin/users', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const [rows] = await pool.query(`
    SELECT u.id, u.username, u.role, u.groupId, u.unitId, g.code AS groupCode, un.name AS unitName
    FROM user u
    LEFT JOIN \`group\` g ON g.id = u.groupId
    LEFT JOIN unit un ON un.id = u.unitId
    ORDER BY u.username
  `);
  res.json(rows);
});

// Crear usuario
app.post('/admin/users', auth, requireRole('superadmin'), async (req, res) => {
  const { username, password, role, groupId, unitId } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Campos requeridos: username, password, role' });
  }
  // Opcional: verifica que el grupo exista
  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  // Opcional: verifica que la unidad exista
  if (unitId) {
    const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
    if (!u) return res.status(404).json({ error: 'Unidad no existe' });
  }
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO `user` (username, passwordHash, role, groupId, unitId) VALUES (?, ?, ?, ?, ?)',
      [username.trim(), hash, role, groupId || null, unitId || null]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'El usuario ya existe' });
    } else {
      res.status(500).json({ error: 'No se pudo crear', detail: e.message });
    }
  }
});

// Actualizar usuario
app.put('/admin/users/:id', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  const { username, role, groupId, unitId, password } = req.body;
  if (!username || !role) {
    return res.status(400).json({ error: 'Campos requeridos: username, role' });
  }
  // Opcional: verifica que el grupo exista
  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  // Opcional: verifica que la unidad exista
  if (unitId) {
    const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
    if (!u) return res.status(404).json({ error: 'Unidad no existe' });
  }
  let setFields = 'username=?, role=?, groupId=?, unitId=?';
  let params = [username.trim(), role, groupId || null, unitId || null];
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    setFields += ', passwordHash=?';
    params.push(hash);
  }
  params.push(id);
  try {
    const [r] = await pool.query(
      `UPDATE \`user\` SET ${setFields} WHERE id=?`,
      params
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar', detail: e.message });
  }
});

// Eliminar usuario
app.delete('/admin/users/:id', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  try {
    const [r] = await pool.query('DELETE FROM `user` WHERE id=?', [id]);
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar', detail: e.message });
  }
});

// ---------- CRUD Agentes Admin ----------

// Listar todos los agentes (puedes agregar filtros con query params)
app.get('/admin/agents', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  try {
    const { q, code, category, groupId, unitId, limit = 100 } = req.query;
    let where = '1=1', params = [];
    if (code) { where += ' AND a.code=?'; params.push(String(code).toUpperCase().trim()); }
    else if (q) { where += ' AND a.code LIKE ?'; params.push(String(q).toUpperCase().trim() + '%'); }
    if (category) { where += ' AND a.category=?'; params.push(category); }
    if (groupId) { where += ' AND a.groupId=?'; params.push(Number(groupId)); }
    if (unitId) { where += ' AND a.unitId=?'; params.push(Number(unitId)); }
    const [rows] = await pool.query(
      `SELECT a.id, a.code, a.category, a.status, a.groupId, a.unitId, g.code AS groupCode, u.name AS unitName, a.municipalityId,
              m.name AS municipalityName, m.dept
         FROM agent a
         LEFT JOIN \`group\` g ON g.id = a.groupId
         LEFT JOIN unit u ON u.id = a.unitId
         LEFT JOIN municipality m ON a.municipalityId = m.id
        WHERE ${where}
        ORDER BY a.code
        LIMIT ?`,
      [...params, Math.min(parseInt(limit,10)||100, 500)]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'AgentListError', detail: e.message });
  }
});

// Crear agente
app.post('/admin/agents', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { code, category, groupId, unitId, status, municipalityId } = req.body;
  if (!/^[A-Z][0-9]+$/.test(code)) {
    return res.status(422).json({ error: 'Código inválido (LETRA + números)' });
  }
  if (!['OF','SO','PT'].includes(category)) {
    return res.status(422).json({ error: 'Categoría inválida' });
  }
  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  if (unitId) {
    const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
    if (!u) return res.status(404).json({ error: 'Unidad no existe' });
  }
  if (municipalityId) {
    const [[m]] = await pool.query('SELECT id FROM municipality WHERE id=? LIMIT 1', [municipalityId]);
    if (!m) return res.status(404).json({ error: 'Municipio no existe' });
  }
  try {
    await pool.query(
      'INSERT INTO agent (code,category,groupId,unitId,status,municipalityId) VALUES (?,?,?,?,?,?)',
      [code.trim(), category, groupId || null, unitId || null, status || 'LABORANDO', municipalityId || null]
    );
    res.json({ ok: true });

  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'El código ya existe' });
    } else {
      res.status(500).json({ error: 'No se pudo crear', detail: e.message });
    }
  }
});

// Actualizar agente (parcial)
app.put('/admin/agents/:id', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { id } = req.params;
  const { code, category, groupId, unitId, status, municipalityId } = req.body;

  const sets = [];
  const params = [];

  if (code !== undefined) {
    if (!/^[A-Z][0-9]+$/.test(String(code))) return res.status(422).json({ error:'Código inválido' });
    sets.push('code=?'); params.push(String(code).trim().toUpperCase());
  }
  if (category !== undefined) {
    if (!['OF','SO','PT'].includes(String(category))) return res.status(422).json({ error:'Categoría inválida' });
    sets.push('category=?'); params.push(category);
  }
  if (groupId !== undefined) {
    if (groupId) {
      const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
      if (!g) return res.status(404).json({ error:'Grupo no existe' });
    }
    sets.push('groupId=?'); params.push(groupId || null);
  }
  if (unitId !== undefined) {
    if (unitId) {
      const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
      if (!u) return res.status(404).json({ error:'Unidad no existe' });
    }
    sets.push('unitId=?'); params.push(unitId || null);
  }
  if (status !== undefined) {
    sets.push('status=?'); params.push(String(status));
  }
  if (municipalityId !== undefined) {
    if (municipalityId) {
      const [[m]] = await pool.query('SELECT id FROM municipality WHERE id=? LIMIT 1', [municipalityId]);
      if (!m) return res.status(404).json({ error:'Municipio no existe' });
    }
    sets.push('municipalityId=?'); params.push(municipalityId || null);
  }

  if (!sets.length) return res.status(400).json({ error:'Nada para actualizar' });

  try {
    params.push(id);
    const [r] = await pool.query(`UPDATE agent SET ${sets.join(', ')} WHERE id=?`, params);
    if (r.affectedRows === 0) return res.status(404).json({ error:'Agente no encontrado' });
    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ error:'No se pudo actualizar', detail:e.message });
  }
});


// Eliminar agente
app.delete('/admin/agents/:id', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { id } = req.params;
  try {
    const [r] = await pool.query('DELETE FROM agent WHERE id=?', [id]);
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar', detail: e.message });
  }
});



app.get('/debug/db', async (req, res) => {
  try {
    const [[g]] = await pool.query('SELECT COUNT(*) AS n FROM `group`');
    const [[u]] = await pool.query('SELECT COUNT(*) AS n FROM `user`');
    const [[a]] = await pool.query('SELECT COUNT(*) AS n FROM agent');
    const [[m]] = await pool.query('SELECT COUNT(*) AS n FROM municipality');
    const [[un]] = await pool.query('SELECT COUNT(*) AS n FROM unit');
    res.json({ ok:true, counts: { groups:g.n, users:u.n, agents:a.n, municipalities:m.n, units:un.n } });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// API para el mapa de municipios con agentes según reporte (date + checkpoint + groups/units)
app.get('/admin/agent-municipalities', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  const { date, groups, units } = req.query;
  if (!date) return res.status(400).json({ error:'Missing date' });

  let reportWhere = `reportDate=?`;
  let reportParams = [date];

  if (req.user.role === 'leader_group') {
    // Forzar solo su grupo
    reportWhere += ' AND groupId=?';
    reportParams.push(req.user.groupId);
  } else if (groups) {
    const groupIds = String(groups).split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
    if (groupIds.length) {
      reportWhere += ` AND groupId IN (${groupIds.map(_ => '?').join(',')})`;
      reportParams = [...reportParams, ...groupIds];
    }
  }
  if (units) {
    const unitIds = String(units).split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
    if (unitIds.length) {
      reportWhere += ` AND unitId IN (${unitIds.map(_ => '?').join(',')})`;
      reportParams = [...reportParams, ...unitIds];
    }
  }

  const [reports] = await pool.query(
    `SELECT id, groupId, unitId FROM dailyreport WHERE ${reportWhere}`,
    reportParams
  );
  if (!reports.length) return res.json([]);

  const reportIds = reports.map(r => r.id);
  let qMarks = reportIds.map(() => '?').join(',');
  const [rows] = await pool.query(`
    SELECT 
      m.id, m.name, m.dept, m.lat, m.lon, 
      da.groupId,
      g.code AS groupCode,
      da.unitId,
      u.name AS unitName,
      COUNT(da.agentId) AS agent_count
    FROM dailyreport_agent da
    JOIN municipality m ON m.id = da.municipalityId
    JOIN \`group\` g ON g.id = da.groupId
    LEFT JOIN unit u ON u.id = da.unitId
    WHERE da.reportId IN (${qMarks})
    GROUP BY m.id, da.groupId, da.unitId
  `, reportIds);

  res.json(rows);
});


app.get('/dashboard/compliance', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error:'Missing date' });

  if (req.user.role === 'leader_group') {
    // Solo cumplimiento de las unidades de SU grupo
    const [units] = await pool.query('SELECT id, name FROM unit WHERE groupId=?', [req.user.groupId]);
    const [reports] = await pool.query(
      'SELECT unitId FROM dailyreport WHERE reportDate=? AND groupId=?',
      [date, req.user.groupId]
    );
    const reported = new Set(reports.map(r => r.unitId));
    const done = [];
    const pending = [];
    for (const u of units) {
      (reported.has(u.id) ? done : pending).push({ unitName: u.name });
    }
    return res.json({ date, done, pending });
  }

  // Lógica original para superadmin/supervision:
  const [groups] = await pool.query('SELECT id,code FROM `group` ORDER BY code');
  const [reports] = await pool.query(
    'SELECT groupId FROM dailyreport WHERE reportDate=?',
    [date]
  );
  const reported = new Set(reports.map(r => r.groupId));
  const done = [];
  const pending = [];
  for (const g of groups) {
    (reported.has(g.id) ? done : pending).push({ groupCode: g.code });
  }
  res.json({ date, done, pending });
});



// ---------- Cron (solo logs) ----------
cron.schedule('16 6 * * *', () => console.log('⏰ Recordatorio 06:16'));
cron.schedule('45 6 * * *', () => console.log('⏳ Cierre ventana 06:45'));
cron.schedule('15 14 * * *', () => console.log('⏰ Recordatorio 14:15'));
cron.schedule('45 14 * * *', () => console.log('⏳ Cierre ventana 14:45'));

// Endpoint: Detalle de agentes por reporte
app.get('/admin/report-agents/:id', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {

  if (req.user.role === 'leader_group') {
    const [[report]] = await pool.query(
      'SELECT groupId FROM dailyreport WHERE id = ? LIMIT 1',
      [req.params.id]
    );
    if (!report || report.groupId !== req.user.groupId) {
      return res.status(403).json({ error: 'No autorizado a ver este reporte' });
    }
  }

  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing reportId' });

  const [rows] = await pool.query(`
    SELECT 
      a.id AS agentId,          -- 👈 NUEVO
      a.code, a.category,
      da.state,
      da.groupId, g.code AS groupCode,
      da.unitId, u.name AS unitName,
      m.name AS municipalityName, m.dept,
      DATE_FORMAT(da.novelty_start, '%Y-%m-%d') AS novelty_start,
      DATE_FORMAT(da.novelty_end,   '%Y-%m-%d') AS novelty_end,
      da.novelty_description
    FROM dailyreport_agent da
    JOIN agent a ON a.id = da.agentId
    LEFT JOIN \`group\` g ON g.id = da.groupId
    LEFT JOIN unit u ON u.id = da.unitId
    LEFT JOIN municipality m ON m.id = da.municipalityId
    WHERE da.reportId = ?
    ORDER BY FIELD(a.category, 'OF', 'SO', 'PT'), a.code
  `, [id]);

  res.json(rows);
});



// Endpoint: Editar estado/novedad de un agente en un reporte específico

app.put('/admin/report-agents/:reportId/:agentId',
  auth,
  requireRole('superadmin', 'supervision', 'leader_group'),
  async (req, res) => {
    const { reportId, agentId } = req.params;
    const { state, municipalityId, novelty_start, novelty_end, novelty_description } = req.body;

    if (!reportId || !agentId) return res.status(400).json({ error: 'Parámetros requeridos' });

    // Si es líder de grupo, solo puede editar reportes de SU grupo
    if (req.user.role === 'leader_group') {
      const [[rep]] = await pool.query('SELECT groupId FROM dailyreport WHERE id=? LIMIT 1', [reportId]);
      if (!rep || rep.groupId !== req.user.groupId) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    const estadosValidos = [
      "SIN NOVEDAD",
      "SERVICIO",
      "COMISIÓN DEL SERVICIO",
      "FRANCO FRANCO",
      "VACACIONES",
      "LICENCIA DE MATERNIDAD",
      "LICENCIA DE LUTO",
      "LICENCIA REMUNERADA",
      "LICENCIA NO REMUNERADA",
      "EXCUSA DEL SERVICIO",
      "LICENCIA PATERNIDAD",,"PERMISO","COMISIÓN EN EL EXTERIOR"
    ];
    const s = String(state || '').toUpperCase().trim();
    if (!estadosValidos.includes(s)) {
      return res.status(422).json({ error: 'Estado inválido' });
    }

    // Normalización/validación según estado
    let muniId = municipalityId ? Number(municipalityId) : null;
    let novStart = novelty_start || null;
    let novEnd   = novelty_end   || null;
    let novDesc  = novelty_description || null;

    if (s === 'SIN NOVEDAD') {
      muniId = 11001; novStart = null; novEnd = null; novDesc = null;
    } else if (s === 'SERVICIO') {
      muniId = 11001;
      if (!novStart) return res.status(422).json({ error: 'Falta fecha de inicio (SERVICIO)' });
      if (!novEnd)   return res.status(422).json({ error: 'Falta fecha de fin (SERVICIO)' });
      if (!novDesc)  return res.status(422).json({ error: 'Falta descripción (SERVICIO)' });
    } else if (s === 'COMISIÓN DEL SERVICIO') {
      if (!muniId) return res.status(422).json({ error: 'Falta municipio (COMISIÓN DEL SERVICIO)' });
      novStart = null; novEnd = null; novDesc = null;
    } else if (s === 'FRANCO FRANCO') {
      muniId = null; novStart = null; novEnd = null; novDesc = null;
    } else {
      // VACACIONES, LICENCIAS, EXCUSA, PATERNIDAD...
      if (!novStart) return res.status(422).json({ error: `Falta fecha de inicio (${s})` });
      if (!novEnd)   return res.status(422).json({ error: `Falta fecha de fin (${s})` });
      if (!novDesc)  return res.status(422).json({ error: `Falta descripción (${s})` });
      muniId = null;
    }

    // Verifica que exista la fila
    const [[exists]] = await pool.query(
      'SELECT 1 FROM dailyreport_agent WHERE reportId=? AND agentId=? LIMIT 1',
      [reportId, agentId]
    );
    if (!exists) return res.status(404).json({ error: 'Fila no encontrada' });

    // Actualiza dailyreport_agent y el agente
    await pool.query(`
      UPDATE dailyreport_agent
      SET state=?, municipalityId=?, novelty_start=?, novelty_end=?, novelty_description=?
      WHERE reportId=? AND agentId=?
    `, [s, muniId, novStart, novEnd, novDesc, reportId, agentId]);

    await pool.query(`
      UPDATE agent SET status=?, municipalityId=? WHERE id=?
    `, [s, muniId, agentId]);

    await recalcDailyReport(reportId);

    res.json({ ok: true });


  }
);



app.get('/me/profile', auth, async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT u.id, u.username, u.role, u.groupId, u.unitId, u.createdAt, g.code AS groupCode, un.name AS unitName
       FROM user u
       LEFT JOIN \`group\` g ON g.id = u.groupId
       LEFT JOIN unit un ON un.id = u.unitId
      WHERE u.id=? LIMIT 1`,
    [req.user.uid]
  );


  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
});

app.post('/me/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Campos requeridos' });

  const [[user]] = await pool.query(
    'SELECT passwordHash FROM user WHERE id=? LIMIT 1', [req.user.uid]
  );
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    'UPDATE user SET passwordHash=? WHERE id=?',
    [hash, req.user.uid]
  );
  res.json({ ok: true });
});


// Endpoint para el mapa con filtro de grupos y unidades
app.get('/admin/agent-municipalities', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  const { date, groups, units } = req.query;
  let reportWhere = `reportDate=?`;
  let reportParams = [date];

  if (req.user.role === 'leader_group') {
    // Busca todas sus unidades
    const [unitsBD] = await pool.query('SELECT id FROM unit WHERE groupId=?', [req.user.groupId]);
    const unitIds = unitsBD.map(u => u.id);
    if (!unitIds.length) return res.json([]);
    reportWhere += ` AND unitId IN (${unitIds.map(_ => '?').join(',')})`;
    reportParams.push(...unitIds);
  } else {
    if (groups) {
      const groupIds = String(groups)
        .split(',')
        .map(x => parseInt(x))
        .filter(x => !isNaN(x));
      if (groupIds.length) {
        reportWhere += ` AND groupId IN (${groupIds.map(_ => '?').join(',')})`;
        reportParams = [...reportParams, ...groupIds];
      }
    }
    if (units) {
      const unitIds = String(units)
        .split(',')
        .map(x => parseInt(x))
        .filter(x => !isNaN(x));
      if (unitIds.length) {
        reportWhere += ` AND unitId IN (${unitIds.map(_ => '?').join(',')})`;
        reportParams = [...reportParams, ...unitIds];
      }
    }
  }

  const [reports] = await pool.query(
    `SELECT id, groupId, unitId FROM dailyreport WHERE ${reportWhere}`,
    reportParams
  );
  if (!reports.length) return res.json([]);

  const reportIds = reports.map(r => r.id);
  let qMarks = reportIds.map(() => '?').join(',');
  const [rows] = await pool.query(`
    SELECT 
      m.id, m.name, m.dept, m.lat, m.lon, 
      da.groupId,
      g.code AS groupCode,
      da.unitId,
      u.name AS unitName,
      COUNT(da.agentId) AS agent_count
    FROM dailyreport_agent da
    JOIN municipality m ON m.id = da.municipalityId
    JOIN \`group\` g ON g.id = da.groupId
    LEFT JOIN unit u ON u.id = da.unitId
    WHERE da.reportId IN (${qMarks})
    GROUP BY m.id, da.groupId, da.unitId
  `, reportIds);

  res.json(rows);
});


// Listar agentes de un grupo que NO tienen unidad asignada
app.get('/admin/agents-no-unit', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  let groupId = req.query.groupId;

  // Si es líder de grupo, forzar groupId por su sesión
  if (req.user.role === 'leader_group') {
    groupId = req.user.groupId;
  }
  if (!groupId) return res.status(400).json({ error: 'Falta groupId' });

  try {
    const [rows] = await pool.query(
      `SELECT id, code, category, status FROM agent WHERE groupId = ? AND (unitId IS NULL OR unitId = 0) ORDER BY code`,
      [groupId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'AgentListNoUnitError', detail: e.message });
  }
});

// Para líder de grupo: cumplimiento de unidades de SU grupo
app.get('/dashboard/compliance-units', auth, requireRole('leader_group'), async (req, res) => {
  const { date, groupId } = req.query;
  const gid = groupId || req.user.groupId;

  // 1. Lista todas las unidades del grupo
  const [units] = await pool.query('SELECT id, name FROM unit WHERE groupId=?', [gid]);

  // 2. ¿Cuáles ya reportaron ese día?
  const [reports] = await pool.query(
    'SELECT unitId FROM dailyreport WHERE reportDate=? AND groupId=?',
    [date, gid]
  );
  const reported = new Set(reports.map(r => r.unitId));
  const done = [];
  const pending = [];
  for (const u of units) {
    (reported.has(u.id) ? done : pending).push({ unitName: u.name });
  }
  res.json({ date, done, pending });
});


// Descarga automatizada para alimentar el formato Excel
app.get('/reports/export', auth, requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit'), async (req, res) => {
  const { date, groupId, unitId } = req.query;
  if (!date) return res.status(400).json({ error: 'Falta la fecha' });

  let where = 'dr.reportDate = ?';
  let params = [date];

  // Filtro de roles
  if (req.user.role === 'leader_group') {
    where += ' AND dr.groupId = ?';
    params.push(req.user.groupId);
  } else if (groupId) {
    where += ' AND dr.groupId = ?';
    params.push(groupId);
  }
  if (req.user.role === 'leader_unit') {
    where += ' AND dr.unitId = ?';
    params.push(req.user.unitId);
  } else if (unitId) {
    where += ' AND dr.unitId = ?';
    params.push(unitId);
  }

  const [rows] = await pool.query(`
    SELECT 
      a.code AS codigo_agente,
      da.state AS novedad,
      da.novelty_description AS descripcion,
      DATE_FORMAT(da.novelty_start, '%Y-%m-%d') AS fecha_inicio,
      DATE_FORMAT(da.novelty_end, '%Y-%m-%d') AS fecha_fin,
      g.code AS grupo,
      u.name AS unidad,
      CONCAT(m.name, ' (', m.dept, ')') AS ubicacion
    FROM dailyreport dr
    JOIN dailyreport_agent da ON da.reportId = dr.id
    JOIN agent a ON a.id = da.agentId
    JOIN \`group\` g ON g.id = da.groupId
    LEFT JOIN unit u ON u.id = da.unitId
    LEFT JOIN municipality m ON m.id = da.municipalityId
    WHERE ${where}
    ORDER BY a.code
  `, params);

  res.json(rows);
});


// ===================== UNITS =====================

// --- Mi grupo (leader_group) -> SOLO LECTURA ---
app.get('/my/units', auth, requireRole('leader_group'), async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, description FROM unit WHERE groupId = ? ORDER BY name',
    [req.user.groupId]
  );
  res.json(rows);
});

// Bloquea creación/edición/eliminación para líder de grupo
app.post('/my/units', auth, requireRole('leader_group'), async (req, res) => {
  return res.status(403).json({ error: 'Forbidden', detail: 'No puede crear unidades. Solicite al superadmin.' });
});

app.put('/my/units/:id', auth, requireRole('leader_group'), async (req, res) => {
  return res.status(403).json({ error: 'Forbidden', detail: 'No puede editar unidades. Solicite al superadmin.' });
});

app.delete('/my/units/:id', auth, requireRole('leader_group'), async (req, res) => {
  return res.status(403).json({ error: 'Forbidden', detail: 'No puede eliminar unidades. Solicite al superadmin.' });
});


// --- Admin (superadmin/supervision) ---
// Listar todas (superadmin y supervision)
app.get('/admin/units', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.description, u.groupId,
            g.code AS groupCode, g.name AS groupName
       FROM unit u
       LEFT JOIN \`group\` g ON g.id = u.groupId
      ORDER BY g.code, u.name`
  );
  res.json(rows);
});

// Crear (solo superadmin)
app.post('/admin/units', auth, requireRole('superadmin'), async (req, res) => {
  const { name, description, groupId } = req.body;
  if (!name || !groupId) {
    return res.status(400).json({ error: 'Nombre y groupId requeridos' });
  }
  const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
  if (!g) return res.status(404).json({ error: 'Grupo no existe' });

  await pool.query(
    'INSERT INTO unit (name, description, groupId) VALUES (?, ?, ?)',
    [name.trim(), description || null, groupId]
  );
  res.json({ ok: true });
});

// Editar (solo superadmin)
app.put('/admin/units/:id', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  const { name, description, groupId } = req.body;

  if (!name || !groupId) {
    return res.status(400).json({ error: 'Nombre y groupId requeridos' });
  }
  const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
  if (!g) return res.status(404).json({ error: 'Grupo no existe' });

  const [r] = await pool.query(
    'UPDATE unit SET name=?, description=?, groupId=? WHERE id=?',
    [name.trim(), description || null, groupId, id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Unidad no encontrada' });
  res.json({ ok: true });
});

// Eliminar (solo superadmin)
app.delete('/admin/units/:id', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  const [r] = await pool.query('DELETE FROM unit WHERE id=?', [id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Unidad no encontrada' });
  res.json({ ok: true });
});





// Inicia el servidor

  // === EJEMPLO DE FINAL ===
  app.listen(process.env.PORT || 8080, () => {
    console.log('API on', process.env.PORT || 8080);
  });
}

main().catch(e => {
  console.error('Fallo crítico al iniciar el servidor:', e);
  process.exit(1);
});