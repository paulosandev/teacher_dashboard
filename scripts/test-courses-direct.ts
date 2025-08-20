// Script para probar obtención de cursos directamente
import * as dotenv from 'dotenv'
dotenv.config()

async function testCoursesDirect() {
  console.log('📚 PROBANDO OBTENCIÓN DE CURSOS DIRECTAMENTE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  // Importar después de cargar las variables
  const { getMoodleAuthService } = await import('../lib/auth/moodle-auth-service')
  
  const username = 'cesar.espindola'
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
    
    // Crear cliente API para obtener foros
    const { MoodleAPIClient } = await import('../lib/moodle/api-client')
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, authResult.token!)
    
    console.log('📚 CURSOS DONDE SOY PROFESOR:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 Total de cursos encontrados: ${teacherCourses.length}`)
    
    // Función para verificar si un foro está abierto
    const isForumOpen = (forum: any) => {
      const now = Math.floor(Date.now() / 1000) // Timestamp actual en segundos
      
      // Si no hay fechas definidas, consideramos que está abierto
      if (!forum.duedate && !forum.cutoffdate && !forum.timeopen && !forum.timeclose) {
        return true
      }
      
      // Verificar fecha de apertura (timeopen)
      if (forum.timeopen && forum.timeopen > now) {
        return false // Aún no se ha abierto
      }
      
      // Verificar fecha de cierre (timeclose)
      if (forum.timeclose && forum.timeclose < now) {
        return false // Ya se cerró
      }
      
      // Verificar fecha límite (duedate) como referencia adicional
      if (forum.duedate && forum.duedate < now && !forum.timeclose) {
        return false // Pasó la fecha límite y no hay timeclose definido
      }
      
      return true // El foro está abierto
    }

    for (let i = 0; i < teacherCourses.length; i++) {
      const course = teacherCourses[i]
      
      console.log(`\n📖 CURSO ${i + 1}:`)
      console.log(`   ID: ${course.id}`)
      console.log(`   Nombre completo: ${course.fullname}`)
      console.log(`   Nombre corto: ${course.shortname}`)
      console.log(`   Visible: ${course.visible ? 'Sí' : 'No'}`)
      
      // Mostrar información adicional
      if (course.summary) {
        const cleanSummary = course.summary.replace(/<[^>]*>/g, '').trim()
        if (cleanSummary) {
          console.log(`   📝 Descripción: ${cleanSummary.substring(0, 100)}${cleanSummary.length > 100 ? '...' : ''}`)
        }
      }
      
      if (course.startdate) {
        const startDate = new Date(course.startdate * 1000)
        console.log(`   📅 Fecha inicio: ${startDate.toLocaleDateString()}`)
      }
      
      if (course.enddate && course.enddate > 0) {
        const endDate = new Date(course.enddate * 1000)
        console.log(`   📅 Fecha fin: ${endDate.toLocaleDateString()}`)
      }
      
      // Obtener foros del curso
      try {
        console.log(`\n   💬 Obteniendo foros del curso...`)
        const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
          courseids: [course.id]
        })
        
        if (forums && forums.length > 0) {
          console.log(`   💬 Total de foros encontrados: ${forums.length}`)
          
          // Filtrar solo foros abiertos
          const openForums = forums.filter(isForumOpen)
          
          console.log(`   🟢 Foros ABIERTOS: ${openForums.length}`)
          console.log(`   🔴 Foros CERRADOS: ${forums.length - openForums.length}`)
          
          if (openForums.length > 0) {
            console.log(`\n   📋 DETALLE DE FOROS ABIERTOS:`)
            openForums.forEach((forum, forumIndex) => {
              console.log(`      ${forumIndex + 1}. 💬 ${forum.name} (ID: ${forum.id})`)
              
              if (forum.intro) {
                const cleanIntro = forum.intro.replace(/<[^>]*>/g, '').trim()
                if (cleanIntro) {
                  console.log(`         📝 ${cleanIntro.substring(0, 80)}${cleanIntro.length > 80 ? '...' : ''}`)
                }
              }
              
              // Mostrar fechas si están definidas
              if (forum.timeopen && forum.timeopen > 0) {
                const openDate = new Date(forum.timeopen * 1000)
                console.log(`         🕐 Abierto desde: ${openDate.toLocaleDateString()} ${openDate.toLocaleTimeString()}`)
              }
              
              if (forum.timeclose && forum.timeclose > 0) {
                const closeDate = new Date(forum.timeclose * 1000)
                console.log(`         ⏰ Se cierra: ${closeDate.toLocaleDateString()} ${closeDate.toLocaleTimeString()}`)
              }
              
              if (forum.duedate && forum.duedate > 0) {
                const dueDate = new Date(forum.duedate * 1000)
                console.log(`         📅 Fecha límite: ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString()}`)
              }
              
              console.log(`         👥 Tipo: ${forum.type || 'general'}`)
              console.log(`         📊 Discusiones permitidas: ${forum.maxdiscussions || 'Ilimitadas'}`)
            })
          } else {
            console.log(`   ⚠️  No hay foros abiertos en este momento`)
          }
          
        } else {
          console.log(`   ❌ No se encontraron foros en este curso`)
        }
        
      } catch (error) {
        console.log(`   ❌ Error obteniendo foros: ${error}`)
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Proceso completado. Total de cursos: ${teacherCourses.length}`)
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
  }
}

testCoursesDirect().catch(console.error)