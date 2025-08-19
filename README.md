# Novedades Starter (MySQL + Node/Express/Prisma + Vue PWA)

## Estructura
- `novedades-api/` → API Node.js (Express + Prisma + JWT + cron de recordatorios)
- `novedades-pwa/` → Frontend Vue 3 (Vite + Router + PWA + IndexedDB con localforage)

## Requisitos
- Node.js 18+
- MySQL 8+ (o MariaDB)
- (Opcional) Docker si vas a usar docker-compose

## Pasos rápidos
1) **Crear DB y usuario** (recomendado):
   ```sql
   CREATE DATABASE IF NOT EXISTS novedades CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'novedades_app'@'%' IDENTIFIED BY 'N0v3d@d3s!2025';
   GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER ON novedades.* TO 'novedades_app'@'%';
   FLUSH PRIVILEGES;
   ```

2) **Configurar API**:
   ```bash
   cd novedades-api
   cp .env.example .env
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   node scripts/seed-groups.mjs
   npm run dev
   ```

3) **Levantar PWA**:
   ```bash
   cd ../novedades-pwa
   npm install
   npm run dev
   ```

## Ventanas de reporte
- Mañana: 06:16 — 06:45
- Tarde: 14:15 — 14:45

## Notas
- Novedades truncadas a 0 en backend y frontend.
- Puedes cambiar `DATABASE_URL` en `.env` para usar root mientras pruebas.
