/**
 * API endpoint para consultar análisis pre-generados filtrados por profesor
 * Reemplaza el sistema de análisis en tiempo real con datos batch procesados
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user?.aulaInfo) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado o información de aula no disponible'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const groupId = searchParams.get('groupId') 
    const activityId = searchParams.get('activityId')
    const analysisType = searchParams.get('type') // 'COURSE_OVERVIEW', 'ACTIVITY_ANALYSIS', etc.
    const limit = parseInt(searchParams.get('limit') || '50')
    const onlyLatest = searchParams.get('latest') === 'true'

    // Detectar aula del profesor desde la sesión
    const professorAula = session.user.aulaInfo.primaryAula
    if (!professorAula) {
      return NextResponse.json({
        success: false,
        error: 'Aula del profesor no identificada'
      }, { status: 400 })
    }

    console.log(`🔍 Consultando análisis pre-generados para profesor en aula: ${professorAula}`)
    console.log(`📋 Filtros: courseId=${courseId}, groupId=${groupId}, activityId=${activityId}, type=${analysisType}`)

    // Construir filtros para la consulta
    const whereClause: any = {
      aulaId: professorAula,
      // Solo análisis válidos y no expirados
      expiresAt: {
        gt: new Date()
      }
    }

    if (onlyLatest) {
      whereClause.isLatest = true
    }

    if (courseId) {
      // Extraer solo el ID numérico si viene en formato "courseId|groupId"
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

    // Procesar y estructurar los resultados
    const processedAnalyses = analyses.map(analysis => ({
      id: analysis.id,
      aulaId: analysis.aulaId,
      aulaName: analysis.aula.name,
      courseId: analysis.courseId,
      courseName: analysis.course.courseName,
      courseShortName: analysis.course.shortName,
      activityId: analysis.activityId,
      activityName: analysis.activity?.name,
      activityType: analysis.activityType,
      activityDueDate: analysis.activity?.dueDate,
      analysisType: analysis.analysisType,
      analysisScope: analysis.analysisScope,
      
      // Contenido del análisis
      analysisText: analysis.analysisText,
      summary: analysis.summary,
      keyInsights: analysis.keyInsights,
      recommendations: analysis.recommendations,
      alertFlags: analysis.alertFlags,
      sections: analysis.sections,
      
      // Metadatos
      confidence: analysis.confidence,
      dataCompleteness: analysis.dataCompleteness,
      studentsAnalyzed: analysis.studentsAnalyzed,
      generatedAt: analysis.generatedAt,
      expiresAt: analysis.expiresAt,
      isLatest: analysis.isLatest
    }))

    // Agrupar por tipo de análisis para mejor organización
    const analysesByType = processedAnalyses.reduce((acc, analysis) => {
      const type = analysis.analysisType || 'GENERAL'
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(analysis)
      return acc
    }, {} as Record<string, typeof processedAnalyses>)

    // Obtener estadísticas adicionales
    const [totalCount, courseOverviews, activityAnalyses, recentCount] = await Promise.all([
      // Total de análisis para este profesor/aula
      prisma.batchAnalysis.count({
        where: { 
          aulaId: professorAula,
          expiresAt: { gt: new Date() }
        }
      }),
      
      // Análisis de cursos completos
      prisma.batchAnalysis.count({
        where: { 
          aulaId: professorAula,
          analysisType: 'COURSE_OVERVIEW',
          isLatest: true,
          expiresAt: { gt: new Date() }
        }
      }),
      
      // Análisis de actividades específicas
      prisma.batchAnalysis.count({
        where: { 
          aulaId: professorAula,
          analysisScope: 'ACTIVITY',
          isLatest: true,
          expiresAt: { gt: new Date() }
        }
      }),
      
      // Análisis generados en las últimas 24 horas
      prisma.batchAnalysis.count({
        where: { 
          aulaId: professorAula,
          generatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          },
          expiresAt: { gt: new Date() }
        }
      })
    ])

    const response = {
      success: true,
      professorAula: professorAula,
      filters: {
        courseId,
        groupId,
        activityId,
        analysisType,
        onlyLatest,
        limit
      },
      results: {
        analyses: processedAnalyses,
        analysesByType,
        count: processedAnalyses.length,
        hasMore: processedAnalyses.length === limit
      },
      stats: {
        totalAnalyses: totalCount,
        courseOverviews,
        activityAnalyses,
        recentAnalyses: recentCount
      },
      timestamp: new Date().toISOString(),
      queryTime: Date.now() - startTime
    }

    console.log(`✅ Consulta completada: ${processedAnalyses.length} análisis encontrados en ${response.queryTime}ms`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error consultando análisis del profesor:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString(),
      queryTime: Date.now() - startTime
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user?.aulaInfo) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado o información de aula no disponible'
      }, { status: 401 })
    }

    const body = await request.json()
    const { 
      courseIds = [], 
      activityIds = [], 
      analysisTypes = [],
      scope = 'ACTIVITY' // 'ACTIVITY', 'COURSE', 'BATCH'
    } = body

    const professorAula = session.user.aulaInfo.primaryAula
    if (!professorAula) {
      return NextResponse.json({
        success: false,
        error: 'Aula del profesor no identificada'
      }, { status: 400 })
    }

    console.log(`🔍 Consulta batch de análisis para aula: ${professorAula}`)
    console.log(`📋 Cursos: ${courseIds.length}, Actividades: ${activityIds.length}, Tipos: ${analysisTypes.length}`)

    const whereClause: any = {
      aulaId: professorAula,
      isLatest: true,
      expiresAt: {
        gt: new Date()
      }
    }

    if (courseIds.length > 0) {
      whereClause.courseId = {
        in: courseIds.map((id: string) => parseInt(id))
      }
    }

    if (activityIds.length > 0) {
      whereClause.activityId = {
        in: activityIds.map((id: string) => parseInt(id))
      }
    }

    if (analysisTypes.length > 0) {
      whereClause.analysisType = {
        in: analysisTypes
      }
    }

    if (scope) {
      whereClause.analysisScope = scope
    }

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
        { courseId: 'asc' },
        { activityId: 'asc' },
        { generatedAt: 'desc' }
      ]
    })

    const response = {
      success: true,
      professorAula,
      scope,
      results: analyses.map(analysis => ({
        id: analysis.id,
        courseId: analysis.courseId,
        courseName: analysis.course.courseName,
        activityId: analysis.activityId,
        activityName: analysis.activity?.name,
        activityType: analysis.activityType,
        analysisType: analysis.analysisType,
        analysisText: analysis.analysisText,
        summary: analysis.summary,
        keyInsights: analysis.keyInsights,
        recommendations: analysis.recommendations,
        sections: analysis.sections,
        confidence: analysis.confidence,
        generatedAt: analysis.generatedAt
      })),
      count: analyses.length,
      timestamp: new Date().toISOString(),
      queryTime: Date.now() - startTime
    }

    console.log(`✅ Consulta batch completada: ${analyses.length} análisis en ${response.queryTime}ms`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error en consulta batch de análisis:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString(),
      queryTime: Date.now() - startTime
    }, { status: 500 })
  }
}