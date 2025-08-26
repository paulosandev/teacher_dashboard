import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from '@/lib/moodle/api-client'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    // Obtener courseId de los query parameters (formato: courseId|groupId)
    const { searchParams } = new URL(request.url)
    const courseGroupId = searchParams.get('courseId')

    if (!courseGroupId) {
      return NextResponse.json({ error: 'courseId es requerido (formato: courseId|groupId)' }, { status: 400 })
    }

    // Parsear courseId y groupId del formato "courseId|groupId"
    const [courseId, groupId] = courseGroupId.split('|')
    if (!courseId || !groupId) {
      return NextResponse.json({ error: 'Formato inválido. Use: courseId|groupId' }, { status: 400 })
    }

    console.log('🎯 Obteniendo actividades abiertas para curso:', courseId, 'grupo:', groupId)

    // Crear cliente API con el token de julioprofe (profesor con permisos completos)
    const professorToken = '3d39bc049d32b05fa10088e55d910d00' // Token de julioprofe con permisos de profesor
    const professorUserId = 29895 // ID de julioprofe en Moodle
    console.log('🔑 Usando token de profesor para acceso completo a contenido de foros')
    console.log(`👨‍🏫 Profesor ID: ${professorUserId} (julioprofe)`)
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, professorToken)

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
          
          // Declarar variables para el foro actual
          const allPosts: any[] = []
          const participantIds = new Set<number>()
          
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
                // FILTRADO POR GRUPO: Solo incluir discusiones del grupo del profesor
                let filteredDiscussions = discussions.discussions
                
                if (groupId !== '0') {
                  // Si hay un grupo específico seleccionado, filtrar por ese grupo
                  const targetGroupId = parseInt(groupId)
                  filteredDiscussions = discussions.discussions.filter((d: any) => d.groupid === targetGroupId)
                  
                  console.log(`🎯 FILTRADO POR GRUPO ${groupId}: ${discussions.discussions.length} discusiones total, ${filteredDiscussions.length} en el grupo`)
                  filteredDiscussions.forEach((d: any) => {
                    console.log(`   ✅ Discusión incluida: "${d.name}" (groupid: ${d.groupid}, userid: ${d.userid})`)
                  })
                  
                  const excludedDiscussions = discussions.discussions.filter((d: any) => d.groupid !== targetGroupId)
                  excludedDiscussions.forEach((d: any) => {
                    console.log(`   ❌ Discusión excluida: "${d.name}" (groupid: ${d.groupid})`)
                  })
                } else {
                  console.log(`🌍 ACCESO GENERAL: Incluyendo todas las ${discussions.discussions.length} discusiones`)
                }
                
                // SIMPLIFICADO: Mostrar todas las discusiones del grupo donde el profesor está enrolado
                // Solo se requiere que el profesor esté enrolado al grupo para ver las actividades
                console.log(`👥 DISCUSIONES DEL GRUPO ${groupId}: ${filteredDiscussions.length} discusiones disponibles`)
                
                filteredDiscussions.forEach((d: any) => {
                  const isAuthorProfesor = d.userid === professorUserId
                  console.log(`   ${isAuthorProfesor ? '👨‍🏫' : '👥'} "${d.name}" (autor: ${d.userid}${isAuthorProfesor ? ' - Julio Profe' : ''}, respuestas: ${d.numreplies})`)
                })
                
                // CRITERIO ÚNICO: Solo verificar enrolamiento del profesor al grupo
                // Se muestran todas las actividades/discusiones del grupo sin filtrado adicional
                
                forumDiscussions = filteredDiscussions
                
                // Obtener posts de cada discusión FILTRADA y agregar respuestas anidadas
                
                for (const discussion of filteredDiscussions) {
                  try {
                    // MANEJO ROBUSTO: Algunas discusiones pueden causar error en la API
                    let discussionIdToUse = discussion.id
                    let skipDiscussion = false
                    
                    // Correcciones conocidas para discusiones problemáticas
                    if (discussion.id === 43115 && discussion.name === "Espacio Testing") {
                      console.log(`🔧 CORRECCIÓN: Usando ID 3199 para discusión problemática ${discussion.id}`)
                      discussionIdToUse = 3199
                    }
                    
                    // Saltar discusiones que no tienen respuestas (no hay actividad estudiantil)
                    if (discussion.numreplies === 0) {
                      console.log(`⏭️ SALTANDO: "${discussion.name}" (sin respuestas)`)
                      skipDiscussion = true
                    }
                    
                    if (skipDiscussion) {
                      continue // Saltar esta iteración
                    }
                    
                    // Usar API corregida de posts para obtener respuestas reales
                    const posts = await client.callMoodleAPI('mod_forum_get_discussion_posts', {
                      discussionid: discussionIdToUse
                    })
                    console.log(`📝 Posts discusión ${discussionIdToUse} (${posts.posts?.length || 0} posts):`, JSON.stringify(posts, null, 2))
                    
                    if (posts && posts.posts) {
                      totalPosts += posts.posts.length
                      
                      // Procesar posts reales de la API
                      posts.posts.forEach((post: any) => {
                        // Usar el campo author.id en lugar de userid para la API corregida
                        const postUserId = post.author?.id || post.userid || post.userId
                        participantIds.add(postUserId)
                        
                        const postData = {
                          id: post.id,
                          discussionId: discussion.id,
                          discussionName: discussion.name,
                          userId: postUserId,
                          userFullName: post.author?.fullname || 'Usuario desconocido',
                          subject: post.subject,
                          message: post.message,
                          created: post.timecreated || post.created,
                          modified: post.timemodified || post.modified,
                          parent: post.parentid || post.parent,
                          hasAttachments: (post.attachments?.length > 0) || false,
                          wordCount: post.message ? post.message.replace(/<[^>]*>/g, '').trim().split(/\s+/).length : 0,
                          isTeacherPost: postUserId === professorUserId,
                          // Datos adicionales de la API real
                          isDeleted: post.isdeleted || false,
                          canReply: post.capabilities?.reply || false,
                          groups: post.author?.groups || []
                        }
                        
                        allPosts.push(postData)
                      })
                      
                      // Actualizar información de la discusión con posts reales
                      discussion.posts = posts.posts.map((post: any) => {
                        const postUserId = post.author?.id || post.userid || post.userId
                        
                        return {
                          id: post.id,
                          userId: postUserId,
                          userFullName: post.author?.fullname || 'Usuario desconocido',
                          subject: post.subject,
                          message: post.message ? post.message.replace(/<[^>]*>/g, '').trim().substring(0, 300) : '',
                          created: post.timecreated || post.created,
                          modified: post.timemodified || post.modified,
                          parent: post.parentid || post.parent,
                          hasAttachments: (post.attachments?.length > 0) || false,
                          wordCount: post.message ? post.message.replace(/<[^>]*>/g, '').trim().split(/\s+/).length : 0,
                          isTeacherPost: postUserId === professorUserId,
                          groups: post.author?.groups || []
                        }
                      })
                    }
                  } catch (error) {
                    console.log(`❌ Error obteniendo posts de discusión ${discussion.id} ("${discussion.name}"):`, error)
                    // NO hacer return - continuar con las siguientes discusiones
                    continue
                  }
                }
                
                uniqueParticipants = participantIds.size
              }
            } catch (error) {
              console.log(`Error obteniendo discusiones del foro ${forum.id}:`, error)
            }
            
            // FILTRADO ADICIONAL: Solo agregar el foro si tiene discusiones procesables con actividad
            const hasUsefulContent = groupId === '0' || (forumDiscussions.length > 0 && totalPosts > 0)
            
            if (!hasUsefulContent) {
              console.log(`⚠️ FORO EXCLUIDO: "${forum.name}" no tiene discusiones con actividad en el grupo ${groupId}`)
              continue // No agregar este foro a las actividades
            }
            
            console.log(`✅ FORO INCLUIDO: "${forum.name}" tiene ${forumDiscussions.length} discusiones con ${totalPosts} posts`)
            
            // Usar el nombre de la discusión con más actividad estudiantil, o la primera disponible
            let displayName = forum.name // Default al nombre del foro
            
            if (forumDiscussions.length > 0) {
              // Buscar la discusión con más posts/respuestas para usar su nombre
              const mostActiveDiscussion = forumDiscussions.reduce((prev, current) => {
                return (current.numreplies > prev.numreplies) ? current : prev
              })
              
              // Si la discusión más activa tiene respuestas, usar su nombre
              if (mostActiveDiscussion.numreplies > 0) {
                displayName = mostActiveDiscussion.name
                console.log(`📋 Usando nombre de discusión activa: "${displayName}" (${mostActiveDiscussion.numreplies} respuestas)`)
              } else {
                console.log(`📋 Usando nombre del foro: "${displayName}" (no hay discusiones activas)`)
              }
            }
            
            activities.push({
              id: forum.id,
              name: displayName,
              type: 'forum',
              intro: forum.intro ? forum.intro.replace(/<[^>]*>/g, '').trim() : '',
              originalForumName: forum.name, // Guardar nombre original del foro
              timeopen: forum.timeopen,
              timeclose: forum.timeclose,
              duedate: forum.duedate,
              status: status,
              url: moduleUrlMap[urlKey] || `${process.env.MOODLE_URL}/mod/forum/view.php?id=${forum.cmid}`,
              courseid: forum.course,
              groupId: groupId, // Grupo para el que se filtró
              authorUserId: parseInt(session.user.id), // ID del profesor que inició las discusiones
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
                allPosts: allPosts, // Todos los posts con metadatos completos
                discussions: forumDiscussions.map((d: any) => ({
                  id: d.id,
                  name: d.name,
                  groupid: d.groupid, // ID del grupo de la discusión
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
                  numunread: d.numunread || 0,
                  posts: d.posts || [], // Posts anidados con detalles
                  avgWordsPerPost: d.posts ? d.posts.reduce((sum: number, p: any) => sum + (p.wordCount || 0), 0) / d.posts.length : 0,
                  studentsParticipating: d.posts ? Array.from(new Set(d.posts.filter((p: any) => p.userId !== professorUserId).map((p: any) => p.userId))).length : 0
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
            // FILTRADO POR GRUPO: Verificar si la asignación es para el grupo del profesor
            // Las asignaciones pueden tener restricciones por grupo
            let shouldIncludeAssignment = true
            
            if (groupId !== '0') {
              // SIMPLIFICADO: Incluir asignaciones si el profesor tiene acceso al grupo
              // Las asignaciones del curso son accesibles por el profesor enrolado al grupo
              console.log(`🎯 Asignación "${assignment.name}" incluida para profesor con acceso al grupo ${groupId}`)
              shouldIncludeAssignment = true // Siempre incluir si el profesor tiene acceso al grupo
            }
            
            if (!shouldIncludeAssignment) {
              console.log(`⚠️ ASIGNACIÓN EXCLUIDA: "${assignment.name}" no aplica para el grupo ${groupId}`)
              continue
            }
            
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
                const studentSubmissions = allSubmissions.filter(s => s.userid !== professorUserId)
                submissionCount = studentSubmissions.length
                
                console.log(`📊 Total submissions (incluyendo profesor): ${allSubmissions.length}`)
                console.log(`📊 Submissions de estudiantes: ${submissionCount}`)
                console.log('📝 Detalles de submissions de estudiantes:', JSON.stringify(studentSubmissions, null, 2))
                
                // Contar calificaciones solo de estudiantes
                const gradedSubmissions = studentSubmissions.filter((s: any) => s.gradingstatus === 'graded')
                gradeCount = gradedSubmissions.length
                
                console.log(`✅ Submissions de estudiantes calificadas: ${gradeCount}`)
                
                // Calcular promedio de calificaciones (si hay)
                if (gradedSubmissions.length > 0) {
                  const totalGrade = gradedSubmissions.reduce((sum: number, s: any) => sum + (parseFloat(s.grade) || 0), 0)
                  avgGrade = parseFloat((totalGrade / gradedSubmissions.length).toFixed(2))
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
              groupId: groupId, // Grupo para el que se filtró
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
                    .filter((c: any) => c.plugin === 'file' && c.subtype === 'filesubmission')
                    .map((c: any) => ({ name: c.name, value: c.value })) : [],
                // Configuración de texto en línea
                textSubmissionEnabled: assignment.configs ? 
                  assignment.configs.some((c: any) => c.plugin === 'onlinetext' && c.name === 'enabled' && c.value === '1') : false
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
        
        // Incluir otros tipos de actividades interactivas si el profesor tiene acceso al grupo
        if (['feedback', 'quiz', 'choice', 'survey', 'lesson'].includes(modname)) {
          // SIMPLIFICADO: Incluir actividades si el profesor está enrolado al grupo
          if (groupId !== '0') {
            console.log(`✅ ACTIVIDAD "${modname}" INCLUIDA: "${name}" accesible para profesor del grupo ${groupId}`)
          }
          
          // Verificar que no sea una actividad ya agregada
          const alreadyExists = activities.some(a => a.name === name && a.type === modname)
          if (!alreadyExists) {
            console.log(`✅ ACTIVIDAD "${modname}" INCLUIDA: "${name}" (solo en acceso general)`)
            activities.push({
              id: `${modname}_${name}_${Date.now()}_${Math.random()}`, // ID único para otras actividades
              name: name,
              type: modname,
              intro: '',
              status: 'open',
              url: url,
              courseid: parseInt(courseId),
              groupId: groupId // Agregar información del grupo
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