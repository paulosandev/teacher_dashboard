import { NextRequest, NextResponse } from 'next/server'
import { BatchAnalysisService } from '@/lib/services/batch-analysis-service'
import { prisma } from '@/lib/db/prisma'

/**
 * POST /api/admin/analyze-pending
 * Analizar solo las actividades que están marcadas como needsAnalysis=true
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🎯 [ANALYZE-PENDING] Iniciando análisis de actividades pendientes...')
    
    // Contar actividades pendientes
    const pendingCount = await prisma.courseActivity.count({
      where: {
        needsAnalysis: true,
        visible: true
      }
    })
    
    console.log(`📊 [ANALYZE-PENDING] ${pendingCount} actividades pendientes encontradas`)
    
    if (pendingCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay actividades pendientes de análisis',
        result: {
          processedActivities: 0,
          generatedAnalyses: 0,
          errors: []
        },
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }
    
    // Obtener actividades que necesitan análisis
    const pendingActivities = await prisma.courseActivity.findMany({
      where: {
        needsAnalysis: true,
        visible: true
      },
      include: {
        aula: true,
        course: true
      },
      orderBy: [
        { type: 'asc' }, // Procesar primero assigns, luego forums
        { lastDataSync: 'desc' } // Más recientes primero
      ]
    })
    
    console.log(`🔄 [ANALYZE-PENDING] Procesando ${pendingActivities.length} actividades pendientes`)
    
    const batchService = new BatchAnalysisService()
    const errors: string[] = []
    let processedCount = 0
    let successCount = 0
    
    // Procesar cada actividad pendiente
    for (const activity of pendingActivities) {
      try {
        console.log(`📝 [ANALYZE-PENDING] Procesando ${activity.type} "${activity.name}" (ID: ${activity.activityId})`)
        
        const success = await batchService.analyzeActivity(activity)
        
        processedCount++
        if (success) {
          successCount++
          console.log(`✅ [ANALYZE-PENDING] Completado: ${activity.type} "${activity.name}"`)
        }
        
        // Pequeña pausa para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        const errorMsg = `Error analizando ${activity.type} ${activity.activityId} del curso ${activity.courseId}: ${error}`
        console.error(`❌ [ANALYZE-PENDING] ${errorMsg}`)
        errors.push(errorMsg)
        processedCount++
        
        // Continuar con la siguiente actividad incluso si una falla
        continue
      }
    }
    
    const duration = Date.now() - startTime
    
    console.log(`🎯 [ANALYZE-PENDING] Análisis completado en ${duration}ms`)
    console.log(`📊 [ANALYZE-PENDING] Resultado: ${successCount}/${processedCount} actividades analizadas exitosamente`)
    
    if (errors.length > 0) {
      console.log(`⚠️ [ANALYZE-PENDING] ${errors.length} errores encontrados:`)
      errors.forEach(error => console.log(`   ${error}`))
    }
    
    return NextResponse.json({
      success: true,
      message: 'Análisis de actividades pendientes completado',
      result: {
        processedActivities: processedCount,
        generatedAnalyses: successCount,
        pendingBefore: pendingCount,
        errors: errors
      },
      duration,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ [ANALYZE-PENDING] Error en análisis:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Error en análisis de actividades pendientes',
      error: error instanceof Error ? error.message : 'Error desconocido',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET /api/admin/analyze-pending
 * Obtener estadísticas de actividades pendientes
 */
export async function GET(request: NextRequest) {
  try {
    const [pending, total, byType, byAula] = await Promise.all([
      // Actividades pendientes
      prisma.courseActivity.count({
        where: {
          needsAnalysis: true,
          visible: true
        }
      }),
      
      // Total de actividades
      prisma.courseActivity.count({
        where: {
          visible: true
        }
      }),
      
      // Por tipo
      prisma.courseActivity.groupBy({
        by: ['type'],
        where: {
          needsAnalysis: true,
          visible: true
        },
        _count: {
          type: true
        }
      }),
      
      // Por aula
      prisma.courseActivity.groupBy({
        by: ['aulaId'],
        where: {
          needsAnalysis: true,
          visible: true
        },
        _count: {
          aulaId: true
        }
      })
    ])
    
    const byTypeMap: Record<string, number> = {}
    byType.forEach(item => {
      byTypeMap[item.type] = item._count.type
    })
    
    const byAulaMap: Record<string, number> = {}
    byAula.forEach(item => {
      byAulaMap[item.aulaId] = item._count.aulaId
    })
    
    return NextResponse.json({
      success: true,
      data: {
        pendingActivities: pending,
        totalActivities: total,
        completionPercentage: total > 0 ? Math.round(((total - pending) / total) * 100) : 100,
        byType: byTypeMap,
        byAula: byAulaMap
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas pendientes:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}