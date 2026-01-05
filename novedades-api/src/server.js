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
import vehiclesRouter from './routes/vehiculos.js';
import restPlanning from './routes/rest_planning.js';
import serviceCommissionsRouter from './routes/service-commissions.js';
import adminDeptsRouter from './routes/admin-depts.js'

// === Helpers de cifrado robustos (no lanzan) ===
import crypto from 'crypto';
import path from 'path';

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

function sanitizeStr(v, maxLen = 120) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

/** Acepta 'YYYY-MM-DD'. Devuelve 'YYYY-MM-DD' o null si no es válida/lógica */
function validateISODate(iso) {
  if (!iso) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null
  const d = new Date(iso + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  // límites razonables
  const y = d.getUTCFullYear()
  if (y < 1900) return null
  const today = new Date()
  const todayYmd = today.toISOString().slice(0,10)
  if (iso > todayYmd) return null
  return iso
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
  'LICENCIA PATERNIDAD','PERMISO','DESCANSO ESPECIAL','PERMISO ACTIVIDAD PERSONAL',
  'COMISIÓN EN EL EXTERIOR','COMISIÓN DE ESTUDIO',
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

  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'))
  );

  // ...otros routers
  app.use('/vehicles', vehiclesRouter);
  app.use('/rest-planning', restPlanning) 
  app.use('/service-commissions', serviceCommissionsRouter)
  app.use('/admin/depts', adminDeptsRouter)

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

    // === Resolver agentId (regla: username == code del agente). Ajusta si usas otra relación. ===
    let agentId = null;
    let agentGroupId = null;
    let agentUnitId = null;
    try {
      const [[ag]] = await pool.query(
        'SELECT id, groupId, unitId FROM agent WHERE code = ? LIMIT 1',
        [user.username]
      );
      if (ag) {
        agentId      = ag.id ?? null;
        agentGroupId = ag.groupId ?? null;
        agentUnitId  = ag.unitId ?? null;
      }
    } catch (e) {
      console.warn('[login] no se pudo resolver agentId:', e.message);
    }

    // Firma del token con secreto consistente
    const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_KEY || 'dev_secret';

    const token = jwt.sign(
      {
        uid: user.id,
        username: user.username,
        role: user.role,
        groupId: user.groupId,
        unitId: user.unitId,
        agentId,        // <- CLAVE para validar alcance en vehiculos.js
        agentGroupId,   // opcional
        agentUnitId     // opcional
      },
      JWT_SECRET,
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
    unitId: req.user.unitId,
    agentId: req.user.agentId ?? null,       // <- agregado
    agentGroupId: req.user.agentGroupId ?? null,
    agentUnitId: req.user.agentUnitId ?? null,
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

    const qNorm = q && String(q).trim();
    let hasQ = !!qNorm;

    if (category) {
      where += ' AND a.category=?';
      params.push(String(category));
    }
    if (groupId) {
      where += ' AND a.groupId=?';
      params.push(Number(groupId));
    }
    if (unitId) {
      where += ' AND a.unitId=?';
      params.push(Number(unitId));
    }

    // Si viene code, usamos búsqueda exacta por código y
    // NO usamos q para filtrar (se ignora q en este caso).
    if (code) {
      where += ' AND a.code=?';
      params.push(String(code).toUpperCase().trim());
      hasQ = false;
    }

    // Si hay q (búsqueda libre), no la usamos en SQL porque nickname está cifrado.
    // En vez de eso traemos un bloque más grande y filtramos en JS.
    const searchLimit = hasQ ? 500 : take;

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
         a.mt,
         a.birthday,
         u.name AS unitName,
         g.code AS groupCode,
         m.dept AS muniDept,
         m.name AS muniName
       FROM agent a
       LEFT JOIN unit u ON u.id = a.unitId
       LEFT JOIN \`group\` g ON g.id = a.groupId
       LEFT JOIN municipality m ON m.id = a.municipalityId
       WHERE ${where}
       ORDER BY a.code
       LIMIT ?`,
      [...params, searchLimit]
    );

    const qLower = (qNorm || '').toLowerCase();

    let result = rows.map(r => {
      let nickname = null;
      try {
        nickname = r.nickname ? decNullable(r.nickname) : null;
      } catch {
        nickname = null;
      }
      return {
        ...r,
        nickname,
        mt: r.mt || null,
        birthday: r.birthday ? String(r.birthday).slice(0, 10) : null
      };
    });

    if (hasQ) {
      result = result.filter(r => {
        const codeLower = String(r.code || '').toLowerCase();
        const nickLower = String(r.nickname || '').toLowerCase();
        return codeLower.includes(qLower) || nickLower.includes(qLower);
      });
    }

    // Respetar el "limit" que pide el cliente
    res.json(result.slice(0, take));
  } catch (e) {
    console.error('GET /catalogs/agents error:', e);
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
      a.id,
      a.code,
      a.category,
      a.rank_order AS rank_order,
      a.status AS status_agent,
      a.groupId,
      a.unitId,
      a.nickname,
      a.mt,
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
    ORDER BY a.rank_order ASC, a.code ASC
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
    rank_order: r.rank_order != null ? Number(r.rank_order) : null,
    status,
    groupId: r.groupId,
    unitId: r.unitId,
    municipalityId: r.effectiveMunicipalityId || null,
    municipalityName,
    novelty_start: r.novelty_start || '',
    novelty_end: r.novelty_end || '',
    novelty_description: r.novelty_description ? decNullable(r.novelty_description) : '',
    nickname: decNullable(r.nickname) || null,
    mt: r.mt || null
  };
  });


  return res.json(out);
}


    // --- leader_group: dejarlo como está ---
    const groupId = req.user.groupId;
    const [rows] = await pool.query(
      `SELECT 
        a.id,
        a.code,
        a.category,
        a.rank_order AS rank_order,
        a.status,
        a.groupId,
        a.unitId,
        a.municipalityId,
        a.nickname,   
        g.code AS groupCode,
        u.name AS unitName,
        m.dept,
        m.name
      FROM agent a
      JOIN \`group\` g ON g.id = a.groupId
      LEFT JOIN unit u ON u.id = a.unitId
      LEFT JOIN municipality m ON m.id = a.municipalityId
      WHERE a.groupId = ?
      ORDER BY a.rank_order ASC, a.code ASC`,
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
      novelty_description,
      mt
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

      // ✅ Nuevo campo MT
      const mtVal = (mt && String(mt).trim() !== '') ? String(mt).trim() : null;

      // === Validaciones según estado ===
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

        // ✅ Actualización: ahora incluye mt
        await conn.query(`
          INSERT INTO dailyreport_agent
            (reportId, agentId, groupId, unitId, state, municipalityId, novelty_start, novelty_end, novelty_description, mt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            state=VALUES(state),
            municipalityId=VALUES(municipalityId),
            novelty_start=VALUES(novelty_start),
            novelty_end=VALUES(novelty_end),
            novelty_description=VALUES(novelty_description),
            mt=VALUES(mt)
        `, [reportId, ag.id, useGroupId, useUnitId, s, muniId, nStart, nEnd, nDescEnc, mtVal]);

        await conn.query(
          'UPDATE agent SET status=?, municipalityId=?, mt=? WHERE id=?',
          [s, muniId, mtVal, ag.id]
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
              novelty_description: nDesc,
              mt: mtVal // ✅ agregado al log
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

// PUT /admin/report/check  { date:'YYYY-MM-DD', agentId:number, check:0|1 }
app.put('/admin/report/check',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    try {
      const isoDate = String(req.body.date || '').slice(0,10);
      const agentId = Number(req.body.agentId);
      const val = Number(req.body.check) ? 1 : 0;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        return res.status(422).json({ error: 'Fecha inválida (YYYY-MM-DD)' });
      }
      if (!agentId) return res.status(422).json({ error: 'agentId requerido' });

      const [[ag]] = await pool.query(
        'SELECT id, groupId, unitId, status, municipalityId, mt FROM agent WHERE id=? LIMIT 1',
        [agentId]
      );
      if (!ag) return res.status(404).json({ error:'Agente no encontrado' });

      if (String(req.user.role).toLowerCase()==='leader_group' &&
          Number(ag.groupId)!==Number(req.user.groupId)) {
        return res.status(403).json({ error:'No autorizado' });
      }

      const leaderUserId = (req.user && (req.user.uid ?? req.user.id)) ?? null; // ✅ seguro

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        // Asegura encabezado
        const [[drEx]] = await conn.query(
          'SELECT id FROM dailyreport WHERE reportDate=? AND groupId=? AND unitId=? LIMIT 1',
          [isoDate, ag.groupId, ag.unitId]
        );
        let reportId = drEx?.id;
        if (!reportId) {
          await conn.query(`
            INSERT INTO dailyreport
              (reportDate, groupId, unitId, leaderUserId,
               OF_effective,SO_effective,PT_effective,
               OF_available,SO_available,PT_available,
               OF_nov,SO_nov,PT_nov)
            VALUES (?, ?, ?, ?, 0,0,0, 0,0,0, 0,0,0)
            ON DUPLICATE KEY UPDATE updatedAt=CURRENT_TIMESTAMP(3)
          `, [isoDate, ag.groupId, ag.unitId, leaderUserId]);

          const [[dr]] = await conn.query(
            'SELECT id FROM dailyreport WHERE reportDate=? AND groupId=? AND unitId=? LIMIT 1',
            [isoDate, ag.groupId, ag.unitId]
          );
          reportId = dr.id;
        }

        // Upsert check (+ copia MT si es fila nueva)
        const [[row]] = await conn.query(
          'SELECT reportId FROM dailyreport_agent WHERE reportId=? AND agentId=? LIMIT 1',
          [reportId, agentId]
        );

        if (row) {
          await conn.query(
            'UPDATE dailyreport_agent SET `check`=? WHERE reportId=? AND agentId=?',
            [val, reportId, agentId]
          );
        } else {
          await conn.query(`
            INSERT INTO dailyreport_agent
              (reportId, agentId, groupId, unitId,
               state, municipalityId, novelty_start, novelty_end, novelty_description,
               mt, \`check\`)
            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)
          `, [
            reportId, agentId, ag.groupId, ag.unitId,
            (ag.status || 'SIN NOVEDAD'), (ag.municipalityId || null),
            (ag.mt || null), val
          ]);
        }

        await conn.commit();
        res.json({ ok:true, reportId, agentId, check: !!val });
      } catch (e) {
        await conn.rollback();
        console.error('ToggleCheckError:', e?.sqlMessage || e?.message || e);
        res.status(500).json({ error:'ToggleCheckError', detail:e?.sqlMessage || e?.message });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('ServerError:', e?.message || e);
      res.status(500).json({ error:'ServerError', detail:e?.message });
    }
  }
);


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
    await pool.query(
      'UPDATE agent SET groupId=?, unitId=? WHERE id=?',
      [groupId, unitId, agentId]
    );

    // 🔁 Actualizar proyecciones de descanso a la nueva unidad
    await pool.query(
      'UPDATE rest_plans SET unit_id=? WHERE agent_id=?',
      [unitId, agentId]
    );

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
    await pool.query(
      'UPDATE agent SET unitId=? WHERE id=?',
      [unitId, agentId]
    );

    // 🔁 Actualizar proyecciones de descanso a la nueva unidad
    await pool.query(
      'UPDATE rest_plans SET unit_id=? WHERE agent_id=?',
      [unitId, agentId]
    );

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
          ['VACACIONES','EXCUSA DEL SERVICIO','PERMISO','DESCANSO ESPECIAL', 'PERMISO ACTIVIDAD PERSONAL', 'COMISIÓN EN EL EXTERIOR','SUSPENDIDO','HOSPITALIZADO'].includes(r.state)

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

      // ✅ MT (nullable, sin cifrar)
      const mtVal = (p.mt && String(p.mt).trim() !== '') ? String(p.mt).trim() : null;

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

      // guardar resolución para insert posterior (✅ incluye mt)
      p._resolved = { state, muniId, novelty_start, novelty_end, novelty_description, mt: mtVal };
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
      const { state, muniId, novelty_start, novelty_end, novelty_description, mt } = p._resolved;

      // evitar duplicados del MISMO día en otros reports
      await deleteAgentRowsSameDate(conn, reportDate, ag.id, reportId);

      const novDescEnc = encNullable(novelty_description);

      // ✅ INSERT incluye mt (no cifrado)
      await conn.query(
        `INSERT INTO dailyreport_agent 
           (reportId, agentId, groupId, unitId, state, municipalityId, novelty_start, novelty_end, novelty_description, mt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [reportId, ag.id, groupId, ag.unitId, state, muniId, novelty_start, novelty_end, novDescEnc, mt]
      );

      await conn.query(
        'UPDATE agent SET status=?, municipalityId=?, mt=? WHERE id=?',
        [state, muniId, mt, ag.id]
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
          agents: people.map(p => String(p.agentCode || '').toUpperCase().trim()),
          // opcional: incluir mt en log por agente si te interesa trazabilidad
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

// GET /admin/agents
app.get('/admin/agents', auth, requireRole('superadmin','supervision','supervisor','leader_group'), async (req, res) => {
  try {
    // ======= Params
    const q        = String(req.query.q || '').trim();
    const groupId  = req.query.groupId ? Number(req.query.groupId) : null;
    const unitId   = req.query.unitId  ? Number(req.query.unitId)  : null;
    const freeOnly = Number(req.query.freeOnly || 0) === 1;   // SOLO sin unidad
    const limit    = Math.min(Math.max(parseInt(req.query.limit)  || 100, 1), 5000);
    const offset   = Math.max(parseInt(req.query.offset) || 0, 0);

    // ======= Restringe por rol (líder sólo su grupo)
    let leaderGroupId = null;
    if (String(req.user.role).toLowerCase() === 'leader_group') {
      leaderGroupId = Number(req.user.groupId) || null;
      if (!leaderGroupId) return res.status(403).json({ error: 'No autorizado (sin groupId de líder)' });
    }

    // ======= SELECT (LEFT JOIN para no perder "sin unidad"; backticks en `group`)
    const baseSelect = `
      SELECT
        a.id, a.code, a.nickname, a.category,
        a.groupId, a.unitId,
        g.code AS groupCode,
        u.name AS unitName
      FROM agent a
      LEFT JOIN \`group\` g ON g.id = a.groupId
      LEFT JOIN unit u      ON u.id = a.unitId
    `;

    const where = [];
    const params = [];

    // Filtro "sin unidad": soporta NULL y 0
    if (freeOnly) {
      where.push('(a.unitId IS NULL OR a.unitId = 0)');
    } else if (unitId) {
      // si piden unidad específica y NO es freeOnly
      where.push('a.unitId = ?');
      params.push(unitId);
    }

    if (groupId) {
      where.push('a.groupId = ?');
      params.push(groupId);
    }

    // Forzar alcance del líder
    if (leaderGroupId) {
      where.push('a.groupId = ?');
      params.push(leaderGroupId);
    }

    // Búsqueda
    if (q) {
      where.push('(a.code LIKE ? OR a.nickname LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like);
    }

    // (opcional) evita soft-deleted si lo usas
    // where.push('IFNULL(a.isDeleted,0)=0');

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Orden estable: categoría (OF/SO/PT) y luego código
    const orderSql = `
      ORDER BY
        CASE a.category
          WHEN 'OF' THEN 1
          WHEN 'SO' THEN 2
          WHEN 'ME' THEN 2  -- por si convives SO/ME
          WHEN 'PT' THEN 3
          ELSE 99
        END,
        a.code
    `;

    // Count total
    const countSql = `
      SELECT COUNT(*) AS total
      FROM agent a
      LEFT JOIN \`group\` g ON g.id = a.groupId
      LEFT JOIN unit u      ON u.id = a.unitId
      ${whereSql}
    `;
    const [cnt] = await pool.query(countSql, params);
    const total = Number(cnt?.[0]?.total || 0);

    // Paginado
    const rowsSql = `
      ${baseSelect}
      ${whereSql}
      ${orderSql}
      LIMIT ? OFFSET ?
    `;
    const rowsParams = [...params, limit, offset];
    const [rows] = await pool.query(rowsSql, rowsParams);

    // Normaliza salida (nickname puede venir cifrado)
    const items = (rows || []).map(r => ({
      id: r.id,
      code: r.code,
      nickname: r.nickname ? decNullable(r.nickname) : null,
      category: r.category,
      groupId: r.groupId,
      groupCode: r.groupCode,
      unitId: r.unitId,
      unitName: r.unitName
    }));

    res.json({ items, total, limit, offset });
  } catch (e) {
    console.error('AdminAgentsError:', e);
    res.status(500).json({ error: 'AdminAgentsError', detail: e.message });
  }
});

// Crear agente (con nickname cifrado)
app.post('/admin/agents', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  let { code, category, groupId, unitId, nickname, mt, birthday } = req.body;

  code = String(code || '').trim().toUpperCase();
  if (!/^[A-Z][0-9]+$/.test(code)) return res.status(422).json({ error: 'Código inválido (LETRA + números)' });

  category = String(category || '').toUpperCase();
  if (!['OF','SO','PT'].includes(category)) return res.status(422).json({ error: 'Categoría inválida' });

  if (groupId) {
    const [[g]] = await pool.query('SELECT id FROM `group` WHERE id=? LIMIT 1', [groupId]);
    if (!g) return res.status(404).json({ error: 'Grupo no existe' });
  }
  if (unitId) {
    const [[u]] = await pool.query('SELECT id FROM unit WHERE id=? LIMIT 1', [unitId]);
    if (!u) return res.status(404).json({ error: 'Unidad no existe' });
  }

  const encNick = encNullable(sanitizeStr(nickname, 120));
  const mtClean  = sanitizeStr(mt, 80);
  const bday     = validateISODate(birthday);

  // ❌ ignorar status/municipalityId que envíen
  const status = 'SIN NOVEDAD';
  const municipalityId = null; // ← si no quieres default fijo, deja null

  try {
    const [r] = await pool.query(
      `INSERT INTO agent (code, category, groupId, unitId, status, municipalityId, nickname, mt, birthday)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [code, category, groupId || null, unitId || null, status, municipalityId, encNick, mtClean, bday]
    );

    await logEvent({
      req, userId: req.user.uid,
      action: Actions.AGENT_CREATE,
      details: { agentId: r.insertId, code, category, groupId: groupId||null, unitId: unitId||null, mt: mtClean, birthday: bday }
    });

    res.json({ ok: true, id: r.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') res.status(409).json({ error: 'El código ya existe' });
    else res.status(500).json({ error: 'No se pudo crear', detail: e.message });
  }
});

// Actualizar agente (SOLO campos propios de agent; sin status/municipalityId)
app.put('/admin/agents/:id', auth, requireRole('superadmin', 'supervision'), async (req, res) => {
  const { id } = req.params;
  let { code, category, groupId, unitId, nickname, mt, birthday } = req.body;

  delete req.body.status;
  delete req.body.municipalityId;

  const sets = [], params = [];
  const changes = {};

  // code (solo si viene)
  if (code !== undefined) {
    const codeUp = String(code || '').trim().toUpperCase();
    if (!/^[A-Z][0-9]+$/.test(codeUp)) return res.status(422).json({ error:'Código inválido' });
    sets.push('code=?'); params.push(codeUp);
    changes.code = codeUp;
  }

  // category (solo si viene)
  if (category !== undefined) {
    const catUp = String(category || '').toUpperCase();
    if (!['OF','SO','PT'].includes(catUp)) return res.status(422).json({ error:'Categoría inválida' });
    sets.push('category=?'); params.push(catUp);
    changes.category = catUp;
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
    const encNick = encNullable(sanitizeStr(nickname, 120));
    sets.push('nickname=?'); params.push(encNick);
    changes.nickname_set = encNick != null;
  }

  // mt (string corto o null)
  if (mt !== undefined) {
    const mtClean = sanitizeStr(mt, 80);
    sets.push('mt=?'); params.push(mtClean);
    changes.mt_set = true;
  }

  // birthday (ISO o null)
  if (birthday !== undefined) {
    const bday = validateISODate(birthday);
    sets.push('birthday=?'); params.push(bday);
    changes.birthday = bday;
  }

  // Integridad: si cambias groupId y NO enviaste unitId, forzar unitId=null
  if (('groupId' in changes) && changes.groupId !== undefined && unitId === undefined) {
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
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error:'El código ya existe' });
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
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    const { date, groups, units } = req.query;
    if (!date) return res.status(400).json({ error:'Missing date' });

    // 1) Alcance base (sin fecha)
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

    // 2) Última fecha <= date
    const [[latest]] = await pool.query(
      `SELECT MAX(reportDate) AS lastDate
         FROM dailyreport
        WHERE ${baseWhere} AND reportDate <= ?`,
      [...baseArgs, date]
    );
    if (!latest?.lastDate) return res.json([]);

    // 3) Reports de esa fecha
    const [reports] = await pool.query(
      `SELECT id FROM dailyreport WHERE ${baseWhere} AND reportDate = ?`,
      [...baseArgs, latest.lastDate]
    );
    if (!reports.length) return res.json([]);
    const reportIds = reports.map(r => r.id);
    const qMarks = reportIds.map(() => '?').join(',');

    // Por si hay muchos nombres
    await pool.query(`SET SESSION group_concat_max_len = 65535`);

    // 4) Agregación con NICKS
    const [rows] = await pool.query(`
      SELECT 
        m.id, m.name, m.dept, m.lat, m.lon, 
        da.groupId,
        g.code AS groupCode,
        da.unitId,
        u.name AS unitName,
        COUNT(da.agentId) AS agent_count,
        GROUP_CONCAT(DISTINCT a.nickname ORDER BY a.nickname SEPARATOR '||') AS nicknames
      FROM dailyreport_agent da
      JOIN municipality m ON m.id = da.municipalityId
      JOIN \`group\` g     ON g.id = da.groupId
      LEFT JOIN unit u     ON u.id = da.unitId
      LEFT JOIN agent a    ON a.id = da.agentId
      WHERE da.reportId IN (${qMarks})
      GROUP BY m.id, da.groupId, da.unitId
    `, reportIds);

    // 5) Normaliza respuesta para el front, DESCIFRANDO los nicknames
    const out = rows.map(r => ({
      id: r.id,
      name: r.name,
      dept: r.dept,
      lat: r.lat,
      lon: r.lon,
      groupId: r.groupId,
      groupCode: r.groupCode,
      unitId: r.unitId,
      unitName: r.unitName,
      agent_count: Number(r.agent_count || 0),
      nicknames: typeof r.nicknames === 'string'
        ? r.nicknames
            .split('||')
            .filter(Boolean)
            .map(nick => typeof decNullable === 'function' ? decNullable(nick) : nick)
        : []
    }));

    res.json(out);
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
app.get('/admin/report-agents/:id',
  auth,
  requireRole('superadmin', 'supervision', 'leader_group'),
  async (req, res) => {
    // Seguridad leader_group: solo reportes de su grupo
    if (String(req.user.role).toLowerCase() === 'leader_group') {
      const [[repCheck]] = await pool.query(
        'SELECT groupId FROM dailyreport WHERE id=? LIMIT 1',
        [req.params.id]
      );
      if (!repCheck || Number(repCheck.groupId) !== Number(req.user.groupId)) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing reportId' });

    const [rows] = await pool.query(`
      SELECT 
        a.id AS agentId,
        a.code,
        a.nickname,
        a.category,
        a.rank_order,                      -- 👈 escalafón
        da.state,
        da.groupId,
        g.code AS groupCode,
        da.unitId,
        u.name AS unitName,
        da.municipalityId,
        m.name AS municipalityName,
        m.dept,
        DATE_FORMAT(da.novelty_start, '%Y-%m-%d') AS novelty_start,
        DATE_FORMAT(da.novelty_end,   '%Y-%m-%d') AS novelty_end,
        da.novelty_description,
        da.mt,
        a.mt AS mt_agent
      FROM dailyreport_agent da
      JOIN agent a              ON a.id = da.agentId
      LEFT JOIN \`group\` g     ON g.id = da.groupId
      LEFT JOIN unit u          ON u.id = da.unitId
      LEFT JOIN municipality m  ON m.id = da.municipalityId
      WHERE da.reportId = ?
      ORDER BY
        a.rank_order ASC,               -- 👈 primero escalafón
        a.code ASC                      --    luego código
    `, [id]);

    res.json(rows.map(r => ({
      ...r,
      nickname: r.nickname ? decNullable(r.nickname) : null,
      novelty_description: r.novelty_description ? decNullable(r.novelty_description) : null,
      mt: r.mt || r.mt_agent || null   // por si quieres caer al MT de la ficha
    })));
  }
);


function normQ(v) {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s || s === 'all' || s === 'null' || s === 'undefined') return undefined
  return v
}

app.get('/admin/report/detail',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    try {
      const date    = req.query.date;
      const groupId = normQ(req.query.groupId);
      const unitId  = normQ(req.query.unitId);
      if (!date) return res.status(400).json({ error: 'date requerido' });

      const where = ['dr.reportDate = ?'];
      const args  = [date];

      // Alcance leader_group
      if (String(req.user.role).toLowerCase() === 'leader_group') {
        where.push('dr.groupId = ?'); args.push(req.user.groupId);
        if (unitId !== undefined) { where.push('dr.unitId = ?'); args.push(unitId); }
      } else {
        if (groupId !== undefined) { where.push('dr.groupId = ?'); args.push(groupId); }
        if (unitId  !== undefined) { where.push('dr.unitId  = ?'); args.push(unitId);  }
      }

      // Orden seguro sin REGEXP (fall-back por prefijo + longitud + alfabético)
      const catRank = `
        CASE
          WHEN UPPER(a.category) LIKE 'OF%' THEN 0
          WHEN UPPER(a.category) IN ('ME','SO') OR UPPER(a.category) LIKE 'SUB%' THEN 1
          ELSE 2
        END
      `;
      const codePrefix = `
        CASE
          WHEN a.code REGEXP '^[A-Za-z]+' THEN UPPER(SUBSTRING(a.code,1,1))
          ELSE 'Z'
        END
      `;
      const codeLen = 'CHAR_LENGTH(a.code)';

      const sql = `
        SELECT
          da.reportId,
          dr.reportDate AS date,
          dr.groupId, dr.unitId,
          g.code AS groupCode, u.name AS unitName,

          da.agentId, a.code, a.nickname, a.category,
          da.state,
          da.municipalityId, m.name AS municipalityName, m.dept,
          da.novelty_description,
          DATE_FORMAT(da.novelty_start,'%Y-%m-%d') AS novelty_start,
          DATE_FORMAT(da.novelty_end  ,'%Y-%m-%d') AS novelty_end,

          da.mt  AS mt_report,   -- ✅ sin colisión
          a.mt   AS mt_agent,    -- ✅ sin colisión
          da.\`check\` AS checked,
          dr.updatedAt
        FROM dailyreport dr
        JOIN dailyreport_agent da ON da.reportId = dr.id
        JOIN agent a              ON a.id = da.agentId
        LEFT JOIN \`group\` g     ON g.id = dr.groupId
        LEFT JOIN unit u          ON u.id = dr.unitId
        LEFT JOIN municipality m  ON m.id = da.municipalityId
        WHERE ${where.join(' AND ')}
        ORDER BY
          g.code ASC,
          u.name ASC,
          ${catRank} ASC,
          ${codePrefix} ASC,
          ${codeLen} ASC,
          a.code ASC
      `;

      const [rows] = await pool.query(sql, args);
      const items = rows.map(r => ({
        reportId: r.reportId,
        date: r.date,
        groupId: r.groupId,
        unitId: r.unitId,
        groupCode: r.groupCode,
        unitName: r.unitName,
        agentId: r.agentId,
        code: r.code,
        nickname: r.nickname ? decNullable(r.nickname) : null,
        category: r.category,
        state: r.state,
        municipalityId: r.municipalityId,
        municipalityName: r.municipalityName,
        dept: r.dept,
        novelty_description: r.novelty_description ? decNullable(r.novelty_description) : null,
        novelty_start: r.novelty_start,
        novelty_end: r.novelty_end,
        // ✅ MT: prioriza la del detalle y cae a la del agente
        mt: r.mt_report ?? r.mt_agent ?? null,
        checked: Number(r.checked) === 1,
        updatedAt: r.updatedAt
      }));
      res.json({ items });
    } catch (err) {
      console.error('AdminReportDetailError:', err?.sqlMessage || err?.message || err);
      res.status(500).json({ error: 'AdminReportDetailError', detail: err?.sqlMessage || err?.message });
    }
  }
);


// ✅ ¿Existe el dailyreport para esa fecha (y filtros)?
app.get('/admin/report/exists',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    try {
      const date    = String(req.query.date || '').slice(0,10)
      const groupId = req.query.groupId !== undefined ? Number(req.query.groupId) : undefined
      const unitId  = req.query.unitId  !== undefined ? Number(req.query.unitId)  : undefined

      // valida fecha YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(422).json({ error: 'Fecha inválida (YYYY-MM-DD)' })
      }

      const where = ['dr.reportDate = ?']
      const args  = [date]

      // leader_group restringido a su grupo
      if (String(req.user.role).toLowerCase() === 'leader_group') {
        where.push('dr.groupId = ?'); args.push(req.user.groupId)
        if (unitId !== undefined) { where.push('dr.unitId = ?'); args.push(unitId) }
      } else {
        if (groupId !== undefined) { where.push('dr.groupId = ?'); args.push(groupId) }
        if (unitId  !== undefined) { where.push('dr.unitId  = ?'); args.push(unitId)  }
      }

      const sql = `
        SELECT dr.id AS reportId
        FROM dailyreport dr
        WHERE ${where.join(' AND ')}
        LIMIT 1
      `
      const [rows] = await pool.query(sql, args)
      if (!rows.length) return res.json({ exists: false })

      return res.json({ exists: true, reportId: rows[0].reportId })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'ReportExistsError' })
    }
  }
)

// Endpoint: Editar estado/novedad de un agente en un reporte específico

app.put('/admin/report-agents/:reportId/:agentId',
  auth,
  requireRole('superadmin', 'supervision', 'leader_group'),
  async (req, res) => {
    try {
      const { reportId, agentId } = req.params;
      const {
        state,
        municipalityId,
        novelty_start,
        novelty_end,
        novelty_description,
        mt // ✅ nuevo campo
      } = req.body;

      if (!reportId || !agentId) {
        return res.status(400).json({ error: 'Parámetros requeridos' });
      }

      // Seguridad leader_group: solo su propio groupId
      if (String(req.user.role).toLowerCase() === 'leader_group') {
        const [[repCheck]] = await pool.query(
          'SELECT groupId FROM dailyreport WHERE id=? LIMIT 1',
          [reportId]
        );
        if (!repCheck || Number(repCheck.groupId) !== Number(req.user.groupId)) {
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
      let novDesc  = (novelty_description ?? null);
      const mtVal  = (mt && String(mt).trim() !== '') ? String(mt).trim() : null; // ✅ normaliza MT

      // Reglas por estado (sin cambios, MT es independiente)
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

      // Verificación de existencia de la fila
      const [[exists]] = await pool.query(
        'SELECT 1 FROM dailyreport_agent WHERE reportId=? AND agentId=? LIMIT 1',
        [reportId, agentId]
      );
      if (!exists) return res.status(404).json({ error: 'Fila no encontrada' });

      const novDescEnc = encNullable(novDesc);

      // ✅ Actualiza incluyendo MT
      await pool.query(`
        UPDATE dailyreport_agent
           SET state=?,
               municipalityId=?,
               novelty_start=?,
               novelty_end=?,
               novelty_description=?,
               mt=?
         WHERE reportId=? AND agentId=?`,
        [s, muniId, novStart, novEnd, novDescEnc, mtVal, reportId, agentId]
      );

      // Sincroniza estado del agente
      await pool.query(
        'UPDATE agent SET status=?, municipalityId=?, mt=? WHERE id=?',
        [s, muniId, mtVal, agentId]
      );

      await recalcDailyReport(reportId);

      // Log (incluye mt en changes)
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
              novelty_description: novDesc,
              mt: mtVal // ✅ nuevo en log
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
      category,
      date
    } = req.query;

    const p  = Math.max(parseInt(page, 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(pageSize, 10) || 100, 1), 1000);
    const offset = (p - 1) * ps;

    // ====== Filtros base (sin q porque el nickname está cifrado) ======
    let where  = '1=1';
    const params = [];

    // RBAC por rol
    if (req.user.role === 'leader_group') {
      // líder de grupo solo ve su grupo
      where += ' AND a.groupId = ?';
      params.push(req.user.groupId);
    } else if (groupId) {
      where += ' AND a.groupId = ?';
      params.push(Number(groupId));
    }

    if (unitId) {
      where += ' AND a.unitId = ?';
      params.push(Number(unitId));
    }

    if (category && category !== 'ALL') {
      where += ' AND a.category = ?';
      params.push(category === 'ME' ? 'SO' : category);
    }

    // ====== Cargamos TODOS los agentes que cumplen los filtros base ======
    // (sin LIMIT/OFFSET, porque filtra y pagina JS por nickname descifrado)
    const [agentsRaw] = await pool.query(
      `
      SELECT 
        a.id   AS agentId,
        a.code,
        a.category,
        a.status,
        a.groupId,
        g.code AS groupCode,
        g.name AS groupName,
        a.unitId,
        u.name AS unitName,
        a.nickname,
        a.rank_order
      FROM agent a
      LEFT JOIN \`group\` g ON g.id = a.groupId
      LEFT JOIN unit u      ON u.id = a.unitId
      WHERE ${where}
      ORDER BY a.rank_order ASC, a.code ASC
      `,
      params
    );

    // Si no hay agentes, devolver vacío
    if (!agentsRaw.length) {
      return res.json({
        page: p,
        pageSize: ps,
        total: 0,
        items: []
      });
    }

    // ====== Descifrar nickname y aplicar búsqueda q (code + nickname + grupo + unidad) ======
    const qNorm = q && String(q).trim().toLowerCase();

    let agents = agentsRaw.map(a => {
      let nick = null;
      try {
        nick = a.nickname ? decNullable(a.nickname) : null;
      } catch {
        nick = null;
      }
      return {
        ...a,
        nickname: nick
      };
    });

    if (qNorm) {
      agents = agents.filter(a => {
        const code  = String(a.code || '').toLowerCase();
        const nick  = String(a.nickname || '').toLowerCase();
        const gCode = String(a.groupCode || '').toLowerCase();
        const uName = String(a.unitName || '').toLowerCase();
        return (
          code.includes(qNorm) ||
          nick.includes(qNorm) ||
          gCode.includes(qNorm) ||
          uName.includes(qNorm)
        );
      });
    }

    const total = agents.length;

    if (!total) {
      return res.json({
        page: p,
        pageSize: ps,
        total: 0,
        items: []
      });
    }

    // ====== Paginación en memoria ======
    const pageAgents = agents.slice(offset, offset + ps);

    // Fecha límite (para streaks y últimas novedades)
    const dateLimit = date || new Date().toISOString().slice(0,10);

    const agentIds = pageAgents.map(a => a.agentId);

    // ====== ÚLTIMA NOVEDAD DEL AGENTE (ESTADO + municipio) HASTA ESA FECHA ======
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
        AND dr.reportDate <= ?
      ORDER BY da.agentId, dr.reportDate DESC, da.id DESC
      `,
      [...agentIds, dateLimit]
    );

    const novedadesMap = {};
    for (const r of latestNovedades) {
      if (!novedadesMap[r.agentId]) {
        novedadesMap[r.agentId] = {
          status: r.status,
          municipalityId: r.municipalityId,
          municipalityName: r.municipalityName,
          dept: r.dept
        };
      }
    }

    // ====== HISTÓRICO PARA CÁLCULO DE RACHA ======
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
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    }

    const validStatesRaw = [
      'SIN NOVEDAD',
      'SERVICIO',
      'COMISIÓN DEL SERVICIO',
      'PERMISO ACTIVIDAD PERSONAL'
    ];
    const validStates = validStatesRaw.map(normalizeState);

    const streaks = {};
    for (const agent of pageAgents) {
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

    // ====== Respuesta final ======
    res.json({
      page: p,
      pageSize: ps,
      total,
      items: pageAgents.map(a => ({
        ...a,
        current_streak: streaks[a.agentId] ?? 0,
        status: novedadesMap[a.agentId]?.status || a.status || null,
        municipalityId: novedadesMap[a.agentId]?.municipalityId || null,
        municipalityName: novedadesMap[a.agentId]?.municipalityName || null,
        municipalityDept: novedadesMap[a.agentId]?.dept || null
      }))
    });
  } catch (e) {
    console.error('Error en /admin/agents-streaks:', e);
    res.status(500).json({ error: 'Error interno en agents-streaks', detail: e.message });
  }
});

// Reordenar escalafón global de agentes
app.post(
  '/admin/agents/reorder',
  auth,
  requireRole('superadmin'),
  async (req, res) => {
    try {
      const { items } = req.body;
      // items: [ { id, rank_order }, ... ]

      if (!Array.isArray(items) || !items.length) {
        return res.status(400).json({ error: 'PayloadInvalido', detail: 'items vacío o inválido' });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        for (const it of items) {
          const id = Number(it.id);
          const ro = Number(it.rank_order);
          if (!id || !ro) continue;

          await conn.query(
            'UPDATE agent SET rank_order=? WHERE id=?',
            [ro, id]
          );
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      res.json({ ok: true });
    } catch (e) {
      console.error('Error en /admin/agents/reorder:', e);
      res.status(500).json({ error: 'ErrorReordenEscalafon', detail: e.message });
    }
  }
);


// Obtener un agente por id (incluye joins útiles)
app.get(
  '/admin/agents/:id',
  auth,
  requireRole('superadmin', 'supervision', 'leader_group'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const [[row]] = await pool.query(
        `
        SELECT
          a.id,
          a.code,
          a.category,
          a.groupId,
          a.unitId,
          a.municipalityId,           -- ✅ alias correcto (no ".municipalityId")
          m.name  AS municipalityName,
          m.dept  AS municipalityDept,
          a.nickname,
          a.mt,
          a.birthday,
          g.code  AS groupCode,
          u.name  AS unitName
        FROM agent a
        LEFT JOIN \`group\` g ON g.id = a.groupId
        LEFT JOIN unit       u ON u.id = a.unitId
        LEFT JOIN municipality m ON m.id = a.municipalityId
        WHERE a.id = ?
        LIMIT 1
        `,
        [id]
      );

      if (!row) return res.status(404).json({ error: 'Agente no encontrado' });

      // Líder solo su grupo
      if (String(req.user.role).toLowerCase() === 'leader_group') {
        const myGroupId = req.user.groupId || req.user.group_id;
        if (!myGroupId || String(row.groupId) !== String(myGroupId)) {
          return res.status(403).json({ error: 'No autorizado para este agente' });
        }
      }

      // Descifrado seguro
      let nickname = null;
      try { nickname = decNullable ? decNullable(row.nickname) : null; } catch { nickname = null; }

      // YYYY-MM-DD para el input date
      let birthday = null;
      if (row.birthday) {
        const d = new Date(row.birthday);
        if (!isNaN(d.getTime())) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          birthday = `${yyyy}-${mm}-${dd}`;
        }
      }

      res.json({
        id: row.id,
        code: row.code,
        category: row.category,
        groupId: row.groupId,
        unitId: row.unitId,
        groupCode: row.groupCode || null,
        unitName: row.unitName || null,
        municipalityId: row.municipalityId ?? null,
        municipalityName: row.municipalityName ?? null,
        municipalityDept: row.municipalityDept ?? null,
        nickname,
        mt: row.mt ?? null,
        birthday
      });
    } catch (e) {
      console.error('GET /admin/agents/:id error:', e);
      res.status(500).json({ error: 'No se pudo cargar el agente', detail: e.message });
    }
  }
);


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
app.get(
  '/reports/export',
  auth,
  requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit'),
  async (req, res) => {
    try {
      const { date, groupId, unitId } = req.query;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        return res.status(400).json({ error: 'Falta la fecha o formato inválido (YYYY-MM-DD)' });
      }

      let where = 'dr.reportDate = ?';
      const params = [date];

      // Filtro por rol / query
      const role = String(req.user.role || '').toLowerCase();
      if (role === 'leader_group') {
        where += ' AND dr.groupId = ?';
        params.push(req.user.groupId);
      } else if (groupId) {
        where += ' AND dr.groupId = ?';
        params.push(groupId);
      }
      if (role === 'leader_unit') {
        where += ' AND dr.unitId = ?';
        params.push(req.user.unitId);
      } else if (unitId) {
        where += ' AND dr.unitId = ?';
        params.push(unitId);
      }

      const [rows] = await pool.query(
        `
        SELECT 
          a.code AS codigo_agente,
          da.state AS novedad,
          da.novelty_description AS descripcion,
          da.mt AS mt,                                   -- 👈 incluye MT
          DATE_FORMAT(da.novelty_start, '%Y-%m-%d') AS fecha_inicio,
          DATE_FORMAT(da.novelty_end,   '%Y-%m-%d') AS fecha_fin,
          g.code AS grupo,
          u.name AS unidad,
          CONCAT(m.name, ' (', m.dept, ')') AS ubicacion
        FROM dailyreport dr
        JOIN dailyreport_agent da ON da.reportId = dr.id
        JOIN agent a              ON a.id = da.agentId
        JOIN \`group\` g          ON g.id = da.groupId
        LEFT JOIN unit u          ON u.id = da.unitId
        LEFT JOIN municipality m  ON m.id = da.municipalityId
        WHERE ${where}
        ORDER BY a.code
        `,
        params
      );

      await logEvent({
        req,
        userId: req.user.uid,
        action: Actions.EXCEL_DOWNLOAD,
        details: {
          date,
          groupId: groupId || (role === 'leader_group' ? req.user.groupId : null),
          unitId:  unitId  || (role === 'leader_unit'  ? req.user.unitId  : null),
          format: 'json-export'
        }
      });

      // 🔐 Desencripta solo si viene con contenido
      const out = rows.map(r => ({
        ...r,
        descripcion: r.descripcion ? decNullable(r.descripcion) : null,
        mt: r.mt ?? null
      }));

      return res.json(out);
    } catch (err) {
      console.error('[/reports/export] ERROR:', err);
      return res.status(500).json({ error: 'Export failed', detail: err.code || err.message });
    }
  }
);
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
  requireRole('superadmin','supervision','leader_group','leader_unit'),
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

// GET /agents/:id/history?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/agents/:id/history', auth, async (req, res) => {
  const agentId = Number(req.params.id);
  const { from, to } = req.query;

  // Permitir si es admin/supervisión/líder — o si es el propio agente:
  const allowed = new Set(['superadmin','supervision','leader_group','leader_unit']);
  const isSelf = Number(req.user?.agentId) === agentId;

  if (!isSelf && !allowed.has(String(req.user?.role || ''))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!from || !to) return res.status(400).json({ error: 'Missing from/to' });

  try {
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
    `, [agentId, from, to]);

    const items = rows.map(r => ({
      date: r.date,
      state: r.state,
      municipalityId: r.municipalityId,
      municipalityName: r.municipalityId ? `${r.dept} - ${r.municipalityName}` : '',
      novelty_start: r.novelty_start ? String(r.novelty_start).slice(0,10) : null,
      novelty_end:   r.novelty_end   ? String(r.novelty_end).slice(0,10)   : null,
      novelty_description: r.novelty_description ? decNullable(r.novelty_description) : null,
    }));

    res.json({ items });
  } catch (e) {
    console.error('GET /agents/:id/history error:', e?.message || e);
    res.status(500).json({ error: 'Internal error' });
  }
});

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

// GET /my/report/detail?date=YYYY-MM-DD
app.get('/my/report/detail',
  auth,
  requireRole('leader_unit'),
  async (req, res) => {
    try {
      const date = String(req.query.date || '').slice(0,10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(422).json({ error:'Fecha inválida (YYYY-MM-DD)' });
      }

      const groupId = req.user.groupId;
      const unitId  = req.user.unitId;

      const sql = `
        SELECT
          da.reportId,
          dr.reportDate AS date,
          dr.groupId, dr.unitId,
          g.code AS groupCode, u.name AS unitName,

          da.agentId, a.code, a.nickname, a.category,
          da.state,
          da.municipalityId, m.name AS municipalityName, m.dept,
          da.novelty_description,
          DATE_FORMAT(da.novelty_start,'%Y-%m-%d') AS novelty_start,
          DATE_FORMAT(da.novelty_end  ,'%Y-%m-%d') AS novelty_end,
          da.mt,
          a.mt AS mt,
          da.\`check\` AS checked,
          dr.updatedAt
        FROM dailyreport dr
        JOIN dailyreport_agent da ON da.reportId = dr.id
        JOIN agent a              ON a.id = da.agentId
        LEFT JOIN \`group\` g     ON g.id = dr.groupId
        LEFT JOIN unit u          ON u.id = dr.unitId
        LEFT JOIN municipality m  ON m.id = da.municipalityId
        WHERE dr.reportDate=? AND dr.groupId=? AND dr.unitId=?
        ORDER BY
          g.code ASC,
          u.name ASC,
          CASE
            WHEN UPPER(a.category) LIKE 'OF%' THEN 0
            WHEN UPPER(a.category) IN ('ME','SO') OR UPPER(a.category) LIKE 'SUB%' THEN 1
            ELSE 2
          END ASC,
          CAST(COALESCE(NULLIF(REGEXP_SUBSTR(a.code, '[0-9]+'), ''), '0') AS UNSIGNED) ASC,
          a.code ASC
      `;
      const [rows] = await pool.query(sql, [date, groupId, unitId]);
      const items = rows.map(r => ({
        ...r,
        nickname: r.nickname ? decNullable(r.nickname) : null,
        novelty_description: r.novelty_description ? decNullable(r.novelty_description) : null,
        checked: Number(r.checked) === 1,
        mt: r.mt || null
      }));
      res.json({ items });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error:'MyReportDetailError' });
    }
  }
);

// server.js
app.get(
  '/admin/agents-locations-latest',
  auth,
  requireRole('superadmin','supervision','leader_group'),
  async (req, res) => {
    const { date, groupId } = req.query;
    const dateISO = (date || new Date().toISOString().slice(0,10));

    try {
      const where = ['dr2.reportDate <= ?'];
      const params = [dateISO];
      if (groupId) { where.push('da2.groupId = ?'); params.push(Number(groupId)); }

      const sql = `
        /* 1) última fecha por agente (hasta dateISO) */
        WITH latest_date AS (
          SELECT da2.agentId, MAX(dr2.reportDate) AS last_date
          FROM dailyreport_agent da2
          JOIN dailyreport dr2 ON dr2.id = da2.reportId
          WHERE ${where.join(' AND ')}
          GROUP BY da2.agentId
        ),
        /* 2) en esa fecha, último registro por timestamp (createdAt) */
        latest_row AS (
          SELECT
            da3.agentId,
            ld.last_date,
            MAX(COALESCE(da3.createdAt, CONCAT(ld.last_date,' 00:00:00'))) AS last_ts
          FROM dailyreport_agent da3
          JOIN dailyreport dr3 ON dr3.id = da3.reportId
          JOIN latest_date ld
            ON ld.agentId = da3.agentId
           AND ld.last_date = dr3.reportDate
          GROUP BY da3.agentId, ld.last_date
        )
        SELECT
          a.id AS agentId,
          a.nickname,
          g.code AS groupCode,
          u.name AS unitName,
          da.state AS status,

          /* Coordenadas: municipality de DRA -> municipality de AGENT */
          CAST(REPLACE(COALESCE(m_da.lat, m_a.lat), ',', '.') AS DECIMAL(10,6)) AS lat,
          CAST(REPLACE(COALESCE(m_da.lon, m_a.lon), ',', '.') AS DECIMAL(10,6)) AS lng,

          COALESCE(da.createdAt, CONCAT(dr.reportDate,' 00:00:00')) AS updated_at

        FROM dailyreport_agent da
        JOIN dailyreport dr ON dr.id = da.reportId
        JOIN agent a        ON a.id  = da.agentId
        LEFT JOIN \`group\` g ON g.id = da.groupId
        LEFT JOIN unit u      ON u.id = da.unitId

        /* municipality desde el registro del día (si lo hay) */
        LEFT JOIN municipality m_da ON m_da.id = da.municipalityId
        /* municipality “fijo” del agente como respaldo */
        LEFT JOIN municipality m_a  ON m_a.id  = a.municipalityId

        JOIN latest_row lr
          ON lr.agentId  = da.agentId
         AND lr.last_date = dr.reportDate
         AND lr.last_ts   = COALESCE(da.createdAt, CONCAT(dr.reportDate,' 00:00:00'))

        WHERE COALESCE(m_da.lat, m_a.lat) IS NOT NULL
          AND COALESCE(m_da.lon, m_a.lon) IS NOT NULL

        ORDER BY updated_at DESC;
      `;

      const [rows] = await pool.query(sql, params);

      const items = rows.map(r => ({
        agentId: r.agentId,
        nickname: (typeof decNullable === 'function') ? decNullable(r.nickname) : r.nickname,
        groupCode: r.groupCode,
        unitName: r.unitName,
        status: r.status,
        lat: r.lat,
        lng: r.lng,
        updated_at: r.updated_at
      }));

      res.json({ ok: 1, items });
    } catch (e) {
      console.error('[agents-locations-latest] SQL ERROR:', e?.sqlMessage || e?.message || e);
      res.status(500).json({
        ok: 0,
        message: 'Error obteniendo últimas ubicaciones',
        sqlMessage: e?.sqlMessage || e?.message
      });
    }
  }
);

// Mantén tu ruta original…
app.get('/fechas/semana', auth, fechasSemanaHandler);
// …y añade este alias para que funcione con tu patrón /api/...
app.get('/api/fechas/semana', auth, fechasSemanaHandler);

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