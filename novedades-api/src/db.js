// src/db.js
import 'dotenv/config';
import mysql from 'mysql2';

const {
  DB_HOST = 'localhost',
  DB_USER = 'nowtacom_novedades',
  DB_PASS = 'Febrero2025*-+',
  DB_NAME = 'nowtacom_novedades',
  DB_PORT = '3306',
} = process.env;

console.log('[DB VARS]', {
  DB_HOST, DB_USER, DB_NAME, DB_PASS: DB_PASS ? '***' : '(empty)'
});

let basePool;   // callback-based
export let pool; // PromisePool (live binding)

export async function initDb() {
  if (pool) return pool;

  basePool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    port: Number(DB_PORT),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // No fijes timezone aquí; lo haremos por sesión
  });

  // ✅ TZ por CONEXIÓN (funciona siempre, también en conexiones nuevas del pool)
  basePool.on('connection', (conn) => {
    // ¡OJO! 'conn' es callback-based: NO uses .catch() aquí
    conn.query("SET time_zone = '-05:00'", () => {});
  });

  // Wrapper de promesas para todo tu código (await/async)
  pool = basePool.promise();

  // Smoke test
  const [r] = await pool.query('SELECT 1 AS ok');
  console.log('✅ DB ping:', r[0]);

  return pool;
}

// Guard útil si quieres asegurar que ya está inicializado
export function getPool() {
  if (!pool) throw new Error('DB not initialized. Call initDb() first.');
  return pool;
}
