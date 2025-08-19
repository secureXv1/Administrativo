import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const codes = ['GRUPO A', 'GRUPO B', 'GRUPO C', 'GRUPO D', 'GRUPO E']
  for (const code of codes) {
    await prisma.group.upsert({
      where: { code },
      update: {},
      create: { code, name: code.replace('GRUPO ', 'Grupo ') }
    })
  }
  console.log('✅ Grupos A–E creados/asegurados')
}

main().finally(() => prisma.$disconnect())
