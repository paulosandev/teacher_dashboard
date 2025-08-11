import { Queue } from 'bullmq'
import { getRedisClient } from './redis'

// Nombre de la cola principal de análisis
export const ANALYSIS_QUEUE_NAME = 'academic-analysis'

// Crear cola de análisis
export const analysisQueue = new Queue(ANALYSIS_QUEUE_NAME, {
  connection: getRedisClient(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Mantener trabajos completados por 24 horas
      count: 1000,     // Mantener máximo 1000 trabajos completados
    },
    removeOnFail: {
      age: 48 * 3600, // Mantener trabajos fallidos por 48 horas
    },
  },
})

// Tipos de trabajos
export interface AnalysisJobData {
  courseId: string
  groupId?: string
  activityId?: string
  forumId?: string
  type: 'activity' | 'forum'
  userId: string
  scheduledBy: 'system' | 'user'
}
