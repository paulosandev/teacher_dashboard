import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export async function GET() {
  try {
    console.log('📊 [STATUS] Consultando estado del sistema batch')

    // Obtener estadísticas generales más simples
    const totalActivities = await prisma.courseActivity.count()
    const activitiesNeedingAnalysis = await prisma.courseActivity.count({
      where: { needsAnalysis: true }
    })

    // Estadísticas por aula más simples
    const aulaStats = await prisma.aula.findMany({
      select: {
        aulaId: true,
        name: true,
        lastSync: true,
        _count: {
          select: {
            courses: true
          }
        }
      }
    })

    // Por ahora usar valores simplificados
    const aulaAnalysisMap = {} as Record<string, number>

    // Procesar estadísticas detalladas
    const detailedStats = aulaStats.map(aula => {      
      return {
        aulaId: aula.aulaId,
        name: aula.name,
        coursesCount: aula._count.courses,
        activitiesCount: 0, // Simplificado por ahora
        analyzedCount: aulaAnalysisMap[aula.aulaId] || 0,
        pendingCount: 0, // Simplificado por ahora
        lastSync: aula.lastSync,
        completionPercentage: 0 // Simplificado por ahora
      }
    })

    // Análisis recientes simplificados por ahora
    const recentAnalyses = [] as any[]

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalActivities,
        analyzedActivities: totalActivities - activitiesNeedingAnalysis, // Calculado
        pendingActivities: activitiesNeedingAnalysis,
        completionPercentage: totalActivities > 0 
          ? Math.round(((totalActivities - activitiesNeedingAnalysis) / totalActivities) * 100) 
          : 0
      },
      aulaBreakdown: detailedStats,
      recentAnalyses,
      systemStatus: {
        isProcessing: activitiesNeedingAnalysis > 0,
        totalAulas: aulaStats.length,
        lastUpdate: new Date().toISOString()
      }
    }

    console.log(`✅ [STATUS] Estado consultado: ${totalActivities - activitiesNeedingAnalysis}/${totalActivities} análisis completados`)
    
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [STATUS] Error consultando estado:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}