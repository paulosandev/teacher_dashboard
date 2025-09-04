/**
 * API endpoint temporal para consultar análisis pre-generados sin autenticación
 * Para testing y desarrollo del sistema batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const aulaId = searchParams.get('aulaId') || 'av141' // Default para testing
    const courseId = searchParams.get('courseId')
    const activityId = searchParams.get('activityId')
    const analysisType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')
    const onlyLatest = searchParams.get('latest') !== 'false' // Default true

    console.log(`🔍 [TEST] Consultando análisis para aula: ${aulaId}`)

    // Construir filtros para la consulta
    const whereClause: any = {
      aulaId: aulaId,
      expiresAt: {
        gt: new Date()
      }
    }

    if (onlyLatest) {
      whereClause.isLatest = true
    }

    if (courseId) {
      const numericCourseId = courseId.includes('|') ? 
        parseInt(courseId.split('|')[0]) : parseInt(courseId)
      whereClause.courseId = numericCourseId
    }

    if (activityId) {
      whereClause.activityId = parseInt(activityId)
    }

    if (analysisType) {
      whereClause.analysisType = analysisType
    }

    // Consultar análisis pre-generados
    const analyses = await prisma.batchAnalysis.findMany({
      where: whereClause,
      include: {
        aula: {
          select: {
            aulaId: true,
            name: true
          }
        },
        course: {
          select: {
            courseId: true,
            courseName: true,
            shortName: true
          }
        },
        activity: {
          select: {
            activityId: true,
            name: true,
            type: true,
            dueDate: true
          }
        }
      },
      orderBy: [
        { isLatest: 'desc' },
        { generatedAt: 'desc' }
      ],
      take: limit
    })

    // Obtener estadísticas generales del sistema
    const [totalAnalyses, totalActivities, totalCourses] = await Promise.all([
      prisma.batchAnalysis.count({
        where: { 
          aulaId: aulaId,
          expiresAt: { gt: new Date() }
        }
      }),
      
      prisma.courseActivity.count({
        where: { aulaId: aulaId }
      }),
      
      prisma.aulaCourse.count({
        where: { 
          aulaId: aulaId,
          isActive: true
        }
      })
    ])

    const response = {
      success: true,
      testMode: true,
      aulaId: aulaId,
      filters: {
        courseId,
        activityId,
        analysisType,
        onlyLatest,
        limit
      },
      results: {
        analyses: analyses.map(analysis => ({
          id: analysis.id,
          aulaId: analysis.aulaId,
          courseId: analysis.courseId,
          courseName: analysis.course.courseName,
          activityId: analysis.activityId,
          activityName: analysis.activity?.name,
          activityType: analysis.activityType,
          analysisType: analysis.analysisType,
          analysisScope: analysis.analysisScope,
          analysisText: analysis.analysisText,
          summary: analysis.summary,
          keyInsights: analysis.keyInsights,
          recommendations: analysis.recommendations,
          sections: analysis.sections,
          confidence: analysis.confidence,
          generatedAt: analysis.generatedAt,
          isLatest: analysis.isLatest
        })),
        count: analyses.length,
        hasMore: analyses.length === limit
      },
      systemStats: {
        totalAnalyses,
        totalActivities,
        totalCourses,
        aulaName: analyses[0]?.aula?.name || `Aula ${aulaId}`
      },
      timestamp: new Date().toISOString(),
      queryTime: Date.now() - startTime
    }

    console.log(`✅ [TEST] Consulta completada: ${analyses.length} análisis en ${response.queryTime}ms`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [TEST] Error consultando análisis:', error)

    return NextResponse.json({
      success: false,
      testMode: true,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString(),
      queryTime: Date.now() - startTime
    }, { status: 500 })
  }
}