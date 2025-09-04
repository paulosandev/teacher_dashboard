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

    // Consultar análisis pre-generados desde ActivityAnalysis
    const whereActivityAnalysis: any = {}
    
    if (courseId) {
      // El courseId viene en formato "courseId|groupId", extraer solo courseId
      const numericCourseId = courseId.includes('|') ? 
        courseId.split('|')[0] : courseId
      whereActivityAnalysis.courseId = `${aulaId}-${numericCourseId}`
    }

    if (activityId) {
      whereActivityAnalysis.activityId = activityId
    }

    if (analysisType) {
      whereActivityAnalysis.activityType = analysisType
    }

    const analyses = await prisma.activityAnalysis.findMany({
      where: whereActivityAnalysis,
      orderBy: [
        { generatedAt: 'desc' }
      ],
      take: limit
    })

    // Obtener estadísticas generales del sistema
    const totalAnalyses = await prisma.activityAnalysis.count()

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
        analyses: analyses.map(analysis => {
          // Extraer la URL de activityData si existe
          const activityUrl = analysis.activityData?.url || 
                            analysis.activityData?.activityInfo?.url ||
                            null
          
          return {
            id: analysis.id,
            aulaId: aulaId,
            courseId: analysis.courseId,
            moodleCourseId: analysis.moodleCourseId,
            activityId: analysis.activityId,
            activityName: analysis.activityName,
            activityType: analysis.activityType,
            activityUrl: activityUrl, // Incluir URL de la actividad
            analysisContent: analysis.fullAnalysis,
            summary: analysis.summary,
            keyInsights: analysis.insights,
            positives: analysis.positives,
            alerts: analysis.alerts,
            recommendation: analysis.recommendation,
            generatedAt: analysis.generatedAt
          }
        }),
        count: analyses.length,
        hasMore: analyses.length === limit
      },
      systemStats: {
        totalAnalyses,
        aulaName: `Aula ${aulaId}`
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