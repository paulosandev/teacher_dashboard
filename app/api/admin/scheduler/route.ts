import { NextRequest, NextResponse } from 'next/server'
import { 
  setupHourlyUpdates, 
  stopHourlyUpdates, 
  getAutoUpdateQueueStatus,
  autoUpdateQueue 
} from '@/lib/schedulers/auto-update-scheduler'

export async function GET() {
  try {
    const status = await getAutoUpdateQueueStatus()
    
    return NextResponse.json({
      success: true,
      scheduler: {
        status: status ? 'running' : 'error',
        ...status
      }
    })
  } catch (error) {
    console.error('❌ Error obteniendo estado del scheduler:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json()

    switch (action) {
      case 'start':
        await setupHourlyUpdates()
        return NextResponse.json({
          success: true,
          message: 'Actualizaciones automáticas iniciadas'
        })

      case 'stop':
        await stopHourlyUpdates()
        return NextResponse.json({
          success: true,
          message: 'Actualizaciones automáticas detenidas'
        })

      case 'trigger':
        // Ejecutar una actualización inmediata
        await autoUpdateQueue.add(
          'manual-trigger',
          {
            type: 'manual',
            triggeredAt: new Date().toISOString()
          }
        )
        return NextResponse.json({
          success: true,
          message: 'Actualización manual programada'
        })

      case 'status':
        const status = await getAutoUpdateQueueStatus()
        return NextResponse.json({
          success: true,
          status
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida. Use: start, stop, trigger, status'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ Error en endpoint del scheduler:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    }, { status: 500 })
  }
}