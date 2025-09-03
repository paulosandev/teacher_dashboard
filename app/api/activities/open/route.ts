import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from '@/lib/moodle/api-client'

// Función para procesar posts de foro con estructura jerárquica y optimización de contenido
function processForumPostsHierarchy(rawPosts: any[], professorUserId: number) {
  // Construir estructura jerárquica
  const postsMap = new Map<number, any>()
  const rootPosts: any[] = []
  
  // Primera pasada: crear mapa de posts y identificar posts raíz
  rawPosts.forEach(post => {
    const postUserId = post.author?.id || post.userid || post.userId
    const cleanMessage = post.message ? post.message.replace(/<[^>]*>/g, '').trim() : ''
    
    // Determinar si es post del profesor
    const isTeacherPost = postUserId === professorUserId
    
    const processedPost = {
      id: post.id,
      userId: postUserId,
      userFullName: post.author?.fullname || 'Usuario desconocido',
      subject: post.subject || 'Sin asunto',
      message: cleanMessage,
      created: post.timecreated || post.created,
      modified: post.timemodified || post.modified,
      parent: post.parentid || post.parent || 0,
      hasAttachments: (post.attachments?.length > 0) || false,
      wordCount: cleanMessage.split(/\s+/).filter(w => w.length > 0).length,
      isTeacherPost: isTeacherPost,
      isDeleted: post.isdeleted || false,
      // Campos para jerarquía
      children: [],
      level: 0
    }
    
    postsMap.set(post.id, processedPost)
    
    if (processedPost.parent === 0) {
      rootPosts.push(processedPost)
    }
  })
  
  // Segunda pasada: construir jerarquía
  postsMap.forEach(post => {
    if (post.parent > 0 && postsMap.has(post.parent)) {
      const parent = postsMap.get(post.parent)!
      parent.children.push(post)
      post.level = parent.level + 1
    }
  })
  
  // Función recursiva para generar resumen de contenido
  function generateContentSummary(posts: any[], level: number = 0): any {
    return posts.map(post => {
      const childrenSummary = post.children.length > 0 
        ? generateContentSummary(post.children, level + 1)
        : []
      
      // LIMITACIÓN REMOVIDA: Enviar mensaje completo sin truncar
      let optimizedMessage = post.message // Sin limitación de caracteres
      
      return {
        id: post.id,
        level: level,
        author: post.isTeacherPost ? `👨‍🏫 ${post.userFullName}` : `👤 ${post.userFullName}`,
        subject: post.subject,
        message: optimizedMessage,
        wordCount: post.wordCount,
        created: new Date(post.created * 1000).toLocaleDateString(),
        hasAttachments: post.hasAttachments,
        repliesCount: post.children.length,
        children: childrenSummary
      }
    })
  }
  
  // Generar posts optimizados para análisis
  const optimizedPosts = Array.from(postsMap.values()).map(post => ({
    id: post.id,
    userId: post.userId,
    userFullName: post.userFullName,
    subject: post.subject,
    message: post.message, // Sin limitación - contenido completo
    created: post.created,
    modified: post.modified,
    parent: post.parent,
    hasAttachments: post.hasAttachments,
    wordCount: post.wordCount,
    isTeacherPost: post.isTeacherPost,
    level: post.level,
    childrenCount: post.children.length
  }))
  
  // Generar estadísticas con distinción de roles
  const allProcessedPosts = Array.from(postsMap.values())
  const stats = {
    totalPosts: rawPosts.length,
    rootPosts: rootPosts.length,
    maxDepth: Math.max(...allProcessedPosts.map(p => p.level), 0),
    teacherPosts: allProcessedPosts.filter(p => p.isTeacherPost).length,
    studentPosts: allProcessedPosts.filter(p => !p.isTeacherPost).length,
    totalParticipants: new Set(rawPosts.map(p => p.author?.id || p.userid || p.userId)).size,
    totalWords: allProcessedPosts.reduce((sum, p) => sum + p.wordCount, 0),
    postsWithAttachments: allProcessedPosts.filter(p => p.hasAttachments).length,
    averageWordCount: Math.round(allProcessedPosts.reduce((sum, p) => sum + p.wordCount, 0) / rawPosts.length)
  }
  
  return {
    optimizedPosts: optimizedPosts,
    hierarchy: generateContentSummary(rootPosts),
    contentSummary: {
      stats: stats,
      participantCount: new Set(rawPosts.map(p => p.author?.id || p.userid)).size,
      conversationFlow: `${stats.rootPosts} tema(s) principal(es) → ${stats.totalPosts - stats.rootPosts} respuesta(s) → máx. ${stats.maxDepth} niveles de profundidad`
    }
  }
}

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

    // Usar el token y ID del profesor de la sesión actual (ya verificada arriba)
    const professorToken = session.user.moodleToken
    let professorUserId = session.user.moodleUserId || session.user.id
    
    // Si no tenemos el ID del usuario, obtenerlo desde Moodle
    if (!professorUserId || professorUserId === 'undefined') {
      const client = new MoodleAPIClient(process.env.MOODLE_URL!, professorToken)
      try {
        const userInfo = await client.callMoodleAPI('core_webservice_get_site_info')
        professorUserId = userInfo.userid
        console.log(`🔍 ID obtenido desde Moodle: ${professorUserId}`)
      } catch (error) {
        console.log(`❌ Error obteniendo ID de usuario: ${error}`)
        professorUserId = null
      }
    }
    
    console.log('🔑 Usando token del profesor logueado para acceso completo')
    console.log(`👨‍🏫 Profesor: ${session.user.name} (ID: ${professorUserId})`)
    
    // Determinar URL base del aula desde la sesión o usar fallback
    let aulaBaseUrl = process.env.MOODLE_URL || 'https://av141.utel.edu.mx'
    
    if (session.user.moodleUrl) {
      // Extraer URL base de la API URL (ej: https://aula101.utel.edu.mx/webservice/rest/server.php -> https://aula101.utel.edu.mx)
      const urlParts = session.user.moodleUrl.match(/^(https:\/\/[^\/]+)/)
      if (urlParts && urlParts[1]) {
        aulaBaseUrl = urlParts[1]
        console.log(`🏫 URL del aula detectada desde sesión: ${aulaBaseUrl}`)
      }
    }
    
    const client = new MoodleAPIClient(session.user.moodleUrl || process.env.MOODLE_API_URL!, professorToken)

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
          
          // NUEVO FILTRO: Verificar tanto timeclose como cutoffdate para determinar validez
          let hasValidCloseDate = (forum.timeclose && forum.timeclose > 0) || (forum.cutoffdate && forum.cutoffdate > 0)
          let closeDate = forum.timeclose && forum.timeclose > 0 ? forum.timeclose : forum.cutoffdate
          
          if (!hasValidCloseDate) {
            console.log(`⚠️ FORO SIN FECHA DE CIERRE: "${forum.name}" - Verificaremos si tiene discusiones activas`)
            // No saltar inmediatamente - verificaremos discusiones más adelante
          } else {
            console.log(`✅ FORO CON FECHA DE CIERRE: "${forum.name}" - ${forum.timeclose ? 'timeclose' : 'cutoffdate'}: ${new Date(closeDate * 1000).toLocaleDateString()}`)
          }
          
          // Verificar fecha de apertura
          if (forum.timeopen && forum.timeopen > 0 && forum.timeopen > now) {
            isOpen = false
            status = 'not_started'
            console.log(`⏰ FORO FUTURO: "${forum.name}" - Aún no ha iniciado`)
            continue // Saltar foros que no han iniciado
          }
          
          // Verificar fecha de cierre solo si tiene fecha de cierre
          if (hasValidCloseDate && closeDate < now) {
            isOpen = false
            status = 'closed'
            console.log(`🔒 FORO CERRADO: "${forum.name}" - Ya cerró el ${new Date(closeDate * 1000).toLocaleDateString()}`)
            continue // Saltar foros que ya cerraron
          }
          
          // Procesar si está vigente o si no tiene fecha de cierre (dependerá de tener discusiones)
          if (isOpen) {
            if (hasValidCloseDate) {
              console.log(`✅ FORO VIGENTE CON FECHA: "${forum.name}" - Cierra el ${new Date(closeDate * 1000).toLocaleDateString()}`)
            } else {
              console.log(`✅ FORO SIN FECHA DE CIERRE: "${forum.name}" - Verificando discusiones...`)
            }
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
                  console.log(`   📌 "${d.name}" (autor ID: ${d.userid}, respuestas: ${d.numreplies})`)
                })
                
                // CRITERIO ÚNICO: Solo verificar enrolamiento del profesor al grupo
                // Se muestran todas las actividades/discusiones del grupo sin filtrado adicional
                
                forumDiscussions = filteredDiscussions
                
                // Obtener posts de cada discusión FILTRADA y agregar respuestas anidadas
                console.log(`🔍 Obteniendo posts para ${filteredDiscussions.length} discusiones filtradas`)
                
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
                    
                    // Para foros con fecha de cierre, incluir incluso discusiones sin respuestas
                    // Para foros sin fecha de cierre, requerir al menos 1 respuesta para mostrar actividad
                    if (discussion.numreplies === 0 && !hasValidCloseDate) {
                      console.log(`⏭️ SALTANDO: "${discussion.name}" (sin respuestas y sin fecha de cierre)`)
                      skipDiscussion = true
                    } else if (discussion.numreplies === 0 && hasValidCloseDate) {
                      console.log(`✅ INCLUYENDO: "${discussion.name}" (sin respuestas pero con fecha de cierre válida)`)
                    }
                    
                    if (skipDiscussion) {
                      continue // Saltar esta iteración
                    }
                    
                    // Usar API corregida de posts para obtener respuestas reales
                    // IMPORTANTE: Usar el campo 'discussion' que es el ID real de la discusión en Moodle
                    const realDiscussionId = discussion.discussion || discussionIdToUse
                    console.log(`📥 Obteniendo posts para discusión ${realDiscussionId} ("${discussion.name}") - Post ID: ${discussionIdToUse}`)
                    const posts = await client.callMoodleAPI('mod_forum_get_discussion_posts', {
                      discussionid: realDiscussionId
                    })
                    console.log(`📝 Posts discusión ${realDiscussionId} (${posts.posts?.length || 0} posts):`, JSON.stringify(posts, null, 2))
                    
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
                      
                      // NUEVO: Procesar posts con estructura jerárquica y optimización de contenido
                      const processedPosts = processForumPostsHierarchy(posts.posts, professorUserId)
                      discussion.posts = processedPosts.optimizedPosts
                      discussion.hierarchy = processedPosts.hierarchy
                      discussion.contentSummary = processedPosts.contentSummary
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
            
            // FILTRADO ADICIONAL: Incluir foros con fecha de cierre o con actividad
            const hasUsefulContent = groupId === '0' || 
              hasValidCloseDate || // Incluir si tiene fecha de cierre válida
              (forumDiscussions.length > 0 && totalPosts > 0) // O si tiene discusiones con actividad
            
            if (!hasUsefulContent) {
              console.log(`⚠️ FORO EXCLUIDO: "${forum.name}" no tiene fecha de cierre ni actividad en el grupo ${groupId}`)
              continue // No agregar este foro a las actividades
            }
            
            console.log(`✅ FORO INCLUIDO: "${forum.name}" tiene ${forumDiscussions.length} discusiones con ${totalPosts} posts`)
            
            // NUEVO: Crear una actividad por cada discusión del grupo donde el profesor está enrolado
            if (forumDiscussions.length > 0) {
              // Agregar cada discusión como una actividad separada
              for (const discussion of forumDiscussions) {
                // Verificar que la discusión pertenezca al grupo correcto (ya filtrado anteriormente)
                // Solo incluir discusiones con actividad o si el foro tiene fecha de cierre
                if (discussion.numreplies > 0 || hasValidCloseDate) {
                  // Usar los posts ya procesados de la discusión
                  const discussionPosts = discussion.posts || []
                  const discussionParticipants = new Set(discussionPosts.map((p: any) => p.userId))
                  
                  console.log(`📋 Agregando discusión del grupo ${groupId}: "${discussion.name}" (${discussion.numreplies} respuestas, ${discussionPosts.length} posts)`)
                  
                  // Debug: Verificar qué posts se están incluyendo y clasificación
                  if (discussionPosts.length > 0) {
                    console.log(`   📝 Posts incluidos: ${discussionPosts.length} posts totales`)
                    discussionPosts.forEach((post: any, index: number) => {
                      const icon = post.isTeacherPost ? '👨‍🏫' : '👤'
                      console.log(`      ${index + 1}. ${icon} ${post.userFullName} (ID: ${post.userId}): "${post.subject}" (${post.wordCount} palabras)`)
                    })
                    
                    const teacherPosts = discussionPosts.filter((p: any) => p.isTeacherPost).length
                    const studentPosts = discussionPosts.filter((p: any) => !p.isTeacherPost).length
                    const uniqueParticipants = new Set(discussionPosts.map((p: any) => p.userId)).size
                    console.log(`   📊 Clasificación: ${teacherPosts} posts profesor, ${studentPosts} posts estudiantes`)
                    console.log(`   👥 Total de participantes únicos: ${uniqueParticipants}`)
                    console.log(`   🆔 Profesor ID: ${professorUserId}`)
                  } else {
                    console.log(`   ⚠️ No hay posts en discussion.posts`)
                  }
                  
                  // URL específica de la discusión
                  const discussionUrl = `${aulaBaseUrl}/mod/forum/discuss.php?d=${discussion.discussion || discussion.id}`
                  
                  activities.push({
                    id: discussion.id, // Usar el ID de la discusión
                    discussionId: discussion.discussion || discussion.id, // ID real de la discusión en Moodle
                    name: discussion.name, // Nombre de la discusión
                    type: 'forum',
                    forumId: forum.id, // Referencia al foro padre
                    forumName: forum.name, // Nombre del foro contenedor
                    intro: forum.intro ? forum.intro.replace(/<[^>]*>/g, '').trim() : '',
                    originalForumName: forum.name, // Guardar nombre original del foro
                    timeopen: forum.timeopen,
                    timeclose: forum.timeclose || forum.cutoffdate, // Usar timeclose o cutoffdate
                    cutoffdate: forum.cutoffdate, // Incluir cutoffdate específicamente
                    duedate: forum.duedate,
                    status: status,
                    url: discussionUrl, // URL específica de la discusión
                    courseid: forum.course,
                    groupId: groupId, // Grupo para el que se filtró
                    authorUserId: discussion.userid || parseInt(session.user.id), // ID del autor de la discusión
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
                      // Estadísticas específicas de esta discusión
                      totalPosts: discussionPosts.length,
                      uniqueParticipants: discussionParticipants.size,
                      avgPostsPerParticipant: discussionParticipants.size > 0 ? (discussionPosts.length / discussionParticipants.size).toFixed(2) : 0,
                      allPosts: discussionPosts, // Posts específicos de esta discusión
                      discussions: [{
                        id: discussion.id,
                        name: discussion.name,
                        groupid: discussion.groupid, // ID del grupo de la discusión
                        timemodified: discussion.timemodified,
                        usermodified: discussion.usermodified,
                        timestart: discussion.timestart,
                        timeend: discussion.timeend,
                        discussion: discussion.discussion,
                        parent: discussion.parent,
                        userid: discussion.userid,
                        created: discussion.created,
                        modified: discussion.modified,
                        mailed: discussion.mailed,
                        subject: discussion.subject,
                        message: discussion.message ? discussion.message.replace(/<[^>]*>/g, '').trim().substring(0, 200) : '',
                        numreplies: discussion.numreplies || 0,
                        numunread: discussion.numunread || 0,
                        posts: discussion.posts || [], // Posts anidados con detalles
                        avgWordsPerPost: discussion.posts ? discussion.posts.reduce((sum: number, p: any) => sum + (p.wordCount || 0), 0) / discussion.posts.length : 0,
                        studentsParticipating: discussion.posts ? Array.from(new Set(discussion.posts.filter((p: any) => p.userId !== professorUserId).map((p: any) => p.userId))).length : 0
                      }]
                    }
                  })
                }
              }
            } else {
              // Si no hay discusiones pero el foro tiene fecha de cierre, agregarlo como placeholder
              if (hasValidCloseDate) {
                console.log(`📋 Agregando foro sin discusiones pero con fecha de cierre: "${forum.name}"`)
                activities.push({
                  id: forum.id,
                  name: forum.name,
                  type: 'forum',
                  intro: forum.intro ? forum.intro.replace(/<[^>]*>/g, '').trim() : '',
                  originalForumName: forum.name,
                  timeopen: forum.timeopen,
                  timeclose: forum.timeclose || forum.cutoffdate,
                  cutoffdate: forum.cutoffdate,
                  duedate: forum.duedate,
                  status: status,
                  url: `${aulaBaseUrl}/mod/forum/view.php?id=${forum.cmid}`,
                  courseid: forum.course,
                  groupId: groupId,
                  authorUserId: parseInt(session.user.id),
                  forumDetails: {
                    type: forum.type || 'general',
                    totalPosts: 0,
                    uniqueParticipants: 0,
                    discussions: []
                  }
                })
              }
            }
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
          
          // NUEVO FILTRO: Solo incluir asignaciones con fecha de entrega o corte definida
          const hasDeadline = (assignment.duedate && assignment.duedate > 0) || (assignment.cutoffdate && assignment.cutoffdate > 0)
          if (!hasDeadline) {
            console.log(`⏭️ TAREA SIN FECHA: "${assignment.name}" - Sin fecha de entrega definida`)
            continue // Saltar asignaciones sin fecha
          }
          
          // Verificar si ya se puede enviar
          if (assignment.allowsubmissionsfromdate && assignment.allowsubmissionsfromdate > now) {
            isOpen = false
            status = 'not_started'
            console.log(`⏰ TAREA FUTURA: "${assignment.name}" - Aún no se puede enviar`)
            continue // Saltar asignaciones que no han iniciado
          }
          
          // Verificar fecha de corte final
          if (assignment.cutoffdate && assignment.cutoffdate > 0 && assignment.cutoffdate < now) {
            isOpen = false
            status = 'closed'
            console.log(`🔒 TAREA CERRADA: "${assignment.name}" - Cerró el ${new Date(assignment.cutoffdate * 1000).toLocaleDateString()}`)
            continue // Saltar asignaciones cerradas
          }
          
          // Verificar si pasó la fecha de entrega (pero aún no el corte)
          if (assignment.duedate && assignment.duedate > 0 && assignment.duedate < now) {
            // Si no hay cutoffdate o aún no ha pasado, está vencida pero vigente
            if (!assignment.cutoffdate || assignment.cutoffdate > now) {
              status = 'overdue' // Vencida pero aún acepta entregas
              console.log(`⚠️ TAREA VENCIDA PERO VIGENTE: "${assignment.name}" - Venció pero aún acepta entregas`)
            } else {
              console.log(`🔒 TAREA CERRADA: "${assignment.name}" - Pasó el periodo de gracia`)
              continue // Ya pasó el cutoff
            }
          }
          
          // Solo procesar si está abierta o vencida pero vigente
          if (isOpen || status === 'overdue') {
            const deadline = assignment.cutoffdate || assignment.duedate
            console.log(`✅ TAREA VIGENTE: "${assignment.name}" - ${status === 'overdue' ? 'Vencida pero acepta entregas hasta' : 'Cierra'} el ${new Date(deadline * 1000).toLocaleDateString()}`)
            // FILTRADO POR GRUPO: Por ahora incluir todas las asignaciones del curso
            // TODO: Verificar si Moodle proporciona información de restricciones por grupo
            // Las asignaciones generalmente están disponibles para todo el curso
            let shouldIncludeAssignment = true
            
            if (groupId !== '0') {
              // Por ahora incluir todas las asignaciones cuando se selecciona un grupo específico
              // Las asignaciones normalmente son a nivel de curso, no de grupo
              console.log(`✅ Asignación "${assignment.name}" incluida para curso ${courseId}, grupo ${groupId}`)
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
              url: moduleUrlMap[urlKey] || `${aulaBaseUrl}/mod/assign/view.php?id=${assignment.cmid}`,
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

    // === 3. OTRAS ACTIVIDADES (QUIZ, CHOICE, ETC) ===
    // NOTA: Por ahora excluimos estas actividades ya que no tienen fechas de cierre definidas
    // y el usuario solicitó solo actividades vigentes con fechas
    console.log('🚫 Omitiendo otras actividades (quiz, choice, etc.) - No tienen fechas de cierre definidas')
    
    // Si en el futuro necesitamos incluir estas actividades, descomentar el código siguiente:
    /*
    try {
      console.log('🎯 Agregando otras actividades...')
      Object.entries(moduleUrlMap).forEach(([key, url]) => {
        const [modname, name] = key.split('_', 2)
        
        if (['feedback', 'quiz', 'choice', 'survey', 'lesson'].includes(modname)) {
          // Aquí se podría agregar lógica para obtener fechas de estas actividades
          // Por ahora las excluimos según lo solicitado
        }
      })
    } catch (error) {
      console.error('Error agregando otras actividades:', error)
    }
    */

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