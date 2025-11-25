// src/routes/admin-depts.js
import express from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db.js'

const router = express.Router()

/* -------------------------------------------------------
   AUTH (mismo patrón que rest_planning.js / vehiculos.js)
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
      // payload: { uid, role, groupId, unitId, agentId, ... }
      req.user = payload
    }
  } catch {
    // silencioso; requireAuth se encargará
  }
  next()
}
router.use(attachUser)

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const role = String(req.user.role || '').toLowerCase()
  const ok = allowed.map(r => String(r).toLowerCase()).includes(role)
  if (!ok) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

/* -------------------------------------------------------
   GET /admin/depts
   Devuelve solo nombres de departamentos (sin duplicados)
------------------------------------------------------- */

router.get(
  '/',
  requireAuth,
  // ajusta la lista de roles que pueden ver el catálogo si quieres
  requireRole('superadmin', 'supervision', 'leader_group', 'leader_unit', 'gastos'),
  async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `
        SELECT DISTINCT
          dept
        FROM municipality
        WHERE dept IS NOT NULL AND dept <> ''
        ORDER BY dept
        `
      )

      // Respuesta simple: [ "ANTIOQUIA", "ATLÁNTICO", ... ]
      const depts = rows.map(r => r.dept)

      res.json({ items: depts })
    } catch (e) {
      console.error('[GET /admin/depts] error', e)
      res.status(500).json({
        error: 'DeptListError',
        detail: e.message
      })
    }
  }
)

export default router
