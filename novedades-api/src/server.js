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
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Carpeta base para fotos de novedades de vehículos
const VEH_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'vehicles');
fs.mkdirSync(VEH_UPLOAD_DIR, { recursive: true });

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // useId llegará en la ruta /vehicles/uses/:id/novelties
    const useId = req.params.id || req.params.useId;
    const dest = path.join(VEH_UPLOAD_DIR, String(useId || 'tmp'));
    ensureDir(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = (file.originalname || 'photo').replace(/[^\w\.\-]+/g, '_');
    cb(null, `${ts}__${safe}`);
  }
});
const upload = multer({ storage });

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
    // normaliza entrada
    const raw = String(req.body.username || '');
    const username = raw.trim();
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // BÚSQUEDA CASE-INSENSITIVE Y IGNORANDO ESPACIOS
    const [rows] = await pool.query(
      `
      SELECT u.id, u.username, u.passwordHash, u.role, u.groupId, u.unitId,
            u.failed_login_count, u.lock_until, u.lock_strikes, u.hard_locked
        FROM \`user\` u
        LEFT JOIN agent a ON a.code = u.username
      WHERE UPPER(TRIM(u.username)) = UPPER(TRIM(?))
      LIMIT 1
      `,
      [username]
    );
    const user = rows[0];

    if (!user) {
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

      await pool.query('UPDATE `user` SET failed_login_count=? WHERE id=? LIMIT 1', [newFailed, user.id]);
      const remaining = Math.max(0, 5 - newFailed);
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

    // 🟢 Buscar agentId si el rol es agent
    let agentId = null;
    if (user.role === 'agent') {
      const [agents] = await pool.query(
        'SELECT id FROM agent WHERE code=? LIMIT 1',
        [user.username]
      );
      agentId = agents.length ? agents[0].id : null;
    }

    const token = jwt.sign(
      {
        uid: user.id,
        username: user.username,
        role: user.role,
        groupId: user.groupId,
        unitId: user.unitId,
        agentId: agentId // << AQUI VA EL agentId calculado
      },
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
  app.get('/me', auth, async (req, res) => {
  try {
    // Datos base del usuario
    const data = {
      uid: req.user.uid,
      username: req.user.username,
      role: req.user.role,
      groupId: req.user.groupId,
      unitId: req.user.unitId,
      agentId: req.user.agentId || null
    };

    // Si es agente, busca el agentId
    let agentId = null;
    if (String(req.user.role).toLowerCase() === 'agent') {
      const [rows] = await pool.query(
        'SELECT id FROM agent WHERE code=? LIMIT 1',
        [req.user.username]
      );
      if (rows.length) agentId = rows[0].id;
    }

    res.json({
      ...data,
      agentId, // null si no aplica
    });
  } catch (err) {
    console.error('Error in /me:', err);
    res.status(500).json({ error: 'Server error' });
  }
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
    const { q, code, category, groupId, unitId, limit = 2000 } = req.query;
    const take = Math.min(Number(limit) || 100, 200);
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
         a.nickname,

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

    res.json(rows.map(r => ({
      ...r,
      nickname: decNullable(r.nickname)
    })));
   
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
      a.id, a.code, a.category, a.status AS status_agent, a.groupId, a.unitId, a.nickname, 
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
    novelty_description: r.novelty_description ? decNullable(r.novelty_description) : '',
    nickname: decNullable(r.nickname) || null
  };
  });


  return res.json(out);
}


    // --- leader_group: puedes dejarlo como lo tienes ---
    const groupId = req.user.groupId;
    const [rows] = await pool.query(
      `SELECT 
         a.id, a.code, a.category, a.status, a.groupId, a.unitId, a.municipalityId, a.nickname,   
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
      municipalityName: r.municipalityId ? `${r.dept} - ${r.name}` : '',
      nickname: decNullable(r.nickname) || null
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

    // Traer agente con code para enriquecer el log
    const [[ag]] = await pool.query(
      'SELECT id, code, groupId, unitId FROM agent WHERE id=? LIMIT 1', [id]
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

      // Mantener snapshot para el log
      const fromGroupId = ag.groupId;
      const fromUnitId  = ag.unitId;

      await pool.query('UPDATE agent SET unitId=? WHERE id=?', [unitId || null, id]);

      // ▶️ Log según acción (asignación o liberación)
      try {
        if (unitId) {
          await logEvent({
            req,
            userId: req.user.uid,
            action: Actions.AGENT_ASSIGN,
            details: {
              mode: 'leader_group_set',
              agentId: ag.id,
              agentCode: ag.code,
              fromGroupId,
              fromUnitId,
              toGroupId: req.user.groupId,
              toUnitId: Number(unitId)
            }
          });
        } else {
          await logEvent({
            req,
            userId: req.user.uid,
            action: Actions.AGENT_RELEASE,
            details: {
              mode: 'leader_group_release',
              agentId: ag.id,
              agentCode: ag.code,
              fromGroupId,
              fromUnitId,
              toGroupId: req.user.groupId,
              toUnitId: null
            }
          });
        }
      } catch {}

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

    const fromGroupId = ag.groupId;
    const fromUnitId  = ag.unitId;

    await pool.query('UPDATE agent SET unitId=NULL WHERE id=?', [id]);

    // ▶️ Log de liberación por líder de unidad
    try {
      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.AGENT_RELEASE,
        details: {
          mode: 'leader_unit_release',
          agentId: ag.id,
          agentCode: ag.code,
          fromGroupId,
          fromUnitId,
          toGroupId: ag.groupId,
          toUnitId: null
        }
      });
    } catch {}

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
async function vehicleHasOpenUse(vehicleId) {
  const [[r]] = await pool.query(
    'SELECT id FROM vehicle_uses WHERE vehicle_id=? AND ended_at IS NULL LIMIT 1',
    [vehicleId]
  );
  return r?.id || null;
}

async function validateAgentScope(req, agentId) {
  const role = String(req.user.role || '').toLowerCase();
  if (role === 'superadmin' || role === 'supervision') return true;
  if (role === 'leader_group') {
    const [[ag]] = await pool.query('SELECT groupId FROM agent WHERE id=?', [agentId]);
    return ag && Number(ag.groupId) === Number(req.user.groupId);
  }
  if (role === 'leader_unit') {
    const [[ag]] = await pool.query('SELECT unitId FROM agent WHERE id=?', [agentId]);
    return ag && Number(ag.unitId) === Number(req.user.unitId);
  }
  // AGENTE: solo puede iniciar uso para sí mismo
  if (role === 'agent') {
    return Number(req.user.agentId) === Number(agentId);
  }
  return false;
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
              (reportDate, groupId, unitId, leaderUserId,
              OF_effective, SO_effective, PT_effective,
              OF_available, SO_available, PT_available,
              OF_nov, SO_nov, PT_nov)
            VALUES (?, ?, ?, ?, 0,0,0, 0,0,0, 0,0,0)
            ON DUPLICATE KEY UPDATE updatedAt=CURRENT_TIMESTAMP(3)
          `, [isoDate, useGroupId, useUnitId, req.user.uid]);

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
    'SELECT id, code, groupId, unitId FROM agent WHERE id=? LIMIT 1',
    [agentId]
  );
  if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });

  // Ya está en alguna unidad
  if (ag.unitId) {
    return res.status(409).json({ error: 'AgenteNoDisponible', detail: 'El agente ya tiene unidad' });
  }

  const fromGroupId = ag.groupId || null;
  const fromUnitId  = ag.unitId  || null;

  // Caso A: sin grupo -> tomarlo a mi grupo/unidad
  if (!ag.groupId) {
    await pool.query('UPDATE agent SET groupId=?, unitId=? WHERE id=?', [groupId, unitId, agentId]);

    // ▶️ Log de asignación (tomado desde “libre total”)
    try {
      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.AGENT_ASSIGN,
        details: {
          mode: 'leader_unit_add_from_free',
          agentId: ag.id,
          agentCode: ag.code,
          fromGroupId,
          fromUnitId,
          toGroupId: groupId,
          toUnitId: unitId
        }
      });
    } catch {}

    return res.json({ ok: true });
  }

  // Caso B: mismo grupo y sin unidad -> solo set unitId
  if (ag.groupId === groupId) {
    await pool.query('UPDATE agent SET unitId=? WHERE id=?', [unitId, agentId]);

    // ▶️ Log de asignación (misma organización, solo unidad)
    try {
      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.AGENT_ASSIGN,
        details: {
          mode: 'leader_unit_add_same_group',
          agentId: ag.id,
          agentCode: ag.code,
          fromGroupId,
          fromUnitId,
          toGroupId: groupId,
          toUnitId: unitId
        }
      });
    } catch {}

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
    `SELECT id, code, category, status, location, nickname FROM agent WHERE ${where} ORDER BY code`,
    params
  );
  res.json(rows.map(r => ({ ...r, nickname: decNullable(r.nickname) })));
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

// Listado de agentes (admin/supervisión/supervisor/leader_group) con paginación
app.get('/admin/agents', auth, requireRole('superadmin', 'supervision', 'supervisor', 'leader_group'), async (req, res) => {
  try {
    const {
      q,
      code,
      category,
      groupId,
      unitId,
      freeOnly,
      // 📄 nuevo: paginado
      page = 1,
      pageSize = 100, // default alto pero controlado
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize, 10) || 100, 1), 1000); // tope razonable
    const offset = (p - 1) * ps;

    let where = '1=1';
    const params = [];

    // 🔐 Restricción para leader_group
    if (req.user.role === 'leader_group') {
      if (!req.user.groupId) return res.status(403).json({ error: 'Forbidden' });
      // Si envían groupId distinto, bloquear
      if (groupId && Number(groupId) !== Number(req.user.groupId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      where += ' AND a.groupId=?';
      params.push(Number(req.user.groupId));
    } else {
      // Roles superiores
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
      params.push(String(category));
    }

    if (unitId) {
      where += ' AND a.unitId=?';
      params.push(Number(unitId));
    }

    // Solo agentes sin unidad
    if (String(freeOnly || '0') === '1') {
      where += ' AND (a.unitId IS NULL OR a.unitId = 0)';
    }

    // 📊 total para paginación
    const [[{ total }]] = await pool.query(
      `
        SELECT COUNT(*) AS total
          FROM agent a
          LEFT JOIN \`group\` g ON g.id = a.groupId
          LEFT JOIN unit u     ON u.id = a.unitId
          LEFT JOIN municipality m ON m.id = a.municipalityId
         WHERE ${where}
      `,
      params
    );

    // 🔎 página solicitada
    const [rows] = await pool.query(
      `
        SELECT 
          a.id, a.code, a.category, a.status,
          a.groupId, g.code AS groupCode,
          a.unitId, u.name AS unitName,
          a.municipalityId, m.name AS municipalityName, m.dept,
          a.nickname 
        FROM agent a
        LEFT JOIN \`group\` g ON g.id = a.groupId
        LEFT JOIN unit u ON u.id = a.unitId
        LEFT JOIN municipality m ON a.municipalityId = m.id
        WHERE ${where}
        ORDER BY a.code
        LIMIT ? OFFSET ?
      `,
      [...params, ps, offset]
    );
    const items = rows.map(r => ({
      ...r,
      nickname: decNullable(r.nickname)  // << DESCIFRA
    }));

    res.json({
      page: p,
      pageSize: ps,
      total: Number(total) || 0,
      items,
    });
  } catch (e) {
    res.status(500).json({ error: 'AgentListError', detail: e.message });
  }
});


// Crear agente (con nickname cifrado)
app.post('/admin/agents', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { code, category, groupId, unitId, nickname } = req.body;

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

  const encNick = encNullable(nickname && String(nickname).trim() !== '' ? String(nickname) : null);

  // ❌ ignorar cualquier status/municipalityId que envíen
  const status = 'SIN NOVEDAD';
  const municipalityId = 11001; // o null si no quieres setear por defecto

  try {
    await pool.query(
      'INSERT INTO agent (code, category, groupId, unitId, status, municipalityId, nickname) VALUES (?,?,?,?,?,?,?)',
      [code.trim(), category, groupId || null, unitId || null, status, municipalityId, encNick]
    );
    res.json({ ok:true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') res.status(409).json({ error: 'El código ya existe' });
    else res.status(500).json({ error: 'No se pudo crear', detail: e.message });
  }
});


// Actualizar agente (SOLO campos propios de agent; sin status/municipalityId)
app.put('/admin/agents/:id', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { id } = req.params;
  let { code, category, groupId, unitId, nickname } = req.body;

  // ❌ Ignorar explícitamente campos que NO deben tocarse desde este flujo
  // (si llegan, se desechan para no romper compatibilidad con front viejos)
  delete req.body.status;
  delete req.body.municipalityId;

  const sets = [], params = [];
  const changes = {};

  if (code !== undefined) {
    if (!/^[A-Z][0-9]+$/.test(String(code))) return res.status(422).json({ error:'Código inválido' });
    const codeUp = String(code).trim().toUpperCase();
    sets.push('code=?'); params.push(codeUp);
    changes.code = codeUp;
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

  // nickname (cifrado)
  if (nickname !== undefined) {
    const encNick = encNullable(nickname && String(nickname).trim() !== '' ? String(nickname) : null);
    sets.push('nickname=?'); params.push(encNick);
    changes.nickname_set = !!(nickname && String(nickname).trim() !== '');
  }

  // Integridad: si cambias groupId sin unitId, forzar unitId=null
  if (('groupId' in changes) && changes.groupId !== null && (unitId === undefined)) {
    sets.push('unitId=?'); params.push(null);
    changes.unitId = null;
  }

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
   // Solo unidades que tienen al menos 1 agente asignado
   const [units] = await pool.query(`
     SELECT u.id, u.name
       FROM unit u
       JOIN agent a ON a.unitId = u.id
      WHERE u.groupId = ?
      GROUP BY u.id, u.name
      HAVING COUNT(a.id) > 0
   `, [req.user.groupId]);

    const [reports] = await pool.query(
      'SELECT unitId FROM dailyreport WHERE reportDate=? AND groupId=?',
      [date, req.user.groupId]
    );
    const reported = new Set(reports.map(r => r.unitId));
    const done = [], pending = [];
    for (const u of units) {
      (reported.has(u.id) ? done : pending).push({ unitName: u.name });
    }
    return res.json({ date, done, pending });
  }
  // ... resto igual para superadmin/supervision
});





// ---------- Cron (solo logs) ----------
cron.schedule('16 6 * * *', () => console.log('⏰ Recordatorio 06:16'), { timezone: 'America/Bogota' });
cron.schedule('45 6 * * *', () => console.log('⏳ Cierre ventana 06:45'), { timezone: 'America/Bogota' });
cron.schedule('15 14 * * *', () => console.log('⏰ Recordatorio 14:15'), { timezone: 'America/Bogota' });
cron.schedule('45 14 * * *', () => console.log('⏳ Cierre ventana 14:45'), { timezone: 'America/Bogota' });


// Endpoint: Detalle de agentes por reporte
app.get('/admin/report-agents/:id', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  // ... seguridad leader_group ...

  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing reportId' });

  const [rows] = await pool.query(`
    SELECT 
      a.id AS agentId,          
      a.code, a.nickname,
      a.category,
      da.state,
      da.groupId, g.code AS groupCode,
      da.unitId, u.name AS unitName,
+     da.municipalityId,
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
    nickname: r.nickname ? decNullable(r.nickname) : null,
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

// End point para contador de días de racha por agente (cálculo JS, preciso + municipio/depto última novedad)
app.get('/admin/agents-streaks', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  try {
    const {
      groupId,
      unitId,
      page = 1,
      pageSize = 100,
      q,
      category
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize, 10) || 100, 1), 1000);
    const offset = (p - 1) * ps;

    let where = '1=1';
    const params = [];

    // RBAC y filtros por rol
    if (req.user.role === 'leader_group') {
      where += ' AND a.groupId=?';
      params.push(req.user.groupId);
    } else if (groupId) {
      where += ' AND a.groupId=?';
      params.push(Number(groupId));
    }
    if (unitId) {
      where += ' AND a.unitId=?';
      params.push(Number(unitId));
    }

    // Filtros búsqueda/categoría
    if (q && String(q).trim()) {
      where += ' AND (a.code LIKE ? OR a.nickname LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (category && category !== 'ALL') {
      where += ' AND a.category = ?';
      params.push(category);
    }

    // Total de agentes (para paginación)
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM agent a WHERE ${where}`, params
    );

    // Agentes de la página
    const [agents] = await pool.query(
      `
      SELECT 
        a.id AS agentId,
        a.code,
        a.category,
        a.status,
        a.groupId,
        g.code AS groupCode,
        g.name AS groupName,
        a.unitId,
        a.nickname
      FROM agent a
      LEFT JOIN \`group\` g ON g.id = a.groupId
      WHERE ${where}
      ORDER BY a.code
      LIMIT ? OFFSET ?
      `,
      [...params, ps, offset]
    );

    // === AGREGA BLOQUE DE FECHA Y AGENTES ===
    const dateLimit = req.query.date || new Date().toISOString().slice(0,10);

    const agentIds = agents.map(a => a.agentId);
    if (agentIds.length === 0) {
      return res.json({ page: p, pageSize: ps, total: 0, items: [] });
    }

    // ======= ÚLTIMA NOVEDAD DEL AGENTE (ESTADO) HASTA ESA FECHA =======
    const [latestNovedades] = await pool.query(
      `
      SELECT
        da.agentId,
        da.state AS status,
        da.municipalityId,
        m.name AS municipalityName,
        m.dept
      FROM dailyreport_agent da
      JOIN dailyreport dr ON dr.id = da.reportId
      LEFT JOIN municipality m ON m.id = da.municipalityId
      WHERE da.agentId IN (${agentIds.map(() => '?').join(',')})
        AND dr.reportDate = (
          SELECT MAX(dr2.reportDate)
          FROM dailyreport_agent da2
          JOIN dailyreport dr2 ON dr2.id = da2.reportId
          WHERE da2.agentId = da.agentId AND dr2.reportDate <= ?
        )
      ORDER BY da.agentId
      `,
      [...agentIds, dateLimit]
    );
    const novedadesMap = {};
    for (const row of latestNovedades) {
      novedadesMap[row.agentId] = {
        status: row.status,
        municipalityId: row.municipalityId,
        municipalityName: row.municipalityId ? `${row.dept} - ${row.municipalityName}` : '',
        dept: row.dept || ''
      };
    }

    // ======= DÍAS LABORADOS (SOLO HASTA ESA FECHA) =======
    const [reports] = await pool.query(
      `
      SELECT
        dra.agentId,
        dr.reportDate,
        dra.state
      FROM dailyreport_agent dra
      JOIN dailyreport dr ON dr.id = dra.reportId
      WHERE dra.agentId IN (${agentIds.map(() => '?').join(',')})
        AND dr.reportDate <= ?
      ORDER BY dra.agentId, dr.reportDate DESC
      `,
      [...agentIds, dateLimit]
    );
    const repMap = {};
    for (const r of reports) {
      if (!repMap[r.agentId]) repMap[r.agentId] = [];
      repMap[r.agentId].push({
        date: r.reportDate,
        state: r.state
      });
    }

    function normalizeState(s) {
      return String(s || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    }

    const validStatesRaw = [
      'SIN NOVEDAD',
      'SERVICIO',
      'COMISIÓN DEL SERVICIO',
      'COMISIÓN EN EL EXTERIOR'
    ];
    const validStates = validStatesRaw.map(normalizeState);

    const streaks = {};
    for (const agent of agents) {
      const list = repMap[agent.agentId] || [];
      let streak = 0;
      for (const reg of list) {
        const normalized = normalizeState(reg.state);
        if (validStates.includes(normalized)) {
          streak += 1;
        } else {
          break;
        }
      }
      streaks[agent.agentId] = streak;
    }

    // ==== RESPUESTA FINAL: Incluye estado y municipio para ese día ====
    res.json({
      page: p,
      pageSize: ps,
      total: Number(total) || 0,
      items: agents.map(a => ({
        ...a,
        nickname: a.nickname ? decNullable(a.nickname) : null,
        current_streak: streaks[a.agentId] ?? 0,
        status: novedadesMap[a.agentId]?.status || a.status || null,
        municipalityId: novedadesMap[a.agentId]?.municipalityId ?? null,
        municipalityName: novedadesMap[a.agentId]?.municipalityName ?? '',
        dept: novedadesMap[a.agentId]?.dept ?? ''
      })),
    });

  } catch (e) {
    console.error('GET /admin/agents-streaks error:', e);
    res.status(500).json({ error: 'AgentStreakError', detail: e.message });
  }
});



// Obtener un agente por id (incluye joins útiles)
app.get('/admin/agents/:id', auth, requireRole('superadmin', 'supervision', 'leader_group'), async (req, res) => {
  const { id } = req.params;
  const [[ag]] = await pool.query(
    `SELECT 
        a.id, a.code, a.category, a.status,
        a.groupId, g.code AS groupCode,
        a.unitId, u.name AS unitName,
        a.municipalityId, m.name AS municipalityName, m.dept,
        a.nickname
      FROM agent a
      LEFT JOIN \`group\` g ON g.id = a.groupId
      LEFT JOIN unit u ON u.id = a.unitId
      LEFT JOIN municipality m ON a.municipalityId = m.id
     WHERE a.id = ? LIMIT 1`,
    [id]
  );
  if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });

  // Seguridad: leader_group solo ve agentes de su grupo
  if (req.user.role === 'leader_group' && ag.groupId !== req.user.groupId) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  res.json({
    ...ag,
    nickname: ag.nickname ? decNullable(ag.nickname) : null
  });
});


// Para líder de grupo: cumplimiento de unidades de SU grupo
app.get('/dashboard/compliance-units', auth, requireRole('leader_group'), async (req, res) => {
  const { date, groupId } = req.query;
  const gid = groupId || req.user.groupId;

 // 1. Solo unidades del grupo que tienen ≥1 agente
 const [units] = await pool.query(`
   SELECT u.id, u.name
     FROM unit u
     JOIN agent a ON a.unitId = u.id
    WHERE u.groupId = ?
    GROUP BY u.id, u.name
    HAVING COUNT(a.id) > 0
 `, [gid]);

  // 2. ¿Cuáles ya reportaron ese día?
  const [reports] = await pool.query(
    'SELECT unitId FROM dailyreport WHERE reportDate=? AND groupId=?',
    [date, gid]
  );
  const reported = new Set(reports.map(r => r.unitId));
  const done = [], pending = [];
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

// GET /admin/agents/:id/history?from=YYYY-MM-01&to=YYYY-MM-31
app.get('/admin/agents/:id/history',
  auth,
  requireRole('superadmin','supervision','leader_group', 'leader_unit', 'agent'),
  async (req, res) => {
    const { id } = req.params;
    const { from, to } = req.query;

    // Seguridad y existencia del agente (mismo patrón que /admin/agents/:id/novelty)
    const [[ag]] = await pool.query(
      'SELECT id, groupId FROM agent WHERE id=? LIMIT 1', [id]
    );
    if (!ag) return res.status(404).json({ error: 'Agente no encontrado' });
    if (String(req.user.role).toLowerCase() === 'leader_group' && ag.groupId !== req.user.groupId) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Rango obligatorio
    if (!from || !to) return res.status(422).json({ error: 'Faltan from/to (YYYY-MM-DD)' });

    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(dr.reportDate, '%Y-%m-%d') AS date,
        da.state,
        da.municipalityId,
        m.dept, m.name AS municipalityName,
        da.novelty_start, da.novelty_end,
        da.novelty_description
      FROM dailyreport_agent da
      JOIN dailyreport dr ON dr.id = da.reportId
      LEFT JOIN municipality m ON m.id = da.municipalityId
      WHERE da.agentId = ?
        AND dr.reportDate BETWEEN ? AND ?
      ORDER BY dr.reportDate ASC
    `, [id, from, to]);

    // Descifrar descripción si existe y normalizar payload
    const data = rows.map(r => ({
      date: r.date,
      state: r.state,
      municipalityId: r.municipalityId,
      municipalityName: r.municipalityId ? `${r.dept} - ${r.municipalityName}` : '',
      novelty_start: r.novelty_start ? String(r.novelty_start).slice(0,10) : null,
      novelty_end:   r.novelty_end   ? String(r.novelty_end).slice(0,10)   : null,
      novelty_description: r.novelty_description ? decNullable(r.novelty_description) : null
    }));

    res.json({ items: data });
  }
);

// === Fechas conmemorativas (ANIVERSARIOS): semana domingo-sábado por MM-DD ===
// Reusa tu lógica actual como handler
const fechasSemanaHandler = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0,10);
    const dateStr = String(req.query.date || todayStr).slice(0,10);
    const [y, m, d] = dateStr.split('-').map(Number);
    const base = new Date(y, m - 1, d);

    const dayIdx = base.getDay(); // 0=Dom .. 6=Sáb
    const start = new Date(base); start.setDate(base.getDate() - dayIdx);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(start); dt.setDate(start.getDate() + i);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      days.push({ date: dt, mmdd: `${mm}-${dd}` });
    }

    const isLeap = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
    const mdList = days.map(d => d.mmdd).filter(md => isLeap ? true : md !== '02-29');

    if (!mdList.length) {
      const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      return res.json({ week_start: fmt(days[0].date), week_end: fmt(days[6].date), items: [] });
    }

    const placeholders = mdList.map(() => '?').join(',');
    const orderField   = mdList.map(() => '?').join(',');
    const sql = `
      SELECT id, fecha, gao, description
        FROM fechas
       WHERE DATE_FORMAT(fecha, '%m-%d') IN (${placeholders})
       ORDER BY FIELD(DATE_FORMAT(fecha, '%m-%d'), ${orderField}), id ASC
    `;
    const params = [...mdList, ...mdList];
    const [rows] = await pool.query(sql, params);

    const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    res.json({ week_start: fmt(days[0].date), week_end: fmt(days[6].date), items: rows });
  } catch (e) {
    console.error('GET /fechas/semana (aniversarios) error', e);
    res.status(500).json({ error: 'FechasWeekAnnivError' });
  }
};

// Mantén tu ruta original…
app.get('/fechas/semana', auth, fechasSemanaHandler);
// …y añade este alias para que funcione con tu patrón /api/...
app.get('/api/fechas/semana', auth, fechasSemanaHandler);

// ===== VEHICLES =====

// GET /vehicles?query=&due_within=30&page=1&pageSize=100
app.get('/vehicles', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  try {
    const { query, due_within, page = 1, pageSize = 100 } = req.query;
    const p = Math.max(parseInt(page,10)||1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize,10)||100,1), 1000);
    const off = (p-1)*ps;

    const where = [];
    const args  = [];

    if (query && String(query).trim()) {
      where.push('(v.code LIKE ? OR v.sigla LIKE ?)');
      const q = `%${String(query).trim()}%`;
      args.push(q, q);
    }
    if (!isNaN(parseInt(due_within,10))) {
      const n = Math.max(parseInt(due_within,10), 0);
      where.push('(v.soat_date  <= DATE_ADD(CURDATE(), INTERVAL ? DAY) OR v.tecno_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY))');
      args.push(n, n);
    }

    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';

    const [rows] = await pool.query(
      `SELECT
          v.id,
          v.code,
          v.sigla,
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

    // DESCIFRA NICKNAME EN CADA FILA
    for (const row of rows) {
      row.agentNickname = decNullable(row.agentNickname);
      row.hasOpenUse = !!row.hasOpenUse;
    }

    // No olvides el contador para paginación:
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM vehicles v ${whereSql}`, args);

    res.json({ page:p, pageSize:ps, total: Number(total)||0, items: rows });
  } catch (e) {
    res.status(500).json({ error:'VehiclesListError', detail: e.message });
  }
});

// POST /vehicles  (crear)
app.post('/vehicles', auth, requireRole('superadmin','supervision'), async (req, res) => {
  try {
    const { code, sigla, soatDate, tecnoDate, category, groupId, unitId } = req.body;
    if (!code || !sigla || !soatDate || !tecnoDate || !category || !groupId || !unitId)
      return res.status(422).json({ error:'Campos requeridos' });

    await pool.query(
      'INSERT INTO vehicles (code, sigla, soat_date, tecno_date, category, group_id, unit_id) VALUES (?,?,?,?,?,?,?)',
      [
        String(code).trim().toUpperCase(),
        String(sigla).trim().toUpperCase(),
        soatDate,
        tecnoDate,
        category,
        groupId,
        unitId
      ]
    );
    await logEvent({ req, userId:req.user.uid, action: Actions.VEHICLE_CREATE, details:{ code, sigla } });
    res.json({ ok:true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error:'Código duplicado' });
    res.status(500).json({ error:'VehicleCreateError', detail: e.message });
  }
});

// PUT /vehicles/:id  (editar)
app.put('/vehicles/:id', auth, requireRole('superadmin','supervision'), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, sigla, soatDate, tecnoDate, category, groupId, unitId } = req.body;
    const sets = [], args = [];
    if (code     !== undefined) { sets.push('code=?');      args.push(String(code).trim().toUpperCase()); }
    if (sigla    !== undefined) { sets.push('sigla=?');     args.push(String(sigla).trim().toUpperCase()); }
    if (soatDate !== undefined) { sets.push('soat_date=?'); args.push(soatDate); }
    if (tecnoDate!== undefined) { sets.push('tecno_date=?');args.push(tecnoDate); }
    if (category !== undefined) { sets.push('category=?');  args.push(category); }
    if (groupId  !== undefined) { sets.push('group_id=?');  args.push(groupId); }
    if (unitId   !== undefined) { sets.push('unit_id=?');   args.push(unitId); }
    if (!sets.length) return res.status(400).json({ error:'Nada para actualizar' });

    args.push(id);
    const [r] = await pool.query(`UPDATE vehicles SET ${sets.join(', ')} WHERE id=?`, args);
    if (!r.affectedRows) return res.status(404).json({ error:'Vehículo no encontrado' });
    await logEvent({ req, userId:req.user.uid, action: Actions.VEHICLE_UPDATE, details:{ vehicleId:Number(id), changes:Object.keys(req.body||{}) } });
    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ error:'VehicleUpdateError', detail: e.message });
  }
});

// DELETE /vehicles/:id
app.delete('/vehicles/:id', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;

    // 1. ¿Existe el vehículo?
    const [[veh]] = await pool.query('SELECT id FROM vehicles WHERE id=? LIMIT 1', [id]);
    if (!veh) return res.status(404).json({ error: 'Vehículo no encontrado' });

    // 2. ¿Hay asignaciones activas?
    const [[assign]] = await pool.query(
      'SELECT id FROM vehicle_assignments WHERE vehicle_id=? AND (end_date IS NULL OR end_date > CURDATE()) LIMIT 1',
      [id]
    );
    if (assign) return res.status(409).json({ error: 'El vehículo tiene asignaciones activas. Libere antes de eliminar.' });

    // 3. ¿Hay usos abiertos?
    const [[openUse]] = await pool.query(
      'SELECT id FROM vehicle_uses WHERE vehicle_id=? AND ended_at IS NULL LIMIT 1',
      [id]
    );
    if (openUse) return res.status(409).json({ error: 'El vehículo tiene usos abiertos. Cierre antes de eliminar.' });

    // --- BLOQUE NUEVO: BORRAR HIJOS (novedades -> usos -> asignaciones) ---
    // Primero borra novedades asociadas a los usos de este vehículo
    await pool.query(
       'DELETE FROM vehicle_novelties WHERE assignment_id IN (SELECT id FROM vehicle_assignments WHERE vehicle_id=?)',
      [id]
    );
    // Luego borra los usos históricos del vehículo
    await pool.query('DELETE FROM vehicle_uses WHERE vehicle_id=?', [id]);
    // Luego borra todas las asignaciones (históricas) del vehículo
    await pool.query('DELETE FROM vehicle_assignments WHERE vehicle_id=?', [id]);
    // ----------------------------------------------------------

    // 4. Ahora sí, elimina el vehículo
    const [r] = await pool.query('DELETE FROM vehicles WHERE id=?', [id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Vehículo no encontrado' });

    await logEvent({
      req,
      userId: req.user.uid,
      action: Actions.VEHICLE_DELETE,
      details: { vehicleId: Number(id) }
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'VehicleDeleteError', detail: e.message });
  }
});

// GET /catalogs/groups
app.get('/catalogs/groups', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, code FROM `group` ORDER BY name')
  res.json({ items: rows })
})

// GET /catalogs/units
app.get('/catalogs/units', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, groupId FROM unit ORDER BY name');
  res.json({ items: rows });
});

// ====================== VEHICLES ======================

// ... tus endpoints de vehículos (sin cambios) ...

// ==================== ASSIGNMENTS =====================

// GET /vehicles/:id/assignments
app.get('/vehicles/:id/assignments', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  const { id } = req.params;
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
  `,[id]);
  res.json(rows);
});

// POST /vehicles/:id/assignments { agent_id, odometer_start?, notes? }
app.post('/vehicles/:id/assignments', auth, requireRole('superadmin','supervision'), async (req, res) => {
  const { id } = req.params;
  const { agent_id, odometer_start, notes } = req.body;

  if (!agent_id) return res.status(422).json({ error:'agent_id requerido' });

  // Bloquear si ya hay asignación vigente para este vehículo
  const [[open]] = await pool.query(
    `SELECT id FROM vehicle_assignments
     WHERE vehicle_id=? AND end_date IS NULL
     LIMIT 1`,
    [id]
  );
  if (open) return res.status(409).json({ error:'Ya existe una asignación vigente' });

  // Insertar con fecha de inicio automática (hoy)
  await pool.query(
    `INSERT INTO vehicle_assignments (vehicle_id, agent_id, start_date, end_date, odometer_start, odometer_end, notes)
     VALUES (?, ?, CURDATE(), NULL, ?, NULL, ?)`,
    [id, agent_id, odometer_start ?? null, (notes || '').trim() || null]
  );

  await logEvent({
    req, userId:req.user.uid,
    action: Actions.VEHICLE_ASSIGN_CREATE,
    details:{ vehicleId:Number(id), agentId:Number(agent_id) }
  });

  res.json({ ok:true });
});

// PATCH /vehicles/:vehicleId/assignments/:assignmentId
app.patch('/vehicles/:vehicleId/assignments/:assignmentId', auth, requireRole('superadmin','supervision'), async (req, res) => {
  const { vehicleId, assignmentId } = req.params;
  const { end_date, odometer_end, notes } = req.body;
  let sets = [];
  let args = [];
  if (end_date !== undefined)     { sets.push('end_date=?');      args.push(end_date); }
  else                            { sets.push('end_date=CURDATE()'); } // ← usa hoy si no envían fecha
  if (odometer_end !== undefined) { sets.push('odometer_end=?');  args.push(odometer_end); }
  if (notes !== undefined)        { sets.push('notes=?');         args.push(notes); }
  if (!sets.length) return res.status(400).json({ error:'Nada para actualizar' });
  args.push(assignmentId, vehicleId);
  const [r] = await pool.query(
    `UPDATE vehicle_assignments SET ${sets.join(', ')} WHERE id=? AND vehicle_id=?`,
    args
  );
  if (!r.affectedRows) return res.status(404).json({ error:'Asignación no encontrada' });
  await logEvent({ req, userId:req.user.uid, action: Actions.VEHICLE_ASSIGN_CLOSE, details:{ vehicleId:Number(vehicleId), assignmentId:Number(assignmentId), end_date, odometer_end }});
  res.json({ ok:true });
});

// GET /vehicles/:vehicleId/assignments/:assignmentId/notes
app.get('/vehicles/:vehicleId/assignments/:assignmentId/notes', auth, async (req, res) => {
  const { vehicleId, assignmentId } = req.params
  const [[row]] = await pool.query(
    'SELECT notes FROM vehicle_assignments WHERE id=? AND vehicle_id=? LIMIT 1',
    [assignmentId, vehicleId]
  )
  res.json({ notes: row?.notes || '' })
})

// GET /vehicles/:id/last-assignment-odometer
app.get('/vehicles/:id/last-assignment-odometer', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  const { id } = req.params;
  const [[row]] = await pool.query(
    `SELECT odometer_end AS last
     FROM vehicle_assignments
     WHERE vehicle_id=? AND odometer_end IS NOT NULL
     ORDER BY end_date DESC, id DESC
     LIMIT 1`,
    [id]
  );
  res.json({ lastOdometer: row?.last ?? null });
});

// ====================== USES ==========================

// GET /vehicles/uses?vehicle_id=&agent_id=&open=1
app.get('/vehicles/uses', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  const { vehicle_id, agent_id, open } = req.query;
  const where = [], args = [];
  if (vehicle_id) { where.push('vu.vehicle_id=?'); args.push(vehicle_id); }
  if (agent_id)   { where.push('vu.agent_id=?');   args.push(agent_id);   }
  if (String(open||'0') === '1') where.push('vu.ended_at IS NULL');
  const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
  const [rows] = await pool.query(`
    SELECT vu.id, vu.vehicle_id AS vehicleId, v.code AS vehicleCode, v.sigla,
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
  `, args);
  res.json({ items: rows });
});

// POST /vehicles/uses/start
// body: { vehicle_id, agent_id, odometer_start?, notes? }
app.post('/vehicles/uses/start', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  const { vehicle_id, agent_id, odometer_start, notes } = req.body;
  if (!vehicle_id || !agent_id) return res.status(422).json({ error:'vehicle_id y agent_id requeridos' });

  // scope del agente
  const okScope = await validateAgentScope(req, Number(agent_id));
  if (!okScope) return res.status(403).json({ error:'No autorizado para iniciar uso con ese agente' });

  // no dos usos abiertos
  const openUseId = await vehicleHasOpenUse(vehicle_id);
  if (openUseId) return res.status(409).json({ error:'Uso abierto existente', useId: openUseId });

  const [r] = await pool.query(`
    INSERT INTO vehicle_uses
      (vehicle_id, agent_id, started_at, odometer_start, notes, created_by)
    VALUES (?, ?, COALESCE(?, NOW()), ?, ?, ?)`,
    [vehicle_id, agent_id, req.body.started_at || null, odometer_start ?? null, notes || null, req.user.uid]
  );
  const useId = r.insertId;

 // ⛳️ MOVER NOVEDADES EN STAGING (vehicle_id, use_id IS NULL) AL NUEVO USO
  await pool.query(
    'UPDATE vehicle_novelties SET use_id=? WHERE vehicle_id=? AND use_id IS NULL',
    [useId, vehicle_id]
  );

  await logEvent({ req, userId:req.user.uid, action: Actions.VEHICLE_USE_START, details:{ vehicleId:Number(vehicle_id), agentId:Number(agent_id), useId } });
  res.json({ id: useId });
});

// PATCH /vehicles/uses/:id/end
// body: { odometer_end?, notes? }
app.patch('/vehicles/uses/:id/end', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  const { id } = req.params;
  const { ended_at, odometer_end, notes } = req.body;

  // verificar dueño del uso/alcance del agente
  const [[useRow]] = await pool.query('SELECT vehicle_id, agent_id, ended_at FROM vehicle_uses WHERE id=? LIMIT 1',[id]);
  if (!useRow) return res.status(404).json({ error:'Uso no encontrado' });
  if (useRow.ended_at) return res.status(409).json({ error:'El uso ya está cerrado' });

  const okScope = await validateAgentScope(req, Number(useRow.agent_id));
  if (!okScope) return res.status(403).json({ error:'No autorizado para cerrar este uso' });

  const sets = [];
  const args = [];
  if (ended_at !== undefined) { sets.push('ended_at=?'); args.push(ended_at); }
  else                        { sets.push('ended_at=NOW()'); }
  sets.push('odometer_end=?'); args.push(odometer_end ?? null);
  sets.push('notes=COALESCE(?, notes)'); args.push(notes ?? null);
  args.push(id);
  await pool.query(`UPDATE vehicle_uses SET ${sets.join(', ')} WHERE id=?`, args);
  await logEvent({ req, userId:req.user.uid, action: Actions.VEHICLE_USE_END, details:{ useId:Number(id), vehicleId:Number(useRow.vehicle_id), agentId:Number(useRow.agent_id) } });
  res.json({ ok:true });
});

// GET /vehicles/:id/last-use-odometer
app.get('/vehicles/:id/last-use-odometer', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  const { id } = req.params;
  // primero intento con odometer_end del último uso cerrado; si no existe, tomo el último odometer_start
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
  );
  res.json({ lastOdometer: row?.last ?? null });
});


// =================== NOVELTIES UNIFICADAS ===================

// GET novedades de un uso o asignación
app.get(
  '/vehicles/:tipo/:id/novelties',
  auth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  async (req, res) => {
    const { tipo, id } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit,10) || 10, 1), 100);
    
    let refField = null;
    if (tipo === 'uses') refField = 'use_id';
    else if (tipo === 'vehicle') refField = 'vehicle_id';
    else if (tipo === 'assignments') {
      // Ya no soportamos novedades en asignaciones
      return res.status(410).json({ error:'NoveltiesDisabledForAssignments' });
    } else {
      return res.status(400).json({ error: 'Tipo inválido' });
    }
    const [rows] = await pool.query(`
      SELECT vn.id, vn.${refField} AS refId, vn.description, vn.photo_url AS photoUrl,
             vn.created_by AS createdBy,
             DATE_FORMAT(vn.created_at,'%Y-%m-%d %H:%i:%s') AS created_at
      FROM vehicle_novelties vn
      WHERE vn.${refField}=?
      ORDER BY vn.id DESC
      LIMIT ?
    `, [id, limit]);

    res.json({ items: rows });
  }
);

// POST crear novedad en uso o asignación
app.post(
  '/vehicles/:tipo/:id/novelties',
  auth,
  requireRole('superadmin','supervision','leader_group','leader_unit','agent'),
  upload.single('photo'),
  async (req, res) => {
    const { tipo, id } = req.params;
    let refField = null;
    if (tipo === 'uses') {
     // ❌ No se permite agregar novedades en usos (abiertos ni cerrados)
     return res.status(403).json({ error:'NoveltiesEditNotAllowedOnUses' });
    }
    else if (tipo === 'assignments') return res.status(410).json({ error:'NoveltiesDisabledForAssignments' });
    else if (tipo === 'vehicle') refField = 'vehicle_id'; 
    else return res.status(400).json({ error: 'Tipo inválido' });

    const description = String(req.body.description || '').trim();
    if (!description && !req.file) return res.status(422).json({ error: 'Debe enviar descripción o foto' });

    // Validación de existencia básica
    if (tipo === 'uses') {
      const [[exists]] = await pool.query('SELECT 1 FROM vehicle_uses WHERE id=?', [id]);
      if (!exists) return res.status(404).json({ error: 'Uso no encontrado' });
    } else if (tipo === 'assignments') {
      const [[exists]] = await pool.query('SELECT 1 FROM vehicle_assignments WHERE id=?', [id]);
      if (!exists) return res.status(404).json({ error: 'Asignación no encontrada' });
    } else if (tipo === 'vehicle') {
      const [[exists]] = await pool.query('SELECT 1 FROM vehicles WHERE id=?', [id]);
      if (!exists) return res.status(404).json({ error: 'Vehículo no encontrado' });
      // 🚫 Si hay uso abierto en el vehículo, no permitir staging
      const openUseId = await vehicleHasOpenUse(id);
      if (openUseId) return res.status(409).json({ error:'OpenUseExists', useId: openUseId });
    }

    const photoUrl = req.file
      ? path.relative(path.join(__dirname, '..'), req.file.path).replace(/\\/g, '/')
      : null;

    const [r] = await pool.query(
      `INSERT INTO vehicle_novelties (${refField}, description, photo_url, created_by)
       VALUES (?,?,?,?)`,
      [id, description || '(sin descripción)', photoUrl, req.user.uid]
    );

    await logEvent({
      req,
      userId: req.user.uid,
      action: Actions.VEHICLE_NOVELTY_CREATE,
      details: { [`${refField}`]: Number(id), noveltyId: r.insertId, hasPhoto: !!photoUrl },
    });

    res.json({ ok: true, id: r.insertId, photoUrl });
  }
);
// GET /vehicles/:id/novelties/recent
// Regla: si hay staging (vehicle_id=?, use_id IS NULL) => devolver esas;
// si no hay, “seed” copiando del último uso a staging y devolver staging.
app.get('/vehicles/:id/novelties/recent', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Math.max(parseInt(req.query.limit,10) || 10, 1), 100);

  // 1) staging existentes
  const [staged] = await pool.query(`
    SELECT id, vehicle_id AS vehicleId, use_id AS useId, description, photo_url AS photoUrl,
           created_by AS createdBy, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
    FROM vehicle_novelties
    WHERE vehicle_id=? AND use_id IS NULL
    ORDER BY id DESC
    LIMIT ?`,
    [id, limit]
  );
  if (staged.length) return res.json({ items: staged, source: 'staging' });

  // 2) último uso del vehículo
  const [[lastUse]] = await pool.query(`
    SELECT id FROM vehicle_uses
    WHERE vehicle_id=?
    ORDER BY started_at DESC, id DESC
    LIMIT 1`,
    [id]
  );
  if (!lastUse) return res.json({ items: [], source: 'none' });

  // 3) copiar novedades del último uso a staging
  await pool.query(`
    INSERT INTO vehicle_novelties (vehicle_id, use_id, description, photo_url, created_by)
    SELECT ?, NULL, vn.description, vn.photo_url, ?
    FROM vehicle_novelties vn
    WHERE vn.use_id = ?
    ORDER BY vn.id DESC
    LIMIT ?`,
    [id, req.user.uid, lastUse.id, limit]
  );

  // 4) devolver staging recién creado
  const [seeded] = await pool.query(`
    SELECT id, vehicle_id AS vehicleId, use_id AS useId, description, photo_url AS photoUrl,
           created_by AS createdBy, DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS created_at
    FROM vehicle_novelties
    WHERE vehicle_id=? AND use_id IS NULL
    ORDER BY id DESC
    LIMIT ?`,
    [id, limit]
  );
  res.json({ items: seeded, source: 'seeded_from_last_use', lastUseId: lastUse.id });
});

// DELETE una novedad
app.delete('/vehicles/novelties/:id', auth, requireRole('superadmin','supervision'), async (req, res) => {
  const { id } = req.params;
  // Solo permitir borrar si es staging (ligada al vehículo, no a un uso)
  const [[row]] = await pool.query('SELECT id, use_id FROM vehicle_novelties WHERE id=?', [id]);
  if (!row) return res.json({ ok:false });
  if (row.use_id) {
    return res.status(403).json({ error:'DeleteNotAllowedOnUseNovelties' });
  }
  const [r] = await pool.query('DELETE FROM vehicle_novelties WHERE id=?', [id]);
  res.json({ ok: !!r.affectedRows });
});

// GET /vehicles/due?within=30
app.get('/vehicles/due', auth, requireRole('superadmin','supervision','leader_group','leader_unit','agent'), async (req, res) => {
  try {
    const within = Math.max(parseInt(req.query.within,10) || 30, 0);
    const [rows] = await pool.query(`
      SELECT id, code, sigla,
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
    `, [within, within]);
    res.json({ items: rows });
  } catch(e) {
    console.error('[vehicles/due ERROR]', e);
    res.status(500).json({ error:'VehicleDueError', detail: e.message });
  }
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