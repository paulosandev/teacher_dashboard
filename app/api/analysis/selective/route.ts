/**
 * API para análisis selectivo de actividades específicas
 * Permite analizar actividades ya guardadas por aula, curso o tipo
 */

import { NextRequest, NextResponse } from 'next/server'
import { batchAnalysisService } from '@/lib/services/batch-analysis-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      aulaId,
      courseId,
      activityType,
      activityIds,
      forceReAnalysis = false
    } = body

    // Validar que al menos un filtro esté presente
    if (!aulaId && !courseId && !activityType && (!activityIds || activityIds.length === 0)) {
      return NextResponse.json(
        {
          error: 'Debe especificar al menos un filtro: aulaId, courseId, activityType o activityIds',
          success: false
        },
        { status: 400 }
      )
    }

    console.log('🎯 Iniciando análisis selectivo con filtros:', {
      aulaId,
      courseId,
      activityType,
      activityIds: activityIds?.length || 0,
      forceReAnalysis
    })

    // Ejecutar análisis selectivo
    const result = await batchAnalysisService.analyzeSpecificActivities({
      aulaId,
      courseId,
      activityType,
      activityIds,
      forceReAnalysis
    })

    return NextResponse.json({
      success: result.success,
      message: `Análisis selectivo completado: ${result.generatedAnalyses}/${result.processedActivities} actividades analizadas`,
      data: {
        processedActivities: result.processedActivities,
        generatedAnalyses: result.generatedAnalyses,
        errors: result.errors,
        duration: `${(result.duration / 1000).toFixed(2)}s`
      }
    })

  } catch (error) {
    console.error('❌ Error en análisis selectivo:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor durante análisis selectivo',
        details: error instanceof Error ? error.message : 'Error desconocido',
        success: false
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const aulaId = searchParams.get('aulaId')
    const courseId = searchParams.get('courseId')
    const activityType = searchParams.get('activityType')

    // Obtener lista de actividades disponibles
    const activities = await batchAnalysisService.getAvailableActivitiesForAnalysis({
      aulaId: aulaId || undefined,
      courseId: courseId || undefined,
      activityType: activityType || undefined
    })

    // Agrupar por aula y curso para mejor organización
    const groupedActivities = activities.reduce((acc, activity) => {
      const aulaKey = activity.aulaId
      const courseKey = `${activity.courseId}-${activity.courseName || 'Sin nombre'}`

      if (!acc[aulaKey]) {
        acc[aulaKey] = {}
      }

      if (!acc[aulaKey][courseKey]) {
        acc[aulaKey][courseKey] = []
      }

      acc[aulaKey][courseKey].push(activity)

      return acc
    }, {} as Record<string, Record<string, typeof activities>>)

    // Estadísticas generales
    const stats = {
      totalActivities: activities.length,
      needingAnalysis: activities.filter(a => a.needsAnalysis).length,
      byType: activities.reduce((acc, activity) => {
        acc[activity.activityType] = (acc[activity.activityType] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byAula: Object.keys(groupedActivities).reduce((acc, aula) => {
        acc[aula] = Object.values(groupedActivities[aula]).flat().length
        return acc
      }, {} as Record<string, number>)
    }

    return NextResponse.json({
      success: true,
      data: {
        activities: groupedActivities,
        stats,
        filters: {
          aulaId: aulaId || 'todas',
          courseId: courseId || 'todos',
          activityType: activityType || 'todos'
        }
      }
    })

  } catch (error) {
    console.error('❌ Error obteniendo actividades disponibles:', error)
    return NextResponse.json(
      {
        error: 'Error obteniendo lista de actividades disponibles',
        details: error instanceof Error ? error.message : 'Error desconocido',
        success: false
      },
      { status: 500 }
    )
  }
}