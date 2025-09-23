/**
 * API para control de actualizaciones automáticas
 */

import { NextRequest, NextResponse } from 'next/server'
import { cronScheduler } from '@/lib/cron/scheduler'
import { autoUpdateService } from '@/lib/services/auto-update-service'
import { batchAnalysisService } from '@/lib/services/batch-analysis-service'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()

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

      case 'test-aula-101':
        // Ejecutar análisis SOLO para aula 101 (modo prueba)
        const { courseId } = body
        const aula101Result = await batchAnalysisService.processAula101Only(courseId)

        return NextResponse.json({
          success: true,
          message: courseId ? `Análisis de Aula 101 curso ${courseId} completado` : 'Análisis de Aula 101 completado',
          result: aula101Result
        })

      case 'clear-cache':
        // Limpiar caché completo para mostrar nuevos análisis
        console.log('🧹 Iniciando limpieza de caché desde cron...')

        try {
          // 1. Limpiar análisis viejos (mantener solo los últimos 500)
          await prisma.$executeRaw`
            DELETE FROM ActivityAnalysis
            WHERE id NOT IN (
              SELECT id FROM ActivityAnalysis
              ORDER BY generatedAt DESC
              LIMIT 500
            )
          `
          console.log('✅ Análisis antiguos limpiados')

          // 2. Limpiar caché Redis
          if (process.env.REDIS_URL) {
            const redis = new Redis(process.env.REDIS_URL)
            await redis.flushdb()
            await redis.quit()
            console.log('✅ Caché Redis limpiado')
          }

          return NextResponse.json({
            success: true,
            message: 'Caché limpiado exitosamente'
          })
        } catch (error) {
          console.error('❌ Error limpiando caché:', error)
          return NextResponse.json({
            success: false,
            error: 'Error limpiando caché'
          }, { status: 500 })
        }

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