/**
 * Script para probar el endpoint de cursos activos de Moodle
 */

import { moodleClient } from '../lib/moodle/api-client'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

async function testMoodleCourses() {
  console.log('🔍 Probando integración con Moodle...\n')
  
  // 1. Probar conexión básica
  console.log('1️⃣ Probando conexión básica...')
  const isConnected = await moodleClient.testConnection()
  
  if (!isConnected) {
    console.error('❌ No se pudo conectar con Moodle')
    process.exit(1)
  }
  
  console.log('✅ Conexión exitosa\n')
  
  // 2. Obtener cursos activos usando el plugin personalizado
  console.log('2️⃣ Obteniendo cursos activos con plugin personalizado...')
  
  try {
    const courses = await moodleClient.getActiveCourses()
    
    if (courses.length > 0) {
      console.log(`✅ Se obtuvieron ${courses.length} cursos activos\n`)
      
      // Mostrar primeros 5 cursos
      console.log('📚 Primeros 5 cursos:')
      courses.slice(0, 5).forEach((course, index) => {
        console.log(`   ${index + 1}. [ID: ${course.id}] ${course.fullname}`)
        console.log(`      Código: ${course.shortname}`)
        console.log(`      Modelo: ${course.model || 'No especificado'}`)
        console.log('')
      })
      
      // 3. Probar obtención de grupos para el primer curso
      if (courses.length > 0) {
        const firstCourse = courses[0]
        console.log(`3️⃣ Obteniendo grupos del curso: ${firstCourse.fullname}...`)
        
        try {
          const groups = await moodleClient.getCourseGroups(firstCourse.id)
          
          if (groups.length > 0) {
            console.log(`✅ Se obtuvieron ${groups.length} grupos`)
            groups.forEach((group, index) => {
              console.log(`   ${index + 1}. ${group.name}`)
            })
          } else {
            console.log('ℹ️  Este curso no tiene grupos')
          }
        } catch (error) {
          console.log('⚠️  No se pudieron obtener grupos (posiblemente requiere permisos adicionales)')
        }
      }
      
      console.log('')
      
      // 4. Probar el método combinado
      console.log('4️⃣ Obteniendo cursos con grupos (método combinado)...')
      const coursesWithGroups = await moodleClient.getCoursesWithGroups()
      
      if (coursesWithGroups.length > 0) {
        console.log(`✅ Se obtuvieron ${coursesWithGroups.length} cursos con sus grupos\n`)
        
        // Mostrar estadísticas
        const totalGroups = coursesWithGroups.reduce((sum, course) => sum + course.groups.length, 0)
        console.log(`📊 Estadísticas:`)
        console.log(`   - Total de cursos: ${coursesWithGroups.length}`)
        console.log(`   - Total de grupos: ${totalGroups}`)
        console.log(`   - Promedio de grupos por curso: ${(totalGroups / coursesWithGroups.length).toFixed(2)}`)
      }
      
    } else {
      console.log('⚠️  No se encontraron cursos activos')
    }
  } catch (error) {
    console.error('❌ Error obteniendo cursos:', error)
  }
  
  console.log('\n✨ Prueba completada')
}

// Ejecutar
testMoodleCourses().catch(console.error)
