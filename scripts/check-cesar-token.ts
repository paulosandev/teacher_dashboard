#!/usr/bin/env tsx

import { prisma } from '../lib/db/prisma'
import { decrypt } from '../lib/utils/encryption'
import { MoodleAPIClient } from '../lib/moodle/api-client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

async function checkCesarToken() {
  console.log('🔍 VERIFICACIÓN DE TOKEN - cesar.espindola')
  console.log('='.repeat(50))
  
  try {
    // Buscar usuario
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'mail.paulo@gmail.com' },
          { matricula: 'cesar.espindola' }
        ]
      },
      include: { moodleToken: true }
    })
    
    if (!user) {
      console.log('❌ Usuario no encontrado')
      return
    }
    
    console.log('\n👤 USUARIO EN BASE DE DATOS:')
    console.log('  Nombre:', user.name)
    console.log('  Email:', user.email)
    console.log('  Matrícula:', user.matricula)
    console.log('  ID:', user.id)
    
    if (!user.moodleToken) {
      console.log('\n❌ NO TIENE TOKEN CONFIGURADO')
      console.log('💡 Debe configurar el token en /settings/moodle-token')
      return
    }
    
    console.log('\n✅ TOKEN ENCONTRADO:')
    console.log('  Usuario Moodle:', user.moodleToken.moodleUsername)
    console.log('  Activo:', user.moodleToken.isActive)
    console.log('  Última actualización:', user.moodleToken.updatedAt)
    
    // Desencriptar y probar token
    const token = decrypt(user.moodleToken.token)
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, token)
    
    console.log('\n🔐 PROBANDO TOKEN...')
    const info = await client.getUserInfo()
    console.log('✅ Token válido!')
    console.log('  Usuario Moodle:', info.fullname)
    console.log('  ID Moodle:', info.userid)
    console.log('  Username:', info.username)
    
    // Obtener cursos como profesor
    console.log('\n📚 CURSOS COMO PROFESOR:')
    const courses = await client.getTeacherCourses('cesar.espindola')
    console.log('  Total:', courses.length, 'cursos')
    
    if (courses.length === 0) {
      console.log('  ⚠️ No se encontraron cursos donde sea profesor')
      return
    }
    
    // Analizar primer curso
    const firstCourse = courses[0]
    console.log('\n📘 ANALIZANDO PRIMER CURSO:')
    console.log('  Nombre:', firstCourse.fullname)
    console.log('  ID:', firstCourse.id)
    console.log('  Nombre corto:', firstCourse.shortname)
    
    // Obtener estudiantes matriculados
    console.log('\n👥 ESTUDIANTES:')
    try {
      const enrolledUsers = await client.getEnrolledUsers(parseInt(firstCourse.id))
      const students = enrolledUsers.filter((u: any) => 
        u.roles?.some((r: any) => r.shortname === 'student')
      )
      const teachers = enrolledUsers.filter((u: any) => 
        u.roles?.some((r: any) => r.shortname === 'editingteacher' || r.shortname === 'teacher')
      )
      
      console.log('  Total usuarios matriculados:', enrolledUsers.length)
      console.log('  Estudiantes:', students.length)
      console.log('  Profesores:', teachers.length)
      
      if (students.length > 0) {
        console.log('\n  Primeros 3 estudiantes:')
        students.slice(0, 3).forEach((s: any) => {
          console.log(`    - ${s.fullname} (${s.email})`)
        })
      }
    } catch (error: any) {
      console.log('  ❌ Error obteniendo estudiantes:', error.message)
    }
    
    // Obtener grupos
    console.log('\n🏷️ GRUPOS/MODALIDADES:')
    try {
      const groups = await client.getCourseGroups(parseInt(firstCourse.id))
      console.log('  Total grupos:', groups.length)
      
      if (groups.length > 0) {
        groups.forEach((g: any) => {
          console.log(`    - ${g.name} (ID: ${g.id})`)
        })
      }
    } catch (error: any) {
      console.log('  ❌ Error obteniendo grupos:', error.message)
    }
    
    // Obtener contenido del curso
    console.log('\n📋 CONTENIDO DEL CURSO:')
    try {
      const contents = await client.getCourseContents(parseInt(firstCourse.id))
      let totalActivities = 0
      let assignments = 0
      let forums = 0
      
      contents.forEach((section: any) => {
        if (section.modules) {
          totalActivities += section.modules.length
          section.modules.forEach((mod: any) => {
            if (mod.modname === 'assign') assignments++
            if (mod.modname === 'forum') forums++
          })
        }
      })
      
      console.log('  Secciones:', contents.length)
      console.log('  Total actividades:', totalActivities)
      console.log('  Tareas:', assignments)
      console.log('  Foros:', forums)
    } catch (error: any) {
      console.log('  ❌ Error obteniendo contenido:', error.message)
    }
    
    // Diagnóstico final
    console.log('\n📊 DIAGNÓSTICO:')
    console.log('='.repeat(50))
    console.log('✅ Token configurado y funcionando')
    console.log('✅ Puede acceder a cursos como profesor')
    console.log('✅ Puede obtener información del curso')
    
    console.log('\n💡 RECOMENDACIONES:')
    console.log('1. El sistema debe usar SIEMPRE este token para operaciones del profesor')
    console.log('2. No usar token administrativo para datos de cursos específicos')
    console.log('3. Verificar que SmartMoodleClient esté usando el token correcto')
    
  } catch (error: any) {
    console.error('\n❌ ERROR GENERAL:', error.message)
    if (error.response) {
      console.error('Detalles:', error.response.data)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
checkCesarToken().catch(console.error)
