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
import { logEvent, Actions } from './audit.js';
import { requireSuperadmin } from './middlewares.js';




// === Helpers de cifrado robustos (no lanzan) ===
import crypto from 'crypto';

// === Zona horaria del proceso Node: Colombia ===
process.env.TZ = 'America/Bogota';

const ENC_KEY_B64 = process.env.NOVELTY_ENC_KEY || '';
const ENC_KEY = Buffer.from(ENC_KEY_B64, 'base64');

if (ENC_KEY.length !== 32) {
  console.warn('[WARN] NOVELTY_ENC_KEY inválida o ausente. AES-256-GCM requiere 32 bytes base64.');
  // No hacemos throw para no tumbar la API en dev; pero idealmente valida esto al arrancar.
}

export function encNullable(plain) {
  if (!plain) return null;
  if (ENC_KEY.length !== 32) {
    // Fallback: si no hay clave válida, guarda en claro (mejor que fallar).
    return String(plain);
  }
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
    const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Formato: [12 iv][16 tag][ct] → base64
    return Buffer.concat([iv, tag, ct]).toString('base64');
  } catch {
    // Si algo raro pasa, devuelve en claro para no romper flujos.
    return String(plain);
  }
}

export function decNullable(maybeB64) {
  if (maybeB64 == null || maybeB64 === '') return null;
  // Si no hay clave válida, no intentes descifrar
  if (ENC_KEY.length !== 32) return String(maybeB64);

  try {
    const raw = Buffer.from(String(maybeB64), 'base64');
    // Debe tener al menos 12 (iv) + 16 (tag) + 1 (ct) = 29 bytes; usamos 28 como mínimo estricto (sin ct).
    if (raw.length < 28) {
      // No es nuestro formato → devolver tal cual (texto plano o base64 ajeno)
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
    // Si falla (no es nuestro ciphertext / clave no corresponde / datos corruptos), regresamos el original.
    return String(maybeB64);
  }
}

// === NOVEDADES: catálogo y normalizador ===
export const VALID_STATES = new Set([
  'SIN NOVEDAD','SERVICIO','COMISIÓN DEL SERVICIO','FRANCO FRANCO',
  'VACACIONES','LICENCIA DE MATERNIDAD','LICENCIA DE LUTO',
  'LICENCIA REMUNERADA','LICENCIA NO REMUNERADA','EXCUSA DEL SERVICIO',
  'LICENCIA PATERNIDAD','PERMISO','COMISIÓN EN EL EXTERIOR','COMISIÓN DE ESTUDIO',
 
  'SUSPENDIDO','HOSPITALIZADO'
]);

export function isValidState(s) {
  return VALID_STATES.has(String(s || '').toUpperCase().trim());
}





// === INICIALIZACIÓN SEGURA DE LA DB ===
async function main() {
  // Llama initDb SOLO si existe, y SOLO una vez
  if (typeof initDb === 'function') {
    await initDb();
  }


   


  const app = express();
  app.use(cors());
  app.use(helmet());
  app.use(express.json());

  function isStrongPassword(pw) {
  // >=8, al menos 1 minúscula, 1 mayúscula, 1 dígito y 1 especial
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(String(pw || ''));
}



// ---------- AUTH ----------
app.post('/auth/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const [rows] = await pool.query(
      `SELECT id, username, passwordHash, role, groupId, unitId,
              failed_login_count, lock_until, lock_strikes, hard_locked
         FROM \`user\`
        WHERE username=? LIMIT 1`,
      [username]
    );
    const user = rows[0];

   

    if (!user) {
      // No revelamos existencia del usuario
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Hard lock activo
    if (Number(user.hard_locked) === 1) {
      return res.status(423).json({ error: 'HardLocked', detail: 'Cuenta bloqueada. Contacte al administrador.' });
    }

    // Bloqueo temporal vigente
    const now = new Date();
    const lockUntil = user.lock_until ? new Date(user.lock_until) : null;
    if (lockUntil && lockUntil > now) {
      const secondsLeft = Math.max(1, Math.ceil((lockUntil - now) / 1000));
      return res.status(429).json({
        error: 'TemporarilyLocked',
        detail: `Cuenta bloqueada temporalmente. Intente nuevamente en ${secondsLeft} s.`
      });
    }

    // Verificación de password
    const ok = await bcrypt.compare(password, user.passwordHash).catch(() => false);

    if (!ok) {
      let newFailed = Number(user.failed_login_count || 0) + 1;

      // ¿alcanza 5 fallos? → BLOQUEO TEMPORAL (esto sí se registra)
      if (newFailed >= 5) {
        const until = new Date(Date.now() + 60 * 1000);
        await pool.query(
          'UPDATE `user` SET failed_login_count=0, lock_until=?, lock_strikes=lock_strikes+1 WHERE id=? LIMIT 1',
          [until, user.id]
        );

        try {
          await logEvent({
            req, userId: user.id,
            action: Actions.ACCOUNT_LOCK,
            details: { username, reason: '5_failed_attempts', lock_until: until.toISOString() }
          });
        } catch {}

        return res.status(429).json({
          error: 'TemporarilyLocked',
          detail: 'Cuenta bloqueada por 1 minuto por múltiples intentos fallidos.'
        });
      }

      // Si ya tuvo un lock (strike>=1) y ahora falla tras el cooldown → HARD LOCK
      if (Number(user.lock_strikes || 0) >= 1) {
        await pool.query(
          'UPDATE `user` SET failed_login_count=0, hard_locked=1, lock_until=NULL WHERE id=? LIMIT 1',
          [user.id]
        );

        try {
          await logEvent({
            req, userId: user.id,
            action: Actions.ACCOUNT_HARD_LOCK,
            details: { username, reason: 'fail_after_cooldown' }
          });
        } catch {}

        return res.status(423).json({ error: 'HardLocked', detail: 'Cuenta bloqueada. Contacte al administrador.' });
      }

      // ❗ Fallo normal (<5): solo actualiza contador y responde con remaining (SIN log)
      await pool.query('UPDATE `user` SET failed_login_count=? WHERE id=? LIMIT 1', [newFailed, user.id]);
      const remaining = Math.max(0, 5 - newFailed);
      // Opcional: header con el mismo dato
      // res.set('X-Login-Attempts-Remaining', String(remaining));
      return res.status(401).json({
        error: 'Invalid credentials',
        remaining,
        detail: `Credenciales inválidas. Intentos restantes: ${remaining}/5`
      });
    }

    // Login OK → reset de contadores/bloqueos
    await pool.query(
      'UPDATE `user` SET failed_login_count=0, lock_until=NULL, lock_strikes=0 WHERE id=? LIMIT 1',
      [user.id]
    );

    try {
      await logEvent({
        req,
        userId: user.id,
        action: Actions.LOGIN,
        details: { username: user.username, role: user.role }
      });
    } catch {}

    const token = jwt.sign(
      { uid: user.id, username: user.username, role: user.role, groupId: user.groupId, unitId: user.unitId },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ token });
  } catch (err) {
    console.error('LOGIN error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
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

// Cambiar contraseña del usuario autenticado
  app.post('/me/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Campos requeridos' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(422).json({
      error: 'Password débil',
      detail: 'Debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y carácter especial.'
    });
  }

  const [[user]] = await pool.query(
    'SELECT passwordHash FROM user WHERE id=? LIMIT 1', [req.user.uid]
  );
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE user SET passwordHash=? WHERE id=?', [hash, req.user.uid]);

  await logEvent({
    req, userId: req.user.uid,
    action: Actions.USER_PASSWORD_CHANGE,
    details: { targetUserId: req.user.uid, by: 'self' }
  });

  res.json({ ok: true });
});


app.get('/catalogs/agents', auth, async (req, res) => {
  try {
    const { q, code, category, groupId, unitId, limit = 50 } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const params = [];
    let where = '1=1';

    if (category) { where += ' AND a.category=?'; params.push(String(category)); }
    if (groupId)  { where += ' AND a.groupId=?';  params.push(Number(groupId)); }
    if (unitId)   { where += ' AND a.unitId=?';   params.push(Number(unitId)); }
    if (code)     { where += ' AND a.code=?';     params.push(String(code).toUpperCase().trim()); }
    else if (q)   { where += ' AND a.code LIKE ?';params.push(String(q).toUpperCase().trim() + '%'); }

    const [rows] = await pool.query(
      `SELECT
         a.id,
         a.code,
         a.category,
         a.groupId,
         a.unitId,
         a.status,
         a.municipalityId,

         -- unidad (solo name para evitar columnas inexistentes)
         u.name AS unitName,

         -- grupo
         g.code AS groupCode,

         -- municipio (renombrado para no chocar con "name")
         m.dept AS muniDept,
         m.name AS muniName
       FROM agent a
       LEFT JOIN unit u ON u.id = a.unitId
       LEFT JOIN \`group\` g ON g.id = a.groupId
       LEFT JOIN municipality m ON m.id = a.municipalityId
       WHERE ${where}
       ORDER BY a.code
       LIMIT ?`,
      [...params, take]
    );

    res.json(rows);
  } catch (e) {
    console.error('GET /catalogs/agents error:', e); // <— mira la consola del servidor
    res.status(500).json({ error: 'CatalogError', detail: e.message });
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
    SELECT DISTINCT
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
    novelty_description: r.novelty_description ? decNullable(r.novelty_description) : ''
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




// Cambiar/liberar unidad de un agente (líder de grupo o líder de unidad)
app.put('/my/agents/:id/unit',
  auth,
  requireRole('leader_group', 'leader_unit'),
  async (req, res) => {
    const { id } = req.params;
    const { unitId } = req.body;

    // Traer agente
    const [[ag]] = await pool.query(
      'SELECT id, groupId, unitId FROM agent WHERE id=? LIMIT 1', [id]
    );
    if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });

    const role = String(req.user.role).toLowerCase();

    if (role === 'leader_group') {
      // Debe pertenecer a su grupo
      if (ag.groupId !== req.user.groupId) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      // Si envían unitId, debe existir y pertenecer a su grupo
      if (unitId) {
        const [[u]] = await pool.query(
          'SELECT id FROM unit WHERE id=? AND groupId=? LIMIT 1',
          [unitId, req.user.groupId]
        );
        if (!u) return res.status(404).json({ error: 'Unidad no existe en su grupo' });
      }
      await pool.query('UPDATE agent SET unitId=? WHERE id=?', [unitId || null, id]);
      return res.json({ ok: true });
    }

    // role === 'leader_unit'
    // Solo puede LIBERAR (unitId=null) agentes que estén en SU unidad
    if (unitId !== null && unitId !== undefined) {
      return res.status(403).json({ error: 'Solo puede liberar (unitId=null)' });
    }
    if (ag.unitId !== req.user.unitId) {
      return res.status(403).json({ error: 'Agente no pertenece a su unidad' });
    }
    await pool.query('UPDATE agent SET unitId=NULL WHERE id=?', [id]);
    return res.json({ ok: true });
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









// PUT: guardar/actualizar novedad de un agente en una fecha específica
app.put('/admin/agents/:id/novelty',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    const { id } = req.params;
    const {
      date,
      state,
      municipalityId,
      novelty_start,
      novelty_end,
      novelty_description
    } = req.body;

    try {
      if (!date)  return res.status(422).json({ error: 'Falta date' });
      if (!state) return res.status(422).json({ error: 'Falta state' });

      const isoDate = String(date).slice(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return res.status(422).json({ error: 'Formato inválido de date (YYYY-MM-DD)' });
      }

      const [[ag]] = await pool.query(
        'SELECT id, groupId, unitId FROM agent WHERE id=? LIMIT 1',
        [id]
      );
      if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });

      if (String(req.user.role).toLowerCase() === 'leader_group' && ag.groupId !== req.user.groupId) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const s = String(state || '').toUpperCase().trim();
      if (!isValidState(s)) {
        return res.status(422).json({ error: 'Estado inválido' });
      }

      let muniId  = municipalityId ? Number(municipalityId) : null;
      let nStart  = novelty_start || null;
      let nEnd    = novelty_end   || null;
      let nDesc   = (novelty_description || '').trim() || null;

      if (s === 'SIN NOVEDAD') {
        muniId = 11001; nStart = null; nEnd = null; nDesc = null;
      } else if (s === 'SERVICIO') {
        muniId = 11001;
        if (!nStart) return res.status(422).json({ error: 'Falta fecha inicio (SERVICIO)' });
        if (!nEnd)   return res.status(422).json({ error: 'Falta fecha fin (SERVICIO)' });
        if (!nDesc)  return res.status(422).json({ error: 'Falta descripción (SERVICIO)' });
      } else if (s === 'COMISIÓN DEL SERVICIO') {
        if (!muniId) return res.status(422).json({ error: 'Falta municipio (COMISIÓN DEL SERVICIO)' });
        if (!nDesc)  return res.status(422).json({ error: 'Falta descripción (COMISIÓN DEL SERVICIO)' });
        nStart = null; nEnd = null;
      } else if (s === 'FRANCO FRANCO') {
        muniId = null; nStart = null; nEnd = null; nDesc = null;
      } else if (s === 'SUSPENDIDO') {
        muniId = null;
        if (!nStart) return res.status(422).json({ error: 'Falta fecha inicio (SUSPENDIDO)' });
        if (!nEnd)   return res.status(422).json({ error: 'Falta fecha fin (SUSPENDIDO)' });
        if (!nDesc)  return res.status(422).json({ error: 'Falta descripción (SUSPENDIDO)' });
      } else if (s === 'HOSPITALIZADO') {
        muniId = null;
        if (!nStart) return res.status(422).json({ error: 'Falta fecha inicio (HOSPITALIZADO)' });
        if (!nDesc)  return res.status(422).json({ error: 'Falta descripción (HOSPITALIZADO)' });
        nEnd = null;
      } else {
        if (!nStart) return res.status(422).json({ error: `Falta fecha inicio (${s})` });
        if (!nEnd)   return res.status(422).json({ error: `Falta fecha fin (${s})` });
        if (!nDesc)  return res.status(422).json({ error: `Falta descripción (${s})` });
        muniId = null;
      }

      if (nStart && nEnd) {
        const startOk = /^\d{4}-\d{2}-\d{2}$/.test(String(nStart).slice(0,10));
        const endOk   = /^\d{4}-\d{2}-\d{2}$/.test(String(nEnd).slice(0,10));
        if (!startOk || !endOk) {
          return res.status(422).json({ error: 'Formato inválido de fechas (YYYY-MM-DD)' });
        }
        if (new Date(nEnd) < new Date(nStart)) {
          return res.status(422).json({ error: 'La fecha fin no puede ser menor a la fecha inicio' });
        }
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [[exist]] = await conn.query(`
          SELECT dr.id AS reportId, dr.groupId, dr.unitId
            FROM dailyreport_agent da
            JOIN dailyreport dr ON dr.id = da.reportId
           WHERE da.agentId=? AND dr.reportDate=? 
           LIMIT 1
        `, [ag.id, isoDate]);

        let reportId, useGroupId, useUnitId;
        if (exist) {
          reportId   = exist.reportId;
          useGroupId = exist.groupId;
          useUnitId  = exist.unitId;
        } else {
          useGroupId = ag.groupId;
          useUnitId  = ag.unitId;

          await conn.query(`
            INSERT INTO dailyreport
              (reportDate, groupId, unitId,
               OF_effective, SO_effective, PT_effective,
               OF_available, SO_available, PT_available,
               OF_nov, SO_nov, PT_nov)
            VALUES (?, ?, ?, 0,0,0, 0,0,0, 0,0,0)
            ON DUPLICATE KEY UPDATE updatedAt=CURRENT_TIMESTAMP(3)
          `, [isoDate, useGroupId, useUnitId]);

          const [[dr]] = await conn.query(`
            SELECT id FROM dailyreport WHERE reportDate=? AND groupId=? AND unitId=? LIMIT 1
          `, [isoDate, useGroupId, useUnitId]);
          reportId = dr.id;
        }

        await deleteAgentRowsSameDate(conn, isoDate, ag.id, reportId);

        const nDescEnc = encNullable(nDesc);
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
        `, [reportId, ag.id, useGroupId, useUnitId, s, muniId, nStart, nEnd, nDescEnc]);

        await conn.query(
          'UPDATE agent SET status=?, municipalityId=? WHERE id=?',
          [s, muniId, ag.id]
        );

        await recalcDailyReport(reportId, conn);

        await conn.commit();

        try {
          await logEvent({
            req, userId: req.user.uid,
            action: Actions.REPORT_UPDATE,
            details: {
              mode: 'byAgent',
              reportId,
              date: isoDate,
              agentId: ag.id,
              state: s,
              municipalityId: muniId,
              novelty_start: nStart,
              novelty_end: nEnd,
              novelty_description: nDesc
            }
          });
        } catch {}

        return res.json({ ok: true, reportId });
      } catch (e) {
        await conn.rollback();
        return res.status(500).json({ error:'NoveltySaveError', detail: e.message });
      } finally {
        conn.release();
      }
    } catch (e) {
      return res.status(500).json({ error:'AgentNoveltyUpdateError', detail:e.message });
    }
  }
);

// Helper: elimina duplicados de ese día en otros reportes
async function deleteAgentRowsSameDate(conn, date, agentId, keepReportId) {
  await conn.query(`
    DELETE da FROM dailyreport_agent da
    JOIN dailyreport dr ON dr.id = da.reportId
    WHERE da.agentId = ? AND dr.reportDate = ? AND da.reportId <> ?
  `, [agentId, date, keepReportId]);
}





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

      if (rows.length) {
        const row = rows[0];
        row.novelty_description = row.novelty_description ? decNullable(row.novelty_description) : null;
        return res.json(row);
      }


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






// Asignar agente a mi unidad (si está libre o ya en mi grupo sin unidad)
app.post('/my/agents/add', auth, requireRole('leader_unit'), async (req, res) => {
  const { agentId } = req.body;
  const groupId = req.user.groupId;
  const unitId  = req.user.unitId;

  const [[ag]] = await pool.query(
    'SELECT id, groupId, unitId FROM agent WHERE id=? LIMIT 1',
    [agentId]
  );
  if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });

  // Ya está en alguna unidad
  if (ag.unitId) {
    return res.status(409).json({ error: 'AgenteNoDisponible', detail: 'El agente ya tiene unidad' });
  }

  // Caso A: sin grupo -> tomarlo a mi grupo/unidad
  if (!ag.groupId) {
    await pool.query('UPDATE agent SET groupId=?, unitId=? WHERE id=?', [groupId, unitId, agentId]);
    return res.json({ ok: true });
  }

  // Caso B: mismo grupo y sin unidad -> solo set unitId
  if (ag.groupId === groupId) {
    await pool.query('UPDATE agent SET unitId=? WHERE id=?', [unitId, agentId]);
    return res.json({ ok: true });
  }

  // Caso C: pertenece a otro grupo
  return res.status(409).json({ error: 'AgenteDeOtroGrupo', detail: 'El agente pertenece a otro grupo' });
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
  try {
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
    return res.json(rows);
  } catch (e) {
    console.error('GET /catalogs/municipalities error:', e?.message, e);
    return res.status(500).json({ error: 'MunicipalitiesError', detail: e?.message });
  }
});





// ---------- Guardar reporte (actualiza solo agent y dailyreport) ----------
app.post('/reports', auth, requireRole('leader_unit', 'leader_group', 'superadmin', 'supervision'), async (req, res) => {
  const { reportDate, people = [] } = req.body;
  if (!reportDate) return res.status(422).json({ error:'FechaRequerida' });
  if (!Array.isArray(people) || !people.length) {
    return res.status(422).json({ error:'SinPersonas', detail:'Envía al menos un agente.' });
  }

  // scope por rol
  let groupId = req.user.groupId;
  let unitId  = req.user.unitId;
  if (['superadmin','supervision'].includes(String(req.user.role))) {
    groupId = req.body.groupId || groupId;
    unitId  = req.body.unitId  || unitId;
  }

  let feOF = 0, feSO = 0, fePT = 0;
  let fdOF = 0, fdSO = 0, fdPT = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // resolver agentes por código
    const codes = people.map(p => String(p.agentCode || '').toUpperCase().trim());
    const [agentsBD] = await conn.query(
      `SELECT id, code, category, unitId FROM agent WHERE code IN (${codes.map(_ => '?').join(',')})`,
      codes
    );
    const agentMap = {};
    for (const a of agentsBD) agentMap[a.code] = a;

    // arrastre de novedades de reporte anterior
    const [[prevReport]] = await conn.query(
      `SELECT id FROM dailyreport 
       WHERE groupId=? AND unitId=? AND reportDate<? 
       ORDER BY reportDate DESC 
       LIMIT 1`,
      [groupId, unitId, reportDate]
    );

    let prevNovedades = {};
    if (prevReport) {
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
          ['VACACIONES','EXCUSA','PERMISO','COMISIÓN EN EL EXTERIOR','SUSPENDIDO','HOSPITALIZADO'].includes(r.state)
        ) {
          prevNovedades[r.agentId] = {
            novelty_start: r.novelty_start,
            novelty_end: r.novelty_end,
            state: r.state,
            novelty_description: decNullable(r.novelty_description)
          };
        }
      }
    }

    // validar/normalizar cada persona
    for (const p of people) {
      const code  = String(p.agentCode || '').toUpperCase().trim();
      const state = String(p.state || '').toUpperCase().trim();
      let muniId = p.municipalityId ? Number(p.municipalityId) : null;
      let novelty_start = p.novelty_start || null;
      let novelty_end   = p.novelty_end   || null;
      let novelty_description = p.novelty_description || null;

      const ag = agentMap[code];
      if (!ag) throw new Error(`No existe agente ${code}`);

      // contadores FE/FD
      if (ag.category === 'OF') feOF++;
      if (ag.category === 'SO') feSO++;
      if (ag.category === 'PT') fePT++;
      if (state === 'SIN NOVEDAD') {
        if (ag.category === 'OF') fdOF++;
        if (ag.category === 'SO') fdSO++;
        if (ag.category === 'PT') fdPT++;
      }

      if (!isValidState(state)) throw new Error(`Estado inválido: ${state}`);

      if (state === "SIN NOVEDAD") {
        muniId = 11001; novelty_start = null; novelty_end = null; novelty_description = null;
      } else if (state === "SERVICIO") {
        muniId = 11001;
        if (!p.novelty_start)      throw new Error(`Falta fecha de inicio para ${code} (SERVICIO)`);
        if (!p.novelty_end)        throw new Error(`Falta fecha de fin para ${code} (SERVICIO)`);
        if (!p.novelty_description)throw new Error(`Falta descripción para ${code} (SERVICIO)`);
        novelty_start = p.novelty_start;
        novelty_end   = p.novelty_end;
        novelty_description = p.novelty_description;
      } else if (state === "COMISIÓN DEL SERVICIO") {
        if (!muniId)               throw new Error(`Falta municipio para ${code} (COMISIÓN DEL SERVICIO)`);
        if (!p.novelty_description)throw new Error(`Falta descripción para ${code} (COMISIÓN DEL SERVICIO)`);
        novelty_start = null; novelty_end = null;
        novelty_description = p.novelty_description;
      } else if (state === "FRANCO FRANCO") {
        muniId = null; novelty_start = null; novelty_end = null; novelty_description = null;
      } else if (state === "SUSPENDIDO") {
        muniId = null;
        if (!p.novelty_start)      throw new Error(`Falta fecha de inicio para ${code} (SUSPENDIDO)`);
        if (!p.novelty_end)        throw new Error(`Falta fecha de fin para ${code} (SUSPENDIDO)`);
        if (!p.novelty_description)throw new Error(`Falta descripción para ${code} (SUSPENDIDO)`);
        novelty_start = p.novelty_start;
        novelty_end   = p.novelty_end;
        novelty_description = p.novelty_description;
      } else if (state === "HOSPITALIZADO") {
        muniId = null;
        if (!p.novelty_start)      throw new Error(`Falta fecha de inicio para ${code} (HOSPITALIZADO)`);
        if (!p.novelty_description)throw new Error(`Falta descripción para ${code} (HOSPITALIZADO)`);
        novelty_start = p.novelty_start;
        novelty_end   = null;
        novelty_description = p.novelty_description;
      } else {
        if (!p.novelty_start)      throw new Error(`Falta fecha de inicio para ${code} (${state})`);
        if (!p.novelty_end)        throw new Error(`Falta fecha de fin para ${code} (${state})`);
        if (!p.novelty_description)throw new Error(`Falta descripción para ${code} (${state})`);
        muniId = null;
        novelty_start = p.novelty_start;
        novelty_end   = p.novelty_end;
        novelty_description = p.novelty_description;
      }

      const ymd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0,10));
      if (novelty_start && !ymd(novelty_start)) throw new Error(`Formato inválido de fecha inicio para ${code} (YYYY-MM-DD)`);
      if (novelty_end   && !ymd(novelty_end))   throw new Error(`Formato inválido de fecha fin para ${code} (YYYY-MM-DD)`);
      if (novelty_start && novelty_end && (new Date(novelty_end) < new Date(novelty_start))) {
        throw new Error(`La fecha fin no puede ser menor a la fecha inicio (${code})`);
      }

      // completar con arrastre si aplica
      if (prevNovedades[ag.id] && state === prevNovedades[ag.id].state) {
        if (!novelty_start && prevNovedades[ag.id].novelty_start)       novelty_start = prevNovedades[ag.id].novelty_start;
        if (!novelty_end   && prevNovedades[ag.id].novelty_end)         novelty_end   = prevNovedades[ag.id].novelty_end;
        if (!novelty_description && prevNovedades[ag.id].novelty_description)
          novelty_description = prevNovedades[ag.id].novelty_description;
      }

      // guardar resolución para insert posterior
      p._resolved = { state, muniId, novelty_start, novelty_end, novelty_description };
    }

    // KPIs
    const { OF_nov, SO_nov, PT_nov } = computeNovelties({
      OF_effective: feOF, SO_effective: feSO, PT_effective: fePT,
      OF_available: fdOF, SO_available: fdSO, PT_available: fdPT
    });

    const leaderUserId = req.user.uid;

    // upsert del encabezado dailyreport
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
    if (!reportId) throw new Error('No se pudo obtener el reportId');

    // limpiar filas del propio reporte antes de insertar
    await conn.query('DELETE FROM dailyreport_agent WHERE reportId=?', [reportId]);

    // insertar filas detalle + actualizar agente
    for (const p of people) {
      const code = String(p.agentCode || '').toUpperCase().trim();
      const ag   = agentMap[code];
      const { state, muniId, novelty_start, novelty_end, novelty_description } = p._resolved;

      // evitar duplicados del MISMO día en otros reports
      await deleteAgentRowsSameDate(conn, reportDate, ag.id, reportId);

      const novDescEnc = encNullable(novelty_description);

      await conn.query(
        `INSERT INTO dailyreport_agent 
           (reportId, agentId, groupId, unitId, state, municipalityId, novelty_start, novelty_end, novelty_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reportId, ag.id, groupId, ag.unitId, state, muniId, novelty_start, novelty_end, novDescEnc]
      );

      await conn.query(
        'UPDATE agent SET status=?, municipalityId=? WHERE id=?',
        [state, muniId, ag.id]
      );
    }

    await conn.commit();

    // log
    try {
      await logEvent({
        req, userId: req.user.uid,
        action: Actions.REPORT_CREATE,
        details: {
          reportId,
          reportDate,
          groupId,
          unitId,
          agents: people.map(p => String(p.agentCode || '').toUpperCase().trim())
        }
      });
    } catch {}

    return res.json({
      action: 'upserted',
      reportId,
      totals: { feOF, feSO, fePT, fdOF, fdSO, fdPT, OF_nov, SO_nov, PT_nov }
    });

  } catch (e) {
    await conn.rollback();
    console.error('POST /reports error', e);
    return res.status(400).json({ error:'Cannot save report', detail: e?.message });
  } finally {
    conn.release();
  }
});






// ---------- Obtener reporte resumen por día ----------

app.get('/reports', auth, async (req, res) => {
  try {
    const { date, groupId, unitId } = req.query;
    if (!date) return res.status(422).json({ error: 'Falta date' });

    let where = 'reportDate=?';
    const params = [date];
    if (groupId) { where += ' AND groupId=?'; params.push(groupId); }
    if (unitId)  { where += ' AND unitId=?'; params.push(unitId); }

    const [rows] = await pool.query(
      `SELECT * FROM dailyreport WHERE ${where} ORDER BY reportDate`,
      params
    );
    return res.json(rows);
  } catch (e) {
    console.error('GET /reports error:', e?.message, e);
    return res.status(500).json({ error: 'ReportsListError', detail: e?.message });
  }
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
    const [r] = await pool.query('INSERT INTO `group` (code, name) VALUES (?, ?)', [code, name]);
    await logEvent({ req, userId: req.user.uid, action: Actions.GROUP_CREATE, details: { groupId: r.insertId, code, name } });
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
    SELECT 
      u.id, u.username, u.role, u.groupId, u.unitId,
      u.createdAt,                          -- (si lo tienes en tu tabla)
      u.failed_login_count, u.lock_until,   -- ▼ campos de seguridad
      u.lock_strikes, u.hard_locked,        -- ▲
      g.code AS groupCode, un.name AS unitName
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
  if (!isStrongPassword(password)) {
    return res.status(422).json({
      error: 'Password débil',
      detail: 'Debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y carácter especial.'
    });
  }
  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  if (unitId) {
    const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
    if (!u) return res.status(404).json({ error: 'Unidad no existe' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await pool.query(
      'INSERT INTO `user` (username, passwordHash, role, groupId, unitId) VALUES (?,?,?,?,?)',
      [username.trim(), hash, role, groupId || null, unitId || null]
    );
    await logEvent({
      req, userId: req.user.uid,
      action: Actions.USER_CREATE,
      details: { newUserId: r.insertId, username: username.trim(), role, groupId: groupId || null, unitId: unitId || null }
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') res.status(409).json({ error: 'El usuario ya existe' });
    else res.status(500).json({ error: 'No se pudo crear', detail: e.message });
  }
});


// Actualizar usuario
app.put('/admin/users/:id', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  const { username, role, groupId, unitId, password } = req.body;
  if (!username || !role) {
    return res.status(400).json({ error: 'Campos requeridos: username, role' });
  }

  // rol previo para detectar cambio de rol
  const [[prev]] = await pool.query('SELECT role FROM `user` WHERE id=? LIMIT 1', [id]);
  if (!prev) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  if (unitId) {
    const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
    if (!u) return res.status(404).json({ error: 'Unidad no existe' });
  }

  let setFields = 'username=?, role=?, groupId=?, unitId=?';
  const params = [username.trim(), role, groupId || null, unitId || null];

  let passwordChanged = false;
  if (password !== undefined && password !== null && password !== '') {
    if (!isStrongPassword(password)) {
      return res.status(422).json({
        error: 'Password débil',
        detail: 'Debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y carácter especial.'
      });
    }
    const hash = await bcrypt.hash(password, 10);
    setFields += ', passwordHash=?';
    params.push(hash);
    passwordChanged = true;
  }
  params.push(id);

  try {
    const [r] = await pool.query(`UPDATE \`user\` SET ${setFields} WHERE id=?`, params);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (prev.role !== role) {
      await logEvent({
        req, userId: req.user.uid,
        action: Actions.USER_ROLE_CHANGE,
        details: { targetUserId: Number(id), oldRole: prev.role, newRole: role }
      });
    }
    if (passwordChanged) {
      await logEvent({
        req, userId: req.user.uid,
        action: Actions.USER_PASSWORD_CHANGE,
        details: { targetUserId: Number(id), by: 'admin' }
      });
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


// Desbloquear cuenta (superadmin)

app.post('/admin/users/:id/unlock', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;

  // obtener username del usuario que desbloqueas
  const [[target]] = await pool.query('SELECT username FROM `user` WHERE id=? LIMIT 1', [id]);

  await pool.query(
    'UPDATE `user` SET failed_login_count=0, lock_until=NULL, lock_strikes=0, hard_locked=0 WHERE id=? LIMIT 1',
    [id]
  );

  try {
    await logEvent({
      req,
      userId: req.user.uid,
      action: Actions.ACCOUNT_UNLOCK,
      details: { targetUserId: Number(id), username: target?.username || null }
    });
  } catch {}

  res.json({ ok: true });
});




// ---------- CRUD Agentes Admin ----------


// Listado de agentes (admin/supervisión/supervisor/leader_group)
app.get('/admin/agents', auth, requireRole('superadmin', 'supervision', 'supervisor', 'leader_group'), async (req, res) => {
  try {
    const { q, code, category, groupId, unitId, freeOnly, limit = 100 } = req.query;

    let where = '1=1';
    const params = [];

    // 🔐 Restricción para leader_group
    if (req.user.role === 'leader_group') {
      // Debe tener groupId asignado en el token
      if (!req.user.groupId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      // Solo puede consultar su propio grupo
      if (groupId && Number(groupId) !== Number(req.user.groupId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      where += ' AND a.groupId=?';
      params.push(Number(req.user.groupId));
    } else {
      // Para roles superiores (superadmin/supervision/supervisor)
      if (groupId) { where += ' AND a.groupId=?'; params.push(Number(groupId)); }
    }

    if (code) {
      where += ' AND a.code=?';
      params.push(String(code).toUpperCase().trim());
    } else if (q) {
      where += ' AND a.code LIKE ?';
      params.push(String(q).toUpperCase().trim() + '%');
    }

    if (category) {
      where += ' AND a.category=?';
      params.push(category);
    }

    if (unitId) {
      where += ' AND a.unitId=?';
      params.push(Number(unitId));
    }

    // ✅ filtro extra: solo agentes sin unidad
    if (String(freeOnly || '0') === '1') {
      where += ' AND (a.unitId IS NULL OR a.unitId = 0)';
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.code, a.category, a.status,
              a.groupId, g.code AS groupCode,
              a.unitId, u.name AS unitName,
              a.municipalityId, m.name AS municipalityName, m.dept
         FROM agent a
         LEFT JOIN \`group\` g ON g.id = a.groupId
         LEFT JOIN unit u ON u.id = a.unitId
         LEFT JOIN municipality m ON a.municipalityId = m.id
        WHERE ${where}
        ORDER BY a.code
        LIMIT ?`,
      [...params, Math.min(parseInt(limit, 10) || 100, 500)]
    );

    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'AgentListError', detail: e.message });
  }
});


// Crear agente
app.post('/admin/agents', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { code, category, groupId, unitId, status, municipalityId } = req.body;
  if (!/^[A-Z][0-9]+$/.test(code)) return res.status(422).json({ error: 'Código inválido (LETRA + números)' });
  if (!['OF','SO','PT'].includes(category)) return res.status(422).json({ error: 'Categoría inválida' });

  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  if (unitId) {
    const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
    if (!u) return res.status(404).json({ error: 'Unidad no existe' });
  }

  let s = String(status || 'SIN NOVEDAD').toUpperCase().trim();
  if (!isValidState(s)) return res.status(422).json({ error: 'Estado inválido', detail: `Recibido: ${status}` });

  let muniId = municipalityId ? Number(municipalityId) : null;
  if (s === 'SIN NOVEDAD' || s === 'SERVICIO') muniId = 11001;
  else if (s === 'COMISIÓN DEL SERVICIO' && !muniId) return res.status(422).json({ error: 'Falta municipalityId para Comisión del servicio' });
  else if (s === 'FRANCO FRANCO') muniId = null;
  else muniId = null;

  if (muniId) {
    const [[m]] = await pool.query('SELECT id FROM municipality WHERE id=? LIMIT 1', [muniId]);
    if (!m) return res.status(404).json({ error: 'Municipio no existe' });
  }

  try {
    const [r] = await pool.query(
      'INSERT INTO agent (code, category, groupId, unitId, status, municipalityId) VALUES (?,?,?,?,?,?)',
      [code.trim(), category, groupId || null, unitId || null, s, muniId]
    );
    await logEvent({
      req, userId: req.user.uid,
      action: Actions.AGENT_CREATE,
      details: { agentId: r.insertId, code: code.trim(), category, groupId: groupId || null, unitId: unitId || null }
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') res.status(409).json({ error: 'El código ya existe' });
    else res.status(500).json({ error: 'No se pudo crear', detail: e.message });
  }
});




// Actualizar agente (parcial)
// Actualizar agente (parcial)
app.put('/admin/agents/:id', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { id } = req.params;
  const { code, category, groupId, unitId, status, municipalityId } = req.body;

  const sets = [], params = [];
  const changes = {};

  if (code !== undefined) {
    if (!/^[A-Z][0-9]+$/.test(String(code))) return res.status(422).json({ error:'Código inválido' });
    sets.push('code=?'); params.push(String(code).trim().toUpperCase());
    changes.code = String(code).trim().toUpperCase();
  }

  if (category !== undefined) {
    if (!['OF','SO','PT'].includes(String(category))) return res.status(422).json({ error:'Categoría inválida' });
    sets.push('category=?'); params.push(category);
    changes.category = category;
  }

  if (groupId !== undefined) {
    if (groupId) {
      const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
      if (!g) return res.status(404).json({ error:'Grupo no existe' });
    }
    sets.push('groupId=?'); params.push(groupId || null);
    changes.groupId = groupId || null;
  }

  if (unitId !== undefined) {
    if (unitId) {
      const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
      if (!u) return res.status(404).json({ error:'Unidad no existe' });
    }
    sets.push('unitId=?'); params.push(unitId || null);
    changes.unitId = unitId || null;
  }

  if (status !== undefined) {
    sets.push('status=?'); params.push(String(status));
    changes.status = String(status);
  }

  if (municipalityId !== undefined) {
    if (municipalityId) {
      const [[m]] = await pool.query('SELECT id FROM municipality WHERE id=? LIMIT 1', [municipalityId]);
      if (!m) return res.status(404).json({ error:'Municipio no existe' });
    }
    sets.push('municipalityId=?'); params.push(municipalityId || null);
    changes.municipalityId = municipalityId || null;
  }

  // ================== PATCH INTEGRIDAD GRUPO-UNIDAD ==================
  // 1) Si vienen groupId Y unitId a la vez, validar que la unidad pertenezca al grupo indicado.
  if (('groupId' in changes) && ('unitId' in changes) && changes.groupId && changes.unitId) {
    const [[ux]] = await pool.query(
      'SELECT id FROM unit WHERE id=? AND groupId=? LIMIT 1',
      [changes.unitId, changes.groupId]
    );
    if (!ux) return res.status(422).json({ error: 'La unidad no pertenece al nuevo grupo' });
  }

  // 2) Si CAMBIAN groupId y NO mandan unitId en el body, limpiar unitId automáticamente
  //    (solo si efectivamente se incluyó groupId en la petición)
  if (('groupId' in changes) && changes.groupId !== null && (unitId === undefined)) {
    sets.push('unitId=?'); params.push(null);
    changes.unitId = null;
  }
  // ================== FIN PATCH INTEGRIDAD ===========================

  if (!sets.length) return res.status(400).json({ error:'Nada para actualizar' });

  try {
    params.push(id);
    const [r] = await pool.query(`UPDATE agent SET ${sets.join(', ')} WHERE id=?`, params);
    if (r.affectedRows === 0) return res.status(404).json({ error:'Agente no encontrado' });

    await logEvent({
      req, userId: req.user.uid,
      action: Actions.AGENT_UPDATE,
      details: { agentId: Number(id), changes }
    });

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

app.get('/admin/agent-municipalities',
  auth,
  requireRole('superadmin','supervision','leader_group'), // <- roles OK
  async (req, res) => {
    const { date, groups, units } = req.query;
    if (!date) return res.status(400).json({ error:'Missing date' });

    // 1) Construye alcance base (sin fecha)
    let baseWhere = `1=1`;
    const baseArgs = [];

    if (req.user.role === 'leader_group') {
      baseWhere += ' AND groupId=?';
      baseArgs.push(req.user.groupId);
    } else {
      if (groups) {
        const groupIds = String(groups).split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
        if (groupIds.length) {
          baseWhere += ` AND groupId IN (${groupIds.map(_ => '?').join(',')})`;
          baseArgs.push(...groupIds);
        }
      }
      if (units) {
        const unitIds = String(units).split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
        if (unitIds.length) {
          baseWhere += ` AND unitId IN (${unitIds.map(_ => '?').join(',')})`;
          baseArgs.push(...unitIds);
        }
      }
    }

    // 2) Averigua la ÚLTIMA fecha disponible <= date dentro del alcance
    const [[latest]] = await pool.query(
      `SELECT MAX(reportDate) AS lastDate
         FROM dailyreport
        WHERE ${baseWhere} AND reportDate <= ?`,
      [...baseArgs, date]
    );

    if (!latest?.lastDate) return res.json([]); // no hay nada que pintar

    // 3) Trae los reports SOLO de esa última fecha
    const [reports] = await pool.query(
      `SELECT id FROM dailyreport WHERE ${baseWhere} AND reportDate = ?`,
      [...baseArgs, latest.lastDate]
    );
    if (!reports.length) return res.json([]);

    const reportIds = reports.map(r => r.id);
    const qMarks = reportIds.map(() => '?').join(',');

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
  }
);



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
cron.schedule('16 6 * * *', () => console.log('⏰ Recordatorio 06:16'), { timezone: 'America/Bogota' });
cron.schedule('45 6 * * *', () => console.log('⏳ Cierre ventana 06:45'), { timezone: 'America/Bogota' });
cron.schedule('15 14 * * *', () => console.log('⏰ Recordatorio 14:15'), { timezone: 'America/Bogota' });
cron.schedule('45 14 * * *', () => console.log('⏳ Cierre ventana 14:45'), { timezone: 'America/Bogota' });


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
      a.id AS agentId,          
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

    res.json(rows.map(r => ({
      ...r,
      novelty_description: r.novelty_description ? decNullable(r.novelty_description) : null
    })));

});



// Endpoint: Editar estado/novedad de un agente en un reporte específico

app.put('/admin/report-agents/:reportId/:agentId',
  auth,
  requireRole('superadmin', 'supervision', 'leader_group'),
  async (req, res) => {
    try {
      const { reportId, agentId } = req.params;
      const { state, municipalityId, novelty_start, novelty_end, novelty_description } = req.body;

      if (!reportId || !agentId) {
        return res.status(400).json({ error: 'Parámetros requeridos' });
      }

      if (req.user.role === 'leader_group') {
        const [[repCheck]] = await pool.query(
          'SELECT groupId FROM dailyreport WHERE id=? LIMIT 1',
          [reportId]
        );
        if (!repCheck || repCheck.groupId !== req.user.groupId) {
          return res.status(403).json({ error: 'No autorizado' });
        }
      }

      const s = String(state || '').toUpperCase().trim();
      if (!isValidState(s)) {
        return res.status(422).json({ error: 'Estado inválido' });
      }

      let muniId  = municipalityId ? Number(municipalityId) : null;
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
        if (!muniId)   return res.status(422).json({ error:'Falta municipio (COMISIÓN DEL SERVICIO)' });
        if (!novDesc)  return res.status(422).json({ error:'Falta descripción (COMISIÓN DEL SERVICIO)' });
        novStart = null; novEnd = null;
      } else if (s === 'FRANCO FRANCO') {
        muniId = null; novStart = null; novEnd = null; novDesc = null;
      } else if (s === 'SUSPENDIDO') {
        muniId = null;
        if (!novStart) return res.status(422).json({ error: 'Falta fecha de inicio (SUSPENDIDO)' });
        if (!novEnd)   return res.status(422).json({ error: 'Falta fecha de fin (SUSPENDIDO)' });
        if (!novDesc)  return res.status(422).json({ error: 'Falta descripción (SUSPENDIDO)' });
      } else if (s === 'HOSPITALIZADO') {
        muniId = null;
        if (!novStart) return res.status(422).json({ error: 'Falta fecha de inicio (HOSPITALIZADO)' });
        if (!novDesc)  return res.status(422).json({ error: 'Falta descripción (HOSPITALIZADO)' });
        novEnd = null;
      } else {
        if (!novStart) return res.status(422).json({ error: `Falta fecha de inicio (${s})` });
        if (!novEnd)   return res.status(422).json({ error: `Falta fecha de fin (${s})` });
        if (!novDesc)  return res.status(422).json({ error: `Falta descripción (${s})` });
        muniId = null;
      }

      const [[exists]] = await pool.query(
        'SELECT 1 FROM dailyreport_agent WHERE reportId=? AND agentId=? LIMIT 1',
        [reportId, agentId]
      );
      if (!exists) return res.status(404).json({ error: 'Fila no encontrada' });

      const novDescEnc = encNullable(novDesc);

      await pool.query(`
        UPDATE dailyreport_agent
           SET state=?, municipalityId=?, novelty_start=?, novelty_end=?, novelty_description=?
         WHERE reportId=? AND agentId=?`,
        [s, muniId, novStart, novEnd, novDescEnc, reportId, agentId]
      );

      await pool.query(
        'UPDATE agent SET status=?, municipalityId=? WHERE id=?',
        [s, muniId, agentId]
      );

      await recalcDailyReport(reportId);

      try {
        const [[agSnap]] = await pool.query(
          'SELECT code, category FROM agent WHERE id=? LIMIT 1',
          [agentId]
        );
        const [[repMeta]] = await pool.query(
          `SELECT DATE_FORMAT(reportDate,'%Y-%m-%d') AS reportDate, groupId, unitId
             FROM dailyreport WHERE id=? LIMIT 1`,
          [reportId]
        );
        await logEvent({
          req,
          userId: req.user.uid,
          action: Actions.REPORT_UPDATE,
          details: {
            reportId: Number(reportId),
            reportDate: repMeta?.reportDate || null,
            groupId: repMeta?.groupId ?? null,
            unitId:  repMeta?.unitId  ?? null,
            agentId: Number(agentId),
            agentCode: agSnap?.code || null,
            agentCategory: agSnap?.category || null,
            changes: {
              state: s,
              municipalityId: muniId,
              novelty_start: novStart,
              novelty_end: novEnd,
              novelty_description: novDesc
            }
          }
        });
      } catch {}

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'ReportAgentUpdateError', detail: e.message });
    }
  }
);







// Listar agentes de un grupo que NO tienen unidad asignada
app.get('/admin/agents-no-unit', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  let groupId = req.query.groupId;
  if (req.user.role === 'leader_group') groupId = req.user.groupId;
  if (!groupId) return res.status(400).json({ error: 'Falta groupId' });

  const [rows] = await pool.query(
    `SELECT id, code, category, status 
       FROM agent 
      WHERE groupId = ? AND (unitId IS NULL OR unitId = 0) 
      ORDER BY code`,
    [groupId]
  );
  res.json(rows);
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

  await logEvent({
  req, userId: req.user.uid,
  action: Actions.EXCEL_DOWNLOAD,
  details: {
    date,
    groupId: groupId || (req.user.role === 'leader_group' ? req.user.groupId : null),
    unitId: unitId  || (req.user.role === 'leader_unit'  ? req.user.unitId  : null),
    format: 'json-export' // o 'xlsx' si sirves archivo
  }
});

      res.json(
        rows.map(r => ({
          ...r,
          // el alias en tu SELECT es "descripcion"
          descripcion: r.descripcion ? decNullable(r.descripcion) : null
        }))
      );

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
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.description, u.groupId,
              g.code AS groupCode, g.name AS groupName
         FROM unit u
         LEFT JOIN \`group\` g ON g.id = u.groupId
        ORDER BY g.code, u.name`
    );
    return res.json(rows);
  } catch (e) {
    console.error('GET /admin/units error:', e?.message, e);
    return res.status(500).json({ error: 'AdminUnitsError', detail: e?.message });
  }
});
// Crear (solo superadmin)

app.post('/admin/units', auth, requireRole('superadmin'), async (req, res) => {
  const { name, description, groupId } = req.body;
  if (!name || !groupId) return res.status(400).json({ error: 'Nombre y groupId requeridos' });
  const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
  if (!g) return res.status(404).json({ error: 'Grupo no existe' });

  const [r] = await pool.query(
    'INSERT INTO unit (name, description, groupId) VALUES (?, ?, ?)',
    [name.trim(), description || null, groupId]
  );
  await logEvent({ req, userId: req.user.uid, action: Actions.UNIT_CREATE, details: { unitId: r.insertId, groupId, name } });
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

app.post('/admin/users/:id/reset-password', auth, requireRole('superadmin'), async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) return res.status(422).json({ error: 'Password requerido' });
  if (!isStrongPassword(password)) {
    return res.status(422).json({
      error: 'Password débil',
      detail: 'Debe tener mínimo 8 caracteres e incluir mayúscula, minúscula, número y carácter especial.'
    });
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE `user` SET passwordHash=? WHERE id=? LIMIT 1', [hash, id]);

  await logEvent({
    req, userId: req.user.uid,
    action: Actions.USER_PASSWORD_CHANGE,
    details: { targetUserId: Number(id), by: 'admin' }
  });

  res.json({ ok: true });
});


// ================== ENDPOINTS PARA LOG DE EVENTOS ==================

// === Listado de auditoría (solo superadmin) ===
// GET /admin/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&action=LOGIN&userId=123&search=texto&page=1&pageSize=50
// GET /admin/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&action=LOGIN&username=juan&page=1&pageSize=50
// GET /admin/audit?from=...&to=...&action=...&username=...
app.get('/admin/audit', auth, requireSuperadmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(parseInt(req.query.pageSize, 10) || 50, 200);
    const offset = (page - 1) * pageSize;

    const { from, to, action, username } = req.query;

    const where = [];
    const args = [];

    if (from)     { where.push('el.created_at >= ?'); args.push(`${from} 00:00:00`); }
    if (to)       { where.push('el.created_at <= ?'); args.push(`${to} 23:59:59`); }
    if (action)   { where.push('el.action = ?');      args.push(action); }
    if (username) { where.push('u.username LIKE ?');  args.push(`%${username}%`); }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
         FROM event_log el
         LEFT JOIN \`user\` u ON u.id = el.userId
       ${whereSql}`, args
    );

    const [rows] = await pool.query(
      `SELECT 
         el.id, el.userId, el.action, el.details, el.ip, el.user_agent,
         UNIX_TIMESTAMP(el.created_at)*1000 AS created_at_ts,
         u.username, u.role,

         -- 💡 extrae agentId del JSON y júntalo para traer el code cuando exista
         CAST(JSON_UNQUOTE(JSON_EXTRACT(el.details,'$.agentId')) AS UNSIGNED) AS agentIdFromDetails,
         a.code   AS agentCodeFromDetails,
         a.category AS agentCategoryFromDetails
       FROM event_log el
       LEFT JOIN \`user\` u ON u.id = el.userId
       LEFT JOIN agent a
         ON a.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(el.details,'$.agentId')) AS UNSIGNED)
       ${whereSql}
       ORDER BY el.created_at DESC
       LIMIT ? OFFSET ?`,
      [...args, pageSize, offset]
    );

    res.json({
      page, pageSize, total,
      items: rows.map(r => {
        let det = null;
        try { det = r.details && typeof r.details === 'string' ? JSON.parse(r.details) : r.details; } catch {}
        if (det && r.agentCodeFromDetails && !det.agentCode) {
          det.agentCode = r.agentCodeFromDetails;
        }
        if (det && r.agentCategoryFromDetails && !det.agentCategory) {
          det.agentCategory = r.agentCategoryFromDetails;
        }
        return {
          id: r.id,
          userId: r.userId,
          username: r.username,
          userRole: r.role,
          action: r.action,
          details: det,
          ip: r.ip,
          user_agent: r.user_agent,
          created_at_ts: Number(r.created_at_ts),
          created_at: new Date(Number(r.created_at_ts)).toISOString()
        };
      })
    });
  } catch (e) {
    console.error('/admin/audit error:', e);
    res.status(500).json({ error: 'AuditListError', detail: e.message });
  }
});



// === Logout (registra cierre de sesión) ===
// ⚠️ Deja SOLO ESTE endpoint para /auth/logout (elimina duplicados)
app.post('/auth/logout', auth, async (req, res) => {
  try {
    await logEvent({
      req,
      userId: req.user?.uid || null,
      action: Actions.LOGOUT,
      details: {}
    });
    res.json({ ok: true });
  } catch (e) {
    // No bloquear por errores de log
    res.json({ ok: true });
  }
});


// GET /dashboard/novelties-by-type
app.get('/dashboard/novelties-by-type', auth, async (req, res) => {
  try {
    const { date, groupId, unitId } = req.query;
    if (!date) return res.status(422).json({ error: 'Falta date' });

    const where = [
      'dr.reportDate = ?',
      "UPPER(da.state) <> 'SIN NOVEDAD'"  // ⛔️ siempre excluir
    ];
    const args = [date];

    // Alcance por rol / filtros
    if (req.user.role === 'leader_group') {
      where.push('dr.groupId = ?');
      args.push(req.user.groupId);
    } else if (groupId) {
      where.push('dr.groupId = ?');
      args.push(groupId);
    }
    if (unitId) {
      where.push('dr.unitId = ?');
      args.push(unitId);
    }

    const [rows] = await pool.query(`
      SELECT 
        da.state AS novedad,
        SUM(CASE WHEN a.category='OF' THEN 1 ELSE 0 END) AS OF_count,
        SUM(CASE WHEN a.category IN ('SO','ME') THEN 1 ELSE 0 END) AS SO_count,
        SUM(CASE WHEN a.category='PT' THEN 1 ELSE 0 END) AS PT_count
      FROM dailyreport dr
      JOIN dailyreport_agent da ON da.reportId = dr.id
      JOIN agent a ON a.id = da.agentId
      WHERE ${where.join(' AND ')}
      GROUP BY da.state
      ORDER BY da.state
    `, args);

    res.json({ items: rows });
  } catch (e) {
    console.error('GET /dashboard/novelties-by-type error:', e);
    res.status(500).json({ error: 'NoveltiesByTypeError', detail: e.message });
  }
});





// GET /dashboard/novelties-by-group
app.get(
  '/dashboard/novelties-by-group',
  auth,
  requireRole('superadmin','supervision'),
  async (req, res) => {
    try {
      const { date, groupId, unitId } = req.query;
      if (!date) return res.status(422).json({ error: 'Falta date' });

      const where = ['dr.reportDate = ?'];
      const args = [date];

      // Filtros opcionales
      if (groupId) { where.push('dr.groupId = ?'); args.push(groupId); }
      if (unitId)  { where.push('dr.unitId = ?');  args.push(unitId);  }

      const [rows] = await pool.query(
        `
        SELECT
          g.code AS label,
          SUM(dr.OF_nov) AS OF_count,
          SUM(dr.SO_nov) AS SO_count,
          SUM(dr.PT_nov) AS PT_count
        FROM dailyreport dr
        JOIN \`group\` g ON g.id = dr.groupId
        WHERE ${where.join(' AND ')}
        GROUP BY g.code
        ORDER BY g.code
        `,
        args
      );

      res.json({ items: rows });
    } catch (e) {
      console.error('GET /dashboard/novelties-by-group error:', e);
      res.status(500).json({ error: 'NoveltiesByGroupError', detail: e.message });
    }
  }
);





// GET /dashboard/novelties-by-unit
app.get('/dashboard/novelties-by-unit', auth, requireRole('leader_group','superadmin','supervision'), async (req, res) => {
  try {
    const { date, groupId, unitId } = req.query;
    if (!date) return res.status(422).json({ error: 'Falta date' });

    const where = ['dr.reportDate = ?'];
    const args = [date];

    // Si es líder de grupo, forzar su groupId
    const effectiveGroupId = (req.user.role === 'leader_group') ? req.user.groupId : groupId;
    if (effectiveGroupId) { where.push('dr.groupId = ?'); args.push(effectiveGroupId); }
    if (unitId && unitId !== 'all') { where.push('dr.unitId = ?'); args.push(unitId); }

    const [rows] = await pool.query(`
      SELECT 
        u.name AS label,
        SUM(dr.OF_nov) AS OF_count,
        SUM(dr.SO_nov) AS SO_count,
        SUM(dr.PT_nov) AS PT_count
      FROM dailyreport dr
      JOIN unit u ON u.id = dr.unitId
      WHERE ${where.join(' AND ')}
      GROUP BY u.name
      ORDER BY u.name
    `, args);

    res.json({ items: rows });
  } catch (e) {
    console.error('GET /dashboard/novelties-by-unit error:', e);
    res.status(500).json({ error: 'NoveltiesByUnitError', detail: e.message });
  }
});

// === DETALLE: Novedades por Grupo (discriminadas por tipo) ===
app.get('/dashboard/novelties-by-group-breakdown',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    const { date, groupId, unitId } = req.query;
    if (!date) return res.status(422).json({ error: 'Falta date' });

    const where = [
      'dr.reportDate = ?',
      "UPPER(da.state) <> 'SIN NOVEDAD'"
    ];
    const args = [date];

    // Alcance por rol
    if (String(req.user.role).toLowerCase() === 'leader_group') {
      where.push('dr.groupId = ?');
      args.push(req.user.groupId);
    } else if (groupId) {
      where.push('dr.groupId = ?');
      args.push(groupId);
    }
    if (unitId) { // opcional: filtrar a una unidad específica
      where.push('dr.unitId = ?');
      args.push(unitId);
    }

    const [rows] = await pool.query(`
      SELECT 
        g.code AS label,                       -- Grupo
        UPPER(da.state) AS novedad,
        SUM(CASE WHEN a.category='OF' THEN 1 ELSE 0 END) AS OF_count,
        SUM(CASE WHEN a.category IN ('SO','ME') THEN 1 ELSE 0 END) AS SO_count,
        SUM(CASE WHEN a.category='PT' THEN 1 ELSE 0 END) AS PT_count
      FROM dailyreport dr
      JOIN dailyreport_agent da ON da.reportId = dr.id
      JOIN agent a ON a.id = da.agentId
      JOIN \`group\` g ON g.id = dr.groupId
      WHERE ${where.join(' AND ')}
      GROUP BY g.code, UPPER(da.state)
      ORDER BY g.code, UPPER(da.state)
    `, args);

    res.json({ items: rows });
  }
);

// === DETALLE: Novedades por Unidad (discriminadas por tipo) ===
app.get('/dashboard/novelties-by-unit-breakdown',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    const { date, groupId, unitId } = req.query;
    if (!date) return res.status(422).json({ error: 'Falta date' });

    const where = [
      'dr.reportDate = ?',
      "UPPER(da.state) <> 'SIN NOVEDAD'"
    ];
    const args = [date];

    // Seguridad/alcance por rol
    if (String(req.user.role).toLowerCase() === 'leader_group') {
      where.push('dr.groupId = ?');
      args.push(req.user.groupId);
    } else if (groupId) {
      where.push('dr.groupId = ?');
      args.push(groupId);
    }
    if (unitId && unitId !== 'all') {
      where.push('dr.unitId = ?');
      args.push(unitId);
    }

    const [rows] = await pool.query(`
      SELECT 
        u.name AS label,                       -- Unidad
        UPPER(da.state) AS novedad,
        SUM(CASE WHEN a.category='OF' THEN 1 ELSE 0 END) AS OF_count,
        SUM(CASE WHEN a.category IN ('SO','ME') THEN 1 ELSE 0 END) AS SO_count,
        SUM(CASE WHEN a.category='PT' THEN 1 ELSE 0 END) AS PT_count
      FROM dailyreport dr
      JOIN dailyreport_agent da ON da.reportId = dr.id
      JOIN agent a ON a.id = da.agentId
      JOIN unit u ON u.id = dr.unitId
      WHERE ${where.join(' AND ')}
      GROUP BY u.name, UPPER(da.state)
      ORDER BY u.name, UPPER(da.state)
    `, args);

    res.json({ items: rows });
  }
);







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