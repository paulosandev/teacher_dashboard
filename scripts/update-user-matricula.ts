#!/usr/bin/env tsx

import { prisma } from '../lib/db/prisma'

async function updateUserMatricula() {
  console.log('🔄 Actualizando matrícula del usuario...')
  console.log('='.repeat(50))
  
  try {
    // Primero verificar el usuario actual
    const currentUser = await prisma.user.findUnique({
      where: { email: 'mail.paulo@gmail.com' }
    })
    
    if (!currentUser) {
      console.log('❌ Usuario no encontrado')
      return
    }
    
    console.log('\n📋 Estado actual:')
    console.log('  Nombre:', currentUser.name)
    console.log('  Email:', currentUser.email)
    console.log('  Matrícula actual:', currentUser.matricula)
    
    // Actualizar matrícula
    const updatedUser = await prisma.user.update({
      where: { email: 'mail.paulo@gmail.com' },
      data: { matricula: 'cesar.espindola' }
    })
    
    console.log('\n✅ Usuario actualizado:')
    console.log('  Nombre:', updatedUser.name)
    console.log('  Email:', updatedUser.email)
    console.log('  Matrícula nueva:', updatedUser.matricula)
    
    console.log('\n💡 Ahora el usuario puede:')
    console.log('  1. Hacer login con email: mail.paulo@gmail.com')
    console.log('  2. Usar matrícula cesar.espindola en Moodle')
    console.log('  3. Configurar token para cesar.espindola')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
updateUserMatricula().catch(console.error)
