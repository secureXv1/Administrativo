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
      `SELECT id, code, category, groupId, status, location
         FROM agent
        WHERE ${where}
     ORDER BY (groupId = 0) DESC, code
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
  const [rows] = await pool.query(
    'SELECT id, code, category, status, location FROM agent WHERE groupId = ? ORDER BY code',
    [groupId]
  );
  res.json(rows);
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

// Quitar un agente de mi grupo (dejarlo libre => groupId = 0)
app.post('/my/agents/remove', auth, async (req, res) => {
  if (String(req.user.role).toLowerCase() !== 'leader') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { agentId } = req.body;
  const groupId = req.user.groupId;
  const [r] = await pool.query(
    'UPDATE agent SET groupId = 0 WHERE id = ? AND groupId = ?',
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
  const { q, limit='100' } = req.query;
  const take = Math.min(parseInt(limit,10)||100, 200);
  let where = '1=1', params = [];
  if (q) { where = '(name LIKE ? OR dept LIKE ?)'; params.push(`%${q}%`,`%${q}%`); }
  const [rows] = await pool.query(`SELECT id,dept,name FROM municipality WHERE ${where} ORDER BY dept,name LIMIT ?`, [...params, take]);
  res.json(rows);
});

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

  // Sumar FE/FD/NOV solo para dailyreport
  let feOF=0, feSO=0, fePT=0, fdOF=0, fdSO=0, fdPT=0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const p of people) {
      const code = String(p.agentCode || '').toUpperCase().trim();
      const state = String(p.state || '').toUpperCase().trim();
      const muniId = p.municipalityId ? Number(p.municipalityId) : null;

      // Traer info de agente
      const [[ag]] = await conn.query(
        `SELECT id, code, category FROM agent WHERE code=?`, [code]
      );
      if (!ag) throw new Error(`No existe agente ${code}`);

      // Actualizar FE/FD (estadísticas)
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
      if (state === 'SERVICIO' && !muniId) {
        throw new Error(`Falta municipio para ${code}`);
      }

      // Ubicación
      let location = 'N/A';
      if (state === 'SERVICIO' && muniId) {
        const [[muni]] = await conn.query(
          'SELECT CONCAT(dept, " - ", name) AS label FROM municipality WHERE id=?', [muniId]
        );
        location = muni?.label || 'SERVICIO';
      }
      // Actualiza agent
      await conn.query(
        'UPDATE agent SET status=?, location=? WHERE id=?',
        [state, location, ag.id]
      );
    }

    // Guarda/actualiza dailyreport solo para KPIs
    const groupId = req.user.groupId;
    const leaderUserId = req.user.uid;
    const { OF_nov, SO_nov, PT_nov } = computeNovelties({
      OF_effective: feOF, SO_effective: feSO, PT_effective: fePT,
      OF_available: fdOF, SO_available: fdSO, PT_available: fdPT
    });

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

    await conn.commit();
    res.json({
      action: 'upserted',
      corte: label,
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
app.get('/admin/groups', auth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code, name FROM `group` ORDER BY code');
    res.json(rows);
  } catch (e) {
    console.error('/admin/groups error', e);
    res.status(500).json({ error:'GroupListError', detail:e.message });
  }
});

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
    console.error('/admin/users error', e);
    res.status(500).json({ error:'UserListError', detail:e.message });
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

// ---------- Cron (solo logs) ----------
cron.schedule('16 6 * * *', () => console.log('⏰ Recordatorio 06:16'));
cron.schedule('45 6 * * *', () => console.log('⏳ Cierre ventana 06:45'));
cron.schedule('15 14 * * *', () => console.log('⏰ Recordatorio 14:15'));
cron.schedule('45 14 * * *', () => console.log('⏳ Cierre ventana 14:45'));

app.listen(process.env.PORT || 8080, () => console.log('API on', process.env.PORT || 8080));
