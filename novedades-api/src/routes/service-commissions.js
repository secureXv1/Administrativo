// src/routes/service-commissions.js
import express from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'
import { logEvent, Actions } from '../audit.js'

// === DESCIFRADO AES-256-GCM nickname ===
import crypto from 'crypto'

const ENC_KEY_B64 = process.env.NOVELTY_ENC_KEY || ''
const ENC_KEY = Buffer.from(ENC_KEY_B64, 'base64') // debe ser 32 bytes

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

const router = express.Router()

// ================== AUTH (igual patrón que rest_planning.js) ==================

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
      req.user = payload
    }
  } catch {
    // silencioso
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

// Helper fecha
function toDate(s) {
  if (!s) return null
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

// ================== GET /service-commissions/projection ==================
// Lista proyección (rest_plans) SOLO con COMISIÓN DEL SERVICIO
// para que gastos tenga la "base sugerida".
// AHORA SOPORTA ?vigenciaId=ID
router.get(
  '/projection',
  requireAuth,
  requireRole('superadmin', 'supervision', 'gastos'),
  async (req, res) => {
    try {
      let { from, to, unitId, groupId, agentId, vigenciaId } = req.query

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

        from = period.fromYmd
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
      }

      const where = [
        'rp.state = "COMISIÓN DEL SERVICIO"',
        'NOT (rp.end_date < ? OR rp.start_date > ?)'
      ]
      const args = [from, to]

      if (usedVigenciaId) {
        where.push('rp.vigencia_id = ?')
        args.push(usedVigenciaId)
      }

      if (unitId) {
        where.push('rp.unit_id = ?')
        args.push(Number(unitId))
      }
      if (groupId) {
        where.push('g.id = ?')
        args.push(Number(groupId))
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
          a.category  AS agentCategory,
          rp.unit_id  AS unitId,
          u.name      AS unitName,
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

      for (const r of rows) {
        r.agentNickname = decNullable(r.agentNickname)
      }

      res.json({ items: rows })
    } catch (e) {
      console.error('[GET /service-commissions/projection] error', e)
      res.status(500).json({ error: 'ServiceProjectionError', detail: e.message })
    }
  }
)

// ================== GET /service-commissions ==================
// Lista comisiones reales (tabla service_commissions)
router.get(
  '/',
  requireAuth,
  requireRole('superadmin', 'supervision', 'gastos'),
  async (req, res) => {
    try {
      let { from, to, unitId, agentId, status, vigenciaId } = req.query
      const where = ['1=1']
      const args = []

      if (vigenciaId) {
        // filtramos directito por vigencia
        where.push('sc.vigencia_id = ?')
        args.push(Number(vigenciaId))
      } else if (from && to) {
        // compatibilidad antigua: filtro por fechas
        where.push('NOT (sc.end_date < ? OR sc.start_date > ?)')
        args.push(from, to)
      }

      if (unitId) {
        where.push('sc.unit_id = ?')
        args.push(Number(unitId))
      }

      if (agentId) {
        where.push('sc.agent_id = ?')
        args.push(Number(agentId))
      }

      if (status) {
        where.push('sc.status = ?')
        args.push(status)
      }

      const whereSql = 'WHERE ' + where.join(' AND ')

      const [rows] = await pool.query(
        `
        SELECT
          sc.id,
          sc.agent_id     AS agentId,
          a.code          AS agentCode,
          a.nickname      AS agentNickname,
          a.category      AS agentCategory,
          sc.unit_id      AS unitId,
          u.name          AS unitName,
          DATE_FORMAT(sc.start_date,'%Y-%m-%d') AS start_date,
          DATE_FORMAT(sc.end_date  ,'%Y-%m-%d') AS end_date,
          sc.state,
          sc.municipality_id AS municipalityId,
          sc.dest_group_id   AS destGroupId,
          sc.dest_unit_id    AS destUnitId,
          g2.name AS destGroupName,
          u2.name AS destUnitName,
          sc.status,
          sc.rest_plan_id AS restPlanId,
          sc.vigencia_id  AS vigenciaId,
          sc.created_by,
          sc.created_at,
          sc.updated_by,
          sc.updated_at
        FROM service_commissions sc
        JOIN agent a ON a.id = sc.agent_id
        JOIN unit  u ON u.id = sc.unit_id
        LEFT JOIN \`group\` g2 ON g2.id = sc.dest_group_id  
        LEFT JOIN unit   u2 ON u2.id = sc.dest_unit_id
        ${whereSql}
        ORDER BY a.code, sc.start_date
        `,
        args
      )

      for (const r of rows) {
        r.agentNickname = decNullable(r.agentNickname)
      }

      res.json({ items: rows })
    } catch (e) {
      console.error('[GET /service-commissions] error', e)
      res.status(500).json({ error: 'ServiceCommissionListError', detail: e.message })
    }
  }
)

// ================== POST /service-commissions ==================
// Crea una comisión real, validando que exista una proyección de COMISIÓN DEL SERVICIO
router.post(
  '/',
  requireAuth,
  requireRole('superadmin', 'gastos'),
  async (req, res) => {
    const {
      agentId,
      unitId,
      restPlanId,           
      start_date,
      end_date,
      state = 'COMISIÓN DEL SERVICIO',
      municipalityId = null,
      destGroupId = null,
      destUnitId = null,
      vigenciaId = null 
    } = req.body || {}

    if (!agentId || !unitId || !start_date || !end_date) {
      return res.status(422).json({ error: 'agentId, unitId, start_date, end_date son requeridos' })
    }

    const d1 = toDate(start_date)
    const d2 = toDate(end_date)
    if (!d1 || !d2 || d2 < d1) {
      return res.status(422).json({ error: 'Rango de fechas inválido' })
    }

    try {
      let usedRestPlanId = null

      // 1) Si el frontend nos manda explícitamente el restPlanId de la proyección usada,
      //    lo validamos y lo usamos DIRECTO.
      if (restPlanId) {
        const [[rp]] = await pool.query(
          `
          SELECT id, agent_id, state, start_date, end_date
          FROM rest_plans
          WHERE id = ?
          LIMIT 1
          `,
          [restPlanId]
        )

        if (!rp) {
          return res.status(422).json({ error: 'La proyección asociada (restPlanId) no existe' })
        }

        if (Number(rp.agent_id) !== Number(agentId)) {
          return res.status(422).json({ error: 'La proyección no corresponde al agente indicado' })
        }

        if (String(rp.state || '').toUpperCase() !== 'COMISIÓN DEL SERVICIO') {
          return res.status(422).json({ error: 'La proyección no es de COMISIÓN DEL SERVICIO' })
        }

        // Opcional: comprobar que el rango real está DENTRO del rango proyectado
        const rpStart = toDate(rp.start_date)
        const rpEnd   = toDate(rp.end_date)
        if (rpStart && rpEnd && (d1 < rpStart || d2 > rpEnd)) {
          return res.status(422).json({
            error: 'El rango de la comisión no está contenido dentro de la proyección seleccionada'
          })
        }

        usedRestPlanId = rp.id
      } else {
        // 2) MODO COMPATIBILIDAD: si no llega restPlanId, buscamos cualquier proyección
        //    de COMISIÓN DEL SERVICIO que se SOLAPE con el rango dado.
        const [rows] = await pool.query(
          `
          SELECT id
          FROM rest_plans
          WHERE agent_id = ?
            AND state = 'COMISIÓN DEL SERVICIO'
            AND NOT (end_date < ? OR start_date > ?)
          LIMIT 1
          `,
          [agentId, start_date, end_date]
        )

        if (!rows.length) {
          return res.status(422).json({
            error: 'No hay proyección de COMISIÓN DEL SERVICIO que soporte este rango'
          })
        }

        usedRestPlanId = rows[0].id
      }

      // 3) Insertar la comisión real, ya enlazada al rest_plans
      const [result] = await pool.query(
        `
        INSERT INTO service_commissions
          (agent_id, unit_id, rest_plan_id, start_date, end_date, state,
          municipality_id, dest_group_id, dest_unit_id, vigencia_id, status, created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,'DRAFT',?)
        `,
        [
          agentId,
          unitId,
          usedRestPlanId,
          start_date,
          end_date,
          state,
          municipalityId || null,
          destGroupId || null,
          destUnitId || null,
          vigenciaId || null,         
          req.user.uid ?? null
        ]
      )


      const newId = result.insertId

      try {
        await logEvent({
          req,
          userId: req.user.uid,
          action: Actions.SERVICE_COMMISSION_CREATE ?? 'SERVICE_COMMISSION_CREATE',
          details: { id: newId, agentId, unitId, start_date, end_date, state, restPlanId: usedRestPlanId }
        })
      } catch {}

      res.json({ ok: true, id: newId })
    } catch (e) {
      console.error('[POST /service-commissions] error', e)
      res.status(500).json({ error: 'ServiceCommissionCreateError', detail: e.message })
    }
  }
)


// ================== PUT /service-commissions/:id ==================
// Editar fechas, destino, etc. (sin cambiar status)
router.put(
  '/:id',
  requireAuth,
  requireRole('superadmin', 'gastos'),
  async (req, res) => {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID inválido' })

    const {
      start_date,
      end_date,
      state,
      municipalityId = null,
      destGroupId = null,
      destUnitId = null
    } = req.body || {}

    if (!start_date || !end_date) {
      return res.status(422).json({ error: 'start_date y end_date son requeridos' })
    }

    const d1 = toDate(start_date)
    const d2 = toDate(end_date)
    if (!d1 || !d2 || d2 < d1) {
      return res.status(422).json({ error: 'Rango de fechas inválido' })
    }

    try {
      // Tomar registro actual (incluyendo vigencia)
      const [[current]] = await pool.query(
        'SELECT agent_id AS agentId, vigencia_id AS vigenciaId FROM service_commissions WHERE id=? LIMIT 1',
        [id]
      )
      if (!current) {
        return res.status(404).json({ error: 'Comisión no encontrada' })
      }

      const agentId = current.agentId
      const vigenciaId = current.vigenciaId

      // Validar contra vigencia (si existe)
      if (vigenciaId) {
        const [[period]] = await pool.query(
          `
          SELECT
            id,
            DATE_FORMAT(from_date,'%Y-%m-%d') AS fromYmd,
            DATE_FORMAT(to_date  ,'%Y-%m-%d') AS toYmd
          FROM projection_periods
          WHERE id=? LIMIT 1
          `,
          [vigenciaId]
        )
        if (!period) {
          return res.status(404).json({ error: 'Vigencia asociada no encontrada' })
        }

        const v1 = toDate(period.fromYmd)
        const v2 = toDate(period.toYmd)
        if (!v1 || !v2 || d1 < v1 || d2 > v2) {
          return res.status(422).json({ error: 'El nuevo rango debe estar dentro de la vigencia asociada' })
        }
      }

      // Validar contra proyección (COMISIÓN DEL SERVICIO)
      const params = [agentId, start_date, end_date]
      let sql = `
        SELECT id
        FROM rest_plans
        WHERE agent_id = ?
          AND state = 'COMISIÓN DEL SERVICIO'
          AND NOT (end_date < ? OR start_date > ?)
      `
      if (vigenciaId) {
        sql += ' AND vigencia_id = ?'
        params.push(vigenciaId)
      }
      sql += ' LIMIT 1'

      const [rows] = await pool.query(sql, params)

      if (!rows.length) {
        return res.status(422).json({
          error: 'El nuevo rango no está cubierto por la proyección de COMISIÓN DEL SERVICIO en la vigencia asociada'
        })
      }

      await pool.query(
        `
        UPDATE service_commissions
        SET start_date = ?, end_date = ?, state = ?, municipality_id = ?,
            dest_group_id = ?, dest_unit_id = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [
          start_date,
          end_date,
          state || 'COMISIÓN DEL SERVICIO',
          municipalityId || null,
          destGroupId || null,
          destUnitId || null,
          req.user.uid ?? null,
          id
        ]
      )

      try {
        await logEvent({
          req,
          userId: req.user.uid,
          action: Actions.SERVICE_COMMISSION_UPDATE ?? 'SERVICE_COMMISSION_UPDATE',
          details: { id, start_date, end_date, state }
        })
      } catch {}

      res.json({ ok: true })
    } catch (e) {
      console.error('[PUT /service-commissions/:id] error', e)
      res.status(500).json({ error: 'ServiceCommissionUpdateError', detail: e.message })
    }
  }
)

router.delete(
  '/:id',
  requireAuth,
  requireRole('superadmin', 'gastos'),
  async (req, res) => {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'ID inválido' })

    try {
      await pool.query(
        'DELETE FROM service_commissions WHERE id=?',
        [id]
      )

      try {
        await logEvent({
          req,
          userId: req.user.uid,
          action: Actions.SERVICE_COMMISSION_DELETE ?? 'SERVICE_COMMISSION_DELETE',
          details: { id }
        })
      } catch {}

      res.json({ ok: true })
    } catch (e) {
      console.error('[DELETE /service-commissions/:id] error', e)
      res.status(500).json({ error: 'ServiceCommissionDeleteError', detail: e.message })
    }
  }
)

// ================== PATCH /service-commissions/:id/status ==================
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('superadmin', 'gastos'),
  async (req, res) => {
    const id = Number(req.params.id)
    const { status } = req.body || {}

    if (!id) return res.status(400).json({ error: 'ID inválido' })
    if (!['DRAFT', 'APROBADA', 'ANULADA'].includes(status)) {
      return res.status(422).json({ error: 'Status inválido' })
    }

    try {
      await pool.query(
        `
        UPDATE service_commissions
        SET status = ?, updated_by = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [status, req.user.uid ?? null, id]
      )

      try {
        await logEvent({
          req,
          userId: req.user.uid,
          action: Actions.SERVICE_COMMISSION_STATUS ?? 'SERVICE_COMMISSION_STATUS',
          details: { id, status }
        })
      } catch {}

      res.json({ ok: true })
    } catch (e) {
      console.error('[PATCH /service-commissions/:id/status] error', e)
      res.status(500).json({ error: 'ServiceCommissionStatusError', detail: e.message })
    }
  }
)

export default router
