import { Queue } from 'bullmq'
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

// Crear la cola para análisis
export const analysisQueue = new Queue('analysis-queue', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 1, // Un solo intento por trabajo, la lógica de reintentos está en la BD
    backoff: {
      type: 'exponential',
      delay: 2000,
    }
  }
})

// Función para agregar actividades a la cola de análisis
export async function queueAnalysisForActivities(
  courseId: string,
  activities: any[],
  requestedBy?: string
) {
  console.log(`📥 Agregando ${activities.length} actividades a cola de análisis para curso: ${courseId}`)
  
  const queuedCount = {
    added: 0,
    existing: 0,
    errors: 0
  }

  for (const activity of activities) {
    try {
      const activityKey = `${activity.type}_${activity.id}`
      
      // Verificar si ya existe un análisis reciente
      const existing = await prisma.activityAnalysis.findUnique({
        where: {
          courseId_activityId_activityType: {
            courseId,
            activityId: activity.id.toString(),
            activityType: activity.type
          }
        }
      })

      // Si ya existe un análisis reciente (menos de 4 horas), skip
      if (existing) {
        const fourHours = 4 * 60 * 60 * 1000
        const age = Date.now() - existing.lastUpdated.getTime()
        if (age < fourHours) {
          queuedCount.existing++
          continue
        }
      }

      // Verificar si ya está en la cola
      const existingInQueue = await prisma.analysisQueue.findUnique({
        where: {
          courseId_activityId_activityType: {
            courseId,
            activityId: activity.id.toString(),
            activityType: activity.type
          }
        }
      })

      if (existingInQueue && existingInQueue.status === 'pending') {
        queuedCount.existing++
        continue
      }

      // Agregar/actualizar en la cola de análisis
      const queueItem = await prisma.analysisQueue.upsert({
        where: {
          courseId_activityId_activityType: {
            courseId,
            activityId: activity.id.toString(),
            activityType: activity.type
          }
        },
        create: {
          courseId,
          activityId: activity.id.toString(),
          activityType: activity.type,
          activityName: activity.name || `${activity.type} ${activity.id}`,
          status: 'pending',
          priority: 0,
          activityData: activity,
          requestedBy,
          attempts: 0
        },
        update: {
          status: 'pending',
          activityData: activity,
          requestedBy,
          attempts: 0,
          lastError: null
        }
      })

      // Agregar trabajo a BullMQ
      await analysisQueue.add(
        'process-analysis',
        { queueId: queueItem.id },
        {
          priority: queueItem.priority,
          delay: queuedCount.added * 1000 // Escalonar para evitar sobrecarga
        }
      )

      queuedCount.added++
      console.log(`📝 Agregado a cola: ${activity.name || activity.type}`)

    } catch (error) {
      console.error(`❌ Error agregando actividad ${activity.id} a cola:`, error)
      queuedCount.errors++
    }
  }

  console.log(`📊 Resumen de cola: ${queuedCount.added} agregados, ${queuedCount.existing} existentes, ${queuedCount.errors} errores`)
  return queuedCount
}

// Función para obtener el estado de la cola para un curso
export async function getAnalysisQueueStatus(courseId: string) {
  try {
    const [pending, processing, completed, failed] = await Promise.all([
      prisma.analysisQueue.count({
        where: { courseId, status: 'pending' }
      }),
      prisma.analysisQueue.count({
        where: { courseId, status: 'processing' }
      }),
      prisma.analysisQueue.count({
        where: { courseId, status: 'completed' }
      }),
      prisma.analysisQueue.count({
        where: { courseId, status: 'failed' }
      })
    ])

    return {
      pending,
      processing,
      completed,
      failed,
      total: pending + processing + completed + failed,
      inProgress: pending + processing > 0
    }
  } catch (error) {
    console.error('Error obteniendo estado de cola:', error)
    return null
  }
}

// Función para limpiar análisis completados antiguos
export async function cleanCompletedAnalysis(olderThanHours = 24) {
  try {
    const cutoff = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000))
    
    const deleted = await prisma.analysisQueue.deleteMany({
      where: {
        status: 'completed',
        completedAt: {
          lt: cutoff
        }
      }
    })

    console.log(`🧹 Limpiados ${deleted.count} análisis completados antiguos`)
    return deleted.count
  } catch (error) {
    console.error('Error limpiando análisis completados:', error)
    return 0
  }
}

export default analysisQueue