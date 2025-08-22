import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import bcrypt from 'bcrypt';
import { pool } from './db.js';
import { getCorte, computeNovelties } from './utils.js';

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// ---------- Auth ----------
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query(
    'SELECT id, email, passwordHash, role, groupId FROM `user` WHERE email=? LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash).catch(() => false);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { uid: user.id, role: user.role, groupId: user.groupId },
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

function requireAdmin(req, res, next) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

app.get('/me', auth, (req, res) => {
  res.json({ uid: req.user.uid, role: req.user.role, groupId: req.user.groupId });
});

// ---------- Catálogos ----------
app.get('/catalogs/agents', auth, async (req, res) => {
  try {
    const { q, code, category, limit = 50 } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const params = [];
    let where = '1=1';

    if (category) { where += ' AND category=?'; params.push(String(category)); }
    if (code) { where += ' AND code=?'; params.push(String(code).toUpperCase().trim()); }
    else if (q) { where += ' AND code LIKE ?'; params.push(String(q).toUpperCase().trim() + '%'); }

    const [rows] = await pool.query(
      `SELECT 
          a.id, 
          a.code, 
          a.category, 
          a.groupId, 
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

// ===== Mis agentes (del líder) =====
app.get('/my/agents', auth, async (req, res) => {
  if (String(req.user.role).toLowerCase() !== 'leader') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const groupId = req.user.groupId;

  // Saca la fecha de hoy y corte actual (AM/PM)
  const now = new Date();
  const { canonical } = getCorte(now); // Ejemplo: "06:30" o "14:30"
  const reportDate = now.toISOString().slice(0, 10);

  // Busca el reporte actual de ese grupo
  const [[report]] = await pool.query(
    `SELECT id FROM dailyreport WHERE reportDate=? AND checkpointTime=TIME(?) AND groupId=? LIMIT 1`,
    [reportDate, canonical, groupId]
  );
  const reportId = report?.id || null;

  // Consulta los agentes + fechas de novedad del dailyreport_agent
  const [rows] = await pool.query(
    `SELECT 
        a.id, a.code, a.category, a.status, a.municipalityId,
        m.dept, m.name,
        da.novelty_start, da.novelty_end
      FROM agent a
      LEFT JOIN municipality m ON a.municipalityId = m.id
      LEFT JOIN dailyreport_agent da ON da.agentId = a.id AND da.reportId = ?
      WHERE a.groupId = ?
      ORDER BY a.code`,
    [reportId, groupId]
  );
  // Opcional: agrega el string completo para el frontend
  const withFullName = rows.map(r => ({
    ...r,
    municipalityName: r.municipalityId ? `${r.name} (${r.dept})` : ""
  }));
  res.json(withFullName);
});




// Asignar un agente libre (groupId = 0) a mi grupo
app.post('/my/agents/add', auth, async (req, res) => {
  if (String(req.user.role).toLowerCase() !== 'leader') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { agentId } = req.body;
  const groupId = req.user.groupId;
  const [r] = await pool.query(
    'UPDATE agent SET groupId = ? WHERE id = ? AND (groupId = 0 OR groupId IS NULL)',
    [groupId, agentId]
  );
  if (r.affectedRows === 0) {
    return res.status(409).json({ error: 'AgenteNoDisponible', detail: 'El agente no está libre (groupId ≠ 0)' });
  }
  res.json({ ok: true });
});

// Quitar un agente de mi grupo (dejarlo libre => )
app.post('/my/agents/remove', auth, async (req, res) => {
  if (String(req.user.role).toLowerCase() !== 'leader') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { agentId } = req.body;
  const groupId = req.user.groupId;
  const [r] = await pool.query(
    'UPDATE agent SET groupId = NULL WHERE id = ? AND groupId = ?',
    [agentId, groupId]
  );
  if (r.affectedRows === 0) {
    return res.status(404).json({ error: 'NoPertenece', detail: 'El agente no pertenece a tu grupo' });
  }
  res.json({ ok: true });
});

app.post('/adminapi/agents', auth, requireAdmin, async (req, res) => {
  const { code, category, groupId } = req.body;
  if (!/^[A-Z][0-9]+$/.test(code)) return res.status(422).json({ error: 'Código inválido (LETRA + números)' });
  if (!['OF','SO','PT'].includes(category)) return res.status(422).json({ error: 'Categoría inválida' });
  try {
    await pool.query('INSERT INTO agent (code,category,groupId) VALUES (?,?,?)', [code, category, groupId ?? null]);
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

  // Solo aplica LIMIT si viene en la query (y es numérico positivo)
  if (limit && !isNaN(limit) && parseInt(limit, 10) > 0) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit, 10));
  }

  const [rows] = await pool.query(sql, params);
  res.json(rows);
});


// ---------- Guardar reporte (actualiza solo agent y dailyreport) ----------
// ---------- Guardar reporte (actualiza solo agent y dailyreport) ----------
app.post('/reports', auth, async (req, res) => {
  const { reportDate, people = [] } = req.body;
  if (!reportDate) return res.status(422).json({ error:'FechaRequerida' });
  if (!Array.isArray(people) || !people.length) {
    return res.status(422).json({ error:'SinPersonas', detail:'Envía al menos un agente.' });
  }

  const now = new Date();
  const { label, canonical, inWindow } = getCorte(now);
  if (!inWindow) return res.status(422).json({ error:'FueraDeCorte', detail:'Solo AM (06–12:59) y PM (13–23:59).' });
  const checkpointTime = canonical;

  // 1. Variables para los KPIs
  let feOF = 0, feSO = 0, fePT = 0, fdOF = 0, fdSO = 0, fdPT = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 2. Consulta previa para obtener categorías de todos los agentes
    // (Esto es más eficiente si el reporte es grande)
    const codes = people.map(p => String(p.agentCode || '').toUpperCase().trim());
    const [agentsBD] = await conn.query(
      `SELECT id, code, category FROM agent WHERE code IN (${codes.map(_ => '?').join(',')})`,
      codes
    );
    // Crea un mapa {code: {id, category}}
    const agentMap = {};
    for (const a of agentsBD) agentMap[a.code] = a;

    // ----------- BLOQUE PARA COPIAR NOVEDADES DEL REPORTE ANTERIOR -----------
    const groupId = req.user.groupId;
    // Busca el último reporte anterior (no el actual)
    const [[prevReport]] = await conn.query(
      `SELECT id FROM dailyreport 
        WHERE groupId=? AND reportDate<=? 
          AND NOT (reportDate=? AND checkpointTime=TIME(?))
        ORDER BY reportDate DESC, checkpointTime DESC 
        LIMIT 1`,
      [groupId, reportDate, reportDate, checkpointTime]
    );
    // Trae novedades activas del anterior reporte (si existe)
    let prevNovedades = {};
    if (prevReport) {
      const [prevRows] = await conn.query(
        `SELECT agentId, state, novelty_start, novelty_end 
           FROM dailyreport_agent 
          WHERE reportId=?`,
        [prevReport.id]
      );
      const today = new Date(reportDate);
      for (const r of prevRows) {
        if (
          r.novelty_start &&
          (!r.novelty_end || new Date(r.novelty_end) >= today) &&
          ['VACACIONES','EXCUSA','PERMISO'].includes(r.state)
        ) {
          prevNovedades[r.agentId] = {
            novelty_start: r.novelty_start,
            novelty_end: r.novelty_end,
            state: r.state
          };
        }
      }
    }
    // ----------- FIN BLOQUE COPIAR NOVEDADES -----------

    // 3. Calcula KPIs y valida agentes
    for (const p of people) {
      const code = String(p.agentCode || '').toUpperCase().trim();
      const state = String(p.state || '').toUpperCase().trim();
      const muniId = p.municipalityId ? Number(p.municipalityId) : null;

      const ag = agentMap[code];
      if (!ag) throw new Error(`No existe agente ${code}`);

      // Sumar FE/FD/NOV según categoría
      if (ag.category === 'OF') feOF++;
      if (ag.category === 'SO') feSO++;
      if (ag.category === 'PT') fePT++;
      if (state === 'LABORANDO') {
        if (ag.category === 'OF') fdOF++;
        if (ag.category === 'SO') fdSO++;
        if (ag.category === 'PT') fdPT++;
      }

      // Validar estado
      if (!['LABORANDO','VACACIONES','EXCUSA','PERMISO','SERVICIO'].includes(state)) {
        throw new Error(`Estado inválido: ${state}`);
      }
      if ((state === 'SERVICIO' || state === 'LABORANDO') && !muniId) {
        throw new Error(`Falta municipio para ${code}`);
      }
    }

    // 4. Calcula Novedades
    const { OF_nov, SO_nov, PT_nov } = computeNovelties({
      OF_effective: feOF, SO_effective: feSO, PT_effective: fePT,
      OF_available: fdOF, SO_available: fdSO, PT_available: fdPT
    });

    // 5. Guarda/actualiza dailyreport (y obtén el id real)
    const leaderUserId = req.user.uid;
    await conn.query(
      `
      INSERT INTO dailyreport
        (reportDate, checkpointTime, groupId, leaderUserId,
         OF_effective, SO_effective, PT_effective,
         OF_available, SO_available, PT_available,
         OF_nov, SO_nov, PT_nov)
      VALUES
        (?, TIME(?), ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        leaderUserId=VALUES(leaderUserId),
        OF_effective=VALUES(OF_effective), SO_effective=VALUES(SO_effective), PT_effective=VALUES(PT_effective),
        OF_available=VALUES(OF_available), SO_available=VALUES(SO_available), PT_available=VALUES(PT_available),
        OF_nov=VALUES(OF_nov), SO_nov=VALUES(SO_nov), PT_nov=VALUES(PT_nov),
        updatedAt=CURRENT_TIMESTAMP(3)
      `,
      [
        reportDate, checkpointTime, groupId, leaderUserId,
        feOF, feSO, fePT,
        fdOF, fdSO, fdPT,
        OF_nov, SO_nov, PT_nov
      ]
    );

    const [[daily]] = await conn.query(
      `SELECT id FROM dailyreport WHERE reportDate=? AND checkpointTime=? AND groupId=? LIMIT 1`,
      [reportDate, checkpointTime, groupId]
    );
    const reportId = daily?.id;

    // 6. Limpia el detalle anterior de agentes para este reporte
    await conn.query('DELETE FROM dailyreport_agent WHERE reportId=?', [reportId]);

    // 7. Inserta todos los agentes de este reporte en dailyreport_agent + actualiza agent
    for (const p of people) {
      const code = String(p.agentCode || '').toUpperCase().trim();
      const state = String(p.state || '').toUpperCase().trim();
      const muniId = p.municipalityId ? Number(p.municipalityId) : null;

      const ag = agentMap[code];

      // --- Nuevo: copiar novedad activa si no se mandó nada ---
      let novelty_start = (state !== 'LABORANDO' && state !== 'SERVICIO') ? (p.novelty_start || null) : null;
      let novelty_end = (state !== 'LABORANDO' && state !== 'SERVICIO') ? (p.novelty_end || null) : null;
      // Si no se mandó ninguna novedad pero la hay en el anterior, la arrastramos (si el estado coincide)
      if (!novelty_start && !novelty_end && prevNovedades[ag.id] && (state === prevNovedades[ag.id].state)) {
        novelty_start = prevNovedades[ag.id].novelty_start;
        novelty_end = prevNovedades[ag.id].novelty_end;
      }

      // Guarda el detalle del agente para el reporte
      await conn.query(
        `INSERT INTO dailyreport_agent (reportId, agentId, state, municipalityId, novelty_start, novelty_end) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          reportId,
          ag.id,
          state,
          muniId,
          novelty_start,
          novelty_end
        ]
      );

      // Actualiza el estado y municipio del agente también
      await conn.query(
        'UPDATE agent SET status=?, municipalityId=? WHERE id=?',
        [state, muniId, ag.id]
      );
    }

    await conn.commit();
    res.json({
      action: 'upserted',
      corte: label,
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
  const { date } = req.query;
  let where = 'reportDate=?';
  const params = [date];
  if (req.user.role === 'leader') { where += ' AND groupId=?'; params.push(req.user.groupId); }
  const [rows] = await pool.query(
    `SELECT * FROM dailyreport WHERE ${where} ORDER BY checkpointTime`,
    params
  );
  res.json(rows);
});

// ---------- Listar agentes de mi grupo (con status/location actual) ----------
app.get('/group/agents', auth, async (req, res) => {
  if (!req.user.groupId) return res.status(400).json({ error: 'Sin grupo asignado' });
  const [rows] = await pool.query(
    'SELECT id, code, category, status, location FROM agent WHERE groupId = ? ORDER BY code',
    [req.user.groupId]
  );
  res.json(rows);
});

// ---------- Dashboard y admin ----------
app.get('/dashboard/reports', auth, requireAdmin, async (req, res) => {
  const { date_from, date_to, checkpoint } = req.query;
  const params = [];
  const where = [];

  if (date_from) { where.push('r.reportDate>=?'); params.push(date_from); }
  if (date_to)   { where.push('r.reportDate<=?'); params.push(date_to); }
  if (checkpoint === 'AM') where.push('r.checkpointTime BETWEEN TIME("06:00") AND TIME("12:59:59")');
  if (checkpoint === 'PM') where.push('r.checkpointTime BETWEEN TIME("13:00") AND TIME("23:59:59")');

  const sql = `
    SELECT r.*, g.code AS groupCode
      FROM dailyreport r
      JOIN \`group\` g ON g.id = r.groupId
     ${where.length ? 'WHERE '+where.join(' AND ') : ''}
     ORDER BY r.reportDate DESC, r.checkpointTime DESC
  `;
  const [rows] = await pool.query(sql, params);

  const items = rows.map(r => {
    const dateStr = (r.reportDate instanceof Date)
      ? r.reportDate.toISOString().slice(0,10)
      : String(r.reportDate).slice(0,10);

    let cp = r.checkpointTime;
    const hhmm = (typeof cp === 'string')
      ? cp.slice(0,5)
      : (cp instanceof Date ? cp.toISOString().slice(11,16) : String(cp).slice(0,5));

    const updated = (r.updatedAt instanceof Date)
      ? r.updatedAt.toISOString()
      : new Date(r.updatedAt).toISOString();

    return {
      id: r.id,
      date: dateStr,
      checkpoint: hhmm,
      groupCode: r.groupCode,
      OF_effective: r.OF_effective, SO_effective: r.SO_effective, PT_effective: r.PT_effective,
      OF_available: r.OF_available, SO_available: r.SO_available, PT_available: r.PT_available,
      OF_nov: r.OF_nov, SO_nov: r.SO_nov, PT_nov: r.PT_nov,
      updatedAt: updated,
      notes: r.notes || ''
    };
  });

  res.json({ items });
});

// ---------- Admin: grupos y usuarios ----------
// Obtener todos los grupos
app.get('/admin/groups', auth, requireAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT id, code, name FROM `group` ORDER BY code');
  res.json(rows);
});

// Crear grupo
app.post('/admin/groups', auth, requireAdmin, async (req, res) => {
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
app.put('/admin/groups/:id', auth, requireAdmin, async (req, res) => {
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
app.delete('/admin/groups/:id', auth, requireAdmin, async (req, res) => {
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
app.get('/admin/users', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.email, u.role, u.groupId, g.code AS groupCode
      FROM \`user\` u
      LEFT JOIN \`group\` g ON g.id = u.groupId
      ORDER BY u.email
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'UserListError', detail: e.message });
  }
});

// Crear usuario
app.post('/admin/users', auth, requireAdmin, async (req, res) => {
  const { email, password, role, groupId } = req.body;
  if (!email || !password || !role || !groupId) {
    return res.status(400).json({ error: 'Campos requeridos: email, password, role, groupId' });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!['admin','leader','viewer'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  // Opcional: verifica que el grupo exista
  const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
  if (!g) return res.status(404).json({ error: 'Grupo no existe' });

  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO `user` (email, passwordHash, role, groupId) VALUES (?, ?, ?, ?)',
      [email.trim(), hash, role, groupId]
    );
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'El email ya existe' });
    } else {
      res.status(500).json({ error: 'No se pudo crear', detail: e.message });
    }
  }
});

// Actualizar usuario
app.put('/admin/users/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { email, role, groupId, password } = req.body;
  if (!email || !role || !groupId) {
    return res.status(400).json({ error: 'Campos requeridos: email, role, groupId' });
  }
  // Opcional: verifica que el grupo exista
  const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
  if (!g) return res.status(404).json({ error: 'Grupo no existe' });

  let setFields = 'email=?, role=?, groupId=?';
  let params = [email.trim(), role, groupId];
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
app.delete('/admin/users/:id', auth, requireAdmin, async (req, res) => {
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
app.get('/admin/agents', auth, requireAdmin, async (req, res) => {
  try {
    const { q, code, category, groupId, limit = 100 } = req.query;
    let where = '1=1', params = [];
    if (code) { where += ' AND a.code=?'; params.push(String(code).toUpperCase().trim()); }
    else if (q) { where += ' AND a.code LIKE ?'; params.push(String(q).toUpperCase().trim() + '%'); }
    if (category) { where += ' AND a.category=?'; params.push(category); }
    if (groupId) { where += ' AND a.groupId=?'; params.push(Number(groupId)); }
    const [rows] = await pool.query(
      `SELECT a.id, a.code, a.category, a.status, a.groupId, g.code AS groupCode, a.municipalityId,
              m.name AS municipalityName, m.dept
         FROM agent a
         LEFT JOIN \`group\` g ON g.id = a.groupId
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
app.post('/admin/agents', auth, requireAdmin, async (req, res) => {
  const { code, category, groupId, status, municipalityId } = req.body;
  if (!/^[A-Z][0-9]+$/.test(code)) {
    return res.status(422).json({ error: 'Código inválido (LETRA + números)' });
  }
  if (!['OF','SO','PT'].includes(category)) {
    return res.status(422).json({ error: 'Categoría inválida' });
  }
  // Opcional: verifica que grupo y municipio existan
  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  if (municipalityId) {
    const [[m]] = await pool.query('SELECT id FROM municipality WHERE id=? LIMIT 1', [municipalityId]);
    if (!m) return res.status(404).json({ error: 'Municipio no existe' });
  }
  try {
    await pool.query(
      'INSERT INTO agent (code,category,groupId,status,municipalityId) VALUES (?,?,?,?,?)',
      [code.trim(), category, groupId || null, status || 'LABORANDO', municipalityId || null]
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

// Actualizar agente
app.put('/admin/agents/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { code, category, groupId, status, municipalityId } = req.body;
  if (!code || !category) {
    return res.status(400).json({ error: 'Campos requeridos: code, category' });
  }
  // Validar código y categoría
  if (!/^[A-Z][0-9]+$/.test(code)) {
    return res.status(422).json({ error: 'Código inválido' });
  }
  if (!['OF','SO','PT'].includes(category)) {
    return res.status(422).json({ error: 'Categoría inválida' });
  }
  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  if (municipalityId) {
    const [[m]] = await pool.query('SELECT id FROM municipality WHERE id=? LIMIT 1', [municipalityId]);
    if (!m) return res.status(404).json({ error: 'Municipio no existe' });
  }
  try {
    const [r] = await pool.query(
      `UPDATE agent SET code=?, category=?, groupId=?, status=?, municipalityId=? WHERE id=?`,
      [code.trim(), category, groupId || null, status || 'LABORANDO', municipalityId || null, id]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar', detail: e.message });
  }
});

// Eliminar agente
app.delete('/admin/agents/:id', auth, requireAdmin, async (req, res) => {
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
    res.json({ ok:true, counts: { groups:g.n, users:u.n, agents:a.n, municipalities:m.n } });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
});

// API para el mapa de municipios con agentes según reporte (date + checkpoint)
app.get('/admin/agent-municipalities', auth, requireAdmin, async (req, res) => {
  const { date, checkpoint } = req.query;
  if (!date || !checkpoint) return res.status(400).json({ error:'Missing date or checkpoint' });

  // Determina la hora canonical de checkpoint
  const canonical = checkpoint === 'AM' ? '06:30' : '14:30';

  // Busca TODOS los reportes (uno por grupo) para ese día/corte
  const [reports] = await pool.query(
    `SELECT id FROM dailyreport WHERE reportDate=? AND checkpointTime=TIME(?)`,
    [date, canonical]
  );
  if (!reports.length) return res.json([]);

  const reportIds = reports.map(r => r.id);

  let qMarks = reportIds.map(() => '?').join(','); // (?, ?, ...)
  const [rows] = await pool.query(`
    SELECT m.id, m.name, m.dept, m.lat, m.lon, COUNT(da.agentId) AS agent_count
      FROM dailyreport_agent da
      JOIN municipality m ON m.id = da.municipalityId
    WHERE da.reportId IN (${qMarks})
    GROUP BY m.id
  `, reportIds);

  res.json(rows);
});

app.get('/dashboard/compliance', auth, requireAdmin, async (req, res) => {
  const { date, checkpoint } = req.query;
  if (!date || !checkpoint) return res.status(400).json({ error:'Missing date or checkpoint' });

  const canonical = checkpoint === 'AM' ? '06:30' : '14:30';

  // Todos los grupos
  const [groups] = await pool.query('SELECT id,code FROM `group` ORDER BY code');

  // Reportes que existen para ese corte
  const [reports] = await pool.query(
    'SELECT groupId FROM dailyreport WHERE reportDate=? AND checkpointTime=TIME(?)',
    [date, canonical]
  );
  const reported = new Set(reports.map(r => r.groupId));

  const done = [];
  const pending = [];
  for (const g of groups) {
    (reported.has(g.id) ? done : pending).push({ groupCode: g.code });
  }
  res.json({ date, checkpoint, done, pending });
});

// ---------- Cron (solo logs) ----------
cron.schedule('16 6 * * *', () => console.log('⏰ Recordatorio 06:16'));
cron.schedule('45 6 * * *', () => console.log('⏳ Cierre ventana 06:45'));
cron.schedule('15 14 * * *', () => console.log('⏰ Recordatorio 14:15'));
cron.schedule('45 14 * * *', () => console.log('⏳ Cierre ventana 14:45'));


// Endpoint: Detalle de agentes por reporte
app.get('/admin/report-agents/:id', auth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing reportId' });

  const [rows] = await pool.query(`
    SELECT 
      a.code, a.category,
      da.state,
      m.name AS municipalityName, m.dept,
      DATE_FORMAT(da.novelty_start, '%Y-%m-%d') AS novelty_start,
      DATE_FORMAT(da.novelty_end, '%Y-%m-%d') AS novelty_end
    FROM dailyreport_agent da
    JOIN agent a ON a.id = da.agentId
    LEFT JOIN municipality m ON m.id = da.municipalityId
    WHERE da.reportId = ?
    ORDER BY a.code
  `, [id]);

  res.json(rows);
});

app.get('/me/profile', auth, async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT u.id, u.email, u.role, u.groupId, u.createdAt, g.code AS groupCode
       FROM user u
       LEFT JOIN \`group\` g ON g.id = u.groupId
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






app.listen(process.env.PORT || 8080, () => console.log('API on', process.env.PORT || 8080));




