// src/db.js
import 'dotenv/config'
import mysql from 'mysql2/promise'

const {
  DB_HOST='localhost',
  DB_USER='nowtacom_novedades',
  DB_PASS='Febrero2025*-+',
  DB_NAME='nowtacom_novedades'
} = process.env

console.log('[DB VARS]', { DB_HOST, DB_USER, DB_NAME, DB_PASS: DB_PASS ? '***' : '(empty)' })

// 1. Quita el top-level await
let pool;

export async function initDb() {
  pool = await mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectionLimit: 10,
    timezone: 'Z',
    dateStrings: false
  });
  // Smoke test al iniciar
  try {
    const [r] = await pool.query('SELECT 1 AS ok')
    console.log('✅ DB ping:', r[0])
  } catch (e) {
    console.error('❌ DB connection error:', e.code, e.message)
    process.exit(1)
  }
}

export { pool }
