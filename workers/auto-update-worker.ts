import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'

// Conectar a Redis
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
})

// Worker para actualizaciones automáticas
export const autoUpdateWorker = new Worker(
  'auto-update-queue',
  async (job: Job) => {
    console.log('🕐 Ejecutando trabajo de actualización automática:', job.id)
    
    try {
      // Llamar al endpoint de actualización automática
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis/auto-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BullMQ-AutoUpdate-Worker'
        }
      })

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${await response.text()}`)
      }

      const result = await response.json()
      console.log('✅ Actualización automática completada:', result)
      
      return result

    } catch (error) {
      console.error('❌ Error en worker de actualización automática:', error)
      throw error
    }
  },
  {
    connection,
    concurrency: 1, // Solo un job de actualización a la vez
    removeOnComplete: 10, // Mantener los últimos 10 trabajos completados
    removeOnFail: 50, // Mantener los últimos 50 trabajos fallidos
  }
)

// Manejar eventos del worker
autoUpdateWorker.on('completed', (job: Job, result: any) => {
  console.log(`✅ Trabajo completado ${job.id}:`, result)
})

autoUpdateWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`❌ Trabajo fallido ${job?.id}:`, err.message)
})

autoUpdateWorker.on('error', (err: Error) => {
  console.error('❌ Error en worker de actualización automática:', err)
})

console.log('🔄 Worker de actualización automática iniciado')

export default autoUpdateWorker