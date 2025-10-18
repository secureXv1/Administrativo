// scripts/create-agent-users.js
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

const DEFAULT_PASSWORD = 'Agente123' // contraseña inicial (puedes cambiarla)

const pool = await mysql.createPool({
  host: 'localhost',
  user: 'root',               // 👈 tu usuario MySQL
  password: 'Febrero2025*-+', // 👈 tu contraseña MySQL
  database: 'novedades',      // 👈 tu base de datos
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
})

async function main() {
  const [agents] = await pool.query(`
    SELECT a.id, a.code, a.groupId, a.unitId
    FROM agent a
    WHERE a.code IS NOT NULL
      AND TRIM(a.code) <> ''
      AND CHAR_LENGTH(a.code) <= 50
  `)

  let created = 0, skipped = 0

  for (const a of agents) {
    // ¿Ya existe user con ese username?
    const [[u]] = await pool.query('SELECT id FROM \`user\` WHERE username=? LIMIT 1', [a.code])
    if (u) { skipped++; continue }

    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    await pool.query(
      'INSERT INTO \`user\` (username, passwordHash, role, groupId, unitId) VALUES (?, ?, ?, ?, ?)',
      [a.code, hash, 'agent', a.groupId ?? null, a.unitId ?? null]
    )
    created++
  }

  console.log(`✅ Usuarios creados: ${created} | Ya existían: ${skipped}`)
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
