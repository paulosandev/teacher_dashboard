/**
 * Servicio de análisis batch para procesar datos sincronizados
 * Genera análisis de actividades usando IA para todas las aulas
 */

import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { aulaConfigService } from './aula-config-service'
import { MoodleAPIClient } from '../moodle/api-client'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export interface BatchAnalysisResult {
  success: boolean
  processedActivities: number
  generatedAnalyses: number
  errors: string[]
  duration: number
}

export class BatchAnalysisService {
  private static instance: BatchAnalysisService

  static getInstance(): BatchAnalysisService {
    if (!this.instance) {
      this.instance = new BatchAnalysisService()
    }
    return this.instance
  }

  /**
   * Procesar análisis de todas las actividades que necesitan análisis CON PAGINACIÓN
   */
  async processAllPendingAnalyses(): Promise<BatchAnalysisResult> {
    const startTime = Date.now()
    console.log('🧠 Iniciando análisis batch paginado de actividades pendientes')

    const result: BatchAnalysisResult = {
      success: true,
      processedActivities: 0,
      generatedAnalyses: 0,
      errors: [],
      duration: 0
    }

    try {
      // PAGINACIÓN: Procesar en chunks para evitar "Out of sort memory"
      const PAGE_SIZE = 50 // Procesar máximo 50 actividades por página
      let currentPage = 0
      let hasMoreActivities = true

      while (hasMoreActivities) {
        console.log(`📄 Procesando página ${currentPage + 1} (hasta ${PAGE_SIZE} actividades)`)

        // Obtener página actual de actividades pendientes Y ACTIVAS
        const now = new Date()
        console.log(`📅 Filtrando actividades activas (fecha actual: ${now.toISOString()})`)
        const pendingActivities = await prisma.courseActivity.findMany({
          where: {
            needsAnalysis: true,
            visible: true,
            // Filtros de actividades activas:
            // 1. Actividad debe haber comenzado (openDate <= now OR openDate is null)
            OR: [
              { openDate: null },
              { openDate: { lte: now } }
            ],
            // 2. Actividad no debe haber terminado (closeDate > now OR closeDate is null)
            AND: [
              {
                OR: [
                  { closeDate: null },
                  { closeDate: { gt: now } }
                ]
              }
            ]
          },
          include: {
            course: true,
            aula: true
          },
          orderBy: [
            { dueDate: 'asc' },
            { lastDataSync: 'desc' }
          ],
          take: PAGE_SIZE,
          skip: currentPage * PAGE_SIZE
        })

        if (pendingActivities.length === 0) {
          hasMoreActivities = false
          break
        }

        console.log(`📋 Página ${currentPage + 1}: Encontradas ${pendingActivities.length} actividades pendientes`)

        // Procesar en lotes pequeños dentro de la página
        const BATCH_SIZE = 5
        for (let i = 0; i < pendingActivities.length; i += BATCH_SIZE) {
          const batch = pendingActivities.slice(i, i + BATCH_SIZE)

          console.log(`🔄 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendingActivities.length / BATCH_SIZE)} de página ${currentPage + 1} (${batch.length} actividades)`)

          // Procesar actividades en paralelo dentro del lote
          const batchPromises = batch.map(activity =>
            this.analyzeActivity(activity).catch(error => {
              const errorMsg = `Error analizando ${activity.type} ${activity.activityId} del curso ${activity.courseId}: ${error}`
              console.error('❌', errorMsg)
              result.errors.push(errorMsg)
              return null
            })
          )

          const batchResults = await Promise.allSettled(batchPromises)

          batchResults.forEach((promiseResult, index) => {
            result.processedActivities++
            if (promiseResult.status === 'fulfilled' && promiseResult.value) {
              result.generatedAnalyses++
            }
          })

          // Pequeña pausa entre lotes para no saturar la API de OpenAI y MySQL
          if (i + BATCH_SIZE < pendingActivities.length) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        // Si obtuvimos menos actividades que el PAGE_SIZE, ya no hay más páginas
        if (pendingActivities.length < PAGE_SIZE) {
          hasMoreActivities = false
        } else {
          currentPage++
          // Pausa entre páginas para liberar memoria y conexiones MySQL
          console.log(`⏸️ Pausa entre páginas para optimización de memoria...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }

    } catch (error) {
      console.error('❌ Error en procesamiento batch paginado:', error)
      result.errors.push(`Error general: ${error}`)
      result.success = false
    }

    result.duration = Date.now() - startTime
    console.log(`✅ Análisis batch paginado completado en ${result.duration}ms: ${result.generatedAnalyses}/${result.processedActivities} análisis generados`)

    return result
  }

  /**
   * Analizar una actividad específica
   */
  private async analyzeActivity(activity: any): Promise<boolean> {
    try {
      console.log(`🧠 Analizando ${activity.type} "${activity.name}" del curso ${activity.course.courseName} (Aula ${activity.aulaId})`)

      // Para todos los tipos de actividad, usar el flujo estándar
      const analysisData = await this.prepareAnalysisData(activity)
      const analysisResult = await this.generateAnalysisWithAI(activity, analysisData)
      
      if (!analysisResult) {
        throw new Error('No se pudo generar análisis con IA')
      }

      const processedAnalysis = this.processAnalysisResponse(analysisResult)
      await this.saveAnalysisResult(activity, processedAnalysis, analysisData)

      // Marcar actividad como analizada
      await prisma.courseActivity.update({
        where: {
          aulaId_courseId_activityId_type: {
            aulaId: activity.aulaId,
            courseId: activity.courseId,
            activityId: activity.activityId,
            type: activity.type
          }
        },
        data: {
          needsAnalysis: false,
          analysisCount: { increment: 1 }
        }
      })

      console.log(`✅ Análisis completado para ${activity.type} "${activity.name}"`)
      return true

    } catch (error) {
      console.error(`❌ Error analizando actividad ${activity.activityId}:`, error)
      throw error
    }
  }

  /**
   * Preparar datos para el análisis de IA (VERSIÓN MEJORADA CON CONTENIDO PROFUNDO)
   */
  private async prepareAnalysisData(activity: any) {
    // Generar URL correcta según el tipo de actividad
    const activityUrl = this.generateCorrectActivityUrl(activity)
    
    const analysisData: any = {
      activityInfo: {
        id: activity.activityId,
        name: activity.name,
        type: activity.type,
        description: activity.description,
        dueDate: activity.dueDate,
        url: activityUrl, // URL correcta de la actividad
        course: {
          id: activity.courseId,
          name: activity.course.courseName,
          shortName: activity.course.shortName
        },
        aula: {
          id: activity.aulaId,
          name: activity.aula.name,
          baseUrl: activity.aula.baseUrl // Base URL del aula
        }
      },
      rawData: activity.rawData,
      dataTimestamp: activity.lastDataSync
    }

    // MEJORA: Obtener contenido completo y profundo según el tipo de actividad
    if (activity.type === 'assign' && activity.assignmentData) {
      // Para tareas: incluir TODAS las entregas, retroalimentaciones completas y conversaciones
      analysisData.assignmentDetails = await this.enrichAssignmentData(activity.assignmentData, activity)
    } else if (activity.type === 'forum' && activity.forumData) {
      // Para foros: incluir TODAS las conversaciones, hilos completos y respuestas anidadas
      analysisData.forumDetails = await this.enrichForumData(activity.forumData, activity)
    }

    return analysisData
  }

  /**
   * NUEVO: Enriquecer datos de asignación con contenido profundo
   */
  private async enrichAssignmentData(assignmentData: any, activity: any) {
    try {
      console.log(`🔍 Enriqueciendo datos de tarea "${activity.name}" con contenido profundo...`)
      
      // Si ya tenemos submissions, enriquecerlas con más detalle
      if (assignmentData.submissions && Array.isArray(assignmentData.submissions)) {
        const enrichedSubmissions = assignmentData.submissions.map((submission: any) => {
          return {
            // Datos básicos del estudiante
            userId: submission.userId || submission.userid,
            userFullName: submission.userFullName || submission.userfullname,
            
            // Estado y timing de la entrega
            submissionStatus: submission.status,
            isLate: submission.late || false,
            submittedAt: submission.timemodified,
            lastAttempt: submission.attempt || 1,
            
            // PROFUNDIZACIÓN: Contenido completo de la entrega
            submissionText: submission.onlinetext || submission.text || 'Sin contenido de texto',
            attachedFiles: submission.files || [],
            submissionComments: submission.submissioncomments || [],
            
            // PROFUNDIZACIÓN: Retroalimentación completa del profesor
            grade: submission.grade,
            gradeText: submission.gradetext || submission.gradername,
            feedback: submission.feedback,
            teacherComment: submission.teachercomment || submission.feedback,
            feedbackComments: submission.feedbackcomments || [],
            
            // PROFUNDIZACIÓN: Historial de intentos y conversaciones
            previousAttempts: submission.previousattempts || [],
            gradehistory: submission.gradehistory || [],
            
            // PROFUNDIZACIÓN: Interacciones adicionales (mensajes, comentarios)
            assignfeedback: submission.assignfeedback || null,
            plugins: submission.plugins || []
          }
        })

        return {
          ...assignmentData,
          submissions: enrichedSubmissions,
          
          // NUEVO: Estadísticas enriquecidas para análisis
          enrichedStats: {
            totalSubmissions: enrichedSubmissions.length,
            submissionsWithDetailedFeedback: enrichedSubmissions.filter(s => s.teacherComment && s.teacherComment.length > 50).length,
            submissionsWithFiles: enrichedSubmissions.filter(s => s.attachedFiles && s.attachedFiles.length > 0).length,
            lateSubmissions: enrichedSubmissions.filter(s => s.isLate).length,
            gradedSubmissions: enrichedSubmissions.filter(s => s.grade !== null && s.grade !== undefined).length,
            averageGrade: enrichedSubmissions.reduce((sum, s) => sum + (parseFloat(s.grade) || 0), 0) / enrichedSubmissions.length,
            submissionsWithConversations: enrichedSubmissions.filter(s => 
              (s.submissionComments && s.submissionComments.length > 0) || 
              (s.feedbackComments && s.feedbackComments.length > 0)
            ).length
          }
        }
      }

      return assignmentData
      
    } catch (error) {
      console.error('❌ Error enriqueciendo datos de tarea:', error)
      return assignmentData // Fallback a datos originales
    }
  }

  /**
   * NUEVO: Enriquecer datos de foro con contenido profundo  
   */
  private async enrichForumData(forumData: any, activity: any) {
    try {
      console.log(`🔍 Enriqueciendo datos de foro "${activity.name}" con conversaciones completas...`)
      
      console.log(`🔍 Enriqueciendo foro "${activity.name}" con discusiones completas`)
      console.log(`📊 Discusiones existentes en forumData: ${forumData.discussions ? forumData.discussions.length : 'NINGUNA'}`)

      // NUEVO: Si no hay discussions en forumData, obtenerlas directamente
      const aulaConfig = aulaConfigService.getAulaConfig(activity.aulaId)
      if (!aulaConfig) {
        console.log(`❌ No se encontró configuración para aula ${activity.aulaId}`)
        return forumData
      }

      let discussionsToProcess = forumData.discussions || []

      // Si no hay discusiones almacenadas, obtenerlas directamente de Moodle
      if (discussionsToProcess.length === 0) {
        console.log(`🔧 No hay discusiones almacenadas, obteniendo directamente de Moodle para foro ${activity.activityId}`)

        const discussionsUrl = `${aulaConfig.apiUrl}?wstoken=${aulaConfig.token}&wsfunction=mod_forum_get_forum_discussions&moodlewsrestformat=json&forumid=${activity.activityId}`

        try {
          const discussionsResponse = await fetch(discussionsUrl)
          if (discussionsResponse.ok) {
            const discussionsData = await discussionsResponse.json()
            discussionsToProcess = discussionsData.discussions || []
            console.log(`💬 Obtenidas ${discussionsToProcess.length} discusiones directamente de Moodle`)
          } else {
            console.error(`❌ Error HTTP ${discussionsResponse.status} obteniendo discusiones`)
          }
        } catch (error) {
          console.error(`❌ Error obteniendo discusiones:`, error)
        }
      }

      if (discussionsToProcess.length > 0) {
        const enrichedDiscussions = []

        const client = new MoodleAPIClient(aulaConfig.apiUrl, aulaConfig.token)

        for (const discussion of discussionsToProcess) {
          console.log(`🔍 Obteniendo posts completos para discusión ${discussion.discussion || discussion.id}`)

          // CRÍTICO: Obtener TODOS los posts de esta discusión directamente con fetch
          const discussionId = discussion.discussion || discussion.id
          const postsUrl = `${aulaConfig.apiUrl}?wstoken=${aulaConfig.token}&wsfunction=mod_forum_get_discussion_posts&moodlewsrestformat=json&discussionid=${discussionId}`

          console.log(`🔍 Obteniendo posts para discusión ${discussionId} directamente de ${postsUrl.replace(aulaConfig.token, 'TOKEN_HIDDEN')}`)

          const postsResponse = await fetch(postsUrl)
          let discussionPosts = []

          if (postsResponse.ok) {
            const postsData = await postsResponse.json()
            discussionPosts = postsData.posts || []
            console.log(`💬 Encontrados ${discussionPosts.length} posts en discusión ${discussion.name}`)
          } else {
            console.error(`❌ Error HTTP ${postsResponse.status} obteniendo posts`)
          }

          const enrichedDiscussion = {
            // Datos básicos de la discusión
            id: discussion.discussion || discussion.id,
            name: discussion.name || discussion.subject,
            message: discussion.message,
            userFullName: discussion.userfullname || discussion.userFullName,
            userId: discussion.userid || discussion.userId,
            created: discussion.created || discussion.timemodified,
            groupId: discussion.groupid || 0,

            // PROFUNDIZACIÓN: Posts completos con hilos anidados
            posts: discussionPosts.map((post: any) => ({
              id: post.id,
              discussion: post.discussion,
              parent: post.parent, // Para hilos anidados
              userId: post.userid,
              userFullName: post.userfullname,
              created: post.created,
              modified: post.modified,
              
              // CONTENIDO COMPLETO del post
              subject: post.subject,
              message: post.message, // Mensaje completo, no truncado
              messageformat: post.messageformat,
              messagetrust: post.messagetrust,
              
              // PROFUNDIZACIÓN: Attachments y multimedia
              attachments: post.attachments || [],
              
              // PROFUNDIZACIÓN: Metadata del post  
              mailed: post.mailed,
              totalscore: post.totalscore,
              mailnow: post.mailnow,
              
              // NUEVO: Análisis de longitud y calidad del post
              messageLength: (post.message || '').length,
              hasAttachments: (post.attachments || []).length > 0,
              isReply: post.parent && post.parent !== '0'
            })),
            
            // NUEVO: Estadísticas de la discusión basadas en posts reales
            discussionStats: {
              totalPosts: discussionPosts.length,
              uniqueParticipants: new Set(discussionPosts.map(p => p.userid)).size,
              averagePostLength: discussionPosts.reduce((sum, p) => sum + (p.message || '').length, 0) / Math.max(discussionPosts.length, 1),
              postsWithAttachments: discussionPosts.filter(p => p.attachments && p.attachments.length > 0).length,
              threadDepth: this.calculateThreadDepth(discussionPosts)
            }
          }

          enrichedDiscussions.push(enrichedDiscussion)
        }

        return {
          ...forumData,
          discussions: enrichedDiscussions,
          
          // NUEVO: Estadísticas globales del foro para análisis
          enrichedStats: {
            totalDiscussions: enrichedDiscussions.length,
            totalPosts: enrichedDiscussions.reduce((sum, d) => sum + (d.posts || []).length, 0),
            totalUniqueParticipants: new Set(
              enrichedDiscussions.flatMap(d => (d.posts || []).map(p => p.userId))
            ).size,
            averagePostsPerDiscussion: enrichedDiscussions.reduce((sum, d) => sum + (d.posts || []).length, 0) / Math.max(enrichedDiscussions.length, 1),
            discussionsWithMultipleParticipants: enrichedDiscussions.filter(d => d.discussionStats.uniqueParticipants > 1).length,
            totalAttachments: enrichedDiscussions.reduce((sum, d) => sum + d.discussionStats.postsWithAttachments, 0)
          }
        }
      } else {
        console.log(`📊 No se encontraron discusiones para el foro "${activity.name}" (ID: ${activity.activityId})`)
      }

      return forumData
      
    } catch (error) {
      console.error('❌ Error enriqueciendo datos de foro:', error)
      return forumData // Fallback a datos originales
    }
  }

  /**
   * NUEVO: Calcular profundidad de hilo de discusión
   */
  private calculateThreadDepth(posts: any[]): number {
    if (!posts || posts.length === 0) return 0
    
    const postMap = new Map()
    posts.forEach(post => postMap.set(post.id, post))
    
    let maxDepth = 0
    
    posts.forEach(post => {
      let depth = 0
      let currentPost = post
      
      // Seguir la cadena de padres hasta el root
      while (currentPost.parent && currentPost.parent !== '0' && postMap.has(currentPost.parent)) {
        depth++
        currentPost = postMap.get(currentPost.parent)
        if (depth > 50) break // Protección contra loops infinitos
      }
      
      maxDepth = Math.max(maxDepth, depth)
    })
    
    return maxDepth
  }

  /**
   * Generar análisis usando IA
   */
  private async generateAnalysisWithAI(activity: any, analysisData: any): Promise<string | null> {
    try {
      // Usar prompt unificado específico por tipo de actividad
      const unifiedPrompt = this.buildUnifiedPrompt(activity, analysisData)

      // Sanitizar contenido para evitar errores de Unicode
      const sanitizedPrompt = this.sanitizeUnicodeForJSON(unifiedPrompt)

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: sanitizedPrompt
          }
        ],
        max_completion_tokens: 32768  // Ajustado para gpt-5-mini
      })

      return completion.choices[0]?.message?.content || null

    } catch (error) {
      console.error('❌ Error generando análisis con IA:', error)
      throw error
    }
  }

  /**
   * Construir prompt unificado específico por tipo de actividad
   */
  private buildUnifiedPrompt(activity: any, analysisData: any): string {
    // Reducir los datos de análisis si son muy grandes
    const optimizedAnalysisData = this.optimizeDataForTokens(analysisData, activity.type)
    
    const baseInfo = `
Información de la actividad:
- Nombre: ${activity.name}
- Tipo: ${this.getActivityTypeLabel(activity.type)}
- Curso: Curso ID ${activity.courseId} (Aula ${activity.aulaId})
- Fecha límite: ${activity.dueDate ? new Date(activity.dueDate).toLocaleDateString('es-ES') : 'Sin fecha límite'}
- Descripción: ${activity.description ? this.truncateText(activity.description, 1500) : 'Sin descripción disponible'}

Datos de la actividad para análisis:
${JSON.stringify(optimizedAnalysisData, null, 2)}

---
`

    // Seleccionar instrucciones específicas según tipo de actividad
    const specificInstructions = this.getInstructionsByActivityType(activity.type)
    
    return baseInfo + specificInstructions
  }

  /**
   * Optimizar datos para evitar exceder límites de tokens - VERSIÓN COMPLETA SIN TRUNCAMIENTO
   */
  private optimizeDataForTokens(analysisData: any, activityType: string): any {
    const optimized = { ...analysisData }

    // Verificar tamaño total
    const totalSize = JSON.stringify(optimized).length
    const MAX_SIZE = 500000 // Límite para gpt-5-mini contexto total (500KB)

    // Aplicar optimización agresiva para o1-mini
    if (totalSize > MAX_SIZE) {
      console.warn(`⚠️ Datos muy grandes (${totalSize} bytes). Aplicando optimización agresiva para gpt-5-mini.`)

      // Remover rawData inmediatamente
      if (optimized.rawData) {
        optimized.rawData = {
          note: 'Datos raw omitidos para gpt-5-mini',
          originalSize: JSON.stringify(optimized.rawData).length
        }
      }

      // Para foros: optimización inteligente manteniendo contenido relevante
      if (activityType === 'forum' && optimized.forumDetails?.discussions) {
        optimized.forumDetails.discussions = optimized.forumDetails.discussions.map((discussion: any) => {
          if (discussion.posts && discussion.posts.length > 50) {
            // MEJORA: Mantener más posts para análisis educativo completo
            console.log(`📊 Foro con ${discussion.posts.length} posts - manteniendo los primeros 50 para análisis completo`)
            discussion.posts = discussion.posts.slice(0, 50)
          }
          // MEJORA: Truncar solo posts extremadamente largos (5000 chars)
          if (discussion.posts) {
            discussion.posts = discussion.posts.map((post: any) => ({
              ...post,
              message: post.message ? (
                post.message.length > 5000
                  ? post.message.substring(0, 5000) + '...[contenido truncado para análisis]'
                  : post.message
              ) : post.message
            }))
          }
          return discussion
        })
      }

      // Para assignments: limitar submissions
      if (activityType === 'assign' && optimized.assignmentDetails?.submissions?.length > 10) {
        optimized.assignmentDetails.submissions = optimized.assignmentDetails.submissions.slice(0, 10)
      }
    }

    // POLÍTICA INTELIGENTE: Optimizar solo si excede límites de GPT-4o
    const dataSize = JSON.stringify(analysisData).length
    console.log(`📊 Enviando datos para análisis detallado: ${dataSize} chars (${activityType})`)

    if (dataSize > MAX_SIZE) {
      console.log(`⚙️ Aplicando optimización inteligente (${dataSize} > ${MAX_SIZE})`)
      return optimized
    }

    return analysisData // Datos originales si están dentro del límite
  }

  /**
   * Obtener instrucciones específicas según tipo de actividad (MEJORADAS PARA CONTENIDO PROFUNDO)
   */
  private getInstructionsByActivityType(activityType: string): string {
    switch (activityType.toLowerCase()) {
      case 'forum':
        return `Eres el asistente pedagógico del profesor en la Universidad UTEL. Tu misión es generar un análisis orientado a la próxima openclass que sea práctico y accionable.

ESTILO CONVERSACIONAL:
- Redacta con un tono cercano y orientado al profesor, como si fueras su asistente pedagógico
- No uses jerga técnica ni frases impersonales
- Evita mencionar detalles técnicos de la plataforma (HTML, campos de API, IDs de sistema, "uniqueParticipants", "por API", "artefactos")
- Concéntrate únicamente en el contenido de las participaciones y lo que revelan del aprendizaje
- Usa datos cuantitativos solo cuando sean necesarios para resaltar patrones (ej: "la mitad de los posts están en la primera discusión"), no para dar cifras técnicas o promedios exactos

ESTRUCTURA FIJA (exactamente en este orden):

#### Nivel de participación
Analiza patrones de participación que afecten el aprendizaje: distribución de estudiantes activos, equilibrio temporal, estudiantes ausentes. Enfócate en PATRONES pedagógicos, no números exactos.

#### Calidad académica de las aportaciones
Evalúa profundidad intelectual: comprensión conceptual demostrada, vocabulario especializado apropiado, desarrollo argumentativo, claridad de escritura. Enfócate en CAPACIDADES cognitivas observadas.

#### Cumplimiento de la consigna
Verifica adherencia a instrucciones: respuesta a preguntas específicas, formato solicitado, límites de extensión, puntualidad. Enfócate en HÁBITOS de trabajo académico.

#### Uso de referencias y fundamentación teórica
Examina rigor académico: presencia de citas reales, calidad del formato APA, conexión teoría-práctica, tipo de fuentes. Enfócate en COMPETENCIAS de investigación.

#### Dinámica de interacción entre compañeros
Analiza colaboración: calidad del feedback entre pares, construcción colaborativa de conocimiento, tono y respeto, densidad de intercambios. Enfócate en HABILIDADES sociales de aprendizaje.

FORMATO OBLIGATORIO POR DIMENSIÓN:
#### [Nombre exacto]
* 3-4 viñetas máximo con hallazgos breves y claros
* Resalta con **negritas** solo elementos pedagógicamente clave
* Cada dimensión debe cerrar con una línea que comience con '**Acción sugerida:**' y una recomendación breve, concreta y accionable

REQUISITOS CRÍTICOS:
- NO repitas información entre dimensiones
- NO sobrecargues con cifras innecesarias
- SÍ analiza contenido real de participaciones
- SÍ identifica conceptos educativos específicos mencionados
- SÍ detecta patrones de aprendizaje observables

Inicia directamente con la primera dimensión, sin introducciones.`

      case 'assign':
      case 'assignment':
        return `Eres un asistente del profesor en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las actividades de tareas y entregas. El propósito es que, aunque el profesor no participa directamente en cada entrega, pueda mantener una visión clara del desempeño y cumplimiento de los estudiantes y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

- Redacta con un estilo conversacional dirigido al profesor de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionales.
- El análisis debe estructurarse en al menos 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
  #### [Nombre de la dimensión]
  * Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
  * Cada hallazgo debe resaltar con negritas los elementos relevantes.
  **Acción sugerida:** redactar una recomendación específica, breve y accionable para el profesor.
- Ordena las dimensiones de mayor a menor impacto.
- El formato de entrega solo es markdown.
- El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
- El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.
- Siempre incluye insights accionables acerca de nivel de entrega y cumplimiento, y si surgen dudas o patrones de incumplimiento.`

      default:
        return `Eres un asistente del docente en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes en las actividades educativas. El propósito es que pueda mantener una visión clara del desempeño y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

Redacta con un estilo conversacional dirigido al docente de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionales.
El análisis debe estructurarse en al menos 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
[Nombre de la dimensión]

Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
Cada hallazgo debe resaltar con negritas los elementos relevantes.
Acción sugerida: redactar una recomendación específica, breve y accionable para el docente.

Ordena las dimensiones de mayor a menor impacto.
El formato de entrega solo es markdown.
El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.

IMPORTANTE: NO menciones nombres de variables, parámetros técnicos, campos de base de datos ni referencias a código. Usa lenguaje natural y enfocado en el contexto educativo. Evita cualquier referencia a estructuras de datos, JSON, arrays o elementos técnicos.`
    }
  }


  /**
   * Truncar texto a una longitud específica
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  /**
   * Extraer insights positivos del análisis
   */
  private extractPositiveInsights(analysisText: string): string[] {
    if (!analysisText) return []

    const insights: string[] = []

    // NUEVO: Buscar patrones en el formato de 5 dimensiones con #### headers
    const sections = analysisText.split(/(?=^####\s)/gm)

    sections.forEach(section => {
      if (!section.trim()) return

      // Extraer puntos positivos de cada sección
      const bulletPoints = section.match(/^\* (.+?)$/gm)
      if (bulletPoints) {
        bulletPoints.forEach(bullet => {
          const content = bullet.replace(/^\* /, '').trim()

          // Buscar contenido positivo (palabras que indican aspectos positivos)
          // Excluir explícitamente contenido negativo
          if (content.toLowerCase().includes('no hay') ||
              content.toLowerCase().includes('no existe') ||
              content.toLowerCase().includes('carece') ||
              content.toLowerCase().includes('falta') ||
              content.toLowerCase().includes('sin ') ||
              content.toLowerCase().includes('baja ') ||
              content.toLowerCase().includes('menor ') ||
              content.toLowerCase().includes('problema')) {
            return // Skip contenido negativo
          }

          const positiveIndicators = [
            /\*\*(.+?)\*\*.*(?:exitoso|efectivo|bueno|positivo|adecuado|apropiado|bien|correcto|satisfactorio|alta|alto|múltiple|varios|diversos)/gi,
            /(?:existe|se observa|se identifica|hay).*\*\*(.+?)\*\*.*(?:positivo|bueno|efectivo|adecuado|activo|participativo)/gi,
            /\*\*(.+?)\*\*.*(?:participan activamente|contribuyen positivamente|aportan valor|colaboran efectivamente|funcionan bien|trabajan correctamente)/gi,
            /(?:múltiples|varios|diversos|abundantes).*\*\*(.+?)\*\*(?!.*(?:no|sin|carece|falta))/gi,
            /\*\*(.+?)\*\*.*(?:cumplen satisfactoriamente|logran exitosamente|alcanzan adecuadamente|superan expectativas)/gi
          ]

          let isPositive = false
          let extractedText = content

          positiveIndicators.forEach(pattern => {
            if (pattern.test(content)) {
              isPositive = true
              const matches = content.match(pattern)
              if (matches && matches[1]) {
                extractedText = matches[1].replace(/\*\*/g, '')
              }
            }
          })

          // Solo incluir si es realmente positivo y no contiene palabras negativas
          if (isPositive && extractedText.length > 10 &&
              !extractedText.toLowerCase().includes('no ') &&
              !extractedText.toLowerCase().includes('sin ') &&
              !extractedText.toLowerCase().includes('baja') &&
              !extractedText.toLowerCase().includes('problema')) {
            insights.push(extractedText.substring(0, 200))
          }
        })
      }
    })

    // FALLBACK: Buscar patrones en formato antiguo si no encontró nada
    if (insights.length === 0) {
      const positivePatterns = [
        /\*\*Hallazgo positivo[^:]*:\*\* (.+?)(?=\.|;|❌|⚠️|$)/gi,
        /- \*\*Hallazgo \d+\*\*: Hay \*\*(.+?)\*\*/gi,
        /- \*\*Hallazgo \d+\*\*: (.+?) \*\*funciona[^\*]*\*\*/gi,
        /✅ (.+?)(?=\n|$)/gi,
        /\*\*Fortaleza:\*\* (.+?)(?=\.|;|\n|$)/gi,
        /\*\*Aspecto positivo:\*\* (.+?)(?=\.|;|\n|$)/gi,
        /son \*\*(.+?)\*\*/gi,
        /está \*\*(.+?)\*\*/gi,
        /\*\*múltiples (.+?)\*\* con contenido académico/gi,
        /\*\*(.+?)\*\* están documentando/gi
      ]

      positivePatterns.forEach(pattern => {
        const matches = analysisText.match(pattern)
        if (matches) {
          matches.forEach(match => {
            let cleaned = match.replace(/^[- ✅]*\*\*[^:]*:\*\*/, '').trim()
            if (cleaned.includes('son **') || cleaned.includes('está **')) {
              cleaned = cleaned.replace(/son \*\*/, '').replace(/está \*\*/, '').replace(/\*\*/g, '')
            }
            if (cleaned && cleaned.length > 10 && !cleaned.includes('❌') && !cleaned.includes('⚠️')) {
              insights.push(cleaned.substring(0, 200))
            }
          })
        }
      })
    }

    return insights.slice(0, 5) // Máximo 5 insights
  }

  /**
   * Extraer alertas/problemas del análisis
   */
  private extractAlerts(analysisText: string): string[] {
    if (!analysisText) return []

    const alerts: string[] = []

    // NUEVO: Buscar patrones en el formato de 5 dimensiones con #### headers
    const sections = analysisText.split(/(?=^####\s)/gm)

    sections.forEach(section => {
      if (!section.trim()) return

      // Extraer puntos de alerta de cada sección
      const bulletPoints = section.match(/^\* (.+?)$/gm)
      if (bulletPoints) {
        bulletPoints.forEach(bullet => {
          const content = bullet.replace(/^\* /, '').trim()

          // Buscar contenido que indica problemas o alertas
          // Solo incluir contenido realmente negativo/problemático
          const alertIndicators = [
            /\*\*(.+?)\*\*.*(?:no hay|no existe|carece|falta|ausencia|problema|deficiente|insuficiente|inadecuado|bajo|baja|menor|sin)/gi,
            /(?:no hay|no existe|carece de|falta).*\*\*(.+?)\*\*/gi,
            /\*\*(.+?)\*\*.*(?:riesgo|alerta|preocupante|problemático|crítico)/gi,
            /(?:solo|únicamente|apenas).*\*\*(.+?)\*\*/gi,
            /\*\*(.+?)\*\*.*(?:limitado|mínimo|escaso|reducido|insuficiente)/gi,
            /\*\*0\s*(.+?)\*\*/gi,
            /\*\*(.+?)\*\*.*(?:→ menor|implica riesgo)/gi
          ]

          let isAlert = false
          let extractedText = content

          alertIndicators.forEach(pattern => {
            if (pattern.test(content)) {
              isAlert = true
              const matches = content.match(pattern)
              if (matches && matches[1]) {
                extractedText = matches[1].replace(/\*\*/g, '')
              } else {
                // Si no hay grupo capturado, usar el contenido completo limpio
                extractedText = content.replace(/\*\*/g, '').replace(/^\* /, '').trim()
              }
            }
          })

          // Solo incluir si es realmente problemático
          if (isAlert && extractedText.length > 10 &&
              (content.toLowerCase().includes('no ') ||
               content.toLowerCase().includes('sin ') ||
               content.toLowerCase().includes('baja') ||
               content.toLowerCase().includes('menor') ||
               content.toLowerCase().includes('problema') ||
               content.toLowerCase().includes('riesgo') ||
               content.toLowerCase().includes('solo ') ||
               content.toLowerCase().includes('únicamente'))) {
            alerts.push(extractedText.substring(0, 200))
          }
        })
      }
    })

    // FALLBACK: Buscar patrones en formato antiguo si no encontró nada
    if (alerts.length === 0) {
      const alertPatterns = [
        /❌ (.+?)(?=\.|⚠️|✅|$)/gi,
        /⚠️ (.+?)(?=\.|❌|✅|$)/gi,
        /\*\*Problema[^:]*:\*\* (.+?)(?=\.|;|\n|$)/gi,
        /\*\*Riesgo[^:]*:\*\* (.+?)(?=\.|;|\n|$)/gi,
        /\*\*no hay (.+?)\*\*/gi,
        /\*\*0 (.+?)\*\* indica que/gi,
        /No hay (.+?) registrado/gi,
        /\*\*ausencia de (.+?)\*\*/gi,
        /- \*\*Hallazgo \d+\*\*: (.+?) \*\*no hay (.+?)\*\*/gi,
        /\*\*(.+?)\*\* no han cumplido/gi
      ]

      alertPatterns.forEach(pattern => {
        const matches = analysisText.match(pattern)
        if (matches) {
          matches.forEach(match => {
            let cleaned = match.replace(/^[- ❌⚠️]*(\*\*[^:]*:\*\*)?/, '').trim()

            // Limpiar patrones específicos
            if (cleaned.includes('**no hay ') || cleaned.includes('**0 ') || cleaned.includes('**ausencia de ')) {
              cleaned = cleaned.replace(/\*\*/g, '')
            }

            if (cleaned && cleaned.length > 10 && !cleaned.includes('✅')) {
              alerts.push(cleaned.substring(0, 200))
            }
          })
        }
      })
    }

    return alerts.slice(0, 5) // Máximo 5 alertas
  }

  /**
   * Sanitizar texto para evitar errores de Unicode en JSON
   */
  private sanitizeUnicodeForJSON(text: string): string {
    if (!text) return ''

    try {
      // Reemplazar caracteres Unicode problemáticos
      return text
        // Eliminar caracteres de control Unicode que pueden causar problemas
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
        // Reemplazar caracteres surrogates mal formados
        .replace(/[\uD800-\uDFFF]/g, '?')
        // Limpiar espacios múltiples
        .replace(/\s+/g, ' ')
        // Asegurar que el texto sea UTF-8 válido
        .normalize('NFKC')
        .trim()
    } catch (error) {
      console.warn('⚠️ Error sanitizando Unicode, usando texto base:', error)
      // Fallback: remover todos los caracteres no-ASCII problemáticos
      return text.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '?').trim()
    }
  }

  /**
   * Obtener etiqueta del tipo de actividad
   */
  private getActivityTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'assign': 'tarea',
      'forum': 'foro',
      'quiz': 'cuestionario',
      'feedback': 'encuesta',
      'choice': 'elección',
      'lesson': 'lección'
    }
    return labels[type] || type
  }

  /**
   * Obtener áreas de enfoque según tipo de actividad
   */
  private getActivityFocusAreas(type: string): string {
    const areas: Record<string, string> = {
      'assign': 'calidad de las entregas, patrones de comportamiento estudiantil, oportunidades de mejora en el aprendizaje',
      'forum': 'participación estudiantil, calidad de las discusiones, patrones de interacción, profundidad de las respuestas',
      'quiz': 'rendimiento académico, áreas de dificultad, patrones de respuesta',
      'feedback': 'participación estudiantil, calidad de las respuestas, insights de satisfacción',
      'choice': 'participación estudiantil, preferencias y tendencias del grupo',
      'lesson': 'progreso del estudiante, comprensión de contenidos, efectividad del material'
    }
    return areas[type] || 'participación estudiantil, patrones de comportamiento, oportunidades de mejora'
  }

  /**
   * Procesar respuesta del análisis y estructurar datos
   */
  private processAnalysisResponse(analysisText: string) {
    // Parsear el markdown en secciones
    const sections = this.parseMarkdownSections(analysisText)
    
    // Extraer insights clave
    const keyInsights = this.extractKeyInsights(analysisText)
    
    // Extraer recomendaciones
    const recommendations = this.extractRecommendations(analysisText)
    
    return {
      analysisText,
      sections,
      keyInsights,
      recommendations,
      summary: this.extractSummary(analysisText)
    }
  }

  /**
   * Parsear markdown en secciones estructuradas
   */
  private parseMarkdownSections(markdown: string) {
    const sections = []
    const sectionMatches = markdown.split(/(?=^####\s)/gm)
      .map(section => section.trim())
      .filter(section => section.length > 0)

    for (const sectionText of sectionMatches) {
      const titleMatch = sectionText.match(/^####\s+(.+)$/m)
      if (titleMatch) {
        const title = titleMatch[1].trim()
        const content = sectionText.replace(/^####\s+.+$/m, '').trim()
        
        sections.push({
          id: this.generateSectionId(title),
          title,
          content,
          format: this.detectContentFormat(content)
        })
      }
    }

    return sections
  }

  /**
   * Generar ID único para sección
   */
  private generateSectionId(title: string): string {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
  }

  /**
   * Detectar formato del contenido
   */
  private detectContentFormat(content: string): string {
    if (content.match(/^\*\s/m)) return 'bullet-list'
    if (content.match(/^\d+\.\s/m)) return 'numbered-list' 
    if (content.includes('**Acción sugerida:**')) return 'recommendation'
    return 'text'
  }

  /**
   * Extraer insights clave del texto
   */
  private extractKeyInsights(text: string): string[] {
    const insights: string[] = []
    const bulletPoints = text.match(/^\*\s+(.+)$/gm)
    
    if (bulletPoints) {
      bulletPoints.forEach(point => {
        const cleanPoint = point.replace(/^\*\s+/, '').trim()
        if (cleanPoint.length > 20 && !cleanPoint.includes('Acción sugerida:')) {
          insights.push(cleanPoint)
        }
      })
    }

    return insights.slice(0, 5) // Máximo 5 insights
  }

  /**
   * Extraer recomendaciones del texto
   */
  private extractRecommendations(text: string): string[] {
    const recommendations: string[] = []
    const actionMatches = text.match(/\*\*Acción sugerida:\*\*\s*(.+?)(?=\n|$)/gm)
    
    if (actionMatches) {
      actionMatches.forEach(match => {
        const recommendation = match.replace(/\*\*Acción sugerida:\*\*\s*/, '').trim()
        if (recommendation.length > 10) {
          recommendations.push(recommendation)
        }
      })
    }

    return recommendations
  }

  /**
   * Extraer resumen del texto
   */
  private extractSummary(text: string): string {
    // Tomar los primeros párrafos o la primera sección como resumen
    const firstSection = text.split('####')[0].trim()
    if (firstSection.length > 50) {
      return firstSection.substring(0, 300) + (firstSection.length > 300 ? '...' : '')
    }

    return text.substring(0, 200) + (text.length > 200 ? '...' : '')
  }

  /**
   * Guardar resultado del análisis
   */
  private async saveAnalysisResult(activity: any, processedAnalysis: any, inputData: any) {
    // Usar ActivityAnalysis con upsert para evitar duplicados
    await prisma.activityAnalysis.upsert({
      where: {
        courseId_activityId_activityType: {
          courseId: `${activity.aulaId}-${activity.courseId}`,
          activityId: activity.activityId.toString(),
          activityType: activity.type
        }
      },
      update: {
        // Actualizar datos existentes
        activityName: activity.name,
        summary: processedAnalysis.summary || 'Análisis generado',
        positives: this.extractPositiveInsights(processedAnalysis.analysisText),
        alerts: this.extractAlerts(processedAnalysis.analysisText),
        insights: processedAnalysis.recommendations || [],
        recommendation: this.truncateText(processedAnalysis.analysisText || 'Sin recomendación específica', 2000),
        fullAnalysis: processedAnalysis.analysisText,
        activityData: inputData,
        llmResponse: {
          model: 'gpt-5-mini',
          processedAt: new Date().toISOString(),
          sections: processedAnalysis.sections?.length || 0
        },
        lastUpdated: new Date(),
        isValid: true
      },
      create: {
        courseId: `${activity.aulaId}-${activity.courseId}`, // Formato combinado para compatibilidad
        moodleCourseId: activity.courseId.toString(),
        activityId: activity.activityId.toString(),
        activityType: activity.type,
        activityName: activity.name,
        
        // Datos del análisis (mapeo corregido)
        summary: processedAnalysis.summary || 'Análisis generado',
        positives: this.extractPositiveInsights(processedAnalysis.analysisText),
        alerts: this.extractAlerts(processedAnalysis.analysisText),
        insights: processedAnalysis.recommendations || [],
        recommendation: processedAnalysis.summary || 'Sin recomendaciones específicas',
        fullAnalysis: processedAnalysis.analysisText,
        
        // Análisis específico por tipo
        forumAnalysis: activity.type === 'forum' ? processedAnalysis : null,
        assignAnalysis: activity.type === 'assign' ? processedAnalysis : null,
        
        // Datos originales (incluyendo URL correcta)
        activityData: {
          ...inputData,
          url: inputData.activityInfo?.url // Incluir la URL correcta en los datos guardados
        },
        llmResponse: processedAnalysis
      }
    })
  }

  /**
   * NUEVO: Analizar actividades específicas ya guardadas en BD
   */
  async analyzeSpecificActivities(filters: {
    aulaId?: string
    courseId?: string
    activityType?: string
    activityIds?: string[]
    forceReAnalysis?: boolean
  }): Promise<{
    success: boolean
    processedActivities: number
    generatedAnalyses: number
    errors: string[]
    duration: number
  }> {
    const startTime = Date.now()
    console.log('🎯 Iniciando análisis selectivo de actividades específicas')

    const result = {
      success: true,
      processedActivities: 0,
      generatedAnalyses: 0,
      errors: [],
      duration: 0
    }

    try {
      // Construir filtros para la consulta
      const whereClause: any = {
        visible: true
      }

      if (filters.aulaId) {
        whereClause.aulaId = filters.aulaId
      }

      if (filters.courseId) {
        whereClause.courseId = parseInt(filters.courseId)
      }

      if (filters.activityType) {
        whereClause.type = filters.activityType
      }

      if (filters.activityIds && filters.activityIds.length > 0) {
        whereClause.activityId = {
          in: filters.activityIds.map(id => parseInt(id))
        }
      }

      // Si no es re-análisis forzado, solo actividades que necesitan análisis
      if (!filters.forceReAnalysis) {
        whereClause.needsAnalysis = true
      }

      // Obtener actividades que coincidan con los filtros
      const activities = await prisma.courseActivity.findMany({
        where: whereClause,
        include: {
          course: true,
          aula: true
        },
        orderBy: [
          { dueDate: 'asc' },
          { lastDataSync: 'desc' }
        ]
      })

      console.log(`🎯 Encontradas ${activities.length} actividades para análisis selectivo`)

      if (activities.length === 0) {
        console.log('⚠️ No se encontraron actividades que coincidan con los filtros')
        return result
      }

      // Procesar en lotes pequeños
      const BATCH_SIZE = 3
      for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const batch = activities.slice(i, i + BATCH_SIZE)

        console.log(`🔄 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(activities.length / BATCH_SIZE)} (${batch.length} actividades)`)

        // Procesar actividades en paralelo dentro del lote
        const batchPromises = batch.map(activity =>
          this.analyzeActivity(activity).catch(error => {
            const errorMsg = `Error analizando ${activity.type} ${activity.activityId} del curso ${activity.courseId}: ${error}`
            console.error('❌', errorMsg)
            result.errors.push(errorMsg)
            return null
          })
        )

        const batchResults = await Promise.allSettled(batchPromises)

        batchResults.forEach((promiseResult, index) => {
          result.processedActivities++
          if (promiseResult.status === 'fulfilled' && promiseResult.value) {
            result.generatedAnalyses++
          }
        })

        // Pausa entre lotes
        if (i + BATCH_SIZE < activities.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

    } catch (error) {
      console.error('❌ Error en análisis selectivo:', error)
      result.errors.push(`Error general: ${error}`)
      result.success = false
    }

    result.duration = Date.now() - startTime
    console.log(`✅ Análisis selectivo completado en ${result.duration}ms: ${result.generatedAnalyses}/${result.processedActivities} análisis generados`)

    return result
  }

  /**
   * NUEVO: Obtener lista de actividades disponibles para análisis selectivo
   */
  async getAvailableActivitiesForAnalysis(filters?: {
    aulaId?: string
    courseId?: string
    activityType?: string
  }): Promise<Array<{
    aulaId: string
    courseId: string
    activityId: string
    activityType: string
    activityName: string
    needsAnalysis: boolean
    lastAnalyzed?: Date
    courseName?: string
  }>> {
    try {
      const whereClause: any = {
        visible: true
      }

      if (filters?.aulaId) {
        whereClause.aulaId = filters.aulaId
      }

      if (filters?.courseId) {
        whereClause.courseId = parseInt(filters.courseId)
      }

      if (filters?.activityType) {
        whereClause.type = filters.activityType
      }

      const activities = await prisma.courseActivity.findMany({
        where: whereClause,
        include: {
          course: {
            select: {
              courseName: true
            }
          }
        },
        orderBy: [
          { aulaId: 'asc' },
          { courseId: 'asc' },
          { name: 'asc' }
        ]
      })

      return activities.map(activity => ({
        aulaId: activity.aulaId,
        courseId: activity.courseId,
        activityId: activity.activityId,
        activityType: activity.type,
        activityName: activity.name,
        needsAnalysis: activity.needsAnalysis,
        lastAnalyzed: activity.lastAnalysis,
        courseName: activity.course?.courseName
      }))

    } catch (error) {
      console.error('❌ Error obteniendo actividades disponibles:', error)
      return []
    }
  }

  /**
   * Obtener estadísticas de análisis batch
   */
  async getAnalysisStats(): Promise<{
    totalAnalyses: number
    recentAnalyses: number
    byActivityType: Record<string, number>
    byAula: Record<string, number>
  }> {
    const [total, recent, byType, byAula] = await Promise.all([
      // Total de análisis
      prisma.activityAnalysis.count(),
      
      // Análisis de las últimas 24 horas
      prisma.activityAnalysis.count({
        where: {
          generatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Por tipo de actividad
      prisma.activityAnalysis.groupBy({
        by: ['activityType'],
        _count: { activityType: true }
      }),
      
      // Por aula (extraer de courseId que tiene formato aulaId-courseId)
      prisma.activityAnalysis.findMany({
        select: {
          courseId: true
        }
      })
    ])

    const byActivityType: Record<string, number> = {}
    byType.forEach(item => {
      if (item.activityType) {
        byActivityType[item.activityType] = item._count.activityType
      }
    })

    const byAulaMap: Record<string, number> = {}
    byAula.forEach(item => {
      if (item.courseId) {
        const aulaId = item.courseId.split('-')[0] // Extraer aulaId de "aulaId-courseId"
        byAulaMap[aulaId] = (byAulaMap[aulaId] || 0) + 1
      }
    })

    return {
      totalAnalyses: total,
      recentAnalyses: recent,
      byActivityType,
      byAula: byAulaMap
    }
  }

  /**
   * Generar URL correcta según el tipo de actividad
   */
  private generateCorrectActivityUrl(activity: any): string {
    const baseUrl = activity.aula.baseUrl || `https://${activity.aulaId}.utel.edu.mx`
    
    // Para foros, intentar obtener la URL de la discusión específica si existe
    if (activity.type === 'forum') {
      // Primero intentar usar firstDiscussionId si está disponible
      if (activity.forumData?.firstDiscussionId) {
        return `${baseUrl}/mod/forum/discuss.php?d=${activity.forumData.firstDiscussionId}`
      }
      
      // Si hay discusiones en el forumData, tomar la primera discusión
      const discussions = activity.forumData?.discussions || []
      if (discussions.length > 0) {
        const discussionId = discussions[0].discussion || discussions[0].id
        if (discussionId) {
          return `${baseUrl}/mod/forum/discuss.php?d=${discussionId}`
        }
      }
      
      // Si no hay discusiones específicas, usar la URL general del foro
      const cmid = activity.rawData?.cmid || activity.rawData?.coursemodule
      if (cmid) {
        return `${baseUrl}/mod/forum/view.php?id=${cmid}`
      }
    }
    
    // Para assignments y otros tipos
    if (activity.type === 'assign' || activity.type === 'assignment') {
      const cmid = activity.rawData?.cmid || activity.rawData?.coursemodule
      if (cmid) {
        return `${baseUrl}/mod/assign/view.php?id=${cmid}`
      }
    }
    
    // Para otros tipos de actividad
    const typeMap: Record<string, string> = {
      'quiz': 'quiz',
      'feedback': 'feedback',
      'choice': 'choice',
      'lesson': 'lesson'
    }
    
    const moduleName = typeMap[activity.type] || activity.type
    const cmid = activity.rawData?.cmid || activity.rawData?.coursemodule
    
    if (cmid) {
      return `${baseUrl}/mod/${moduleName}/view.php?id=${cmid}`
    }
    
    // Fallback: URL del curso
    return `${baseUrl}/course/view.php?id=${activity.courseId}`
  }

  /**
   * Analizar foro por grupos específicos
   */
  private async analyzeForumByGroups(activity: any): Promise<boolean> {
    try {
      console.log(`📋 Analizando foro por grupos: "${activity.name}" (ID: ${activity.activityId})`)
      
      // Importar dinámicamente el cliente de Moodle y configuración del aula
      const { MoodleAPIClient } = await import('@/lib/moodle/api-client')
      const { aulaConfigService } = await import('@/lib/services/aula-config-service')
      
      // Obtener configuración del aula
      const aulaConfig = aulaConfigService.getAulaConfig(activity.aulaId)
      if (!aulaConfig) {
        throw new Error(`No se encontró configuración para el aula ${activity.aulaId}`)
      }
      
      // Crear cliente con la configuración del aula
      const client = new MoodleAPIClient(aulaConfig.apiUrl, aulaConfig.token)
      
      // Obtener todas las discusiones del foro
      const forumDiscussions = await client.getForumDiscussions(activity.activityId)
      console.log(`💬 Encontradas ${forumDiscussions.length} discusiones en el foro`)
      
      if (!forumDiscussions || forumDiscussions.length === 0) {
        console.log(`⚠️ No hay discusiones para analizar en el foro ${activity.activityId}`)
        return false
      }

      // Agrupar discusiones por grupo
      const discussionsByGroup = forumDiscussions.reduce((groups: any, discussion: any) => {
        const groupId = discussion.groupid || '0'
        if (!groups[groupId]) {
          groups[groupId] = []
        }
        groups[groupId].push(discussion)
        return groups
      }, {})

      console.log(`📊 Discusiones agrupadas: ${Object.keys(discussionsByGroup).length} grupos`)

      let successCount = 0
      
      // Analizar cada grupo por separado
      for (const [groupId, discussions] of Object.entries(discussionsByGroup)) {
        try {
          console.log(`🎯 Analizando grupo ${groupId} con ${(discussions as any[]).length} discusiones`)
          
          // Para cada discusión del grupo, obtener los posts completos
          const groupDiscussionData = []
          
          for (const discussion of discussions as any[]) {
            try {
              // Obtener posts de la discusión
              const discussionId = discussion.discussion || discussion.id
              const posts = await client.getDiscussionPosts(discussionId)
              
              if (posts && posts.length > 0) {
                groupDiscussionData.push({
                  discussion: discussion,
                  posts: posts,
                  discussionId: discussion.discussion || discussion.id,
                  groupId: groupId
                })
                console.log(`   📝 Discusión "${discussion.name}": ${posts.length} posts obtenidos`)
              }
            } catch (error) {
              console.error(`   ❌ Error obteniendo posts de discusión ${discussion.id}:`, error)
            }
          }

          if (groupDiscussionData.length > 0) {
            // Crear análisis específico para este grupo
            await this.createGroupSpecificAnalysis(activity, groupId, groupDiscussionData)
            successCount++
          }

        } catch (error) {
          console.error(`❌ Error analizando grupo ${groupId}:`, error)
        }
      }

      // Marcar la actividad original como analizada
      await prisma.courseActivity.update({
        where: {
          aulaId_courseId_activityId_type: {
            aulaId: activity.aulaId,
            courseId: activity.courseId,
            activityId: activity.activityId,
            type: activity.type
          }
        },
        data: {
          needsAnalysis: false,
          analysisCount: { increment: successCount }
        }
      })

      console.log(`✅ Análisis de foro completado: ${successCount} grupos analizados`)
      return successCount > 0

    } catch (error) {
      console.error(`❌ Error en análisis de foro por grupos:`, error)
      throw error
    }
  }

  /**
   * Crear análisis específico para un grupo
   */
  private async createGroupSpecificAnalysis(activity: any, groupId: string, discussionData: any[]) {
    try {
      // Preparar datos específicos del grupo
      const analysisData = {
        activityInfo: {
          id: activity.activityId,
          name: activity.name,
          type: activity.type,
          description: activity.description,
          groupId: groupId,
          course: {
            id: activity.courseId,
            name: activity.course.courseName,
            shortName: activity.course.shortName
          },
          aula: {
            id: activity.aulaId,
            name: activity.aula.name
          }
        },
        groupDiscussions: discussionData,
        totalDiscussions: discussionData.length,
        totalPosts: discussionData.reduce((total, d) => total + d.posts.length, 0),
        dataTimestamp: new Date()
      }

      // Generar análisis con IA para este grupo específico
      const analysisResult = await this.generateGroupAnalysisWithAI(activity, analysisData, groupId)
      
      if (!analysisResult) {
        throw new Error(`No se pudo generar análisis para grupo ${groupId}`)
      }

      // Procesar respuesta
      const processedAnalysis = this.processAnalysisResponse(analysisResult)

      // Determinar la discusión principal para el URL (la primera o la que tenga más posts)
      const mainDiscussion = discussionData.reduce((main, current) => 
        current.posts.length > main.posts.length ? current : main, discussionData[0])

      // Guardar análisis específico del grupo
      await prisma.activityAnalysis.upsert({
        where: {
          courseId_activityId_activityType: {
            courseId: `${activity.aulaId}-${activity.courseId}-group${groupId}`,
            activityId: activity.activityId.toString(),
            activityType: activity.type
          }
        },
        update: {
          activityName: `${activity.name} (Grupo ${groupId})`,
          summary: processedAnalysis.summary || 'Análisis de discusiones grupales',
          positives: this.extractPositiveInsights(processedAnalysis.analysisText),
          alerts: this.extractAlerts(processedAnalysis.analysisText),
          insights: processedAnalysis.recommendations || [],
          recommendation: this.truncateText(processedAnalysis.analysisText || 'Sin recomendación específica', 2000),
          fullAnalysis: processedAnalysis.analysisText,
          activityData: analysisData,
          forumAnalysis: {
            groupId: groupId,
            discussionId: mainDiscussion.discussionId,
            totalDiscussions: discussionData.length,
            totalPosts: analysisData.totalPosts,
            discussions: discussionData.map(d => ({
              id: d.discussionId,
              name: d.discussion.name,
              posts: d.posts.length
            }))
          },
          llmResponse: {
            model: 'gpt-5-mini',
            response: processedAnalysis.analysisText,
            groupId: groupId,
            discussionCount: discussionData.length,
            timestamp: new Date()
          },
          lastUpdated: new Date(),
          isValid: true
        },
        create: {
          courseId: `${activity.aulaId}-${activity.courseId}-group${groupId}`,
          moodleCourseId: activity.courseId.toString(),
          activityId: activity.activityId.toString(),
          activityType: activity.type,
          activityName: `${activity.name} (Grupo ${groupId})`,
          summary: processedAnalysis.summary || 'Análisis de discusiones grupales',
          positives: this.extractPositiveInsights(processedAnalysis.analysisText),
          alerts: this.extractAlerts(processedAnalysis.analysisText),
          insights: processedAnalysis.recommendations || [],
          recommendation: this.truncateText(processedAnalysis.analysisText || 'Sin recomendación específica', 2000),
          fullAnalysis: processedAnalysis.analysisText,
          activityData: analysisData,
          forumAnalysis: {
            groupId: groupId,
            discussionId: mainDiscussion.discussionId,
            totalDiscussions: discussionData.length,
            totalPosts: analysisData.totalPosts,
            discussions: discussionData.map(d => ({
              id: d.discussionId,
              name: d.discussion.name,
              posts: d.posts.length
            }))
          },
          llmResponse: {
            model: 'gpt-5-mini',
            response: processedAnalysis.analysisText,
            groupId: groupId,
            discussionCount: discussionData.length,
            timestamp: new Date()
          },
          isValid: true
        }
      })

      console.log(`✅ Análisis guardado para grupo ${groupId} con ${discussionData.length} discusiones`)

    } catch (error) {
      console.error(`❌ Error creando análisis para grupo ${groupId}:`, error)
      throw error
    }
  }

  /**
   * Generar análisis con IA para grupo específico
   */
  private async generateGroupAnalysisWithAI(activity: any, analysisData: any, groupId: string): Promise<string | null> {
    try {
      // Construir prompt específico para análisis grupal
      const groupPrompt = this.buildGroupSpecificPrompt(activity, analysisData, groupId)
      
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: groupPrompt
          }
        ],
        max_completion_tokens: 30000
      })

      return completion.choices[0]?.message?.content || null

    } catch (error) {
      console.error('❌ Error generando análisis grupal con IA:', error)
      throw error
    }
  }

  /**
   * Construir prompt específico para análisis grupal
   */
  private buildGroupSpecificPrompt(activity: any, analysisData: any, groupId: string): string {
    const baseInfo = `
Información de la actividad:
- Nombre: ${activity.name}
- Tipo: Foro de discusión (Análisis específico del Grupo ${groupId})
- Curso: ${activity.course.courseName} (Aula ${activity.aulaId})
- Descripción: ${activity.description ? this.truncateText(activity.description, 1500) : 'Sin descripción disponible'}

Datos del grupo ${groupId} para análisis:
- Total de discusiones: ${analysisData.totalDiscussions}
- Total de posts en el grupo: ${analysisData.totalPosts}
- Discusiones del grupo: ${analysisData.groupDiscussions.map(d => `"${d.discussion.name}" (${d.posts.length} posts)`).join(', ')}

Conversaciones completas del grupo:
${analysisData.groupDiscussions.map(d => `
Discusión: "${d.discussion.name}"
Posts (${d.posts.length} mensajes):
${d.posts.map((post: any) => `- ${post.userFullName || post.userfullname || 'Usuario'}: ${this.truncateText(post.message || post.content || '', 800)}`).join('\n')}
`).join('\n---\n')}

---
`

    const groupSpecificInstructions = `Eres un asistente del docente en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables específicamente para el Grupo ${groupId} de este foro de discusión. Analiza únicamente las conversaciones de este grupo, considerando la dinámica grupal, participación individual, y calidad de las interacciones dentro del grupo.

Enfócate especialmente en:
- Participación activa vs. pasiva dentro del grupo
- Calidad de las contribuciones de cada miembro del grupo
- Dinámicas de colaboración y apoyo entre compañeros del grupo
- Temas de interés o confusión específicos que emergen en el grupo
- Estudiantes del grupo que necesitan más acompañamiento
- Oportunidades de intervención específicas para este grupo

Redacta con un estilo conversacional dirigido al docente de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionables.

El análisis debe estructurarse en al menos 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
**[Nombre de la dimensión]**

Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
Cada hallazgo debe resaltar con negritas los elementos relevantes.
**Acción sugerida:** redactar una recomendación específica, breve y accionable para el docente.

Ordena las dimensiones de mayor a menor impacto.
El formato de entrega solo es markdown.
El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.
Siempre incluye insights accionables acerca de nivel de participación grupal y si surgen dudas o temas de conversación fuera de la consigna de la discusión específicos del grupo.`

    return baseInfo + groupSpecificInstructions
  }

  /**
   * Analizar tarea con enfoque en retroalimentaciones
   */
  private async analyzeAssignmentFeedback(activity: any): Promise<boolean> {
    try {
      console.log(`📚 Analizando tarea con enfoque en retroalimentaciones: "${activity.name}"`)
      
      // Para tareas, usar el flujo normal pero con prompt modificado para enfocarse en feedback
      const analysisData = await this.prepareAssignmentFeedbackData(activity)
      const analysisResult = await this.generateAssignmentFeedbackAnalysis(activity, analysisData)
      
      if (!analysisResult) {
        throw new Error('No se pudo generar análisis de retroalimentaciones')
      }

      const processedAnalysis = this.processAnalysisResponse(analysisResult)
      await this.saveAnalysisResult(activity, processedAnalysis, analysisData)

      // Marcar actividad como analizada
      await prisma.courseActivity.update({
        where: {
          aulaId_courseId_activityId_type: {
            aulaId: activity.aulaId,
            courseId: activity.courseId,
            activityId: activity.activityId,
            type: activity.type
          }
        },
        data: {
          needsAnalysis: false,
          analysisCount: { increment: 1 }
        }
      })

      console.log(`✅ Análisis de retroalimentaciones completado para "${activity.name}"`)
      return true

    } catch (error) {
      console.error(`❌ Error en análisis de retroalimentaciones:`, error)
      throw error
    }
  }

  /**
   * Preparar datos específicos para análisis de retroalimentaciones
   */
  private async prepareAssignmentFeedbackData(activity: any) {
    const baseData = await this.prepareAnalysisData(activity)
    
    // Si hay datos de asignación, enfocarse en las retroalimentaciones
    if (activity.assignmentData && activity.assignmentData.submissions) {
      const submissions = activity.assignmentData.submissions
      
      // Extraer solo las retroalimentaciones y calificaciones
      const feedbackData = submissions.map((submission: any) => ({
        userId: submission.userId || submission.userid,
        userFullName: submission.userFullName || submission.userfullname,
        submissionStatus: submission.status,
        grade: submission.grade,
        feedback: submission.feedback,
        teacherComment: submission.teachercomment || submission.feedback,
        submittedAt: submission.timemodified,
        isLate: submission.late || false
      })).filter((sub: any) => sub.feedback || sub.teacherComment || sub.grade !== null)

      baseData.feedbackAnalysis = {
        totalSubmissions: submissions.length,
        submissionsWithFeedback: feedbackData.length,
        feedbackData: feedbackData,
        averageGrade: feedbackData.reduce((sum: number, sub: any) => sum + (sub.grade || 0), 0) / feedbackData.length || 0,
        lateSubmissions: feedbackData.filter((sub: any) => sub.isLate).length
      }
    }

    return baseData
  }

  /**
   * Generar análisis específico para retroalimentaciones
   */
  private async generateAssignmentFeedbackAnalysis(activity: any, analysisData: any): Promise<string | null> {
    try {
      const feedbackPrompt = this.buildAssignmentFeedbackPrompt(activity, analysisData)
      
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: feedbackPrompt
          }
        ],
        max_completion_tokens: 30000
      })

      return completion.choices[0]?.message?.content || null

    } catch (error) {
      console.error('❌ Error generando análisis de retroalimentaciones:', error)
      throw error
    }
  }

  /**
   * Construir prompt específico para análisis de retroalimentaciones
   */
  private buildAssignmentFeedbackPrompt(activity: any, analysisData: any): string {
    const baseInfo = `
Información de la tarea:
- Nombre: ${activity.name}
- Tipo: Tarea/Entrega (Análisis de Retroalimentaciones)
- Curso: ${activity.course.courseName} (Aula ${activity.aulaId})
- Fecha límite: ${activity.dueDate ? new Date(activity.dueDate).toLocaleDateString('es-ES') : 'Sin fecha límite'}
- Descripción: ${activity.description ? this.truncateText(activity.description, 1500) : 'Sin descripción disponible'}

Datos de retroalimentaciones para análisis:
${JSON.stringify(analysisData.feedbackAnalysis || analysisData, null, 2)}

---
`

    const feedbackInstructions = `Eres un asistente del docente en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las entregas y retroalimentaciones de esta tarea específica. El propósito es que pueda mantener una visión clara del desempeño, calidad de las retroalimentaciones proporcionadas, y patrones en las entregas de los estudiantes.

Enfócate especialmente en:
- Calidad y consistencia de las retroalimentaciones proporcionadas
- Patrones en las calificaciones y comentarios
- Estudiantes que requieren retroalimentación adicional o seguimiento
- Efectividad de las retroalimentaciones en el aprendizaje
- Tendencias en reenvíos o correcciones después de feedback
- Identificación de estudiantes en riesgo basado en patrones de entrega y feedback

Redacta con un estilo conversacional dirigido al docente de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionables.

El análisis debe estructurarse en al menos 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
**[Nombre de la dimensión]**

Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
Cada hallazgo debe resaltar con negritas los elementos relevantes.
**Acción sugerida:** redactar una recomendación específica, breve y accionable para el docente.

Ordena las dimensiones de mayor a menor impacto.
El formato de entrega solo es markdown.
El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.
Siempre incluye insights accionables acerca de puntualidad en las entregas, calidad del feedback proporcionado, patrones de reenvío, y estudiantes en riesgo de no completar satisfactoriamente.`

    return baseInfo + feedbackInstructions
  }

  /**
   * Procesar análisis SOLO para aula 101 (modo prueba)
   */
  async processAula101Only(specificCourseId?: string): Promise<BatchAnalysisResult> {
    const startTime = Date.now()
    const courseFilter = specificCourseId ? ` y curso ${specificCourseId}` : ''
    console.log(`🧠 Iniciando análisis SOLO para Aula 101${courseFilter} (modo prueba)`)

    const result: BatchAnalysisResult = {
      success: true,
      processedActivities: 0,
      generatedAnalyses: 0,
      errors: [],
      duration: 0
    }

    try {
      // Construir filtros con fechas de actividades activas
      const now = new Date()
      console.log(`📅 Filtrando actividades activas del aula 101 (fecha actual: ${now.toISOString()})`)
      const whereCondition: any = {
        aulaId: '101',
        needsAnalysis: true,
        visible: true,
        // Filtros de actividades activas:
        OR: [
          { openDate: null },
          { openDate: { lte: now } }
        ],
        AND: [
          {
            OR: [
              { closeDate: null },
              { closeDate: { gt: now } }
            ]
          }
        ]
      }

      // Agregar filtro de curso si se especifica
      if (specificCourseId) {
        whereCondition.courseId = parseInt(specificCourseId)
      }

      // Obtener SOLO actividades del aula 101 (y curso específico si se indicó)
      const aula101Activities = await prisma.courseActivity.findMany({
        where: whereCondition,
        include: {
          course: true,
          aula: true
        },
        orderBy: [
          { dueDate: 'asc' },
          { lastDataSync: 'desc' }
        ]
      })

      console.log(`📋 Encontradas ${aula101Activities.length} actividades pendientes en Aula 101${courseFilter}`)

      if (aula101Activities.length === 0) {
        console.log('⚠️ No hay actividades pendientes en Aula 101')
        result.duration = Date.now() - startTime
        return result
      }

      // Procesar en lotes pequeños
      const BATCH_SIZE = 3 // Lotes más pequeños para pruebas
      for (let i = 0; i < aula101Activities.length; i += BATCH_SIZE) {
        const batch = aula101Activities.slice(i, i + BATCH_SIZE)

        console.log(`🔄 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(aula101Activities.length / BATCH_SIZE)} (${batch.length} actividades del Aula 101)`)

        // Procesar actividades en paralelo dentro del lote
        const batchPromises = batch.map(activity =>
          this.analyzeActivity(activity).catch(error => {
            const errorMsg = `Error analizando ${activity.type} ${activity.activityId} del curso ${activity.courseId}: ${error}`
            console.error(`❌ ${errorMsg}`)
            result.errors.push(errorMsg)
            return false
          })
        )

        const batchResults = await Promise.all(batchPromises)

        // Contar resultados
        result.processedActivities += batch.length
        result.generatedAnalyses += batchResults.filter(success => success === true).length

        // Pausa entre lotes para evitar sobrecarga
        if (i + BATCH_SIZE < aula101Activities.length) {
          console.log('⏳ Pausa de 2 segundos antes del siguiente lote...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

    } catch (error) {
      console.error('❌ Error en procesamiento de Aula 101:', error)
      result.errors.push(`Error general: ${error}`)
      result.success = false
    }

    result.duration = Date.now() - startTime
    console.log(`✅ Análisis de Aula 101 completado en ${result.duration}ms: ${result.generatedAnalyses}/${result.processedActivities} análisis generados`)

    return result
  }
}

// Singleton export
export const batchAnalysisService = BatchAnalysisService.getInstance()