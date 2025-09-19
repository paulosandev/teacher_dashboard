import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from '@/lib/moodle/api-client'
import { PrismaClient } from '@prisma/client'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

interface GroupActivityRequest {
  courseId: string
  groupId: string
  aulaUrl?: string
}

/**
 * Endpoint para obtener actividades abiertas de un grupo específico
 * GET /api/group/activities?courseId=X&groupId=Y&aulaUrl=Z
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.moodleToken) {
      return NextResponse.json(
        { success: false, error: 'No hay sesión activa' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const groupId = searchParams.get('groupId')
    const aulaUrl = searchParams.get('aulaUrl')

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'courseId es requerido' },
        { status: 400 }
      )
    }

    // groupId puede ser 0 para acceso general

    console.log(`🎯 [ACTIVIDADES] Obteniendo actividades abiertas para grupo ${groupId} en curso ${courseId}`)

    // Construir URL completa de API si se proporciona aulaUrl
    let moodleApiUrl = session.user.moodleUrl || process.env.MOODLE_URL!
    if (aulaUrl) {
      moodleApiUrl = aulaUrl.includes('/webservice/rest/server.php')
        ? aulaUrl
        : `${aulaUrl}/webservice/rest/server.php`
    } else {
      moodleApiUrl = moodleApiUrl.includes('/webservice/rest/server.php')
        ? moodleApiUrl
        : `${moodleApiUrl}/webservice/rest/server.php`
    }

    // Obtener el token correcto para el aula específica
    let token = session.user.moodleToken

    // Si tenemos datos multi-aula, usar el token específico del aula
    if (session.user.multiAulaData?.aulaResults && aulaUrl) {
      const aulaResult = session.user.multiAulaData.aulaResults.find(
        (aula: any) => aula.aulaUrl === aulaUrl.replace('/webservice/rest/server.php', '')
      )
      if (aulaResult?.token) {
        token = aulaResult.token
        console.log(`🔑 Usando token específico del aula: ${aulaResult.aulaId}`)
      }
    }

    const client = new MoodleAPIClient(moodleApiUrl, token)

    // Obtener actividades del curso
    const activities = await getOpenActivitiesForGroup(client, parseInt(courseId), parseInt(groupId), moodleApiUrl)

    console.log(`✅ [ACTIVIDADES] Encontradas ${activities.length} actividades abiertas en grupo ${groupId}`)

    return NextResponse.json({
      success: true,
      courseId,
      groupId,
      activities,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error obteniendo actividades del grupo:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * Obtiene actividades abiertas (foros y tareas) para un grupo específico
 */
async function getOpenActivitiesForGroup(
  client: MoodleAPIClient,
  courseId: number,
  groupId: number,
  moodleApiUrl: string
): Promise<any[]> {
  const discussions: any[] = []
  const now = Date.now() / 1000 // Timestamp actual en segundos

  try {
    console.log(`📚 Obteniendo foros del curso ${courseId}`)

    // 1. Obtener contenidos del curso usando token de servicio si está disponible
    let courseContents
    try {
      // Intentar primero con token de usuario
      courseContents = await client.callMoodleAPI('core_course_get_contents', {
        courseid: courseId
      })
      console.log(`📋 [TOKEN USUARIO] Obtenidas ${courseContents?.length || 0} secciones del curso`)
      if (courseContents && courseContents.length > 0) {
        console.log(`📝 [DETALLE] Secciones del curso:`, JSON.stringify(courseContents.map(s => ({
          id: s.id,
          name: s.name,
          modules: s.modules?.length || 0,
          visible: s.visible
        })), null, 2))
      }
    } catch (error) {
      console.warn(`⚠️ Error con token de usuario, intentando con token de servicio:`, error)

      // Si falla, intentar con token de servicio
      const { serviceTokenManager } = await import('@/lib/services/service-token-manager')
      const aulaIdFromUrl = moodleApiUrl.replace('/webservice/rest/server.php', '').replace('https://', '').split('.')[0]
      const serviceToken = serviceTokenManager.getServiceToken(aulaIdFromUrl)

      if (serviceToken) {
        console.log(`🔑 Usando token de servicio para obtener contenidos del curso ${courseId}`)
        const serviceClient = new MoodleAPIClient(serviceToken.aulaUrl, serviceToken.token)
        courseContents = await serviceClient.callMoodleAPI('core_course_get_contents', {
          courseid: courseId
        })
        console.log(`📋 [TOKEN SERVICIO] Obtenidas ${courseContents?.length || 0} secciones del curso`)
      } else {
        throw error // Re-lanzar error original
      }
    }

    // 2. Encontrar foros y tareas
    const activities: any[] = []
    const allModules: any[] = []

    for (const section of courseContents) {
      if (!section.modules) continue

      for (const module of section.modules) {
        allModules.push({
          id: module.id,
          name: module.name,
          modname: module.modname,
          visible: module.visible,
          sectionName: section.name
        })

        // Solo procesar foros y tareas visibles
        if (!module.visible || (module.modname !== 'forum' && module.modname !== 'assign')) continue

        activities.push({
          id: module.instance,
          moduleId: module.id,
          name: module.name,
          sectionName: section.name,
          url: module.url,
          modname: module.modname
        })
      }
    }

    console.log(`📋 Encontradas ${activities.length} actividades (foros y tareas) en el curso`)
    console.log(`🔍 [DETALLE] Total de módulos en el curso: ${allModules.length}`)
    if (allModules.length > 0) {
      console.log(`📄 [MÓDULOS] Tipos encontrados:`, allModules.map(m => `${m.modname}${m.visible ? '' : ' (oculto)'}`).join(', '))
    }

    // 3. Para cada actividad, procesar según su tipo
    for (const activity of activities) {
      if (activity.modname === 'forum') {
        // Procesar foros - obtener discusiones del grupo específico
        try {
          console.log(`🔍 Obteniendo discusiones del foro: ${activity.name}`)

          // Obtener discusiones del foro
          const forumDiscussions = await client.callMoodleAPI('mod_forum_get_forum_discussions', {
            forumid: activity.id
          })

          console.log(`📝 Encontradas ${forumDiscussions.discussions?.length || 0} discusiones en foro ${activity.name}`)

          if (forumDiscussions.discussions && forumDiscussions.discussions.length > 0) {
            console.log(`🔍 [DETALLE] Ejemplo de discusión:`, JSON.stringify(forumDiscussions.discussions[0], null, 2))
          } else {
            console.log(`⚠️ [DETALLE] Respuesta completa del API:`, JSON.stringify(forumDiscussions, null, 2))
          }

          if (forumDiscussions.discussions) {
            for (const discussion of forumDiscussions.discussions) {
              console.log(`🔎 [DISCUSIÓN] ${discussion.name} - GroupID: ${discussion.groupid || 'undefined'} - Buscamos: ${groupId}`)

              // Filtrar por grupo si no es grupo 0 (acceso general)
              if (groupId !== 0 && discussion.groupid !== groupId && discussion.groupid !== 0) {
                console.log(`⏭️ [SKIP] Discusión ${discussion.name} no es del grupo ${groupId}`)
                continue
              }

              // Verificar que la discusión esté abierta
              if (discussion.timestart && discussion.timestart > now) {
                console.log(`⏭️ [SKIP] Discusión ${discussion.name} no ha comenzado aún`)
                continue
              }
              if (discussion.timeend && discussion.timeend < now) {
                console.log(`⏭️ [SKIP] Discusión ${discussion.name} ya terminó`)
                continue
              }

              // Construir URL correcta para la discusión - usar discussion.discussion como ID de discusión
              const urlObj = new URL(activity.url)
              const discussionUrl = `${urlObj.origin}/mod/forum/discuss.php?d=${discussion.discussion}`

              // NUEVA FUNCIONALIDAD: Consultar análisis pre-calculado del foro
              const preCalculatedForumAnalysis = await getPreCalculatedAnalysis(
                moodleApiUrl.replace('/webservice/rest/server.php', '').replace('https://', ''),
                courseId,
                activity.id,
                'forum'
              )

              const discussionActivity = {
                id: discussion.id,
                name: discussion.name,
                modname: 'forum_discussion',
                sectionName: activity.sectionName,
                url: discussionUrl,
                type: 'Foro',
                courseId,
                groupId: discussion.groupid || 0,
                isOpen: true,
                dueDate: discussion.timeend || null,
                forumName: activity.name,
                // NUEVA FUNCIONALIDAD: Incluir análisis pre-calculado
                analysis: preCalculatedForumAnalysis,
                hasAnalysis: !!preCalculatedForumAnalysis,
                details: {
                  forumId: activity.id,
                  discussionId: discussion.id,
                  author: discussion.userfullname,
                  created: discussion.created,
                  modified: discussion.timemodified,
                  replies: discussion.numreplies || 0,
                  unread: discussion.numunread || 0,
                  pinned: discussion.pinned || false,
                  locked: discussion.locked || false
                }
              }

              console.log(`✅ [INCLUIDA] Discusión agregada: ${discussion.name}`)
              discussions.push(discussionActivity)
            }
          }

        } catch (forumError) {
          console.warn(`⚠️ Error obteniendo discusiones del foro ${activity.name}:`, forumError)
        }
      } else if (activity.modname === 'assign') {
        // Procesar tareas/asignaciones consultando análisis pre-calculados
        try {
          console.log(`📝 Procesando tarea: ${activity.name}`)

          // NUEVA FUNCIONALIDAD: Consultar análisis pre-calculado del sistema batch
          const preCalculatedAnalysis = await getPreCalculatedAnalysis(
            moodleApiUrl.replace('/webservice/rest/server.php', '').replace('https://', ''),
            courseId,
            activity.id,
            'assign'
          )

          const assignmentActivity = {
            id: activity.id,
            name: activity.name,
            modname: 'assign',
            sectionName: activity.sectionName,
            url: activity.url,
            type: 'Tarea',
            courseId,
            groupId: groupId,
            isOpen: true,
            dueDate: null,
            // NUEVA FUNCIONALIDAD: Incluir análisis pre-calculado
            analysis: preCalculatedAnalysis,
            hasAnalysis: !!preCalculatedAnalysis,
            details: {
              assignmentId: activity.id,
              description: preCalculatedAnalysis?.summary || 'Detalles no disponibles temporalmente',
              maxGrade: 100,
              allowSubmissionsFromDate: null
            }
          }

          console.log(`✅ [INCLUIDA] Tarea agregada: ${activity.name} ${preCalculatedAnalysis ? '(con análisis)' : '(sin análisis)'}`)
          discussions.push(assignmentActivity)

        } catch (assignError) {
          console.warn(`⚠️ Error procesando tarea ${activity.name}:`, assignError)
        }
      }
    }

    // 4. ADICIONAL: Obtener asignaciones directamente usando mod_assign_get_assignments
    // (algunas asignaciones pueden no aparecer en core_course_get_contents)
    try {
      console.log(`📋 Buscando asignaciones adicionales usando mod_assign_get_assignments...`)

      const assignmentsResponse = await client.callMoodleAPI('mod_assign_get_assignments', {
        courseids: [courseId]
      })

      if (assignmentsResponse.courses && assignmentsResponse.courses.length > 0) {
        const courseAssignments = assignmentsResponse.courses[0].assignments || []
        console.log(`📝 Encontradas ${courseAssignments.length} asignaciones adicionales via API directa`)

        for (const assignment of courseAssignments) {
          // Verificar si ya existe (para evitar duplicados)
          const exists = discussions.some(d => d.modname === 'assign' && d.id === assignment.id)
          if (exists) {
            console.log(`⏭️ Asignación ${assignment.name} ya existe, saltando...`)
            continue
          }

          // Filtrar por fechas de entrega si es necesario
          const isOpen = (!assignment.duedate || assignment.duedate === 0 || assignment.duedate > now) &&
                        (!assignment.cutoffdate || assignment.cutoffdate === 0 || assignment.cutoffdate > now)

          // NUEVO: Verificar si tiene análisis pre-calculado (coherente con el backend)
          const activityKey = `${aulaId}-${courseId}`
          const hasAnalysis = await prisma.activityAnalysis.findFirst({
            where: {
              courseId: activityKey,
              activityId: assignment.id.toString(),
              activityType: 'assign'
            }
          })

          const hasSubstantialContent = assignment.numsubmissions > 0 ||
                                       (assignment.submissions && assignment.submissions.length > 0)

          // NUEVO: Para aulas principales (101-110), mostrar TODAS las actividades
          const isMainAula = /^aula10[1-9]$|^aula110$/.test(aulaId)
          const shouldShow = isMainAula ? true : (isOpen || hasSubstantialContent || hasAnalysis)

          if (!shouldShow) {
            console.log(`⏭️ [SKIP] Asignación ${assignment.name} está cerrada, sin contenido y sin análisis`)
            continue
          }

          if (!isOpen && (hasSubstantialContent || hasAnalysis)) {
            console.log(`📊 [INCLUIR] Asignación ${assignment.name} está vencida pero tiene ${hasAnalysis ? 'análisis' : 'contenido'}`)
          }

          console.log(`📝 Procesando asignación adicional: ${assignment.name}`)

          // Consultar análisis pre-calculado
          const preCalculatedAnalysis = await getPreCalculatedAnalysis(
            moodleApiUrl.replace('/webservice/rest/server.php', '').replace('https://', ''),
            courseId,
            assignment.id,
            'assign'
          )

          const assignmentActivity = {
            id: assignment.id,
            name: assignment.name,
            modname: 'assign',
            sectionName: 'Asignaciones',
            url: `${moodleApiUrl.replace('/webservice/rest/server.php', '')}/mod/assign/view.php?id=${assignment.cmid}`,
            type: 'Tarea',
            courseId,
            groupId: groupId, // Las asignaciones generalmente no están filtradas por grupo
            isOpen: isOpen,
            dueDate: assignment.duedate || null,
            analysis: preCalculatedAnalysis,
            hasAnalysis: !!preCalculatedAnalysis,
            details: {
              assignmentId: assignment.id,
              description: assignment.intro || preCalculatedAnalysis?.summary || 'Detalles no disponibles',
              maxGrade: assignment.grade || 100,
              allowSubmissionsFromDate: assignment.allowsubmissionsfromdate || null,
              dueDate: assignment.duedate || null,
              cutoffDate: assignment.cutoffdate || null
            }
          }

          console.log(`✅ [INCLUIDA] Asignación adicional agregada: ${assignment.name} ${preCalculatedAnalysis ? '(con análisis)' : '(sin análisis)'}`)
          discussions.push(assignmentActivity)
        }
      }
    } catch (assignError) {
      console.warn(`⚠️ Error obteniendo asignaciones adicionales:`, assignError)
    }

    // 5. ADICIONAL: Obtener foros directamente usando mod_forum_get_forums_by_courses
    // (algunos foros pueden no aparecer en core_course_get_contents)
    try {
      console.log(`📋 Buscando foros adicionales usando mod_forum_get_forums_by_courses...`)

      const forumsResponse = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
        courseids: [courseId]
      })

      if (forumsResponse && forumsResponse.length > 0) {
        console.log(`🗣️ Encontrados ${forumsResponse.length} foros adicionales via API directa`)

        for (const forum of forumsResponse) {
          console.log(`🔍 Procesando foro adicional: ${forum.name}`)

          try {
            // Obtener discusiones del foro
            const forumDiscussions = await client.callMoodleAPI('mod_forum_get_forum_discussions', {
              forumid: forum.id
            })

            console.log(`📝 Encontradas ${forumDiscussions.discussions?.length || 0} discusiones en foro adicional ${forum.name}`)

            if (forumDiscussions.discussions && forumDiscussions.discussions.length > 0) {
              for (const discussion of forumDiscussions.discussions) {
                console.log(`🔎 [DISCUSIÓN ADICIONAL] ${discussion.name} - GroupID: ${discussion.groupid || 'undefined'} - Buscamos: ${groupId}`)

                // Verificar si ya existe (para evitar duplicados)
                const exists = discussions.some(d => d.id === discussion.id && d.modname === 'forum_discussion')
                if (exists) {
                  console.log(`⏭️ Discusión ${discussion.name} ya existe, saltando...`)
                  continue
                }

                // Filtrar por grupo si no es grupo 0 (acceso general)
                if (groupId !== 0 && discussion.groupid !== groupId && discussion.groupid !== 0) {
                  console.log(`⏭️ [SKIP] Discusión adicional ${discussion.name} no es del grupo ${groupId}`)
                  continue
                }

                // Verificar que la discusión esté abierta
                if (discussion.timestart && discussion.timestart > now) {
                  console.log(`⏭️ [SKIP] Discusión adicional ${discussion.name} no ha comenzado aún`)
                  continue
                }
                if (discussion.timeend && discussion.timeend < now) {
                  console.log(`⏭️ [SKIP] Discusión adicional ${discussion.name} ya terminó`)
                  continue
                }

                // Construir URL correcta para la discusión
                const discussionUrl = `${moodleApiUrl.replace('/webservice/rest/server.php', '')}/mod/forum/discuss.php?d=${discussion.discussion}`

                // Consultar análisis pre-calculado del foro
                const preCalculatedForumAnalysis = await getPreCalculatedAnalysis(
                  moodleApiUrl.replace('/webservice/rest/server.php', '').replace('https://', ''),
                  courseId,
                  forum.id,
                  'forum'
                )

                const discussionActivity = {
                  id: discussion.id,
                  name: discussion.name,
                  modname: 'forum_discussion',
                  sectionName: 'Foros Adicionales',
                  url: discussionUrl,
                  type: 'Foro',
                  courseId,
                  groupId: discussion.groupid || 0,
                  isOpen: true,
                  dueDate: discussion.timeend || null,
                  forumName: forum.name,
                  analysis: preCalculatedForumAnalysis,
                  hasAnalysis: !!preCalculatedForumAnalysis,
                  details: {
                    forumId: forum.id,
                    discussionId: discussion.id,
                    author: discussion.userfullname,
                    created: discussion.created,
                    modified: discussion.timemodified,
                    replies: discussion.numreplies || 0,
                    unread: discussion.numunread || 0,
                    pinned: discussion.pinned || false,
                    locked: discussion.locked || false
                  }
                }

                console.log(`✅ [INCLUIDA] Discusión adicional agregada: ${discussion.name} ${preCalculatedForumAnalysis ? '(con análisis)' : '(sin análisis)'}`)
                discussions.push(discussionActivity)
              }
            }

          } catch (forumError) {
            console.warn(`⚠️ Error obteniendo discusiones del foro adicional ${forum.name}:`, forumError)
          }
        }
      }
    } catch (forumError) {
      console.warn(`⚠️ Error obteniendo foros adicionales:`, forumError)
    }

    console.log(`✅ Total de actividades encontradas: ${discussions.length}`)
    return discussions

  } catch (error) {
    console.error('❌ Error obteniendo actividades:', error)
    throw error
  }
}

/**
 * Obtiene detalles de un foro y verifica si está abierto
 */
async function getForumDetails(client: MoodleAPIClient, forumId: number, groupId: number, now: number) {
  try {
    const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
      courseids: []
    })

    const forum = forums.find((f: any) => f.id === forumId)
    if (!forum) return { isOpen: false }

    // Verificar fechas de apertura y cierre
    const isOpen = (!forum.duedate || forum.duedate === 0 || forum.duedate > now) &&
                   (!forum.cutoffdate || forum.cutoffdate === 0 || forum.cutoffdate > now)

    // NUEVO: Verificar si tiene análisis pre-calculado o contenido sustancial (coherente con el backend)
    const activityKey = `${client.baseUrl.includes('aula') ? client.baseUrl.match(/aula(\d+)/)?.[1] || 'av141' : 'av141'}-${forum.course || 'unknown'}`
    let hasAnalysis = false
    try {
      const analysis = await prisma.activityAnalysis.findFirst({
        where: {
          activityId: forumId.toString(),
          activityType: 'forum'
        }
      })
      hasAnalysis = !!analysis
    } catch (error) {
      console.log(`⚠️ No se pudo verificar análisis del foro ${forumId}`)
      hasAnalysis = false
    }

    let hasSubstantialContent = false
    try {
      const discussions = await client.getForumDiscussions(forumId)
      hasSubstantialContent = discussions && discussions.length > 0
    } catch (error) {
      console.log(`⚠️ No se pudo verificar contenido del foro ${forumId}`)
      hasSubstantialContent = false
    }

    // NUEVO: Para aulas principales (101-110), mostrar TODOS los foros
    const aulaId = client.baseUrl.includes('aula') ? client.baseUrl.match(/aula(\d+)/)?.[1] || 'av141' : 'av141'
    const isMainAula = /^10[1-9]$|^110$/.test(aulaId)
    const shouldShow = isMainAula ? true : (isOpen || hasSubstantialContent || hasAnalysis)

    return {
      isOpen,
      shouldShow,
      hasSubstantialContent,
      dueDate: forum.duedate || null,
      cutoffDate: forum.cutoffdate || null,
      description: forum.intro || '',
      discussions: 0 // Se puede obtener con mod_forum_get_forum_discussions
    }
  } catch (error) {
    console.warn(`⚠️ Error obteniendo detalles del foro ${forumId}:`, error)
    return { isOpen: true } // Por defecto, asumir que está abierto
  }
}


/**
 * Obtiene detalles de un cuestionario y verifica si está abierto
 */
async function getQuizDetails(client: MoodleAPIClient, quizId: number, now: number) {
  try {
    const quizzes = await client.callMoodleAPI('mod_quiz_get_quizzes_by_courses', {
      courseids: []
    })

    const quiz = quizzes.quizzes?.find((q: any) => q.id === quizId)
    if (!quiz) return { isOpen: false }

    // Verificar si está abierto
    const isOpen = (!quiz.timeclose || quiz.timeclose === 0 || quiz.timeclose > now) &&
                   (!quiz.timeopen || quiz.timeopen === 0 || quiz.timeopen <= now)

    return {
      isOpen,
      openDate: quiz.timeopen || null,
      closeDate: quiz.timeclose || null,
      description: quiz.intro || '',
      questions: quiz.sumgrades || 0
    }
  } catch (error) {
    console.warn(`⚠️ Error obteniendo detalles del cuestionario ${quizId}:`, error)
    return { isOpen: true }
  }
}

/**
 * Convierte el nombre del módulo a un tipo legible
 */
function getActivityType(modname: string): string {
  const types: { [key: string]: string } = {
    'forum': 'Foro de discusión',
    'forum_discussion': 'Foro',
    'assign': 'Tarea',
    'quiz': 'Cuestionario',
    'resource': 'Recurso',
    'page': 'Página',
    'url': 'Enlace web',
    'label': 'Etiqueta',
    'book': 'Libro',
    'folder': 'Carpeta',
    'workshop': 'Taller'
  }

  return types[modname] || modname.charAt(0).toUpperCase() + modname.slice(1)
}

/**
 * NUEVA FUNCIONALIDAD: Consultar análisis pre-calculados del sistema batch
 * Esta función consulta los análisis generados por el sistema cron
 */
async function getPreCalculatedAnalysis(
  aulaId: string,
  courseId: string,
  activityId: number,
  activityType: string
): Promise<any | null> {
  try {
    console.log(`🔍 [ANÁLISIS PRE-CALCULADO] INICIO: Buscando análisis para ${activityType} ${activityId} en curso ${courseId} (aula ${aulaId})`)
    console.log(`🔧 [LLAMADA] getPreCalculatedAnalysis EJECUTÁNDOSE...`)

    // Normalizar aulaId (extraer solo el ID del aula)
    const normalizedAulaId = aulaId.replace(/^https?:\/\//, '').split('.')[0]
    console.log(`🔧 [DEBUG] aulaId original: "${aulaId}" → normalizado: "${normalizedAulaId}"`)

    // Usar exactamente el formato que está en la base de datos
    const expectedCourseId = `${normalizedAulaId}-${courseId}`  // Formato batch: "av141-237"
    console.log(`🎯 [DEBUG] Formato courseId esperado: "${expectedCourseId}"`)

    // Buscar análisis con el formato exacto
    const analysis = await prisma.activityAnalysis.findFirst({
      where: {
        courseId: expectedCourseId,
        activityId: activityId.toString(),
        activityType: activityType,
        isValid: true
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    })

    console.log(`🔍 [QUERY] courseId: "${expectedCourseId}", activityId: "${activityId}", activityType: "${activityType}"`)

    if (analysis) {
      console.log(`✅ [ANÁLISIS PRE-CALCULADO] Análisis encontrado!`)
    } else {
      console.log(`❌ [ANÁLISIS PRE-CALCULADO] No se encontró análisis`)
    }

    if (analysis) {
      console.log(`✅ [ANÁLISIS PRE-CALCULADO] Análisis encontrado para ${activityType} ${activityId}`)
      return {
        summary: analysis.summary,
        insights: analysis.insights,
        recommendations: analysis.positives,
        alerts: analysis.alerts,
        fullAnalysis: analysis.fullAnalysis,
        lastUpdated: analysis.lastUpdated,
        analysisId: analysis.id
      }
    }

    console.log(`⚠️ [ANÁLISIS PRE-CALCULADO] No se encontró análisis para ${activityType} ${activityId} en curso ${courseId}`)
    return null

  } catch (error) {
    console.error(`❌ [ANÁLISIS PRE-CALCULADO] Error consultando análisis:`, error)
    return null
  }
}