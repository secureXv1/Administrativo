import fs from 'fs';
import path from 'path';
import { pool } from '../src/db.js';

const dir = path.resolve(process.cwd(), 'sql');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

for (const f of files) {
  const p = path.join(dir, f);
  const sql = fs.readFileSync(p, { encoding: 'utf8' });
  console.log('▶ Ejecutando', f);
  try {
    await pool.query(sql);
    console.log('✅ OK', f);
  } catch (e) {
    console.error('❌ Error en', f, e.message);
    process.exit(1);
  }
}
process.exit(0);
