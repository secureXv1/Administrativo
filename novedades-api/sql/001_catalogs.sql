@'
-- Agentes
CREATE TABLE IF NOT EXISTS `agent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `category` VARCHAR(8) NOT NULL,
  `groupId` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_code_uq` (`code`),
  KEY `agent_group_idx` (`groupId`),
  CONSTRAINT `agent_group_fkey` FOREIGN KEY (`groupId`) REFERENCES `group`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Municipios
CREATE TABLE IF NOT EXISTS `municipality` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `dept` VARCHAR(80) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `municipality_dept_name_uq` (`dept`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Novedades por persona
CREATE TABLE IF NOT EXISTS `report_novelty` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `dailyReportId` INT NOT NULL,
  `agentId` INT NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `municipalityId` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `rn_report_idx` (`dailyReportId`),
  KEY `rn_agent_idx` (`agentId`),
  KEY `rn_muni_idx` (`municipalityId`),
  CONSTRAINT `rn_report_fkey` FOREIGN KEY (`dailyReportId`) REFERENCES `dailyreport`(`id`) ON DELETE CASCADE,
  CONSTRAINT `rn_agent_fkey` FOREIGN KEY (`agentId`) REFERENCES `agent`(`id`),
  CONSTRAINT `rn_muni_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipality`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
'@ | Set-Content -Path .\sql\001_catalogs.sql -Encoding UTF8