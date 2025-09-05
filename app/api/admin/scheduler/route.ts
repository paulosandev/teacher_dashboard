import { NextRequest, NextResponse } from 'next/server'
import { cronScheduler } from '@/lib/cron/scheduler'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = cronScheduler.getStatus()
    
    return NextResponse.json({
      success: true,
      scheduler: status
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
        cronScheduler.initialize()
        return NextResponse.json({
          success: true,
          message: 'Cron scheduler iniciado',
          status: cronScheduler.getStatus()
        })

      case 'stop':
        cronScheduler.stop()
        return NextResponse.json({
          success: true,
          message: 'Cron scheduler detenido',
          status: cronScheduler.getStatus()
        })

      case 'restart':
        cronScheduler.restart()
        return NextResponse.json({
          success: true,
          message: 'Cron scheduler reiniciado',
          status: cronScheduler.getStatus()
        })

      case 'trigger':
        const result = await cronScheduler.triggerManualUpdate()
        return NextResponse.json({
          success: true,
          message: 'Actualización manual ejecutada',
          result
        })

      case 'status':
        const status = cronScheduler.getStatus()
        return NextResponse.json({
          success: true,
          status
        })

      case 'validate':
        const isValid = cronScheduler.validateJobs()
        return NextResponse.json({
          success: true,
          valid: isValid,
          status: cronScheduler.getStatus()
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida. Use: start, stop, restart, trigger, status, validate'
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