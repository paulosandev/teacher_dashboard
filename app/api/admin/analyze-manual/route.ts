import { NextRequest, NextResponse } from 'next/server'
import { batchAnalysisService } from '@/lib/services/batch-analysis-service'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🧠 [ANALYZE-MANUAL] Iniciando análisis batch manual')

  try {
    // Ejecutar análisis de todas las actividades pendientes
    const result = await batchAnalysisService.processAllPendingAnalyses()

    const duration = Date.now() - startTime
    console.log(`✅ [ANALYZE-MANUAL] Análisis completado en ${duration}ms`)

    return NextResponse.json({
      success: result.success,
      message: 'Análisis batch manual completado',
      result: {
        processedActivities: result.processedActivities,
        generatedAnalyses: result.generatedAnalyses,
        errors: result.errors
      },
      duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [ANALYZE-MANUAL] Error en análisis:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}