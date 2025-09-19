import { NextResponse } from 'next/server'

/**
 * Endpoint de estado de sincronización para el dashboard
 * Versión simplificada del endpoint de status
 */
export async function GET() {
  try {
    console.log('📊 [SYNC-STATUS] Consultando estado de sincronización')

    // Por ahora devolver un estado básico
    // Este endpoint puede expandirse según las necesidades del dashboard
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      syncStatus: {
        isActive: false,
        lastSync: new Date().toISOString(),
        progress: 100,
        message: 'Sistema iniciado'
      },
      dashboard: {
        ready: true,
        coursesLoaded: false,
        error: null
      }
    }

    console.log('✅ [SYNC-STATUS] Estado consultado exitosamente')

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ [SYNC-STATUS] Error consultando estado:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}