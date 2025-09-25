/**
 * Servicio para marcar actividades válidas que necesitan análisis
 * Se ejecuta antes del cron principal para asegurar análisis actualizados
 */

import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export class ActivityMarkingService {
  private static instance: ActivityMarkingService

  static getInstance(): ActivityMarkingService {
    if (!this.instance) {
      this.instance = new ActivityMarkingService()
    }
    return this.instance
  }

  /**
   * Marcar actividades válidas que necesitan análisis
   * Marca TODAS las actividades que estén en fechas válidas para actualización constante
   */
  async markValidActivitiesForAnalysis(): Promise<{
    success: boolean
    markedActivities: number
    errors: string[]
    duration: number
  }> {
    const startTime = Date.now()
    const result = {
      success: true,
      markedActivities: 0,
      errors: [] as string[],
      duration: 0
    }

    try {
      const now = new Date()

      console.log('🔍 Marcando TODAS las actividades válidas para análisis...')

      // Marcar TODAS las actividades que estén en fechas válidas
      const marked = await prisma.courseActivity.updateMany({
        where: {
          needsAnalysis: false,
          visible: true,
          // Actividad debe haber comenzado (openDate <= now OR openDate is null)
          OR: [
            { openDate: null },
            { openDate: { lte: now } }
          ],
          // Actividad no debe haber terminado (closeDate > now OR closeDate is null)
          AND: [
            {
              OR: [
                { closeDate: null },
                { closeDate: { gt: now } }
              ]
            }
          ]
        },
        data: {
          needsAnalysis: true
        }
      })

      result.markedActivities = marked.count
      console.log(`✅ Marcadas ${marked.count} actividades válidas para análisis`)

      // Estadísticas finales
      const totalPending = await prisma.courseActivity.count({
        where: { needsAnalysis: true }
      })

      console.log(`📊 Total de actividades pendientes de análisis: ${totalPending}`)

    } catch (error) {
      console.error('❌ Error marcando actividades:', error)
      result.errors.push(`Error general: ${error}`)
      result.success = false
    }

    result.duration = Date.now() - startTime
    console.log(`✅ Marcado completado en ${result.duration}ms`)

    return result
  }

  /**
   * Marcar actividades específicas por aula
   */
  async markActivitiesByAula(aulaId: string): Promise<{
    success: boolean
    markedActivities: number
    errors: string[]
  }> {
    const result = {
      success: true,
      markedActivities: 0,
      errors: [] as string[]
    }

    try {
      const now = new Date()

      console.log(`🎯 Marcando actividades del aula ${aulaId} para análisis...`)

      const marked = await prisma.courseActivity.updateMany({
        where: {
          aulaId: aulaId,
          needsAnalysis: false,
          visible: true,
          // Actividades activas (mismas reglas de fecha)
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
        },
        data: {
          needsAnalysis: true
        }
      })

      result.markedActivities = marked.count
      console.log(`✅ Marcadas ${marked.count} actividades del aula ${aulaId}`)

    } catch (error) {
      console.error(`❌ Error marcando actividades del aula ${aulaId}:`, error)
      result.errors.push(`Error en aula ${aulaId}: ${error}`)
      result.success = false
    }

    return result
  }

  /**
   * Obtener estadísticas de actividades
   */
  async getActivityStats() {
    try {
      const now = new Date()

      const stats = await prisma.courseActivity.groupBy({
        by: ['aulaId', 'needsAnalysis'],
        _count: true,
        where: {
          visible: true,
          // Solo actividades activas
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
      })

      const result: any = {}

      stats.forEach(stat => {
        if (!result[stat.aulaId]) {
          result[stat.aulaId] = { pending: 0, analyzed: 0 }
        }

        if (stat.needsAnalysis) {
          result[stat.aulaId].pending = stat._count
        } else {
          result[stat.aulaId].analyzed = stat._count
        }
      })

      return result

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error)
      return {}
    }
  }
}

// Singleton export
export const activityMarkingService = ActivityMarkingService.getInstance()