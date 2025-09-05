import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const aulaId = searchParams.get('aulaId')
    const courseId = searchParams.get('courseId')
    const activityId = searchParams.get('activityId')
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    
    console.log('🔍 [ANALYSES] Consultando análisis:', { aulaId, courseId, activityId, limit })

    let whereClause: any = {}
    
    if (aulaId) {
      whereClause.courseId = { startsWith: `${aulaId}-` }
    }
    
    if (courseId) {
      whereClause.moodleCourseId = courseId
    }
    
    if (activityId) {
      whereClause.activityId = activityId
    }

    // Obtener los análisis (ActivityAnalysis no tiene relación con CourseActivity)
    const analyses = await prisma.activityAnalysis.findMany({
      where: whereClause,
      orderBy: [
        { id: 'desc' }
      ],
      take: limit
    })

    // Agrupar por actividad para mejor visualización
    const groupedByActivity = analyses.reduce((acc, analysis) => {
      const aulaId = analysis.courseId.split('-')[0] // Extraer aulaId de courseId
      const key = `${aulaId}-${analysis.moodleCourseId}-${analysis.activityId}`
      if (!acc[key]) {
        acc[key] = {
          aulaId: aulaId,
          courseId: analysis.moodleCourseId,
          activityId: analysis.activityId,
          activityName: analysis.activityName,
          activityType: analysis.activityType,
          analyses: []
        }
      }
      acc[key].analyses.push({
        id: analysis.id,
        summary: analysis.summary,
        recommendation: analysis.recommendation,
        fullAnalysis: analysis.fullAnalysis,
        generatedAt: analysis.generatedAt
      })
      return acc
    }, {} as Record<string, any>)

    // Estadísticas
    const stats = {
      total: analyses.length,
      byAula: {} as Record<string, number>,
      byCourse: {} as Record<string, number>,
      byActivityType: {} as Record<string, number>,
      recentAnalyses: analyses.slice(0, 5).map(a => ({
        activity: a.activityName,
        id: a.id,
        type: a.activityType
      }))
    }

    analyses.forEach(analysis => {
      const aulaId = analysis.courseId.split('-')[0]
      stats.byAula[aulaId] = (stats.byAula[aulaId] || 0) + 1
      stats.byCourse[analysis.moodleCourseId] = (stats.byCourse[analysis.moodleCourseId] || 0) + 1
      stats.byActivityType[analysis.activityType] = (stats.byActivityType[analysis.activityType] || 0) + 1
    })

    console.log(`✅ [ANALYSES] Encontrados ${analyses.length} análisis`)

    return NextResponse.json({
      success: true,
      filters: { aulaId, courseId, activityId, limit },
      stats,
      analyses: Object.values(groupedByActivity),
      rawAnalyses: analyses, // También incluir los análisis sin agrupar
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [ANALYSES] Error consultando análisis:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}