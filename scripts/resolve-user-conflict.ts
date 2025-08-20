#!/usr/bin/env tsx

import { prisma } from '../lib/db/prisma'
import { decrypt } from '../lib/utils/encryption'

async function resolveUserConflict() {
  console.log('🔍 RESOLVIENDO CONFLICTO DE USUARIOS')
  console.log('='.repeat(50))
  
  try {
    // 1. Buscar todos los usuarios relevantes
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { email: 'mail.paulo@gmail.com' },
          { matricula: 'cesar.espindola' },
          { email: 'cesar.espindola@utel.edu.mx' }
        ]
      },
      include: { moodleToken: true }
    })
    
    console.log(`\nEncontrados ${users.length} usuarios relevantes:`)
    
    users.forEach((user, index) => {
      console.log(`\n📋 Usuario ${index + 1}:`)
      console.log('  ID:', user.id)
      console.log('  Nombre:', user.name)
      console.log('  Email:', user.email)
      console.log('  Matrícula:', user.matricula)
      console.log('  Token:', user.moodleToken ? '✅ Configurado' : '❌ No configurado')
      
      if (user.moodleToken) {
        console.log('    Usuario Moodle:', user.moodleToken.moodleUsername)
        console.log('    Activo:', user.moodleToken.isActive)
      }
    })
    
    // 2. Identificar el conflicto
    const pauloUser = users.find(u => u.email === 'mail.paulo@gmail.com')
    const cesarUser = users.find(u => u.matricula === 'cesar.espindola')
    
    if (pauloUser && cesarUser && pauloUser.id !== cesarUser.id) {
      console.log('\n⚠️ CONFLICTO DETECTADO:')
      console.log('  - Usuario Paulo (mail.paulo@gmail.com) tiene matrícula:', pauloUser.matricula)
      console.log('  - Otro usuario ya tiene matrícula cesar.espindola')
      
      // 3. Verificar si el usuario César tiene token
      if (cesarUser.moodleToken) {
        console.log('\n✅ El usuario con matrícula cesar.espindola YA tiene token configurado')
        
        // Transferir el token a Paulo
        console.log('\n🔄 Transfiriendo token al usuario Paulo...')
        
        // Primero eliminar el token del usuario César si Paulo ya tiene uno
        if (pauloUser.moodleToken) {
          await prisma.userMoodleToken.delete({
            where: { userId: pauloUser.id }
          })
        }
        
        // Transferir el token
        await prisma.userMoodleToken.update({
          where: { userId: cesarUser.id },
          data: { userId: pauloUser.id }
        })
        
        console.log('✅ Token transferido')
      }
      
      // 4. Eliminar el usuario duplicado César
      console.log('\n🗑️ Eliminando usuario duplicado...')
      await prisma.user.delete({
        where: { id: cesarUser.id }
      })
      
      // 5. Actualizar matrícula de Paulo
      console.log('\n🔄 Actualizando matrícula de Paulo a cesar.espindola...')
      const updatedUser = await prisma.user.update({
        where: { id: pauloUser.id },
        data: { matricula: 'cesar.espindola' }
      })
      
      console.log('\n✅ CONFLICTO RESUELTO:')
      console.log('  Nombre:', updatedUser.name)
      console.log('  Email:', updatedUser.email)
      console.log('  Matrícula:', updatedUser.matricula)
      
    } else if (pauloUser && !cesarUser) {
      console.log('\n✅ No hay conflicto, actualizando matrícula directamente...')
      
      const updatedUser = await prisma.user.update({
        where: { id: pauloUser.id },
        data: { matricula: 'cesar.espindola' }
      })
      
      console.log('✅ Usuario actualizado:')
      console.log('  Nombre:', updatedUser.name)
      console.log('  Email:', updatedUser.email)
      console.log('  Matrícula:', updatedUser.matricula)
      
    } else if (pauloUser && cesarUser && pauloUser.id === cesarUser.id) {
      console.log('\n✅ El usuario ya tiene la matrícula correcta')
    }
    
    // 6. Verificar el estado final
    console.log('\n📊 ESTADO FINAL:')
    const finalUser = await prisma.user.findUnique({
      where: { email: 'mail.paulo@gmail.com' },
      include: { moodleToken: true }
    })
    
    if (finalUser) {
      console.log('  Usuario configurado correctamente:')
      console.log('    Nombre:', finalUser.name)
      console.log('    Email:', finalUser.email)
      console.log('    Matrícula:', finalUser.matricula)
      console.log('    Token:', finalUser.moodleToken ? '✅ Configurado' : '❌ Necesita configurar token')
      
      if (!finalUser.moodleToken) {
        console.log('\n💡 SIGUIENTE PASO:')
        console.log('  1. Ir a /settings/moodle-token')
        console.log('  2. Configurar token con:')
        console.log('     - Usuario: cesar.espindola')
        console.log('     - Contraseña: admin1234')
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
resolveUserConflict().catch(console.error)
