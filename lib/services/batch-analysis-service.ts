/**
 * Servicio de análisis batch para procesar datos sincronizados
 * Genera análisis de actividades usando IA para todas las aulas
 */

import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import { aulaConfigService } from './aula-config-service'

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

        // Obtener página actual de actividades pendientes
        const pendingActivities = await prisma.courseActivity.findMany({
          where: {
            needsAnalysis: true,
            visible: true
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
      
      // Si ya tenemos discussions, enriquecerlas con hilos completos
      if (forumData.discussions && Array.isArray(forumData.discussions)) {
        const enrichedDiscussions = forumData.discussions.map((discussion: any) => {
          return {
            // Datos básicos de la discusión
            id: discussion.discussion || discussion.id,
            name: discussion.name || discussion.subject,
            message: discussion.message,
            userFullName: discussion.userfullname || discussion.userFullName,
            userId: discussion.userid || discussion.userId,
            created: discussion.created || discussion.timemodified,
            groupId: discussion.groupid || 0,
            
            // PROFUNDIZACIÓN: Posts completos con hilos anidados
            posts: (discussion.posts || []).map((post: any) => ({
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
            
            // NUEVO: Estadísticas de la discusión
            discussionStats: {
              totalPosts: (discussion.posts || []).length,
              uniqueParticipants: new Set((discussion.posts || []).map(p => p.userid)).size,
              averagePostLength: (discussion.posts || []).reduce((sum, p) => sum + (p.message || '').length, 0) / Math.max((discussion.posts || []).length, 1),
              postsWithAttachments: (discussion.posts || []).filter(p => p.attachments && p.attachments.length > 0).length,
              threadDepth: this.calculateThreadDepth(discussion.posts || [])
            }
          }
        })

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
        max_completion_tokens: 30000  // Aumentado a 10,000 tokens para análisis completos
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
    const MAX_SIZE = 500000 // Límite aumentado para análisis completo (500KB)

    // Solo aplicar optimización mínima si es absolutamente necesario
    if (totalSize > MAX_SIZE) {
      console.warn(`⚠️ Datos muy grandes (${totalSize} bytes). Aplicando optimización mínima.`)

      // Solo remover rawData si es extremadamente grande
      if (optimized.rawData && typeof optimized.rawData === 'object') {
        const rawDataStr = JSON.stringify(optimized.rawData)
        if (rawDataStr.length > 100000) { // Solo si rawData es > 100KB
          optimized.rawData = {
            note: 'Datos raw omitidos por tamaño extremo',
            originalSize: rawDataStr.length,
            keys: Object.keys(optimized.rawData)
          }
        }
      }

      // Para actividades con más de 10,000 elementos, aplicar paginación suave
      if (activityType === 'forum' && optimized.forumDetails?.discussions?.length > 1000) {
        console.log(`📊 Forum con ${optimized.forumDetails.discussions.length} discusiones - manteniendo todas`)
      }

      if (activityType === 'assign' && optimized.assignmentDetails?.submissions?.length > 1000) {
        console.log(`📊 Assignment con ${optimized.assignmentDetails.submissions.length} entregas - manteniendo todas`)
      }
    }

    // POLÍTICA NUEVA: NO TRUNCAR NADA - Enviar contenido completo
    console.log(`📊 Enviando datos completos para análisis detallado: ${JSON.stringify(analysisData).length} chars (${activityType})`)
    return analysisData // Devolver datos originales completos SIN optimización
  }

  /**
   * Obtener instrucciones específicas según tipo de actividad (MEJORADAS PARA CONTENIDO PROFUNDO)
   */
  private getInstructionsByActivityType(activityType: string): string {
    switch (activityType.toLowerCase()) {
      case 'forum':
        return `Eres un asistente del docente en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las actividades en el foro de discusión. El propósito es que pueda mantener una visión clara de lo que ocurre en él y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

IMPORTANTE: Tienes acceso completo a TODAS las conversaciones, hilos de discusión, respuestas anidadas, y el contenido textual completo de cada mensaje. Analiza en profundidad:

📋 **CONVERSACIONES COMPLETAS**: Examina todo el contenido de los mensajes, no solo estadísticas
📋 **HILOS Y RESPUESTAS**: Analiza la estructura de las conversaciones, quién responde a quién
📋 **CALIDAD DEL CONTENIDO**: Evalúa la profundidad, relevancia y calidad académica de cada participación
📋 **DINÁMICAS SOCIALES**: Identifica líderes, participantes pasivos, y patrones de interacción
📋 **TEMAS EMERGENTES**: Detecta dudas recurrentes, malentendidos, o temas fuera del alcance
📋 **EVOLUCIÓN TEMPORAL**: Observa cómo se desarrollan las discusiones en el tiempo

Considera que varias retroalimentaciones pueden ser generadas por un asistente virtual, así que también evalúa esa dinámica.

Redacta con un estilo conversacional dirigido al docente de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionales.

FORMATO OBLIGATORIO - El análisis debe estructurarse EXACTAMENTE en estas 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:

**[Nombre de la dimensión]**

- **Hallazgo 1**: Descripción DETALLADA con **nombres específicos**, **fechas**, **cantidades** en negritas
- **Hallazgo 2**: Descripción DETALLADA con **datos cuantitativos** específicos y ejemplos concretos
- **Hallazgo 3**: Descripción DETALLADA con **citas textuales** y **patrones identificados**
- **Hallazgo 4**: Descripción DETALLADA con **comparaciones** y **contexto educativo**
**Acción sugerida:** Redactar recomendación ESPECÍFICA con pasos concretos y medibles.

DIMENSIONES OBLIGATORIAS para foros (DEBEN aparecer todas en este orden):

1. **Calidad de las conversaciones** (analiza el contenido textual real de los mensajes)
2. **Patrones de participación** (quién participa, cuándo, y con qué frecuencia)  
3. **Dinámicas de grupo** (interacciones, respuestas, construcción colectiva)
4. **Temas y dudas emergentes** (análisis semántico del contenido)
5. **Oportunidades de intervención** (momentos específicos para actuar)

REGLAS ESTRICTAS AMPLIADAS:
- EXACTAMENTE 5 dimensiones, con análisis EXTENSO en cada una
- Cada dimensión DEBE tener MÍNIMO 4 hallazgos específicos y detallados
- INCLUIR nombres específicos de estudiantes cuando sea relevante
- INCLUIR datos cuantitativos: números de posts, fechas, horarios de participación
- MENCIONAR contenido textual específico y citas cuando sea relevante para ilustrar puntos
- ANALIZAR patrones temporales de participación
- Cada dimensión DEBE terminar con "Acción sugerida:" con pasos específicos y medibles
- El análisis completo debe tener MÍNIMO 1000 palabras
- Usar TODO el contenido de conversaciones disponible, no resumir
- Si hay pocas conversaciones, analizar en mayor profundidad las existentes

IMPORTANTE: NO menciones nombres de variables, parámetros técnicos, campos de base de datos ni referencias a código. Usa lenguaje natural y enfocado en el contexto educativo. Por ejemplo, no digas "el campo 'posts' muestra" sino "las conversaciones de los estudiantes revelan". Analiza el CONTENIDO REAL de los mensajes, no solo metadatos.`

      case 'assign':
      case 'assignment':
        return `Eres un asistente del docente en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las actividades de tareas y entregas. El propósito es que pueda mantener una visión clara del desempeño y cumplimiento de los estudiantes y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

IMPORTANTE: Tienes acceso completo a TODAS las entregas de los estudiantes, incluyendo el contenido textual completo, archivos adjuntos, retroalimentaciones detalladas, historial de intentos, y conversaciones completas entre estudiante-profesor. Analiza en profundidad:

📚 **CONTENIDO DE ENTREGAS**: Examina el texto completo enviado por cada estudiante
📚 **RETROALIMENTACIONES COMPLETAS**: Analiza todos los comentarios y feedback proporcionado
📚 **HISTORIAL DE INTENTOS**: Revisa múltiples entregas y correcciones del mismo estudiante
📚 **CONVERSACIONES**: Evalúa la comunicación bidireccional estudiante-profesor
📚 **ARCHIVOS Y ATTACHMENTS**: Considera la variedad y calidad de materiales adjuntos
📚 **PATRONES TEMPORALES**: Identifica tendencias de entrega y respuesta a feedback

Considera que varias calificaciones y retroalimentaciones pueden ser generadas por un asistente virtual, así que también evalúa esa dinámica y su efectividad.

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

DIMENSIONES OBLIGATORIAS para tareas (usa el contenido completo disponible):
- **Calidad del trabajo entregado** (analiza el contenido textual real de las entregas)
- **Efectividad de la retroalimentación** (evalúa la calidad y profundidad del feedback)
- **Patrones de entrega y reenvío** (timing, multiple attempts, mejoras)
- **Comunicación estudiante-profesor** (conversaciones, preguntas, clarificaciones)
- **Estudiantes en riesgo** (identificación basada en patrones múltiples)

IMPORTANTE: NO menciones nombres de variables, parámetros técnicos, campos de base de datos ni referencias a código. Usa lenguaje natural y enfocado en el contexto educativo. Por ejemplo, no digas "el objeto 'submissions' indica" sino "las entregas de los estudiantes revelan". Analiza el CONTENIDO REAL de las entregas y retroalimentaciones, no solo metadatos.`

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

    // Buscar patrones de insights positivos
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
            insights.push(cleaned.substring(0, 200)) // Limitar longitud
          }
        })
      }
    })

    return insights.slice(0, 5) // Máximo 5 insights
  }

  /**
   * Extraer alertas/problemas del análisis
   */
  private extractAlerts(analysisText: string): string[] {
    if (!analysisText) return []

    const alerts: string[] = []

    // Buscar patrones de alertas/problemas
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
            alerts.push(cleaned.substring(0, 200)) // Limitar longitud
          }
        })
      }
    })

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
}

// Singleton export
export const batchAnalysisService = BatchAnalysisService.getInstance()