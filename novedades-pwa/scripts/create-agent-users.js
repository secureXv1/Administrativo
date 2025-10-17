// scripts/create-agent-users.js
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

const DEFAULT_PASSWORD = 'Agente123' // cámbiala si quieres

const pool = await mysql.createPool({
  host: 'localhost',
  user: 'root',              // 👈 tu usuario MySQL
  password: 'Febrero2025*-+',        // 👈 tu contraseña MySQL
  database: 'novedades',     // 👈 tu base de datos
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
});


async function main() {
  // 1) Trae agentes con nickname usable
  const [agents] = await pool.query(`
    SELECT a.id, a.code, TRIM(a.nickname) AS nickname
    FROM agent a
    WHERE a.nickname IS NOT NULL
      AND TRIM(a.nickname) <> ''
      AND CHAR_LENGTH(TRIM(a.nickname)) <= 50
  `)

  let created = 0, skipped = 0

  for (const a of agents) {
    // 2) ¿Ya existe user con ese username?
    const [[u]] = await pool.query(
      'SELECT id FROM \`user\` WHERE username=? LIMIT 1',
      [a.nickname]
    )
    if (u) { skipped++; continue }

    // 3) Crear usuario
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
    await pool.query(
      'INSERT INTO \`user\` (username, passwordHash, role, groupId, unitId) VALUES (?, ?, ?, NULL, NULL)',
      [a.nickname, hash, 'agent'] // si no agregaste ENUM 'agent', usa el rol que elijas
    )
    created++
  }

  console.log(`Usuarios creados: ${created} | Ya existían: ${skipped}`)
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
