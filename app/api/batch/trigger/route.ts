/**
 * API Endpoint para ejecutar manualmente el proceso batch
 * Útil para disparar sincronización y análisis en producción sin esperar el cron
 */

import { NextRequest, NextResponse } from 'next/server'
import { autoUpdateService } from '@/lib/services/auto-update-service'
import { headers } from 'next/headers'

// Token secreto para proteger el endpoint en producción
const BATCH_SECRET = process.env.BATCH_SECRET || 'default-batch-secret-change-in-production'

export async function POST(request: NextRequest) {
  try {
    // Verificar autorización mediante header secreto o query param
    const headersList = headers()
    const authHeader = headersList.get('x-batch-secret')
    const { searchParams } = new URL(request.url)
    const querySecret = searchParams.get('secret')

    // Verificar el secreto
    if (authHeader !== BATCH_SECRET && querySecret !== BATCH_SECRET) {
      console.log('❌ Intento no autorizado de ejecutar batch process')
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener parámetros opcionales
    const body = await request.json().catch(() => ({}))
    const {
      aulaIds = null, // Array de aulas específicas o null para todas
      forceAnalysis = false, // Forzar re-análisis aunque ya exista
      onlyAnalysis = false, // Solo ejecutar análisis, sin sincronización
      priority = 'normal' // 'normal', 'high', 'low'
    } = body

    console.log('🚀 ===== PROCESO BATCH MANUAL INICIADO =====')
    console.log('📋 Parámetros:', {
      aulaIds,
      forceAnalysis,
      onlyAnalysis,
      priority,
      timestamp: new Date().toISOString()
    })

    // Verificar si ya hay un proceso en ejecución
    if (autoUpdateService.isUpdating) {
      return NextResponse.json({
        success: false,
        error: 'Ya hay un proceso batch en ejecución',
        currentStatus: autoUpdateService.getStatus()
      }, { status: 409 })
    }

    // Ejecutar el proceso batch
    const startTime = Date.now()

    if (onlyAnalysis) {
      // Solo ejecutar análisis sin sincronización
      console.log('🧠 Ejecutando solo análisis (sin sincronización)...')
      await autoUpdateService.runAnalysisOnly({
        aulaIds,
        forceReAnalysis: forceAnalysis
      })
    } else {
      // Ejecutar proceso completo
      console.log('🔄 Ejecutando proceso batch completo...')
      await autoUpdateService.executeBatchProcess({
        source: 'MANUAL_API',
        aulaIds,
        forceAnalysis
      })
    }

    const duration = Date.now() - startTime
    const status = autoUpdateService.getStatus()

    console.log('✅ Proceso batch manual completado')
    console.log(`⏱️ Duración: ${(duration / 1000).toFixed(2)} segundos`)

    return NextResponse.json({
      success: true,
      message: 'Proceso batch ejecutado exitosamente',
      duration: `${(duration / 1000).toFixed(2)}s`,
      status: status,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error ejecutando proceso batch manual:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Endpoint GET para verificar estado actual
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const querySecret = searchParams.get('secret')

    // Verificar el secreto
    if (querySecret !== BATCH_SECRET) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const status = autoUpdateService.getStatus()

    return NextResponse.json({
      success: true,
      status: status,
      isUpdating: autoUpdateService.isUpdating,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error obteniendo estado:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}