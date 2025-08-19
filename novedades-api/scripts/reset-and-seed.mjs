import 'dotenv/config'
import mysql from 'mysql2/promise'
import bcrypt from 'bcrypt'

const {
  DB_HOST='127.0.0.1',
  DB_USER='root',
  DB_PASS='',
  DB_NAME='novedades'
} = process.env

const conn = await mysql.createConnection({
  host: DB_HOST, user: DB_USER, password: DB_PASS, multipleStatements: true
})

// 1) Crear BD y limpiar todo
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; USE \`${DB_NAME}\`;`);

await conn.query(`
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS report_person;
DROP TABLE IF EXISTS dailyreport;
DROP TABLE IF EXISTS municipality;
DROP TABLE IF EXISTS agent;
DROP TABLE IF EXISTS \`user\`;
DROP TABLE IF EXISTS \`group\`;
SET FOREIGN_KEY_CHECKS=1;
`)

// 2) Esquema nuevo (sin Prisma)
await conn.query(`
CREATE TABLE \`group\` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE \`user\` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL UNIQUE,
  passwordHash VARCHAR(191) NOT NULL,
  role ENUM('admin','leader') NOT NULL DEFAULT 'leader',
  groupId INT NULL,
  CONSTRAINT fk_user_group FOREIGN KEY (groupId) REFERENCES \`group\`(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE agent (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL UNIQUE,
  category ENUM('OF','SO','PT') NOT NULL,
  groupId INT NULL,
  CONSTRAINT fk_agent_group FOREIGN KEY (groupId) REFERENCES \`group\`(id) ON DELETE SET NULL,
  INDEX idx_agent_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE municipality (
  id INT PRIMARY KEY AUTO_INCREMENT,
  dept VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  INDEX idx_muni_dept (dept),
  INDEX idx_muni_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE dailyreport (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reportDate DATE NOT NULL,
  checkpointTime TIME NOT NULL,
  groupId INT NOT NULL,
  leaderUserId INT NOT NULL,
  OF_effective INT NOT NULL DEFAULT 0,
  SO_effective INT NOT NULL DEFAULT 0,
  PT_effective INT NOT NULL DEFAULT 0,
  OF_available INT NOT NULL DEFAULT 0,
  SO_available INT NOT NULL DEFAULT 0,
  PT_available INT NOT NULL DEFAULT 0,
  OF_nov INT NOT NULL DEFAULT 0,
  SO_nov INT NOT NULL DEFAULT 0,
  PT_nov INT NOT NULL DEFAULT 0,
  notes VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_report_group FOREIGN KEY (groupId) REFERENCES \`group\`(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_leader FOREIGN KEY (leaderUserId) REFERENCES \`user\`(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_report (reportDate, checkpointTime, groupId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE report_person (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reportId INT NOT NULL,
  agentId INT NOT NULL,
  state ENUM('LABORANDO','VACACIONES','EXCUSA','PERMISO','SERVICIO') NOT NULL,
  municipalityId INT NULL,
  CONSTRAINT fk_rp_report FOREIGN KEY (reportId) REFERENCES dailyreport(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_agent FOREIGN KEY (agentId) REFERENCES agent(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rp_muni FOREIGN KEY (municipalityId) REFERENCES municipality(id) ON DELETE SET NULL,
  UNIQUE KEY uq_report_agent (reportId, agentId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`)

// 3) Datos demo: grupos, usuarios, agentes, municipios
await conn.query(
 `INSERT INTO \`group\` (code,name) VALUES
  ('GRUPO A','Grupo A'), ('GRUPO B','Grupo B'),
  ('GRUPO C','Grupo C'), ('GRUPO D','Grupo D'), ('GRUPO E','Grupo E')
  ON DUPLICATE KEY UPDATE name=VALUES(name);`
)
const [[gA]] = await conn.query(`SELECT id FROM \`group\` WHERE code='GRUPO A' LIMIT 1;`)

const adminHash = await bcrypt.hash('Demo2025*+', 10)
const leaderHash = await bcrypt.hash('Demo2025*+', 10)

await conn.query(
 `INSERT INTO \`user\` (email,passwordHash,role,groupId) VALUES
  ('admin@demo.com', ?, 'admin', NULL),
  ('liderA@demo.com', ?, 'leader', ?)
  ON DUPLICATE KEY UPDATE passwordHash=VALUES(passwordHash), role=VALUES(role), groupId=VALUES(groupId);`,
 [adminHash, leaderHash, gA?.id || null]
)

await conn.query(
 `INSERT INTO agent (code,category,groupId) VALUES
  ('O101','OF', ?), ('O102','OF', ?),
  ('S201','SO', ?), ('S202','SO', ?),
  ('P301','PT', ?), ('P302','PT', ?)
  ON DUPLICATE KEY UPDATE category=VALUES(category), groupId=VALUES(groupId);`,
 [gA?.id, gA?.id, gA?.id, gA?.id, gA?.id, gA?.id]
)

await conn.query(
 `INSERT INTO municipality (dept,name) VALUES
  ('ANTIOQUIA','MEDELLÍN'),
  ('ANTIOQUIA','BELLO'),
  ('CUNDINAMARCA','SOACHA'),
  ('VALLE DEL CAUCA','CALI')
  ON DUPLICATE KEY UPDATE name=VALUES(name);`
)

console.log('✅ BD recreada y datos demo cargados.')
await conn.end()
