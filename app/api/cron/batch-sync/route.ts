/**
 * Endpoint de cron job para ejecución programada del sistema batch
 * Se ejecuta automáticamente a las 12:50 PM y 4:00 PM todos los días
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

// Horarios programados (en formato 24h)
const SCHEDULED_TIMES = [
  { hour: 12, minute: 50, name: '12:50 PM' },
  { hour: 16, minute: 0, name: '4:00 PM' }
]

export async function GET(request: NextRequest) {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  
  console.log(`⏰ Cron job ejecutado a las ${currentHour}:${currentMinute.toString().padStart(2, '0')}`)

  try {
    // Verificar si estamos en uno de los horarios programados
    const isScheduledTime = SCHEDULED_TIMES.some(time => 
      time.hour === currentHour && 
      Math.abs(time.minute - currentMinute) <= 2 // Tolerancia de 2 minutos
    )

    if (!isScheduledTime) {
      // No es hora de ejecutar el batch
      const nextScheduled = getNextScheduledTime(now)
      return NextResponse.json({
        success: true,
        executed: false,
        message: 'No es horario programado para ejecutar batch',
        currentTime: now.toISOString(),
        nextScheduled: nextScheduled.toISOString(),
        scheduledTimes: SCHEDULED_TIMES.map(t => `${t.hour}:${t.minute.toString().padStart(2, '0')}`)
      })
    }

    // Verificar si no hay otro job ejecutándose
    const runningJob = await prisma.batchJob.findFirst({
      where: {
        status: 'RUNNING'
      },
      orderBy: { startedAt: 'desc' }
    })

    if (runningJob) {
      const runningDuration = Date.now() - (runningJob.startedAt?.getTime() || 0)
      
      // Si el job lleva más de 30 minutos, marcarlo como fallido
      if (runningDuration > 30 * 60 * 1000) {
        await prisma.batchJob.update({
          where: { id: runningJob.id },
          data: {
            status: 'FAILED',
            lastError: 'Job timeout - ejecutándose más de 30 minutos',
            completedAt: new Date(),
            duration: runningDuration
          }
        })
        console.log(`⚠️ Job ${runningJob.id} marcado como fallido por timeout`)
      } else {
        return NextResponse.json({
          success: true,
          executed: false,
          message: 'Ya hay un job batch ejecutándose',
          runningJobId: runningJob.id,
          runningDuration: runningDuration
        })
      }
    }

    // Verificar si ya se ejecutó en este horario
    const recentJob = await prisma.batchJob.findFirst({
      where: {
        startedAt: {
          gte: new Date(now.getTime() - 10 * 60 * 1000) // Últimos 10 minutos
        },
        status: {
          in: ['COMPLETED', 'RUNNING']
        }
      }
    })

    if (recentJob) {
      return NextResponse.json({
        success: true,
        executed: false,
        message: 'Batch ya ejecutado recientemente',
        recentJobId: recentJob.id,
        recentJobStatus: recentJob.status
      })
    }

    // ✅ Ejecutar el proceso batch
    console.log(`🚀 Ejecutando batch programado del ${getScheduledTimeName(currentHour, currentMinute)}`)
    
    const startTime = Date.now()
    
    // Crear registro del job
    const batchJob = await prisma.batchJob.create({
      data: {
        jobType: 'FULL_SYNC',
        scope: 'ALL_AULAS',
        status: 'RUNNING',
        priority: 5, // Alta prioridad para jobs programados
        triggeredBy: 'CRON',
        scheduledFor: now,
        startedAt: new Date()
      }
    })

    try {
      // Paso 1: Sincronización de datos
      console.log('📡 Sincronizando datos de todas las aulas...')
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: { currentStep: 1, totalSteps: 3 }
      })

      const syncResult = await moodleSyncService.syncAllAulas()
      
      // Paso 2: Análisis con IA
      console.log('🧠 Generando análisis con IA...')
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: { 
          currentStep: 2,
          processedAulas: syncResult.processedAulas,
          processedCourses: syncResult.totalCourses,
          processedActivities: syncResult.totalActivities
        }
      })

      const analysisResult = await batchAnalysisService.processAllPendingAnalyses()
      
      // Paso 3: Limpieza
      console.log('🧹 Limpiando análisis expirados...')
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: { 
          currentStep: 3,
          generatedAnalyses: analysisResult.generatedAnalyses
        }
      })

      const cleanupResult = await prisma.batchAnalysis.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
          isLatest: false
        }
      })

      // Completar job
      const duration = Date.now() - startTime
      await prisma.batchJob.update({
        where: { id: batchJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          duration: duration,
          successCount: analysisResult.generatedAnalyses,
          errorCount: syncResult.errors.length + analysisResult.errors.length,
          summary: {
            sync: syncResult,
            analysis: analysisResult,
            cleanup: { expiredRemoved: cleanupResult.count }
          }
        }
      })

      const response = {
        success: true,
        executed: true,
        jobId: batchJob.id,
        executedAt: now.toISOString(),
        scheduledTime: getScheduledTimeName(currentHour, currentMinute),
        duration: duration,
        results: {
          aulas: syncResult.processedAulas,
          courses: syncResult.totalCourses,
          activities: syncResult.totalActivities,
          analyses: analysisResult.generatedAnalyses,
          cleanedUp: cleanupResult.count,
          errors: syncResult.errors.length + analysisResult.errors.length
        }
      }

      console.log(`✅ Batch programado completado en ${duration}ms:`, {
        aulas: syncResult.processedAulas,
        cursos: syncResult.totalCourses,
        actividades: syncResult.totalActivities,
        análisis: analysisResult.generatedAnalyses
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
    console.error('❌ Error en cron job batch:', error)

    return NextResponse.json({
      success: false,
      executed: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: now.toISOString()
    }, { status: 500 })
  }
}

/**
 * Obtener el próximo horario programado
 */
function getNextScheduledTime(from: Date): Date {
  const next = new Date(from)
  
  for (const time of SCHEDULED_TIMES) {
    const scheduledToday = new Date(from)
    scheduledToday.setHours(time.hour, time.minute, 0, 0)
    
    if (scheduledToday > from) {
      return scheduledToday
    }
  }
  
  // Si no hay horarios hoy, el próximo es mañana
  const tomorrow = new Date(from)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(SCHEDULED_TIMES[0].hour, SCHEDULED_TIMES[0].minute, 0, 0)
  
  return tomorrow
}

/**
 * Obtener nombre del horario programado
 */
function getScheduledTimeName(hour: number, minute: number): string {
  const found = SCHEDULED_TIMES.find(time => 
    time.hour === hour && Math.abs(time.minute - minute) <= 2
  )
  return found?.name || `${hour}:${minute.toString().padStart(2, '0')}`
}

// También exponer como POST para testing manual
export async function POST(request: NextRequest) {
  console.log('🔧 Ejecución manual del cron job batch')
  return GET(request)
}