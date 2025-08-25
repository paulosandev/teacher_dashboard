import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Conectar a Redis
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
})

// Worker para procesar cola de análisis
export const analysisQueueWorker = new Worker(
  'analysis-queue',
  async (job: Job) => {
    const { queueId } = job.data
    console.log(`🔬 Procesando análisis en cola: ${queueId}`)

    try {
      // Obtener el análisis pendiente
      const analysisItem = await prisma.analysisQueue.findUnique({
        where: { id: queueId }
      })

      if (!analysisItem) {
        console.log(`❌ No se encontró análisis en cola: ${queueId}`)
        return { success: false, error: 'Analysis item not found' }
      }

      if (analysisItem.status !== 'pending') {
        console.log(`⚠️ Análisis ${queueId} ya no está pendiente: ${analysisItem.status}`)
        return { success: true, message: 'Already processed' }
      }

      // Marcar como en procesamiento
      await prisma.analysisQueue.update({
        where: { id: queueId },
        data: {
          status: 'processing',
          startedAt: new Date(),
          attempts: analysisItem.attempts + 1
        }
      })

      console.log(`🔄 Iniciando análisis de ${analysisItem.activityName}`)

      // Ejecutar el análisis llamando al endpoint
      const analysisResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AnalysisQueue-Worker'
        },
        body: JSON.stringify({
          courseId: analysisItem.courseId,
          activityId: analysisItem.activityId,
          activityType: analysisItem.activityType,
          activityData: analysisItem.activityData,
          backgroundProcessing: true
        })
      })

      if (analysisResponse.ok) {
        const result = await analysisResponse.json()
        
        // Marcar como completado
        await prisma.analysisQueue.update({
          where: { id: queueId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            analysisResult: result,
            lastError: null
          }
        })

        console.log(`✅ Análisis completado: ${analysisItem.activityName}`)
        return { success: true, result }

      } else {
        const errorText = await analysisResponse.text()
        console.log(`❌ Error en análisis de ${analysisItem.activityName}: ${errorText}`)

        // Si superó los intentos máximos, marcar como fallido
        if (analysisItem.attempts + 1 >= analysisItem.maxAttempts) {
          await prisma.analysisQueue.update({
            where: { id: queueId },
            data: {
              status: 'failed',
              lastError: errorText
            }
          })
          console.log(`💀 Análisis fallido permanentemente: ${analysisItem.activityName}`)
        } else {
          // Volver a pending para reintentar más tarde
          await prisma.analysisQueue.update({
            where: { id: queueId },
            data: {
              status: 'pending',
              lastError: errorText
            }
          })
          console.log(`🔄 Análisis reintentará más tarde: ${analysisItem.activityName}`)
        }

        throw new Error(errorText)
      }

    } catch (error: any) {
      console.error(`❌ Error procesando análisis ${queueId}:`, error)

      // Actualizar el registro con el error
      try {
        await prisma.analysisQueue.update({
          where: { id: queueId },
          data: {
            status: 'pending', // Volver a pending para reintentar
            lastError: error.message || 'Unknown error'
          }
        })
      } catch (updateError) {
        console.error('Error actualizando estado de fallo:', updateError)
      }

      throw error
    }
  },
  {
    connection,
    concurrency: 2, // Procesar hasta 2 análisis simultáneamente
    removeOnComplete: 50,
    removeOnFail: 100
  }
)

analysisQueueWorker.on('completed', (job, result) => {
  console.log(`✅ Trabajo de análisis completado: ${job.id}`)
})

analysisQueueWorker.on('failed', (job, error) => {
  console.error(`❌ Trabajo de análisis falló: ${job?.id}`, error.message)
})

// Función para inicializar el worker
export async function startAnalysisQueueWorker() {
  console.log('🔬 Worker de cola de análisis iniciado')
  return analysisQueueWorker
}

export default analysisQueueWorker