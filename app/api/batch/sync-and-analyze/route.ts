/**
 * API endpoint para ejecutar sincronización y análisis batch
 * Ejecuta el proceso completo: sync de datos + análisis con IA
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { moodleSyncService } from '@/lib/services/moodle-sync-service'
import { batchAnalysisService } from '@/lib/services/batch-analysis-service'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🚀 Iniciando proceso batch completo: sync + análisis')

  try {
    // Crear registro del job batch
    const batchJob = await prisma.batchJob.create({
      data: {
        jobType: 'FULL_SYNC',
        scope: 'ALL_AULAS',
        status: 'RUNNING',
        priority: 1,
        triggeredBy: 'API',
        startedAt: new Date()
      }
    })

    let currentStep = 0
    const totalSteps = 3 // sync + análisis + limpieza

    try {
      // Paso 1: Sincronización de datos de Moodle
      console.log('📡 Paso 1/3: Sincronizando datos de todas las aulas')
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: { currentStep: ++currentStep }
      })

      const syncResult = await moodleSyncService.syncAllAulas()
      
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: {
          processedAulas: syncResult.processedAulas,
          processedCourses: syncResult.totalCourses,
          processedActivities: syncResult.totalActivities
        }
      })

      if (!syncResult.success) {
        throw new Error(`Errores en sincronización: ${syncResult.errors.join(', ')}`)
      }

      console.log(`✅ Sincronización completada: ${syncResult.processedAulas} aulas, ${syncResult.totalCourses} cursos, ${syncResult.totalActivities} actividades`)

      // Paso 2: Análisis con IA
      console.log('🧠 Paso 2/3: Generando análisis con IA')
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: { currentStep: ++currentStep }
      })

      const analysisResult = await batchAnalysisService.processAllPendingAnalyses()
      
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: {
          generatedAnalyses: analysisResult.generatedAnalyses,
          successCount: analysisResult.generatedAnalyses,
          errorCount: analysisResult.errors.length
        }
      })

      if (!analysisResult.success) {
        throw new Error(`Errores en análisis: ${analysisResult.errors.join(', ')}`)
      }

      console.log(`✅ Análisis completado: ${analysisResult.generatedAnalyses}/${analysisResult.processedActivities} análisis generados`)

      // Paso 3: Limpieza de análisis expirados
      console.log('🧹 Paso 3/3: Limpiando análisis expirados')
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: { currentStep: ++currentStep }
      })

      const cleanupResult = await prisma.batchAnalysis.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          },
          isLatest: false
        }
      })

      console.log(`🧹 Limpieza completada: ${cleanupResult.count} análisis expirados eliminados`)

      // Marcar job como completado
      const duration = Date.now() - startTime
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          duration: duration,
          totalSteps: totalSteps,
          summary: {
            syncResult,
            analysisResult,
            cleanupCount: cleanupResult.count,
            totalDuration: duration
          }
        }
      })

      // Obtener estadísticas finales
      const [syncStats, analysisStats] = await Promise.all([
        moodleSyncService.getSyncStats(),
        batchAnalysisService.getAnalysisStats()
      ])

      const response = {
        success: true,
        jobId: batchJob.id,
        duration: duration,
        timestamp: new Date().toISOString(),
        results: {
          sync: {
            processedAulas: syncResult.processedAulas,
            totalCourses: syncResult.totalCourses,
            totalActivities: syncResult.totalActivities,
            errors: syncResult.errors
          },
          analysis: {
            processedActivities: analysisResult.processedActivities,
            generatedAnalyses: analysisResult.generatedAnalyses,
            errors: analysisResult.errors,
            analysisDuration: analysisResult.duration
          },
          cleanup: {
            expiredAnalysesRemoved: cleanupResult.count
          }
        },
        stats: {
          sync: syncStats,
          analysis: analysisStats
        }
      }

      console.log(`✅ Proceso batch completado exitosamente en ${duration}ms`)
      console.log(`📊 Estadísticas finales:`, {
        aulas: syncStats.totalAulas,
        cursos: syncStats.activeCourses,
        actividades: syncStats.totalActivities,
        análisis: analysisStats.totalAnalyses
      })

      return NextResponse.json(response)

    } catch (error) {
      // Marcar job como fallido
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          duration: Date.now() - startTime,
          lastError: error instanceof Error ? error.message : String(error),
          errorCount: { increment: 1 }
        }
      })

      throw error
    }

  } catch (error) {
    console.error('❌ Error en proceso batch:', error)

    const errorResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Obtener estadísticas del último batch
    const [lastJob, syncStats, analysisStats] = await Promise.all([
      prisma.batchJob.findFirst({
        orderBy: { createdAt: 'desc' }
      }),
      moodleSyncService.getSyncStats(),
      batchAnalysisService.getAnalysisStats()
    ])

    const response = {
      success: true,
      lastJob: lastJob ? {
        id: lastJob.id,
        status: lastJob.status,
        startedAt: lastJob.startedAt,
        completedAt: lastJob.completedAt,
        duration: lastJob.duration,
        processedAulas: lastJob.processedAulas,
        processedCourses: lastJob.processedCourses,
        processedActivities: lastJob.processedActivities,
        generatedAnalyses: lastJob.generatedAnalyses,
        errors: lastJob.errorCount
      } : null,
      currentStats: {
        sync: syncStats,
        analysis: analysisStats
      },
      systemHealth: {
        totalAulas: syncStats.totalAulas,
        activeCourses: syncStats.activeCourses,
        totalActivities: syncStats.totalActivities,
        totalAnalyses: analysisStats.totalAnalyses,
        recentAnalyses: analysisStats.recentAnalyses,
        lastSync: syncStats.lastSync
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas batch:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}