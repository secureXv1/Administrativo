// src/routes/rest_planning.js
import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { pool } from '../db.js'
import { logEvent, Actions } from '../audit.js'

const router = express.Router()

/* -------------------------------------------------------
   AUTH (igual patrón que vehiculos.js)
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
      req.user = payload // { uid, role, groupId, unitId, agentId, ... }
    }
  } catch {
    // silencioso; requireAuth se encargará
  }
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
   DESCIFRADO nickname (igual que en vehiculos.js)
------------------------------------------------------- */

const ENC_KEY_B64 = process.env.NOVELTY_ENC_KEY || ''
const ENC_KEY = Buffer.from(ENC_KEY_B64, 'base64') // 32 bytes

function decNullable(maybeB64) {
  if (maybeB64 == null || maybeB64 === '') return null
  if (ENC_KEY.length !== 32) return String(maybeB64)

  try {
    const raw = Buffer.from(String(maybeB64), 'base64')
    if (raw.length < 28) return String(maybeB64)
    const iv  = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const ct  = raw.subarray(28)

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return pt.toString('utf8')
  } catch {
    return String(maybeB64)
  }
}

/* -------------------------------------------------------
   HELPERS DE FECHA / ALCANCE
------------------------------------------------------- */

function toDate(s) {
  if (!s) return null
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/* -------------------------------------------------------
   VIGENCIAS (projection_periods)
   - POST /rest-planning/periods  → crear vigencia
   - GET  /rest-planning/periods  → listar vigencias
------------------------------------------------------- */

router.post(
  '/periods',
  requireAuth,
  // aquí decides quién puede crear vigencias; yo dejé superadmin + supervision + gastos
  requireRole('superadmin', 'supervision', 'gastos'),
  async (req, res) => {
    try {
      const { name, from, to } = req.body || {}

      const nombre = String(name || '').trim().toUpperCase()
      if (!nombre) {
        return res.status(422).json({ error: 'Nombre de vigencia requerido (ej: DIC25)' })
      }

      const d1 = toDate(from)
      const d2 = toDate(to)

      if (!d1 || !d2 || d2 < d1) {
        return res.status(422).json({ error: 'Rango de fechas inválido para la vigencia' })
      }

      const fromYMD = formatYMD(d1)
      const toYMD   = formatYMD(d2)

      const [result] = await pool.query(
        `
        INSERT INTO projection_periods (name, from_date, to_date, created_by)
        VALUES (?,?,?,?)
        `,
        [nombre, fromYMD, toYMD, req.user.uid ?? null]
      )

      const newId = result.insertId

      try {
        await logEvent({
          req,
          userId: req.user.uid,
          action: Actions.REST_PLAN_PERIOD_CREATE ?? 'REST_PLAN_PERIOD_CREATE',
          details: { id: newId, name: nombre, from: fromYMD, to: toYMD }
        })
      } catch {}

      res.json({ ok: true, id: newId })
    } catch (e) {
      console.error('[POST /rest-planning/periods] error', e)
      res.status(500).json({ error: 'PeriodCreateError', detail: e.message })
    }
  }
)

router.get(
  '/periods',
  requireAuth,
  requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit', 'gastos'),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          id,
          name,
          DATE_FORMAT(from_date,'%Y-%m-%d') AS from_date,
          DATE_FORMAT(to_date  ,'%Y-%m-%d') AS to_date,
          created_by,
          created_at
        FROM projection_periods
        ORDER BY created_at DESC, id DESC
        `
      )

      res.json({ items: rows })
    } catch (e) {
      console.error('[GET /rest-planning/periods] error', e)
      res.status(500).json({ error: 'PeriodListError', detail: e.message })
    }
  }
)

// Valida que un usuario pueda tocar info de un agente
async function validateAgentScope(req, agentId) {
  const role = String(req.user?.role || '').toLowerCase()

  const requesterAgentId = req.user?.agentId ?? req.user?.agent_id ?? null
  if (role === 'agent' && requesterAgentId && Number(requesterAgentId) === Number(agentId)) {
    return true
  }

  if (role === 'superadmin' || role === 'supervision') return true

  if (role === 'leader_group') {
    const [[row]] = await pool.query(
      'SELECT groupId FROM agent WHERE id=? LIMIT 1',
      [agentId]
    )
    return row && Number(row.groupId) === Number(req.user.groupId)
  }

  if (role === 'leader_unit') {
    const [[row]] = await pool.query(
      'SELECT unitId FROM agent WHERE id=? LIMIT 1',
      [agentId]
    )
    return row && Number(row.unitId) === Number(req.user.unitId)
  }

  return false
}

/* -------------------------------------------------------
   POST /rest-planning/bulk
   Guarda/actualiza proyección en bloque por unidad
   AHORA PUEDE USAR vigenciaId (projection_periods.id)
------------------------------------------------------- */
/**
 * Body esperado:
 * {
 *   vigenciaId: 7,           // OPCIONAL, pero recomendado
 *   from: "2025-12-01",      // usado sólo si NO se envía vigenciaId
 *   to:   "2025-12-25",
 *   items: [
 *     {
 *       agentId: 123,
 *       segments: [
 *         { from: "2025-11-25", to: "2025-12-05", state: "PERMISO" },
 *         { from: "2025-12-06", to: "2025-12-27", state: "COMISIÓN DEL SERVICIO" },
 *         { from: "2025-12-28", to: "2026-01-05", state: "PERMISO" }
 *       ]
 *     },
 *     ...
 *   ]
 * }
 *
 * Regla importante: para cada agente:
 * - los rangos no se pueden solapar
 * - no pueden quedar “huecos” entre un rango y otro
 *   (prev.to + 1 día debe ser = next.from)
 */
router.post(
  '/bulk',
  requireAuth,
  requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit'),
  async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) {
      return res.status(422).json({ error: 'items requerido (lista de agentes y segmentos)' })
    }

    const role = String(req.user.role || '').toLowerCase()

    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const { from: bodyFrom, to: bodyTo, vigenciaId } = req.body || {}

      // ===== RANGO GLOBAL (gStart / gEnd) Y VIGENCIA =====
      let gStart, gEnd, usedVigenciaId = null

      if (vigenciaId) {
        const idV = Number(vigenciaId)
        if (!idV) {
          throw { status: 422, message: 'vigenciaId inválido' }
        }

        const [[period]] = await conn.query(
          `
          SELECT
            id,
            DATE_FORMAT(from_date,'%Y-%m-%d') AS fromYmd,
            DATE_FORMAT(to_date  ,'%Y-%m-%d') AS toYmd
          FROM projection_periods
          WHERE id=? LIMIT 1
          `,
          [idV]
        )

        if (!period) {
          throw { status: 404, message: 'Vigencia no encontrada' }
        }

        const d1 = toDate(period.fromYmd)
        const d2 = toDate(period.toYmd)
        if (!d1 || !d2 || d2 < d1) {
          throw { status: 500, message: 'Rango inválido en la vigencia' }
        }

        gStart = d1
        gEnd   = d2
        usedVigenciaId = period.id

      } else {
        // Comportamiento anterior: se usa from/to enviados en el body
        const d1 = toDate(bodyFrom)
        const d2 = toDate(bodyTo)
        if (!d1 || !d2 || d2 < d1) {
          throw { status: 422, message: 'Rango global from/to inválido' }
        }
        gStart = d1
        gEnd   = d2
        usedVigenciaId = null
      }

      for (const item of items) {
        const agentId = Number(item.agentId)
        const segments = Array.isArray(item.segments) ? item.segments : []

        if (!agentId || !segments.length) {
          throw { status: 422, message: 'Cada item debe tener agentId y segments no vacío' }
        }

        const okScope = await validateAgentScope(req, agentId)
        if (!okScope) {
          throw { status: 403, message: `Sin permiso para proyectar descanso de agente ${agentId}` }
        }

        // Traer unitId del agente (lo guardamos en la tabla)
        const [[agentRow]] = await conn.query(
          'SELECT unitId FROM agent WHERE id=? LIMIT 1',
          [agentId]
        )
        if (!agentRow || !agentRow.unitId) {
          throw { status: 422, message: `Agente ${agentId} no tiene unidad asignada` }
        }

        // Si es líder de unidad, refuerza que sea SU unidad
        if (role === 'leader_unit' && Number(agentRow.unitId) !== Number(req.user.unitId)) {
          throw { status: 403, message: `Agente ${agentId} no pertenece a su unidad` }
        }

        // ================== Normalizar y validar segmentos ==================
        const normSegs = segments.map((s, idx) => {
          const d1raw = toDate(s.from)
          const d2raw = toDate(s.to)
          const state = String(s.state || '').trim().toUpperCase()

          if (!d1raw || !d2raw || !state) {
            throw {
              status: 422,
              message: `Segmento inválido para agente ${agentId} en índice ${idx}`
            }
          }

          const from = formatYMD(d1raw)
          const to   = formatYMD(d2raw)

          const d1 = d1raw
          const d2 = d2raw
          if (d2 < d1) {
            throw {
              status: 422,
              message: `Fecha fin menor a inicio en agente ${agentId} (${from} → ${to})`
            }
          }

          return {
            from,
            to,
            state,
            destGroupId: s.destGroupId ?? null,
            destUnitId:  s.destUnitId ?? null,
            fromDate: d1,
            toDate: d2
          }
        })

        // Ordenar por fecha inicio
        normSegs.sort((a, b) => a.fromDate - b.fromDate)

        // 1) Revisar solapes entre segmentos
        for (let i = 1; i < normSegs.length; i++) {
          const prev = normSegs[i - 1]
          const curr = normSegs[i]
          if (curr.fromDate <= prev.toDate) {
            throw {
              status: 422,
              message: `Solapamiento de rangos para agente ${agentId}: ${prev.from}→${prev.to} con ${curr.from}→${curr.to}`
            }
          }
        }

        // 2) Construir mapa día → estado
        let dayMap = new Map()
        for (const seg of normSegs) {
          for (let d = new Date(seg.fromDate); d <= seg.toDate; d.setDate(d.getDate() + 1)) {
            dayMap.set(formatYMD(d), seg.state)
          }
        }

        // 3) Validar días faltantes usando el rango global gStart/gEnd
        let missing = []
        for (let d = new Date(gStart); d <= gEnd; d.setDate(d.getDate() + 1)) {
          const y = formatYMD(d)
          if (!dayMap.has(y)) missing.push(y)
        }

        if (missing.length) {
          throw {
            status: 422,
            message: `El agente ${agentId} tiene días sin estado en el rango global: ${missing[0]} → ${missing[missing.length - 1]}`
          }
        }

        // Rango completo a limpiar (primer inicio → última fin)
        const firstFrom = normSegs[0].from
        const lastTo = normSegs[normSegs.length - 1].to

        // Borrar proyección anterior que se solape con ese rango
        if (usedVigenciaId) {
          await conn.query(
            `
            DELETE FROM rest_plans
            WHERE agent_id = ?
              AND vigencia_id = ?
              AND NOT (end_date < ? OR start_date > ?)
            `,
            [agentId, usedVigenciaId, firstFrom, lastTo]
          )
        } else {
          await conn.query(
            `
            DELETE FROM rest_plans
            WHERE agent_id = ?
              AND NOT (end_date < ? OR start_date > ?)
            `,
            [agentId, firstFrom, lastTo]
          )
        }

        // Insertar nuevos rangos
        for (const seg of normSegs) {
          await conn.query(
            `
            INSERT INTO rest_plans
              (agent_id, unit_id, start_date, end_date, state,
               dest_group_id, dest_unit_id, created_by, vigencia_id)
            VALUES (?,?,?,?,?,?,?,?,?)
            `,
            [
              agentId,
              agentRow.unitId,
              seg.from,
              seg.to,
              seg.state,
              seg.destGroupId || null,
              seg.destUnitId || null,
              req.user.uid ?? null,
              usedVigenciaId || null
            ]
          )
        }

        // Audit por agente
        try {
          await logEvent({
            req,
            userId: req.user.uid,
            action: Actions.REST_PLAN_SAVE ?? 'REST_PLAN_SAVE',
            details: {
              agentId,
              unitId: agentRow.unitId,
              vigenciaId: usedVigenciaId || null,
              from: firstFrom,
              to: lastTo,
              segments: normSegs.map(s => ({
                from: s.from,
                to: s.to,
                state: s.state
              }))
            }
          })
        } catch { }
      }

      await conn.commit()
      res.json({ ok: true, vigenciaId: usedVigenciaId || null })
    } catch (e) {
      await conn.rollback()
      const status = e?.status || 500
      const message = e?.message || e?.detail || 'Error al guardar proyección de descanso'
      return res.status(status).json({ error: message })
    } finally {
      conn.release()
    }
  }
)

/* -------------------------------------------------------
   GET /rest-planning
   Consulta proyección
   AHORA SOPORTA ?vigenciaId=ID
------------------------------------------------------- */
/**
 * Query params:
 * - vigenciaId (opcional; si viene, se usa la vigencia)
 * - from=YYYY-MM-DD (si NO hay vigenciaId, requerido)
 * - to=YYYY-MM-DD   (si NO hay vigenciaId, requerido)
 * - unitId (opcional; para líder_unidad se fuerza a su unitId)
 * - agentId (opcional; para rol agent se fuerza a su propio agente)
 */
router.get(
  '/',
  requireAuth,
  requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit', 'agent'),
  async (req, res) => {
    try {
      let { from, to, unitId, agentId, vigenciaId } = req.query
      const role = String(req.user.role || '').toLowerCase()

      let d1, d2
      let usedVigenciaId = null

      if (vigenciaId) {
        const idV = Number(vigenciaId)
        if (!idV) {
          return res.status(400).json({ error: 'vigenciaId inválido' })
        }

        const [[period]] = await pool.query(
          `
          SELECT
            id,
            DATE_FORMAT(from_date,'%Y-%m-%d') AS fromYmd,
            DATE_FORMAT(to_date  ,'%Y-%m-%d') AS toYmd
          FROM projection_periods
          WHERE id=? LIMIT 1
          `,
          [idV]
        )
        if (!period) {
          return res.status(404).json({ error: 'Vigencia no encontrada' })
        }

        d1 = toDate(period.fromYmd)
        d2 = toDate(period.toYmd)
        if (!d1 || !d2 || d2 < d1) {
          return res.status(500).json({ error: 'Rango inválido en la vigencia' })
        }

        from = period.fromYmd   // ya vienen YYYY-MM-DD
        to   = period.toYmd
        usedVigenciaId = idV

      } else {
        if (!from || !to) {
          return res.status(400).json({ error: 'Parámetros from y to son requeridos si no se especifica vigenciaId' })
        }
        d1 = toDate(from)
        d2 = toDate(to)
        if (!d1 || !d2 || d2 < d1) {
          return res.status(400).json({ error: 'Rango de fechas inválido' })
        }
        from = formatYMD(d1)
        to   = formatYMD(d2)
      }

      const where = ['NOT (rp.end_date < ? OR rp.start_date > ?)']
      const args = [from, to]

      if (usedVigenciaId) {
        where.push('rp.vigencia_id = ?')
        args.push(usedVigenciaId)
      }

      // Ámbito por rol
      if (role === 'leader_unit') {
        unitId = req.user.unitId
      }
      if (role === 'leader_group') {
        // restringimos por groupId vía join
        where.push('g.id = ?')
        args.push(req.user.groupId)
      }
      if (role === 'agent') {
        const myAgentId = req.user?.agentId ?? req.user?.agent_id ?? null
        if (!myAgentId) {
          return res.status(403).json({ error: 'No se pudo determinar su agente asociado' })
        }
        agentId = myAgentId
      }

      if (unitId) {
        where.push('rp.unit_id = ?')
        args.push(Number(unitId))
      }
      if (agentId) {
        where.push('rp.agent_id = ?')
        args.push(Number(agentId))
      }

      const whereSql = 'WHERE ' + where.join(' AND ')

      const [rows] = await pool.query(
        `
        SELECT
          rp.id,
          rp.agent_id AS agentId,
          a.code      AS agentCode,
          a.nickname  AS agentNickname,

          -- Unidad y grupo actual del agente
          a.unitId      AS agentUnitId,
          a.groupId     AS agentGroupId,

          -- Unidad actual del rango
          rp.unit_id    AS unitId,
          u.name        AS unitName,

          DATE_FORMAT(rp.start_date,'%Y-%m-%d') AS start_date,
          DATE_FORMAT(rp.end_date  ,'%Y-%m-%d') AS end_date,
          rp.state,
          rp.dest_group_id AS destGroupId,
          rp.dest_unit_id  AS destUnitId,
          g2.name AS destGroupName,
          u2.name AS destUnitName,
          rp.vigencia_id   AS vigenciaId
        FROM rest_plans rp
        JOIN agent a ON a.id = rp.agent_id
        JOIN unit  u ON u.id = rp.unit_id
        LEFT JOIN \`group\` g2 ON g2.id = rp.dest_group_id  
        LEFT JOIN unit   u2 ON u2.id = rp.dest_unit_id
        LEFT JOIN \`group\` g  ON g.id = u.groupId
        ${whereSql}
        ORDER BY a.code, rp.start_date
        `,
        args
      )

      // descifrar nickname
      for (const r of rows) {
        r.agentNickname = decNullable(r.agentNickname)
      }

      res.json({ items: rows })
    } catch (e) {
      console.error('[GET /rest-planning] error', e)
      res.status(500).json({ error: 'RestPlanningListError', detail: e.message })
    }
  }
)


// === Catálogo de grupos (para proyección de descanso) ===
router.get(
  '/groups',
  requireAuth,
  requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit'),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          g.id,
          g.code,
          g.name
        FROM \`group\` g
        ORDER BY g.code, g.name
        `
      )
      res.json(rows)
    } catch (e) {
      console.error('[GET /rest-planning/groups] error', e.code, e.sqlMessage || e.message)
      res.status(500).json({ error: 'CatalogGroupsError', detail: e.message })
    }
  }
)

// === Catálogo de unidades (para proyección de descanso) ===
router.get(
  '/units',
  requireAuth,
  requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit'),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT
          u.id,
          u.groupId,
          u.name,
          u.id AS code   -- usamos el id como "code" genérico para no depender de la columna code
        FROM unit u
        ORDER BY u.name
        `
      )
      res.json(rows)
    } catch (e) {
      console.error('[GET /rest-planning/units] error', e.code, e.sqlMessage || e.message)
      res.status(500).json({
        error: 'CatalogUnitsError',
        detail: e.sqlMessage || e.message
      })
    }
  }
)

export default router

