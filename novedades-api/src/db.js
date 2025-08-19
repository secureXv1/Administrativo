// src/db.js
import 'dotenv/config'
import mysql from 'mysql2/promise'

const {
  DB_HOST='127.0.0.1',
  DB_USER='root',
  DB_PASS='Febrero2025*-+',
  DB_NAME='novedades'
} = process.env

console.log('[DB VARS]', { DB_HOST, DB_USER, DB_NAME, DB_PASS: DB_PASS ? '***' : '(empty)' })

export const pool = await mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  connectionLimit: 10,
  timezone: 'Z',           // evita desfases de hora
  dateStrings: false
})

// smoke test al iniciar
try {
  const [r] = await pool.query('SELECT 1 AS ok')
  console.log('✅ DB ping:', r[0])
} catch (e) {
  console.error('❌ DB connection error:', e.code, e.message)
  process.exit(1)
}
