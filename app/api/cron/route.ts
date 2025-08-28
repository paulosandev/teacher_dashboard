/**
 * API para control de actualizaciones automáticas
 */

import { NextRequest, NextResponse } from 'next/server'
import { cronScheduler } from '@/lib/cron/scheduler'
import { autoUpdateService } from '@/lib/services/auto-update-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

// GET - Obtener estado del sistema
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'status':
        // Estado del sistema
        return NextResponse.json({
          success: true,
          status: cronScheduler.getStatus(),
          timestamp: new Date().toISOString()
        })

      case 'logs':
        // Obtener logs de actualizaciones
        const limit = parseInt(searchParams.get('limit') || '10')
        const logs = await autoUpdateService.getLogs(limit)
        
        return NextResponse.json({
          success: true,
          logs,
          count: logs.length
        })

      case 'next':
        // Próximas actualizaciones programadas
        const status = autoUpdateService.getStatus()
        
        return NextResponse.json({
          success: true,
          nextUpdates: status.nextScheduledUpdates,
          lastUpdate: status.lastUpdate,
          isUpdating: status.isUpdating
        })

      default:
        // Estado general
        return NextResponse.json({
          success: true,
          scheduler: cronScheduler.getStatus(),
          service: autoUpdateService.getStatus(),
          serverTime: new Date().toISOString(),
          timezone: process.env.TZ || 'America/Mexico_City'
        })
    }
  } catch (error) {
    console.error('Error en GET /api/cron:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

// POST - Controlar actualizaciones
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación (solo admin o con token especial)
    const session = await getServerSession(authOptions)
    const authHeader = request.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET_KEY
    
    // Verificar autorización
    if (!session?.user && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'start':
        // Inicializar scheduler
        cronScheduler.initialize()
        
        return NextResponse.json({
          success: true,
          message: 'Scheduler iniciado',
          status: cronScheduler.getStatus()
        })

      case 'stop':
        // Detener scheduler
        cronScheduler.stop()
        
        return NextResponse.json({
          success: true,
          message: 'Scheduler detenido',
          status: cronScheduler.getStatus()
        })

      case 'restart':
        // Reiniciar scheduler
        cronScheduler.restart()
        
        return NextResponse.json({
          success: true,
          message: 'Scheduler reiniciado',
          status: cronScheduler.getStatus()
        })

      case 'trigger':
        // Ejecutar actualización manual
        const result = await cronScheduler.triggerManualUpdate()
        
        return NextResponse.json({
          success: true,
          message: 'Actualización manual ejecutada',
          result
        })

      case 'validate':
        // Validar que los jobs están funcionando
        const isValid = cronScheduler.validateJobs()
        
        return NextResponse.json({
          success: true,
          valid: isValid,
          status: cronScheduler.getStatus()
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Error en POST /api/cron:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}