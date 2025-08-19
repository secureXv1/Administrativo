-- === (A) BASE DE DATOS =========================================
CREATE DATABASE IF NOT EXISTS novedades CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE novedades;

-- === (B) TABLAS ================================================

-- OJO: `group` y `user` llevan backticks porque son palabras reservadas
DROP TABLE IF EXISTS report_novelty;
DROP TABLE IF EXISTS dailyreport;
DROP TABLE IF EXISTS agent;
DROP TABLE IF EXISTS municipality;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `group`;

CREATE TABLE `group` (
  id      INT NOT NULL AUTO_INCREMENT,
  code    VARCHAR(32) NOT NULL UNIQUE,
  name    VARCHAR(100) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE `user` (
  id           INT NOT NULL AUTO_INCREMENT,
  email        VARCHAR(191) NOT NULL UNIQUE,
  passwordHash VARCHAR(191) NOT NULL,
  role         ENUM('admin','leader') NOT NULL DEFAULT 'leader',
  groupId      INT NULL,
  PRIMARY KEY (id),
  KEY idx_user_group (groupId),
  CONSTRAINT fk_user_group FOREIGN KEY (groupId) REFERENCES `group`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE agent (
  id       INT NOT NULL AUTO_INCREMENT,
  code     VARCHAR(16) NOT NULL UNIQUE,
  category ENUM('OF','SO','PT') NOT NULL,
  groupId  INT NULL,
  PRIMARY KEY (id),
  KEY idx_agent_group (groupId),
  CONSTRAINT fk_agent_group FOREIGN KEY (groupId) REFERENCES `group`(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE municipality (
  id   INT NOT NULL AUTO_INCREMENT,
  dept VARCHAR(80)  NOT NULL,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_muni (dept, name)
) ENGINE=InnoDB;

CREATE TABLE dailyreport (
  id             INT NOT NULL AUTO_INCREMENT,
  reportDate     DATE NOT NULL,
  checkpointTime TIME NOT NULL,
  groupId        INT NOT NULL,
  leaderUserId   INT NOT NULL,

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

  PRIMARY KEY (id),
  UNIQUE KEY uq_daily (reportDate, checkpointTime, groupId),
  KEY idx_daily_group (groupId),
  KEY idx_daily_leader (leaderUserId),
  CONSTRAINT fk_daily_group  FOREIGN KEY (groupId)      REFERENCES `group`(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_daily_leader FOREIGN KEY (leaderUserId) REFERENCES `user`(id)  ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE report_novelty (
  id            INT NOT NULL AUTO_INCREMENT,
  dailyReportId INT NOT NULL,
  agentId       INT NOT NULL,
  type          ENUM('VACACIONES','EXCUSA','PERMISO','SERVICIO') NOT NULL,
  municipalityId INT NULL,

  PRIMARY KEY (id),
  KEY idx_rn_report (dailyReportId),
  KEY idx_rn_agent (agentId),
  KEY idx_rn_muni (municipalityId),
  CONSTRAINT fk_rn_report FOREIGN KEY (dailyReportId) REFERENCES dailyreport(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_rn_agent  FOREIGN KEY (agentId)       REFERENCES agent(id)      ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_rn_muni   FOREIGN KEY (municipalityId) REFERENCES municipality(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- === (C) SEED MÍNIMO ===========================================

-- Grupos A–E
INSERT INTO `group` (code, name) VALUES
('GRUPO A','Grupo A'),
('GRUPO B','Grupo B'),
('GRUPO C','Grupo C'),
('GRUPO D','Grupo D'),
('GRUPO E','Grupo E');

-- Usuarios (passwordHash temporal; lo actualizaremos con bcrypt más abajo)
INSERT INTO `user` (email, passwordHash, role, groupId) VALUES
('admin@demo.com',  '$2b$10$abcdefghijklmnopqrstuv', 'admin', NULL),
('liderA@demo.com', '$2b$10$abcdefghijklmnopqrstuv', 'leader', (SELECT id FROM `group` WHERE code='GRUPO A' LIMIT 1));

-- Agentes de ejemplo (en GRUPO A)
INSERT INTO agent (code, category, groupId) VALUES
('O101','OF', (SELECT id FROM `group` WHERE code='GRUPO A' LIMIT 1)),
('S201','SO', (SELECT id FROM `group` WHERE code='GRUPO A' LIMIT 1)),
('P301','PT', (SELECT id FROM `group` WHERE code='GRUPO A' LIMIT 1));

-- Municipios de ejemplo
INSERT INTO municipality (dept, name) VALUES
('ANTIOQUIA','MEDELLÍN'),
('CUNDINAMARCA','BOGOTÁ D.C.');
