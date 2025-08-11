import { Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db/prisma'
import { getRedisClient } from '@/lib/queue/redis'
import { ANALYSIS_QUEUE_NAME, AnalysisJobData } from '@/lib/queue/queues'
import { analyzeForum, analyzeActivity } from '@/lib/analysis/analyzer'
import { fetchMoodleData } from '@/lib/moodle/client'

// Configuración del worker
const CONCURRENCY = 2 // Procesar 2 trabajos en paralelo

async function processAnalysisJob(job: Job<AnalysisJobData>) {
  const { courseId, groupId, activityId, forumId, type, userId, scheduledBy } = job.data
  
  console.log(`🔄 Procesando análisis: ${type} - Job ID: ${job.id}`)
  console.log(`   Curso: ${courseId}, Grupo: ${groupId || 'N/A'}`)
  
  try {
    // Registrar inicio del job
    await prisma.jobLog.create({
      data: {
        jobId: job.id!,
        jobType: scheduledBy === 'system' ? 'scheduled' : 'on-demand',
        status: 'processing',
        courseId,
        groupId,
        startedAt: new Date(),
      },
    })

    // Actualizar progreso
    await job.updateProgress(10)
    
    // Obtener datos de Moodle
    console.log('📥 Obteniendo datos de Moodle...')
    const moodleData = await fetchMoodleData({
      courseId,
      groupId,
      activityId,
      forumId,
      type,
    })
    
    await job.updateProgress(40)
    
    // Realizar análisis según el tipo
    let analysisResult
    
    if (type === 'forum' && forumId) {
      console.log('💬 Analizando foro...')
      analysisResult = await analyzeForum(moodleData, forumId, groupId)
    } else if (type === 'activity' && activityId) {
      console.log('📝 Analizando actividad...')
      analysisResult = await analyzeActivity(moodleData, activityId, groupId)
    } else {
      throw new Error('Tipo de análisis no válido')
    }
    
    await job.updateProgress(70)
    
    // Marcar análisis anteriores como no más recientes
    if (activityId) {
      await prisma.analysisResult.updateMany({
        where: {
          activityId,
          groupId,
          isLatest: true,
        },
        data: { isLatest: false },
      })
    }
    
    if (forumId) {
      await prisma.analysisResult.updateMany({
        where: {
          forumId,
          groupId,
          isLatest: true,
        },
        data: { isLatest: false },
      })
    }
    
    // Guardar nuevo resultado de análisis
    const savedResult = await prisma.analysisResult.create({
      data: {
        groupId,
        activityId,
        forumId,
        analysisType: type,
        strengths: analysisResult.strengths,
        alerts: analysisResult.alerts,
        nextStep: analysisResult.nextStep,
        rawData: moodleData,
        llmResponse: analysisResult.llmResponse,
        isLatest: true,
        confidence: analysisResult.confidence,
      },
    })
    
    await job.updateProgress(90)
    
    // Actualizar registro del job
    await prisma.jobLog.updateMany({
      where: { jobId: job.id! },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })
    
    await job.updateProgress(100)
    
    console.log(`✅ Análisis completado: ${savedResult.id}`)
    
    return {
      resultId: savedResult.id,
      message: 'Análisis completado exitosamente',
    }
    
  } catch (error) {
    console.error(`❌ Error en análisis:`, error)
    
    // Actualizar registro del job con error
    await prisma.jobLog.updateMany({
      where: { jobId: job.id! },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Error desconocido',
        completedAt: new Date(),
      },
    })
    
    throw error
  }
}

// Crear el worker
const worker = new Worker<AnalysisJobData>(
  ANALYSIS_QUEUE_NAME,
  processAnalysisJob,
  {
    connection: getRedisClient(),
    concurrency: CONCURRENCY,
  }
)

// Event listeners
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completado`)
})

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} falló:`, err)
})

worker.on('active', (job) => {
  console.log(`🚀 Job ${job.id} activo`)
})

worker.on('stalled', (jobId) => {
  console.warn(`⚠️ Job ${jobId} estancado`)
})

// Manejo de señales para shutdown graceful
process.on('SIGTERM', async () => {
  console.log('📛 SIGTERM recibido, cerrando worker...')
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('📛 SIGINT recibido, cerrando worker...')
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

console.log('🎯 Worker de análisis iniciado')
console.log(`   Concurrencia: ${CONCURRENCY} trabajos en paralelo`)
console.log(`   Cola: ${ANALYSIS_QUEUE_NAME}`)
console.log('   Esperando trabajos...')
