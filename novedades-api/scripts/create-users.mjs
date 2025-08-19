import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const adminEmail = 'admin@demo.com'
  const leaderEmail = 'liderA@demo.com'
  const pwd = 'Demo2025*+'

  const passwordHash = await bcrypt.hash(pwd, 10)

  const group = await prisma.group.upsert({
    where: { code: 'GRUPO A' },
    update: {},
    create: { code: 'GRUPO A', name: 'Grupo A' }
  })

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'admin' },
    create: { email: adminEmail, passwordHash, role: 'admin' }
  })

  await prisma.user.upsert({
    where: { email: leaderEmail },
    update: { passwordHash, role: 'leader', groupId: group.id },
    create: { email: leaderEmail, passwordHash, role: 'leader', groupId: group.id }
  })

  console.log('✅ Usuarios: admin@demo.com y liderA@demo.com | clave: Demo2025*+')
}
main().finally(()=>prisma.$disconnect())
