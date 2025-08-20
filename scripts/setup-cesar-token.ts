#!/usr/bin/env tsx

import { prisma } from '../lib/db/prisma'
import { encrypt } from '../lib/utils/encryption'
import { MoodleAuthService } from '../lib/moodle/auth-service'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

async function setupCesarToken() {
  console.log('🔐 CONFIGURANDO TOKEN PARA cesar.espindola')
  console.log('='.repeat(50))
  
  try {
    // 1. Buscar usuario
    const user = await prisma.user.findFirst({
where: { email: 'cesar.espindola@utel.edu.mx' },
      include: { moodleToken: true }
    })
    
    if (!user) {
      console.log('❌ Usuario no encontrado')
      return
    }
    
    console.log('\n👤 Usuario encontrado:')
    console.log('  Nombre:', user.name)
    console.log('  Email:', user.email)
    console.log('  Matrícula:', user.matricula)
    
    // 2. Generar token con las credenciales de cesar.espindola
    console.log('\n🔄 Generando token con credenciales de Moodle...')
    console.log('  Usuario: cesar.espindola')
    console.log('  Contraseña: admin1234')
    
    const authService = new MoodleAuthService()
    const authResult = await authService.authenticateWithCredentials(
      user.id,
      'cesar.espindola',
      'admin1234'
    )
    
    if (authResult.success && authResult.token) {
      console.log('\n✅ Token generado exitosamente')
      
      // 3. Guardar o actualizar token
      const encryptedToken = encrypt(authResult.token)
      
      if (user.moodleToken) {
        // Actualizar token existente
        await prisma.userMoodleToken.update({
          where: { userId: user.id },
          data: {
            token: encryptedToken,
            moodleUsername: 'cesar.espindola',
            isActive: true,
            updatedAt: new Date()
          }
        })
        console.log('✅ Token actualizado en base de datos')
      } else {
        // Crear nuevo token
        await prisma.userMoodleToken.upsert({
          where: { userId: user.id },
          update: {
            token: encryptedToken,
            moodleUsername: 'cesar.espindola',
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            userId: user.id,
            token: encryptedToken,
            moodleUsername: 'cesar.espindola',
            isActive: true,
            capabilities: []
          }
        })
        console.log('✅ Token creado en base de datos')
      }
      
      // 4. Verificar el token
      console.log('\n🔍 Verificando token...')
      const { MoodleAPIClient } = await import('../lib/moodle/api-client')
      const client = new MoodleAPIClient(process.env.MOODLE_URL!, authResult.token)
      
      const userInfo = await client.getUserInfo()
      console.log('✅ Token verificado:')
      console.log('  Usuario Moodle:', userInfo.fullname)
      console.log('  Username:', userInfo.username)
      console.log('  ID:', userInfo.userid)
      
      // 5. Obtener cursos
      console.log('\n📚 Obteniendo cursos como profesor...')
      const courses = await client.getTeacherCoursesWithGroups('cesar.espindola')
      console.log(`✅ Encontrados ${courses.length} cursos`)
      
      if (courses.length > 0) {
        console.log('\nPrimeros 3 cursos:')
        courses.slice(0, 3).forEach((course: any) => {
          console.log(`  - ${course.fullname} (ID: ${course.id})`)
        })
      }
      
      console.log('\n🎉 CONFIGURACIÓN COMPLETA')
      console.log('El usuario ahora puede:')
      console.log('  1. Hacer login con: mail.paulo@gmail.com')
      console.log('  2. Ver sus cursos en el dashboard')
      console.log('  3. Generar análisis con datos completos')
      
    } else {
      console.log('\n❌ Error al generar token:', authResult.error)
      console.log('\n💡 Posibles causas:')
      console.log('  1. Credenciales incorrectas')
      console.log('  2. Servicio de tokens no configurado en Moodle')
      console.log('  3. Usuario no existe en Moodle')
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    if (error.response?.data) {
      console.error('Detalles:', error.response.data)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
setupCesarToken().catch(console.error)
