#!/usr/bin/env tsx

/**
 * Script para verificar y corregir las credenciales de César Espíndola
 */

import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🔧 VERIFICANDO Y CORRIGIENDO CREDENCIALES DE CÉSAR ESPÍNDOLA')
  console.log('=' .repeat(60))

  // 1. Buscar el usuario
  const cesar = await prisma.user.findUnique({
    where: { username: 'cesar.espindola' }
  })

  if (!cesar) {
    console.log('❌ Usuario no encontrado')
    return
  }

  console.log('\n📋 DATOS ACTUALES DEL USUARIO:')
  console.log(`   Nombre: ${cesar.name}`)
  console.log(`   Username: ${cesar.username}`)
  console.log(`   Email: ${cesar.email}`)
  console.log(`   Matrícula: ${cesar.matricula}`)
  console.log(`   ID: ${cesar.id}`)

  // 2. Actualizar la contraseña a 'admin1234'
  console.log('\n🔐 ACTUALIZANDO CONTRASEÑA...')
  const hashedPassword = await bcrypt.hash('admin1234', 10)
  
  await prisma.user.update({
    where: { id: cesar.id },
    data: { 
      password: hashedPassword,
      // Asegurar que el email sea correcto
      email: 'mail.paulo@gmail.com'
    }
  })

  console.log('✅ Contraseña actualizada a: admin1234')

  // 3. Verificar que la contraseña funciona
  console.log('\n🧪 VERIFICANDO NUEVA CONTRASEÑA...')
  const updatedUser = await prisma.user.findUnique({
    where: { username: 'cesar.espindola' }
  })

  if (updatedUser) {
    const isValid = await bcrypt.compare('admin1234', updatedUser.password)
    console.log(`   Verificación: ${isValid ? '✅ EXITOSA' : '❌ FALLIDA'}`)
  }

  // 4. Mostrar formas de login
  console.log('\n📝 FORMAS DE HACER LOGIN:')
  console.log('\n   Opción 1 - Con email:')
  console.log('   -------------------------')
  console.log('   Email: mail.paulo@gmail.com')
  console.log('   Contraseña: admin1234')
  
  console.log('\n   Opción 2 - Con username:')
  console.log('   -------------------------')
  console.log('   Username: cesar.espindola')
  console.log('   Contraseña: admin1234')

  // 5. Limpiar sesiones antiguas
  console.log('\n🧹 LIMPIANDO SESIONES ANTIGUAS...')
  const deletedSessions = await prisma.session.deleteMany({
    where: {
      userId: cesar.id
    }
  })
  console.log(`   Eliminadas ${deletedSessions.count} sesiones antiguas`)

  console.log('\n✅ LISTO! Ya puedes hacer login con las credenciales mostradas arriba.')
}

main()
  .catch((error) => {
    console.error('💥 Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
