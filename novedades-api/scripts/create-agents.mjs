import { pool } from '../src/db.js';
const demo = [
  ['O101','OF', null],
  ['O102','OF', null],
  ['S201','SO', null],
  ['S202','SO', null],
  ['P301','PT', null],
];
for (const [code,cat,grp] of demo) {
  await pool.query('INSERT IGNORE INTO agent (code,category,groupId) VALUES (?,?,?)', [code,cat,grp]);
}
console.log('✅ Agentes demo listos'); process.exit(0);
