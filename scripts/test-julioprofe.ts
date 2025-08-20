// Script para probar obtención de cursos y actividades con julioprofe
import * as dotenv from 'dotenv'
dotenv.config()

async function testJulioProfe() {
  console.log('📚 PROBANDO CON USUARIO JULIOPROFE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  // Importar después de cargar las variables
  const { getMoodleAuthService } = await import('../lib/auth/moodle-auth-service')
  
  const username = 'julioprofe'
  const password = 'admin1234'
  
  try {
    console.log(`🔐 Autenticando usuario: ${username}`)
    
    const moodleAuthService = getMoodleAuthService()
    const authResult = await moodleAuthService.authenticateUser(username, password)
    
    if (!authResult.success || !authResult.user) {
      console.log('❌ Error de autenticación:', authResult.error)
      return
    }
    
    console.log('✅ Autenticación exitosa')
    console.log(`👤 Usuario: ${authResult.user.fullname}`)
    console.log(`🆔 ID: ${authResult.user.id}`)
    
    console.log('\n📚 Obteniendo cursos donde soy profesor...')
    
    const teacherCourses = await moodleAuthService.getTeacherCourses(
      authResult.token!,
      authResult.user.id
    )
    
    // Crear cliente API para obtener actividades
    const { MoodleAPIClient } = await import('../lib/moodle/api-client')
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, authResult.token!)
    
    console.log('📚 CURSOS DONDE SOY PROFESOR:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 Total de cursos encontrados: ${teacherCourses.length}`)
    
    // Función mejorada para verificar si un foro está abierto
    const isForumOpen = (forum: any) => {
      const now = Math.floor(Date.now() / 1000) // Timestamp actual en segundos
      
      console.log(`   🔍 Analizando foro "${forum.name}" (ID: ${forum.id})`)
      console.log(`      - timeopen: ${forum.timeopen} (${forum.timeopen ? new Date(forum.timeopen * 1000) : 'No definido'})`)
      console.log(`      - timeclose: ${forum.timeclose} (${forum.timeclose ? new Date(forum.timeclose * 1000) : 'No definido'})`)
      console.log(`      - duedate: ${forum.duedate} (${forum.duedate ? new Date(forum.duedate * 1000) : 'No definido'})`)
      console.log(`      - cutoffdate: ${forum.cutoffdate} (${forum.cutoffdate ? new Date(forum.cutoffdate * 1000) : 'No definido'})`)
      
      // Si no hay fechas definidas, consideramos que está abierto
      if (!forum.duedate && !forum.cutoffdate && !forum.timeopen && !forum.timeclose) {
        console.log(`      ✅ Abierto: No hay restricciones de fecha`)
        return true
      }
      
      // Verificar fecha de apertura (timeopen)
      if (forum.timeopen && forum.timeopen > 0 && forum.timeopen > now) {
        console.log(`      ❌ Cerrado: Aún no se ha abierto`)
        return false // Aún no se ha abierto
      }
      
      // Verificar fecha de cierre (timeclose)
      if (forum.timeclose && forum.timeclose > 0 && forum.timeclose < now) {
        console.log(`      ❌ Cerrado: Ya se cerró`)
        return false // Ya se cerró
      }
      
      console.log(`      ✅ Abierto: Dentro del rango de fechas`)
      return true // El foro está abierto
    }

    for (let i = 0; i < teacherCourses.length; i++) {
      const course = teacherCourses[i]
      
      console.log(`\n📖 CURSO ${i + 1}:`)
      console.log(`   ID: ${course.id}`)
      console.log(`   Nombre completo: ${course.fullname}`)
      console.log(`   Nombre corto: ${course.shortname}`)
      console.log(`   Visible: ${course.visible ? 'Sí' : 'No'}`)
      
      // Obtener foros del curso
      try {
        console.log(`\n   💬 === FOROS DEL CURSO ===`)
        const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
          courseids: [course.id]
        })
        
        if (forums && forums.length > 0) {
          console.log(`   💬 Total de foros encontrados: ${forums.length}`)
          
          // Filtrar solo foros abiertos
          const openForums = forums.filter(isForumOpen)
          
          console.log(`   🟢 Foros ABIERTOS: ${openForums.length}`)
          console.log(`   🔴 Foros CERRADOS: ${forums.length - openForums.length}`)
          
        } else {
          console.log(`   ❌ No se encontraron foros en este curso`)
        }
        
      } catch (error) {
        console.log(`   ❌ Error obteniendo foros: ${error}`)
      }

      // Obtener asignaciones del curso
      try {
        console.log(`\n   📝 === ASIGNACIONES DEL CURSO ===`)
        const assignments = await client.callMoodleAPI('mod_assign_get_assignments', {
          courseids: [course.id]
        })
        
        if (assignments && assignments.courses && assignments.courses.length > 0) {
          const courseAssignments = assignments.courses[0].assignments || []
          console.log(`   📝 Total de asignaciones encontradas: ${courseAssignments.length}`)
          
          courseAssignments.forEach((assignment: any, index: number) => {
            console.log(`\n   📄 ASIGNACIÓN ${index + 1}: ${assignment.name} (ID: ${assignment.id})`)
            console.log(`      - allowsubmissionsfromdate: ${assignment.allowsubmissionsfromdate} (${assignment.allowsubmissionsfromdate ? new Date(assignment.allowsubmissionsfromdate * 1000) : 'No definido'})`)
            console.log(`      - duedate: ${assignment.duedate} (${assignment.duedate ? new Date(assignment.duedate * 1000) : 'No definido'})`)
            console.log(`      - cutoffdate: ${assignment.cutoffdate} (${assignment.cutoffdate ? new Date(assignment.cutoffdate * 1000) : 'No definido'})`)
            
            const now = Math.floor(Date.now() / 1000)
            let isOpen = true
            
            // Verificar si ya se puede enviar
            if (assignment.allowsubmissionsfromdate && assignment.allowsubmissionsfromdate > now) {
              console.log(`      ❌ No disponible: Aún no se puede enviar`)
              isOpen = false
            }
            
            // Verificar fecha límite
            if (assignment.duedate && assignment.duedate > 0 && assignment.duedate < now) {
              console.log(`      ⚠️  Vencida: Pasó la fecha límite`)
              // Pero puede seguir abierta si no hay cutoffdate
            }
            
            // Verificar fecha de corte final
            if (assignment.cutoffdate && assignment.cutoffdate > 0 && assignment.cutoffdate < now) {
              console.log(`      ❌ Cerrada: Pasó la fecha de corte final`)
              isOpen = false
            }
            
            if (isOpen && (!assignment.duedate || assignment.duedate > now || (!assignment.cutoffdate))) {
              console.log(`      ✅ DISPONIBLE para entrega`)
            }
          })
          
        } else {
          console.log(`   ❌ No se encontraron asignaciones en este curso`)
        }
        
      } catch (error) {
        console.log(`   ❌ Error obteniendo asignaciones: ${error}`)
      }

      // Obtener todas las actividades del curso
      try {
        console.log(`\n   🎯 === CONTENIDOS DEL CURSO ===`)
        const courseContents = await client.callMoodleAPI('core_course_get_contents', {
          courseid: course.id
        })
        
        if (courseContents && courseContents.length > 0) {
          console.log(`   📚 Total de secciones encontradas: ${courseContents.length}`)
          
          let totalModules = 0
          courseContents.forEach((section: any, sectionIndex: number) => {
            if (section.modules && section.modules.length > 0) {
              console.log(`\n   📑 SECCIÓN ${sectionIndex + 1}: ${section.name || 'Sin nombre'}`)
              console.log(`      Módulos: ${section.modules.length}`)
              
              section.modules.forEach((module: any, moduleIndex: number) => {
                console.log(`      ${moduleIndex + 1}. ${module.modname}: ${module.name} (ID: ${module.id})`)
                if (module.url) {
                  console.log(`         URL: ${module.url}`)
                }
                totalModules++
              })
            }
          })
          
          console.log(`\n   📊 Total de módulos/actividades: ${totalModules}`)
          
        } else {
          console.log(`   ❌ No se encontraron contenidos en este curso`)
        }
        
      } catch (error) {
        console.log(`   ❌ Error obteniendo contenidos del curso: ${error}`)
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Análisis completado para ${authResult.user.fullname}`)
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
  }
}

testJulioProfe().catch(console.error)