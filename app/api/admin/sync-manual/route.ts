import { NextRequest, NextResponse } from 'next/server'
import { moodleSyncService } from '@/lib/services/moodle-sync-service'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🔄 [SYNC-MANUAL] Iniciando sincronización manual')

  try {
    // Ejecutar sincronización de todas las aulas configuradas
    const result = await moodleSyncService.syncAllAulas()

    const duration = Date.now() - startTime
    console.log(`✅ [SYNC-MANUAL] Sincronización completada en ${duration}ms`)

    return NextResponse.json({
      success: result.success,
      message: 'Sincronización manual completada',
      result: {
        processedAulas: result.processedAulas,
        totalCourses: result.totalCourses,
        totalActivities: result.totalActivities,
        errors: result.errors
      },
      duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [SYNC-MANUAL] Error en sincronización:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}