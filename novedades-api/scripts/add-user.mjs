import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'

/**
 * Uso:
 * node scripts/add-user.mjs --email=correo@demo.com --password=Clave123 --role=leader --group="GRUPO B"
 * node scripts/add-user.mjs --email=admin2@demo.com --password=Clave123 --role=admin
 */

const prisma = new PrismaClient()

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, ...rest] = a.replace(/^--/, '').split('=')
      return [k, rest.join('=')]
    })
  )
  return {
    email: args.email,
    password: args.password,
    role: (args.role || 'leader').toLowerCase(),      // 'leader' | 'admin'
    groupCode: args.group || args.groupCode || null   // ej: 'GRUPO B'
  }
}

async function main() {
  const { email, password, role, groupCode } = parseArgs()

  if (!email || !password || !role) {
    console.error('❌ Faltan argumentos. Ej: --email=... --password=... --role=leader|admin [--group="GRUPO B"]')
    process.exit(1)
  }
  if (!['leader', 'admin'].includes(role)) {
    console.error('❌ role inválido. Usa leader o admin')
    process.exit(1)
  }

  let groupId = null
  if (role === 'leader') {
    if (!groupCode) {
      console.error('❌ Un líder debe tener --group="GRUPO X"')
      process.exit(1)
    }
    // Asegura que exista el grupo
    const g = await prisma.group.upsert({
      where: { code: groupCode },
      update: {},
      create: { code: groupCode, name: groupCode.replace('GRUPO ', 'Grupo ') }
    })
    groupId = g.id
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, groupId },
    create: { email, passwordHash, role, groupId }
  })

  console.log('✅ Usuario creado/actualizado:')
  console.log(`   email: ${user.email}`)
  console.log(`   role : ${user.role}`)
  console.log(`   group: ${groupId ? groupCode : '(sin grupo)'}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
