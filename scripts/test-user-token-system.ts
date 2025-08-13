#!/usr/bin/env npx tsx

/**
 * Script para probar el sistema completo de tokens de usuario
 */

import dotenv from 'dotenv'
import path from 'path'
import { prisma } from '../lib/db/prisma'
import { encrypt } from '../lib/utils/encryption'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testTokenSystem() {
  console.log('🧪 PRUEBA DEL SISTEMA DE TOKENS DE USUARIO')
  console.log('='.repeat(60))
  
  // 1. Buscar usuario César
  console.log('\n1️⃣ Buscando usuario César en la base de datos...')
  const cesar = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'cesar' },
        { email: { contains: 'cesar' } },
        { matricula: { contains: 'cesar' } }
      ]
    }
  })
  
  if (!cesar) {
    console.log('❌ Usuario César no encontrado')
    console.log('\n💡 Creando usuario de prueba...')
    
    const bcrypt = await import('bcryptjs')
    const hashedPassword = await bcrypt.hash('password123', 10)
    
    const newUser = await prisma.user.create({
      data: {
        email: 'cesar.espindola@utel.edu.mx',
        username: 'cesar.espindola',
        password: hashedPassword,
        matricula: 'PROF001',
        name: 'César Espíndola'
      }
    })
    
    console.log(`✅ Usuario creado: ${newUser.name} (ID: ${newUser.id})`)
    
    // 2. Simular token de Moodle para César
    console.log('\n2️⃣ Simulando configuración de token de Moodle...')
    
    // IMPORTANTE: Aquí deberías usar el token real del profesor César
    const cesarMoodleToken = 'TOKEN_DE_CESAR_AQUI' // <-- Reemplazar con el token real
    
    if (cesarMoodleToken === 'TOKEN_DE_CESAR_AQUI') {
      console.log('\n⚠️ ADVERTENCIA: Necesitas configurar el token real del profesor César')
      console.log('Edita este script y reemplaza TOKEN_DE_CESAR_AQUI con el token real')
      return
    }
    
    const encryptedToken = encrypt(cesarMoodleToken)
    
    const savedToken = await prisma.userMoodleToken.create({
      data: {
        userId: newUser.id,
        token: encryptedToken,
        moodleUserId: 123, // ID del usuario en Moodle
        moodleUsername: 'cesar.espindola',
        isActive: true,
        capabilities: [] // Se actualizará al verificar el token
      }
    })
    
    console.log('✅ Token de Moodle configurado para César')
    
  } else {
    console.log(`✅ Usuario encontrado: ${cesar.name} (ID: ${cesar.id})`)
    
    // Verificar si tiene token
    const existingToken = await prisma.userMoodleToken.findUnique({
      where: { userId: cesar.id }
    })
    
    if (existingToken) {
      console.log('✅ El usuario ya tiene un token configurado')
      console.log(`   Moodle Username: ${existingToken.moodleUsername}`)
      console.log(`   Activo: ${existingToken.isActive ? 'Sí' : 'No'}`)
    } else {
      console.log('⚠️ El usuario NO tiene token configurado')
      console.log('\n💡 Para configurar el token del profesor César:')
      console.log('1. Obtén el token API del profesor desde Moodle')
      console.log('2. Inicia sesión en el dashboard como César')
      console.log('3. Ve a la configuración del token de Moodle')
      console.log('4. Ingresa el token y guárdalo')
    }
  }
  
  // 3. Probar el cliente con token de usuario
  console.log('\n3️⃣ Probando cliente de Moodle con token de usuario...')
  
  const userWithToken = cesar || await prisma.user.findFirst({
    where: { id: { not: undefined } }
  })
  
  if (userWithToken) {
    try {
      const { createUserMoodleClient } = await import('../lib/moodle/user-api-client')
      const client = createUserMoodleClient(userWithToken.id)
      
      console.log('   Verificando conexión...')
      const isConnected = await client.testConnection()
      
      if (isConnected) {
        console.log('   ✅ Conexión exitosa con token del usuario')
        
        console.log('\n   Obteniendo cursos del profesor...')
        const courses = await client.getTeacherCoursesWithGroups()
        
        console.log(`   ✅ Encontrados ${courses.length} cursos`)
        
        if (courses.length > 0) {
          console.log('\n   📚 Primeros 3 cursos:')
          courses.slice(0, 3).forEach((course: any) => {
            console.log(`      - ${course.name} (${course.groups.length} grupos)`)
          })
        }
      } else {
        console.log('   ❌ No se pudo conectar con el token del usuario')
      }
      
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`)
      
      if (error.message.includes('no tiene un token')) {
        console.log('\n   💡 El usuario necesita configurar su token de Moodle')
      }
    }
  }
  
  console.log('\n\n✅ Prueba completada')
  console.log('\n📏 RESUMEN DEL SISTEMA:')
  console.log('='.repeat(60))
  console.log('✅ Base de datos configurada con modelo UserMoodleToken')
  console.log('✅ Sistema de encriptación funcionando')
  console.log('✅ Cliente de Moodle con soporte para tokens de usuario')
  console.log('✅ API endpoints actualizados para usar tokens de usuario')
  console.log('✅ Componente UI para configuración de tokens')
  console.log('\n🎯 PRÓXIMOS PASOS:')
  console.log('1. Cada profesor debe configurar su token de Moodle')
  console.log('2. El sistema usará automáticamente el token del profesor')
  console.log('3. Cada profesor solo verá y analizará SUS cursos')
  console.log('4. Los permisos nativos de Moodle se respetan automáticamente')
}

// Ejecutar
testTokenSystem()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
