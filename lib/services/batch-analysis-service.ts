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
   * Procesar análisis de todas las actividades que necesitan análisis
   */
  async processAllPendingAnalyses(): Promise<BatchAnalysisResult> {
    const startTime = Date.now()
    console.log('🧠 Iniciando análisis batch de todas las actividades pendientes')

    const result: BatchAnalysisResult = {
      success: true,
      processedActivities: 0,
      generatedAnalyses: 0,
      errors: [],
      duration: 0
    }

    try {
      // Obtener todas las actividades que necesitan análisis
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
        ]
      })

      console.log(`📋 Encontradas ${pendingActivities.length} actividades pendientes de análisis`)

      // Procesar en lotes para no sobrecargar el sistema
      const BATCH_SIZE = 5
      for (let i = 0; i < pendingActivities.length; i += BATCH_SIZE) {
        const batch = pendingActivities.slice(i, i + BATCH_SIZE)
        
        console.log(`🔄 Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendingActivities.length / BATCH_SIZE)} (${batch.length} actividades)`)
        
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

        // Pequeña pausa entre lotes para no saturar la API de OpenAI
        if (i + BATCH_SIZE < pendingActivities.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

    } catch (error) {
      console.error('❌ Error en procesamiento batch:', error)
      result.errors.push(`Error general: ${error}`)
      result.success = false
    }

    result.duration = Date.now() - startTime
    console.log(`✅ Análisis batch completado en ${result.duration}ms: ${result.generatedAnalyses}/${result.processedActivities} análisis generados`)

    return result
  }

  /**
   * Analizar una actividad específica
   */
  private async analyzeActivity(activity: any): Promise<boolean> {
    try {
      console.log(`🧠 Analizando ${activity.type} "${activity.name}" del curso ${activity.course.courseName} (Aula ${activity.aulaId})`)

      // Preparar datos para el análisis
      const analysisData = await this.prepareAnalysisData(activity)
      
      // Generar análisis con IA
      const analysisResult = await this.generateAnalysisWithAI(activity, analysisData)
      
      if (!analysisResult) {
        throw new Error('No se pudo generar análisis con IA')
      }

      // Procesar y estructurar el análisis
      const processedAnalysis = this.processAnalysisResponse(analysisResult)

      // Guardar análisis en la base de datos
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
   * Preparar datos para el análisis de IA
   */
  private async prepareAnalysisData(activity: any) {
    const analysisData: any = {
      activityInfo: {
        id: activity.activityId,
        name: activity.name,
        type: activity.type,
        description: activity.description,
        dueDate: activity.dueDate,
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
      rawData: activity.rawData,
      dataTimestamp: activity.lastDataSync
    }

    // Agregar datos específicos según el tipo de actividad
    if (activity.type === 'assign' && activity.assignmentData) {
      analysisData.assignmentDetails = activity.assignmentData
    } else if (activity.type === 'forum' && activity.forumData) {
      analysisData.forumDetails = activity.forumData
    }

    return analysisData
  }

  /**
   * Generar análisis usando IA
   */
  private async generateAnalysisWithAI(activity: any, analysisData: any): Promise<string | null> {
    try {
      // Usar prompt unificado específico por tipo de actividad
      const unifiedPrompt = this.buildUnifiedPrompt(activity, analysisData)
      
      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user", 
            content: unifiedPrompt
          }
        ],
        max_completion_tokens: 4000 // Solo parámetros soportados por GPT-5-mini
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
    const baseInfo = `
Información de la actividad:
- Nombre: ${activity.name}
- Tipo: ${this.getActivityTypeLabel(activity.type)}
- Curso: Curso ID ${activity.courseId} (Aula ${activity.aulaId})
- Fecha límite: ${activity.dueDate ? new Date(activity.dueDate).toLocaleDateString('es-ES') : 'Sin fecha límite'}
- Descripción: ${activity.description ? this.truncateText(activity.description, 500) : 'Sin descripción disponible'}

Datos de la actividad para análisis:
${JSON.stringify(analysisData, null, 2)}

---
`

    // Seleccionar instrucciones específicas según tipo de actividad
    const specificInstructions = this.getInstructionsByActivityType(activity.type)
    
    return baseInfo + specificInstructions
  }

  /**
   * Obtener instrucciones específicas según tipo de actividad
   */
  private getInstructionsByActivityType(activityType: string): string {
    switch (activityType.toLowerCase()) {
      case 'forum':
        return `Eres un asistente del docente en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las actividades en el foro de discusión. El propósito es que pueda mantener una visión clara de lo que ocurre en él y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass). Considera que en varias de las retroalimentaciones son generadas por un asistente virtual, asi que tambien puedes evaluar el comportamiento.

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
Siempre incluye insights accionables acerca de nivel de participación y si surgen dudas o temas de conversación fuera de la consigna de la discusión.`

      case 'assign':
      case 'assignment':
        return `Eres un asistente del docente en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las actividades de tareas y entregas. El propósito es que pueda mantener una visión clara del desempeño y cumplimiento de los estudiantes y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass). Considera que varias de las calificaciones y retroalimentaciones son generadas por un asistente virtual, así que también puedes evaluar ese comportamiento.

Redacta con un estilo conversacional dirigido al docente de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionables.
El análisis debe estructurarse en al menos 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
[Nombre de la dimensión]

Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
Cada hallazgo debe resaltar con negritas los elementos relevantes.
Acción sugerida: redactar una recomendación específica, breve y accionable para el docente.

Ordena las dimensiones de mayor a menor impacto.
El formato de entrega solo es markdown.
El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.
Siempre incluye insights accionables acerca de puntualidad en las entregas, calidad del trabajo entregado, patrones de reenvío y estudiantes en riesgo de no completar.`

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
El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.`
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
        summary: processedAnalysis.analysisText || processedAnalysis.summary || 'Análisis generado',
        positives: processedAnalysis.keyInsights || [],
        alerts: processedAnalysis.recommendations || [],
        insights: processedAnalysis.sections || [],
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
        
        // Datos del análisis
        summary: processedAnalysis.analysisText || processedAnalysis.summary || 'Análisis generado',
        positives: processedAnalysis.keyInsights || [],
        alerts: processedAnalysis.alerts || [],
        insights: processedAnalysis.recommendations || [],
        recommendation: processedAnalysis.summary || 'Sin recomendaciones específicas',
        fullAnalysis: processedAnalysis.analysisText,
        
        // Análisis específico por tipo
        forumAnalysis: activity.type === 'forum' ? processedAnalysis : null,
        assignAnalysis: activity.type === 'assign' ? processedAnalysis : null,
        
        // Datos originales
        activityData: inputData,
        llmResponse: processedAnalysis
      }
    })
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
}

// Singleton export
export const batchAnalysisService = BatchAnalysisService.getInstance()