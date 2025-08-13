#!/usr/bin/env tsx

/**
 * Script para verificar el problema de autenticación con César Espíndola
 */

import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🔍 DIAGNÓSTICO DE AUTENTICACIÓN')
  console.log('=' .repeat(60))

  // 1. Verificar conexión a BD
  console.log('\n1️⃣ VERIFICANDO CONEXIÓN A BASE DE DATOS...')
  try {
    await prisma.$connect()
    console.log('✅ Conexión exitosa a PostgreSQL')
  } catch (error) {
    console.error('❌ Error conectando a BD:', error)
    return
  }

  // 2. Buscar usuario César
  console.log('\n2️⃣ BUSCANDO USUARIO CÉSAR ESPÍNDOLA...')
  
  // Por email
  const userByEmail = await prisma.user.findUnique({
    where: { email: 'mail.paulo@gmail.com' }
  })
  console.log(`   Por email (mail.paulo@gmail.com): ${userByEmail ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`)
  
  // Por username
  const userByUsername = await prisma.user.findUnique({
    where: { username: 'cesar.espindola' }
  })
  console.log(`   Por username (cesar.espindola): ${userByUsername ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`)
  
  // Por matrícula
  const userByMatricula = await prisma.user.findUnique({
    where: { matricula: 'cesar.espindola' }
  })
  console.log(`   Por matrícula (cesar.espindola): ${userByMatricula ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`)

  const user = userByEmail || userByUsername || userByMatricula
  
  if (!user) {
    console.log('\n❌ USUARIO NO ENCONTRADO EN LA BASE DE DATOS')
    return
  }

  // 3. Mostrar datos del usuario
  console.log('\n3️⃣ DATOS DEL USUARIO:')
  console.log(`   ID: ${user.id}`)
  console.log(`   Nombre: ${user.name}`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Username: ${user.username}`)
  console.log(`   Matrícula: ${user.matricula}`)
  console.log(`   Password hash: ${user.password.substring(0, 20)}...`)

  // 4. Verificar contraseñas
  console.log('\n4️⃣ VERIFICANDO CONTRASEÑAS:')
  
  const passwords = ['admin1234', 'password123', 'Admin1234', 'Password123']
  
  for (const pwd of passwords) {
    const isValid = await bcrypt.compare(pwd, user.password)
    console.log(`   ${pwd}: ${isValid ? '✅ VÁLIDA' : '❌ INVÁLIDA'}`)
  }

  // 5. Simular autenticación completa
  console.log('\n5️⃣ SIMULANDO AUTENTICACIÓN COMPLETA:')
  
  const credentials = {
    email: 'mail.paulo@gmail.com',
    password: 'admin1234',
    matricula: 'cesar.espindola'
  }
  
  console.log('   Credenciales a probar:')
  console.log(`     Email: ${credentials.email}`)
  console.log(`     Password: ${credentials.password}`)
  console.log(`     Matrícula: ${credentials.matricula}`)
  
  // Buscar usuario
  const authUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: credentials.email.toLowerCase() },
        { username: credentials.email.toLowerCase() }
      ]
    }
  })
  
  if (!authUser) {
    console.log('\n   ❌ Usuario no encontrado con email/username')
    return
  }
  console.log('\n   ✅ Usuario encontrado')
  
  // Verificar matrícula
  if (authUser.matricula !== credentials.matricula) {
    console.log(`   ❌ Matrícula incorrecta: esperada "${authUser.matricula}", recibida "${credentials.matricula}"`)
    return
  }
  console.log('   ✅ Matrícula correcta')
  
  // Verificar contraseña
  const passwordValid = await bcrypt.compare(credentials.password, authUser.password)
  if (!passwordValid) {
    console.log('   ❌ Contraseña incorrecta')
    return
  }
  console.log('   ✅ Contraseña correcta')
  
  console.log('\n   🎉 AUTENTICACIÓN EXITOSA!')
  
  // 6. Instrucciones para login
  console.log('\n6️⃣ INSTRUCCIONES PARA LOGIN:')
  console.log('\n   📝 USA ESTOS DATOS EXACTOS:')
  console.log('   -------------------------')
  console.log('   Email: mail.paulo@gmail.com')
  console.log('   Contraseña: admin1234')
  console.log('   Matrícula: cesar.espindola')
  console.log('\n   ⚠️ IMPORTANTE: La matrícula NO es opcional, es obligatoria')
  console.log('   ⚠️ La matrícula debe ser: cesar.espindola (tu username)')

  // 7. Verificar si hay otros usuarios
  console.log('\n7️⃣ OTROS USUARIOS EN EL SISTEMA:')
  const allUsers = await prisma.user.findMany({
    select: {
      name: true,
      email: true,
      username: true,
      matricula: true
    }
  })
  
  allUsers.forEach(u => {
    console.log(`\n   ${u.name}:`)
    console.log(`     Email: ${u.email}`)
    console.log(`     Username: ${u.username}`)
    console.log(`     Matrícula: ${u.matricula}`)
  })
}

main()
  .catch((error) => {
    console.error('💥 Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
