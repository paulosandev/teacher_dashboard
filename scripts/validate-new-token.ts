/**
 * Script para validar el nuevo token de Moodle con todos los permisos
 */

import { moodleClient } from '../lib/moodle/api-client'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

async function validateNewToken() {
  console.log('🔐 Validando nuevo token de Moodle...\n')
  console.log('Token: e16e271b2e37da5ade1e439f3314069c\n')
  
  let successCount = 0
  let failureCount = 0
  const results: { test: string; status: string; details?: string }[] = []
  
  // 1. Probar conexión básica
  console.log('1️⃣ Probando conexión básica...')
  try {
    const isConnected = await moodleClient.testConnection()
    if (isConnected) {
      console.log('✅ Conexión exitosa\n')
      successCount++
      results.push({ test: 'Conexión básica', status: '✅ Exitoso' })
    }
  } catch (error) {
    console.error('❌ Error en conexión:', error)
    failureCount++
    results.push({ test: 'Conexión básica', status: '❌ Fallido', details: String(error) })
  }
  
  // 2. Obtener cursos activos (plugin personalizado)
  console.log('2️⃣ Obteniendo cursos activos...')
  try {
    const courses = await moodleClient.getActiveCourses()
    console.log(`✅ Se obtuvieron ${courses.length} cursos activos\n`)
    successCount++
    results.push({ test: 'Cursos activos', status: '✅ Exitoso', details: `${courses.length} cursos` })
    
    if (courses.length > 0) {
      const firstCourse = courses[0]
      console.log(`   Curso de prueba: ${firstCourse.fullname} (ID: ${firstCourse.id})\n`)
      
      // 3. Probar obtención de grupos
      console.log('3️⃣ Obteniendo grupos del curso...')
      try {
        const groups = await moodleClient.getCourseGroups(firstCourse.id)
        console.log(`✅ Grupos obtenidos: ${groups.length}`)
        if (groups.length > 0) {
          console.log(`   Primer grupo: ${groups[0].name}`)
        }
        console.log('')
        successCount++
        results.push({ test: 'Grupos del curso', status: '✅ Exitoso', details: `${groups.length} grupos` })
      } catch (error: any) {
        console.error(`❌ Error obteniendo grupos: ${error.message}\n`)
        failureCount++
        results.push({ test: 'Grupos del curso', status: '❌ Fallido', details: error.message })
      }
      
      // 4. Probar obtención de foros
      console.log('4️⃣ Obteniendo foros del curso...')
      try {
        const forums = await moodleClient.getCourseForums(firstCourse.id)
        console.log(`✅ Foros obtenidos: ${forums.length}`)
        if (forums.length > 0) {
          console.log(`   Primer foro: ${forums[0].name}`)
          
          // 5. Probar obtención de discusiones del primer foro
          console.log('\n5️⃣ Obteniendo discusiones del foro...')
          try {
            const discussions = await moodleClient.getForumDiscussions(forums[0].id)
            console.log(`✅ Discusiones obtenidas: ${discussions.length}`)
            successCount++
            results.push({ test: 'Discusiones del foro', status: '✅ Exitoso', details: `${discussions.length} discusiones` })
            
            if (discussions.length > 0) {
              // 6. Probar obtención de posts de la primera discusión
              console.log('\n6️⃣ Obteniendo posts de una discusión...')
              try {
                const posts = await moodleClient.getDiscussionPosts(discussions[0].id)
                console.log(`✅ Posts obtenidos: ${posts.length}`)
                successCount++
                results.push({ test: 'Posts de discusión', status: '✅ Exitoso', details: `${posts.length} posts` })
              } catch (error: any) {
                console.error(`❌ Error obteniendo posts: ${error.message}`)
                failureCount++
                results.push({ test: 'Posts de discusión', status: '❌ Fallido', details: error.message })
              }
            }
          } catch (error: any) {
            console.error(`❌ Error obteniendo discusiones: ${error.message}`)
            failureCount++
            results.push({ test: 'Discusiones del foro', status: '❌ Fallido', details: error.message })
          }
        }
        console.log('')
        successCount++
        results.push({ test: 'Foros del curso', status: '✅ Exitoso', details: `${forums.length} foros` })
      } catch (error: any) {
        console.error(`❌ Error obteniendo foros: ${error.message}\n`)
        failureCount++
        results.push({ test: 'Foros del curso', status: '❌ Fallido', details: error.message })
      }
      
      // 7. Probar obtención de contenido del curso
      console.log('7️⃣ Obteniendo contenido/actividades del curso...')
      try {
        const contents = await moodleClient.getCourseContents(firstCourse.id)
        console.log(`✅ Secciones obtenidas: ${contents.length}`)
        
        let totalActivities = 0
        contents.forEach((section: any) => {
          if (section.modules) {
            totalActivities += section.modules.length
          }
        })
        console.log(`   Total de actividades/recursos: ${totalActivities}\n`)
        successCount++
        results.push({ test: 'Contenido del curso', status: '✅ Exitoso', details: `${contents.length} secciones, ${totalActivities} actividades` })
      } catch (error: any) {
        console.error(`❌ Error obteniendo contenido: ${error.message}\n`)
        failureCount++
        results.push({ test: 'Contenido del curso', status: '❌ Fallido', details: error.message })
      }
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo cursos:', error)
    failureCount++
    results.push({ test: 'Cursos activos', status: '❌ Fallido', details: String(error) })
  }
  
  // 8. Probar el método combinado
  console.log('8️⃣ Probando obtención de cursos con grupos...')
  try {
    const coursesWithGroups = await moodleClient.getCoursesWithGroups()
    const totalGroups = coursesWithGroups.reduce((sum, course) => sum + course.groups.length, 0)
    console.log(`✅ ${coursesWithGroups.length} cursos con ${totalGroups} grupos en total\n`)
    successCount++
    results.push({ test: 'Cursos con grupos', status: '✅ Exitoso', details: `${coursesWithGroups.length} cursos, ${totalGroups} grupos` })
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}\n`)
    failureCount++
    results.push({ test: 'Cursos con grupos', status: '❌ Fallido', details: error.message })
  }
  
  // Resumen final
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE VALIDACIÓN')
  console.log('='.repeat(60))
  console.log(`\n✅ Pruebas exitosas: ${successCount}`)
  console.log(`❌ Pruebas fallidas: ${failureCount}`)
  console.log(`📈 Tasa de éxito: ${((successCount / (successCount + failureCount)) * 100).toFixed(1)}%\n`)
  
  console.log('Detalle de pruebas:')
  console.log('-'.repeat(60))
  results.forEach(result => {
    console.log(`${result.status} ${result.test}`)
    if (result.details) {
      console.log(`   └─ ${result.details}`)
    }
  })
  
  console.log('\n' + '='.repeat(60))
  
  if (failureCount === 0) {
    console.log('\n🎉 ¡ÉXITO! El nuevo token tiene todos los permisos necesarios.')
    console.log('El sistema está listo para funcionar completamente.')
  } else {
    console.log('\n⚠️  Algunos permisos aún faltan. Revisa los detalles arriba.')
  }
}

// Ejecutar
validateNewToken().catch(console.error)
