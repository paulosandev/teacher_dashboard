#!/usr/bin/env tsx
/**
 * Script para probar la conexión con la API de Moodle
 * Uso: npm run test:moodle
 */

import { moodleClient } from '../lib/moodle/api-client'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

async function testMoodleConnection() {
  console.log('🔧 Probando conexión con Moodle...\n')
  
  // Verificar que las variables de entorno estén configuradas
  if (!process.env.MOODLE_API_URL || !process.env.MOODLE_API_TOKEN) {
    console.error('❌ Error: Las variables MOODLE_API_URL y MOODLE_API_TOKEN deben estar configuradas en el archivo .env')
    console.log('\nAsegúrate de configurar:')
    console.log('MOODLE_API_URL=https://tu-moodle.com/webservice/rest/server.php')
    console.log('MOODLE_API_TOKEN=tu-token-de-api')
    process.exit(1)
  }
  
  console.log('📍 URL de Moodle:', process.env.MOODLE_API_URL)
  console.log('🔑 Token configurado:', process.env.MOODLE_API_TOKEN.substring(0, 10) + '...')
  console.log('')
  
  try {
    // 1. Probar conexión básica
    console.log('1️⃣ Probando conexión básica...')
    const isConnected = await moodleClient.testConnection()
    
    if (!isConnected) {
      console.error('❌ No se pudo conectar con Moodle')
      process.exit(1)
    }
    
    console.log('✅ Conexión exitosa!\n')
    
    // 2. Obtener cursos de un usuario de prueba
    // Nota: El ID 2 es típicamente un usuario profesor en Moodle
    // Puedes cambiar este ID según tu instalación
    const testUserId = 2
    console.log(`2️⃣ Obteniendo cursos del usuario ID ${testUserId}...`)
    
    const courses = await moodleClient.getUserCourses(testUserId)
    
    if (courses.length === 0) {
      console.log('⚠️  No se encontraron cursos para este usuario')
      console.log('   Asegúrate de que el usuario tenga cursos asignados en Moodle')
    } else {
      console.log(`✅ Se encontraron ${courses.length} curso(s):\n`)
      
      for (const course of courses) {
        console.log(`   📚 ${course.fullname} (${course.shortname})`)
        console.log(`      ID: ${course.id}`)
        
        // 3. Obtener grupos del curso
        console.log(`      Obteniendo grupos...`)
        const groups = await moodleClient.getCourseGroups(course.id)
        
        if (groups.length > 0) {
          console.log(`      ✅ ${groups.length} grupo(s) encontrado(s):`)
          for (const group of groups) {
            console.log(`         - ${group.name} (ID: ${group.id})`)
          }
        } else {
          console.log(`      ⚠️  Sin grupos`)
        }
        
        // 4. Obtener foros del curso
        console.log(`      Obteniendo foros...`)
        const forums = await moodleClient.getCourseForums(course.id)
        
        if (forums.length > 0) {
          console.log(`      ✅ ${forums.length} foro(s) encontrado(s):`)
          for (const forum of forums.slice(0, 3)) { // Mostrar máximo 3
            console.log(`         - ${forum.name} (ID: ${forum.id})`)
          }
          if (forums.length > 3) {
            console.log(`         ... y ${forums.length - 3} más`)
          }
        } else {
          console.log(`      ⚠️  Sin foros`)
        }
        
        console.log('') // Línea en blanco entre cursos
      }
    }
    
    // 5. Probar el método combinado
    console.log('3️⃣ Probando método getCoursesWithGroups...')
    const coursesWithGroups = await moodleClient.getCoursesWithGroups(testUserId)
    
    console.log(`✅ Datos combinados obtenidos: ${coursesWithGroups.length} curso(s) con sus grupos`)
    console.log('\n📊 Resumen de la estructura de datos:')
    console.log(JSON.stringify(coursesWithGroups[0], null, 2))
    
    console.log('\n✨ Prueba completada exitosamente!')
    console.log('   Moodle está listo para integrarse con el dashboard')
    
  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error)
    process.exit(1)
  }
}

// Ejecutar prueba
testMoodleConnection().catch(console.error)
