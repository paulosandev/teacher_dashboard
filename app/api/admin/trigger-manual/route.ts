import { NextResponse } from 'next/server'
import { autoUpdateService } from '@/lib/services/auto-update-service'

export async function POST() {
  try {
    console.log('🔧 [MANUAL] Ejecutando actualización manual completa desde API...')
    console.log('🔄 [MANUAL] Usando sistema unificado (misma lógica que automático)')
    
    // IMPORTANTE: Ahora SIEMPRE usar el sistema unificado AutoUpdateService
    // que incluye sincronización completa + análisis profundo
    const result = await autoUpdateService.executeUpdate('manual')
    
    console.log('✅ [MANUAL] Actualización manual completada con sistema unificado')
    
    return NextResponse.json({
      success: true,
      message: 'Actualización manual ejecutada exitosamente usando sistema unificado',
      result,
      unifiedSystem: true, // Indicar que se usó sistema unificado
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [MANUAL] Error en actualización manual:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}