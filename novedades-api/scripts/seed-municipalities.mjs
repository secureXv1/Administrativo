import { pool } from '../src/db.js';
const demo = [
  ['ANTIOQUIA','MEDELLÍN'],
  ['CUNDINAMARCA','BOGOTÁ D.C.'],
  ['VALLE DEL CAUCA','CALI'],
  ['ATLÁNTICO','BARRANQUILLA'],
  ['BOLÍVAR','CARTAGENA'],
];
for (const [dept,name] of demo) {
  await pool.query('INSERT IGNORE INTO municipality (dept,name) VALUES (?,?)', [dept,name]);
}
console.log('✅ Municipios demo listos'); process.exit(0);
