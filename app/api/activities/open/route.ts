import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from '@/lib/moodle/api-client'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.moodleToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar expiración del token
    if (session.user.tokenExpiry && new Date() > new Date(session.user.tokenExpiry)) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 401 })
    }

    // Obtener courseId de los query parameters
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    if (!courseId) {
      return NextResponse.json({ error: 'courseId es requerido' }, { status: 400 })
    }

    console.log('🎯 Obteniendo actividades abiertas para curso:', courseId)

    // Crear cliente API con el token de la sesión
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, session.user.moodleToken)

    const now = Math.floor(Date.now() / 1000)
    const activities: any[] = []
    const moduleUrlMap: { [key: string]: string } = {}

    // === 0. OBTENER CONTENIDOS DEL CURSO PRIMERO (para mapear URLs) ===
    try {
      console.log('🗺️ Obteniendo mapeo de URLs...')
      const courseContents = await client.callMoodleAPI('core_course_get_contents', {
        courseid: parseInt(courseId)
      })

      if (courseContents && courseContents.length > 0) {
        courseContents.forEach((section: any) => {
          if (section.modules && section.modules.length > 0) {
            section.modules.forEach((module: any) => {
              // Crear mapeo basado en tipo y nombre para foros y asignaciones
              const key = `${module.modname}_${module.name}`
              moduleUrlMap[key] = module.url
            })
          }
        })
        console.log(`🗺️ URLs mapeadas: ${Object.keys(moduleUrlMap).length}`)
      }
    } catch (error) {
      console.error('Error obteniendo mapeo de URLs:', error)
    }

    // === 1. OBTENER FOROS ===
    try {
      console.log('💬 Obteniendo foros...')
      const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
        courseids: [parseInt(courseId)]
      })

      if (forums && forums.length > 0) {
        for (const forum of forums) {
          // Lógica mejorada para foros
          let isOpen = true
          let status = 'open'
          
          // Verificar fecha de apertura
          if (forum.timeopen && forum.timeopen > 0 && forum.timeopen > now) {
            isOpen = false
            status = 'not_started'
          }
          
          // Verificar fecha de cierre
          if (forum.timeclose && forum.timeclose > 0 && forum.timeclose < now) {
            isOpen = false
            status = 'closed'
          }
          
          if (isOpen) {
            const urlKey = `forum_${forum.name}`
            
            // LOG: Información cruda del foro
            console.log(`\n🔍 === FORO CRUDO: ${forum.name} ===`)
            console.log('📋 Datos completos del foro:', JSON.stringify(forum, null, 2))
            
            // Obtener discusiones del foro para análisis detallado
            let forumDiscussions = []
            let totalPosts = 0
            let uniqueParticipants = 0
            
            try {
              const discussions = await client.callMoodleAPI('mod_forum_get_forum_discussions', {
                forumid: forum.id
              })
              
              console.log(`💬 Respuesta discusiones foro ${forum.id}:`, JSON.stringify(discussions, null, 2))
              
              if (discussions && discussions.discussions) {
                forumDiscussions = discussions.discussions
                
                // Obtener posts de cada discusión
                for (const discussion of discussions.discussions) {
                  try {
                    const posts = await client.callMoodleAPI('mod_forum_get_forum_discussion_posts', {
                      discussionid: discussion.id
                    })
                    
                    console.log(`📝 Posts discusión ${discussion.id}:`, JSON.stringify(posts, null, 2))
                    
                    if (posts && posts.posts) {
                      totalPosts += posts.posts.length
                      const participantIds = [...new Set(posts.posts.map(p => p.userid))]
                      uniqueParticipants = Math.max(uniqueParticipants, participantIds.length)
                    }
                  } catch (error) {
                    console.log(`Error obteniendo posts de discusión ${discussion.id}:`, error)
                  }
                }
              }
            } catch (error) {
              console.log(`Error obteniendo discusiones del foro ${forum.id}:`, error)
            }
            
            activities.push({
              id: forum.id,
              name: forum.name,
              type: 'forum',
              intro: forum.intro ? forum.intro.replace(/<[^>]*>/g, '').trim() : '',
              timeopen: forum.timeopen,
              timeclose: forum.timeclose,
              duedate: forum.duedate,
              status: status,
              url: moduleUrlMap[urlKey] || `${process.env.MOODLE_URL}/mod/forum/view.php?id=${forum.cmid}`,
              courseid: forum.course,
              // Información detallada del foro
              forumDetails: {
                type: forum.type || 'general',
                maxdiscussions: forum.maxdiscussions || 'Ilimitadas',
                maxattachments: forum.maxattachments || 0,
                maxbytes: forum.maxbytes || 0,
                forcesubscribe: forum.forcesubscribe || 0,
                trackingtype: forum.trackingtype || 0,
                rsstype: forum.rsstype || 0,
                rssarticles: forum.rssarticles || 0,
                timemodified: forum.timemodified,
                warnafter: forum.warnafter || 0,
                blockafter: forum.blockafter || 0,
                blockperiod: forum.blockperiod || 0,
                completiondiscussions: forum.completiondiscussions || 0,
                completionreplies: forum.completionreplies || 0,
                completionposts: forum.completionposts || 0,
                cmid: forum.cmid,
                numdiscussions: forumDiscussions.length,
                // Estadísticas calculadas
                totalPosts: totalPosts,
                uniqueParticipants: uniqueParticipants,
                avgPostsPerParticipant: uniqueParticipants > 0 ? (totalPosts / uniqueParticipants).toFixed(2) : 0,
                discussions: forumDiscussions.map(d => ({
                  id: d.id,
                  name: d.name,
                  timemodified: d.timemodified,
                  usermodified: d.usermodified,
                  timestart: d.timestart,
                  timeend: d.timeend,
                  discussion: d.discussion,
                  parent: d.parent,
                  userid: d.userid,
                  created: d.created,
                  modified: d.modified,
                  mailed: d.mailed,
                  subject: d.subject,
                  message: d.message ? d.message.replace(/<[^>]*>/g, '').trim().substring(0, 200) : '',
                  numreplies: d.numreplies || 0,
                  numunread: d.numunread || 0
                }))
              }
            })
          }
        }
        console.log(`💬 Foros procesados: ${forums.length}, abiertos: ${activities.filter(a => a.type === 'forum').length}`)
      }
    } catch (error) {
      console.error('Error obteniendo foros:', error)
    }

    // === 2. OBTENER ASIGNACIONES ===
    try {
      console.log('📝 Obteniendo asignaciones...')
      const assignments = await client.callMoodleAPI('mod_assign_get_assignments', {
        courseids: [parseInt(courseId)]
      })

      if (assignments && assignments.courses && assignments.courses.length > 0) {
        const courseAssignments = assignments.courses[0].assignments || []
        
        for (const assignment of courseAssignments) {
          let isOpen = true
          let status = 'open'
          
          // Verificar si ya se puede enviar
          if (assignment.allowsubmissionsfromdate && assignment.allowsubmissionsfromdate > now) {
            isOpen = false
            status = 'not_started'
          }
          
          // Verificar fecha de corte final
          if (assignment.cutoffdate && assignment.cutoffdate > 0 && assignment.cutoffdate < now) {
            isOpen = false
            status = 'closed'
          }
          
          // Si hay duedate pero no cutoffdate, sigue abierta pero vencida
          if (assignment.duedate && assignment.duedate > 0 && assignment.duedate < now && !assignment.cutoffdate) {
            status = 'overdue' // Vencida pero aún acepta entregas
          }
          
          if (isOpen) {
            const urlKey = `assign_${assignment.name}`
            
            // LOG: Información cruda de la asignación
            console.log(`\n🔍 === ASIGNACIÓN CRUDA: ${assignment.name} ===`)
            console.log('📄 Datos completos de la asignación:', JSON.stringify(assignment, null, 2))
            
            // Obtener información detallada de la asignación
            let submissionCount = 0
            let gradeCount = 0
            let avgGrade = 0
            
            try {
              // Obtener submissions de la asignación
              const submissions = await client.callMoodleAPI('mod_assign_get_submissions', {
                assignmentids: [assignment.id]
              })
              
              console.log(`📥 Respuesta submissions asignación ${assignment.id}:`, JSON.stringify(submissions, null, 2))
              
              if (submissions && submissions.assignments && submissions.assignments.length > 0) {
                const allSubmissions = submissions.assignments[0].submissions || []
                
                // FILTRAR: Excluir submissions del profesor (usuario actual)
                const studentSubmissions = allSubmissions.filter(s => s.userid !== session.user.id)
                submissionCount = studentSubmissions.length
                
                console.log(`📊 Total submissions (incluyendo profesor): ${allSubmissions.length}`)
                console.log(`📊 Submissions de estudiantes: ${submissionCount}`)
                console.log('📝 Detalles de submissions de estudiantes:', JSON.stringify(studentSubmissions, null, 2))
                
                // Contar calificaciones solo de estudiantes
                const gradedSubmissions = studentSubmissions.filter(s => s.gradingstatus === 'graded')
                gradeCount = gradedSubmissions.length
                
                console.log(`✅ Submissions de estudiantes calificadas: ${gradeCount}`)
                
                // Calcular promedio de calificaciones (si hay)
                if (gradedSubmissions.length > 0) {
                  const totalGrade = gradedSubmissions.reduce((sum, s) => sum + (parseFloat(s.grade) || 0), 0)
                  avgGrade = (totalGrade / gradedSubmissions.length).toFixed(2)
                  console.log(`📈 Promedio calculado (solo estudiantes): ${avgGrade}`)
                }
              }
            } catch (error) {
              console.log(`Error obteniendo submissions de asignación ${assignment.id}:`, error)
            }
            
            activities.push({
              id: assignment.id,
              name: assignment.name,
              type: 'assign',
              intro: assignment.intro ? assignment.intro.replace(/<[^>]*>/g, '').trim() : '',
              allowsubmissionsfromdate: assignment.allowsubmissionsfromdate,
              duedate: assignment.duedate,
              cutoffdate: assignment.cutoffdate,
              status: status,
              url: moduleUrlMap[urlKey] || `${process.env.MOODLE_URL}/mod/assign/view.php?id=${assignment.cmid}`,
              courseid: parseInt(courseId),
              // Información detallada de la asignación
              assignDetails: {
                course: assignment.course,
                nosubmissions: assignment.nosubmissions || 0,
                submissiondrafts: assignment.submissiondrafts || 0,
                sendnotifications: assignment.sendnotifications || 0,
                sendlatenotifications: assignment.sendlatenotifications || 0,
                blindmarking: assignment.blindmarking || 0,
                revealidentities: assignment.revealidentities || 0,
                attemptreopenmethod: assignment.attemptreopenmethod || 'none',
                maxattempts: assignment.maxattempts || -1,
                markingworkflow: assignment.markingworkflow || 0,
                markingallocation: assignment.markingallocation || 0,
                requiresubmissionstatement: assignment.requiresubmissionstatement || 0,
                preventsubmissionnotingroup: assignment.preventsubmissionnotingroup || 0,
                configs: assignment.configs || [],
                cmid: assignment.cmid,
                // Estadísticas calculadas
                submissionCount: submissionCount,
                gradeCount: gradeCount,
                avgGrade: avgGrade,
                submissionRate: submissionCount > 0 ? '100.0' : '0.0', // Si hay submissions, la tasa es 100% de los que enviaron
                gradingProgress: gradeCount > 0 ? ((gradeCount / submissionCount) * 100).toFixed(1) : 0,
                // Configuración de archivos
                fileTypeRestrictions: assignment.configs ? 
                  assignment.configs
                    .filter(c => c.plugin === 'file' && c.subtype === 'filesubmission')
                    .map(c => ({ name: c.name, value: c.value })) : [],
                // Configuración de texto en línea
                textSubmissionEnabled: assignment.configs ? 
                  assignment.configs.some(c => c.plugin === 'onlinetext' && c.name === 'enabled' && c.value === '1') : false
              }
            })
          }
        }
        console.log(`📝 Asignaciones procesadas: ${courseAssignments.length}, abiertas: ${activities.filter(a => a.type === 'assign').length}`)
      }
    } catch (error) {
      console.error('Error obteniendo asignaciones:', error)
    }

    // === 3. AGREGAR OTRAS ACTIVIDADES DESDE EL MAPEO INICIAL ===
    try {
      console.log('🎯 Agregando otras actividades...')
      Object.entries(moduleUrlMap).forEach(([key, url]) => {
        const [modname, name] = key.split('_', 2)
        
        // Incluir otros tipos de actividades interactivas
        if (['feedback', 'quiz', 'choice', 'survey', 'lesson'].includes(modname)) {
          // Verificar que no sea una actividad ya agregada
          const alreadyExists = activities.some(a => a.name === name && a.type === modname)
          if (!alreadyExists) {
            activities.push({
              id: `${modname}_${name}_${Date.now()}_${Math.random()}`, // ID único para otras actividades
              name: name,
              type: modname,
              intro: '',
              status: 'open',
              url: url,
              courseid: parseInt(courseId)
            })
          }
        }
      })
      console.log(`🎯 Otras actividades encontradas: ${activities.filter(a => !['forum', 'assign'].includes(a.type)).length}`)
    } catch (error) {
      console.error('Error agregando otras actividades:', error)
    }

    // Ordenar actividades por tipo y nombre
    activities.sort((a, b) => {
      if (a.type !== b.type) {
        const typeOrder = ['forum', 'assign', 'quiz', 'feedback', 'choice', 'survey', 'lesson']
        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)
      }
      return a.name.localeCompare(b.name)
    })

    console.log(`🟢 Total de actividades abiertas encontradas: ${activities.length}`)
    
    // LOG: Resumen final de todas las actividades
    console.log('\n🎯 === RESUMEN FINAL DE ACTIVIDADES ===')
    activities.forEach((activity, index) => {
      console.log(`\n${index + 1}. [${activity.type.toUpperCase()}] ${activity.name}`)
      console.log(`   Status: ${activity.status}`)
      console.log(`   ID: ${activity.id}`)
      
      if (activity.type === 'forum' && activity.forumDetails) {
        console.log(`   📊 Estadísticas: ${activity.forumDetails.numdiscussions} discusiones, ${activity.forumDetails.totalPosts} posts, ${activity.forumDetails.uniqueParticipants} participantes`)
      }
      
      if (activity.type === 'assign' && activity.assignDetails) {
        console.log(`   📊 Estadísticas: ${activity.assignDetails.submissionCount} entregas, ${activity.assignDetails.gradeCount} calificadas`)
      }
      
      console.log(`   📄 Datos completos:`, JSON.stringify(activity, null, 2))
    })

    return NextResponse.json({
      activities: activities,
      summary: {
        total: activities.length,
        forums: activities.filter(a => a.type === 'forum').length,
        assignments: activities.filter(a => a.type === 'assign').length,
        others: activities.filter(a => !['forum', 'assign'].includes(a.type)).length
      }
    })

  } catch (error: any) {
    console.error('❌ Error obteniendo actividades abiertas:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}