// Script para probar el endpoint detallado de actividades
import * as dotenv from 'dotenv'
dotenv.config()

async function testDetailedActivities() {
  console.log('🔍 PROBANDO ENDPOINT DETALLADO DE ACTIVIDADES')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const { getMoodleAuthService } = await import('../lib/auth/moodle-auth-service')
  const { MoodleAPIClient } = await import('../lib/moodle/api-client')
  
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
    
    // Obtener cursos
    const teacherCourses = await moodleAuthService.getTeacherCourses(
      authResult.token!,
      authResult.user.id
    )
    
    if (teacherCourses.length === 0) {
      console.log('❌ No se encontraron cursos')
      return
    }
    
    const courseId = teacherCourses[0].id
    console.log(`📚 Probando con curso: ${teacherCourses[0].fullname} (ID: ${courseId})`)
    
    // Crear cliente para simular el endpoint
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, authResult.token!)
    const now = Math.floor(Date.now() / 1000)

    console.log('\n🎯 === SIMULANDO ENDPOINT DETALLADO ===')

    // === OBTENER FOROS CON INFORMACIÓN DETALLADA ===
    try {
      console.log('\n💬 Analizando foros en detalle...')
      const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
        courseids: [courseId]
      })

      if (forums && forums.length > 0) {
        console.log(`💬 Foros encontrados: ${forums.length}`)
        
        for (let i = 0; i < Math.min(2, forums.length); i++) {
          const forum = forums[i]
          console.log(`\n📋 FORO ${i + 1}: ${forum.name}`)
          console.log(`   ID: ${forum.id}`)
          console.log(`   Tipo: ${forum.type}`)
          console.log(`   Máx discusiones: ${forum.maxdiscussions}`)
          console.log(`   Máx adjuntos: ${forum.maxattachments}`)
          
          // Obtener discusiones
          try {
            const discussions = await client.callMoodleAPI('mod_forum_get_forum_discussions', {
              forumid: forum.id
            })
            
            if (discussions && discussions.discussions) {
              console.log(`   💬 Discusiones: ${discussions.discussions.length}`)
              
              let totalPosts = 0
              let uniqueParticipants = new Set()
              
              // Analizar cada discusión
              for (let j = 0; j < Math.min(2, discussions.discussions.length); j++) {
                const discussion = discussions.discussions[j]
                console.log(`      Discusión ${j + 1}: ${discussion.name}`)
                console.log(`         Respuestas: ${discussion.numreplies}`)
                
                try {
                  const posts = await client.callMoodleAPI('mod_forum_get_forum_discussion_posts', {
                    discussionid: discussion.id
                  })
                  
                  if (posts && posts.posts) {
                    totalPosts += posts.posts.length
                    posts.posts.forEach(p => uniqueParticipants.add(p.userid))
                    console.log(`         Posts: ${posts.posts.length}`)
                    
                    // Mostrar algunos posts de ejemplo
                    posts.posts.slice(0, 2).forEach((post, postIdx) => {
                      const message = post.message ? post.message.replace(/<[^>]*>/g, '').trim() : ''
                      console.log(`            Post ${postIdx + 1} (Usuario ${post.userid}): ${message.substring(0, 60)}...`)
                    })
                  }
                } catch (error) {
                  console.log(`         Error obteniendo posts: ${error}`)
                }
              }
              
              console.log(`   📊 ESTADÍSTICAS CALCULADAS:`)
              console.log(`      Posts totales: ${totalPosts}`)
              console.log(`      Participantes únicos: ${uniqueParticipants.size}`)
              console.log(`      Promedio posts/usuario: ${uniqueParticipants.size > 0 ? (totalPosts / uniqueParticipants.size).toFixed(2) : 0}`)
              
            } else {
              console.log(`   ❌ No se encontraron discusiones`)
            }
          } catch (error) {
            console.log(`   ❌ Error obteniendo discusiones: ${error}`)
          }
        }
      }
    } catch (error) {
      console.error('Error obteniendo foros:', error)
    }

    // === OBTENER ASIGNACIONES CON INFORMACIÓN DETALLADA ===
    try {
      console.log('\n📝 Analizando asignaciones en detalle...')
      const assignments = await client.callMoodleAPI('mod_assign_get_assignments', {
        courseids: [courseId]
      })

      if (assignments && assignments.courses && assignments.courses.length > 0) {
        const courseAssignments = assignments.courses[0].assignments || []
        console.log(`📝 Asignaciones encontradas: ${courseAssignments.length}`)
        
        for (let i = 0; i < Math.min(2, courseAssignments.length); i++) {
          const assignment = courseAssignments[i]
          console.log(`\n📄 ASIGNACIÓN ${i + 1}: ${assignment.name}`)
          console.log(`   ID: ${assignment.id}`)
          console.log(`   Intentos máximos: ${assignment.maxattempts}`)
          console.log(`   Borradores: ${assignment.submissiondrafts ? 'Sí' : 'No'}`)
          console.log(`   Calificación ciega: ${assignment.blindmarking ? 'Sí' : 'No'}`)
          
          // Obtener submissions
          try {
            const submissions = await client.callMoodleAPI('mod_assign_get_submissions', {
              assignmentids: [assignment.id]
            })
            
            if (submissions && submissions.assignments && submissions.assignments.length > 0) {
              const assignmentSubmissions = submissions.assignments[0].submissions || []
              console.log(`   📥 Entregas: ${assignmentSubmissions.length}`)
              
              // Analizar submissions
              const gradedSubmissions = assignmentSubmissions.filter(s => s.gradingstatus === 'graded')
              console.log(`   ✅ Calificadas: ${gradedSubmissions.length}`)
              
              if (gradedSubmissions.length > 0) {
                const totalGrade = gradedSubmissions.reduce((sum, s) => sum + (parseFloat(s.grade) || 0), 0)
                const avgGrade = (totalGrade / gradedSubmissions.length).toFixed(2)
                console.log(`   📊 Promedio calificación: ${avgGrade}`)
              }
              
              console.log(`   📊 ESTADÍSTICAS CALCULADAS:`)
              console.log(`      Tasa de entrega: ${assignmentSubmissions.length > 0 ? '100%' : '0%'}`)
              console.log(`      Progreso calificación: ${assignmentSubmissions.length > 0 ? ((gradedSubmissions.length / assignmentSubmissions.length) * 100).toFixed(1) + '%' : '0%'}`)
              
              // Mostrar algunas configuraciones
              if (assignment.configs && assignment.configs.length > 0) {
                console.log(`   ⚙️ CONFIGURACIONES:`)
                assignment.configs.slice(0, 5).forEach(config => {
                  console.log(`      ${config.plugin}.${config.name}: ${config.value}`)
                })
              }
              
            } else {
              console.log(`   ❌ No se encontraron entregas`)
            }
          } catch (error) {
            console.log(`   ❌ Error obteniendo entregas: ${error}`)
          }
        }
      }
    } catch (error) {
      console.error('Error obteniendo asignaciones:', error)
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Análisis detallado completado')
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
  }
}

testDetailedActivities().catch(console.error)