import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

// Conectar a Redis
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
})

// Crear la cola para actualizaciones automáticas
export const autoUpdateQueue = new Queue('auto-update-queue', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5 segundos de retraso inicial
    }
  }
})

// En versiones modernas de BullMQ, el QueueScheduler no es necesario

// Función para programar actualizaciones automáticas cada hora
export async function setupHourlyUpdates() {
  try {
    console.log('⏰ Configurando actualizaciones automáticas cada hora...')

    // Limpiar trabajos repetidos existentes para evitar duplicados
    const repeatableJobs = await autoUpdateQueue.getRepeatableJobs()
    for (const job of repeatableJobs) {
      if (job.name === 'hourly-auto-update') {
        await autoUpdateQueue.removeRepeatableByKey(job.key)
        console.log('🗑️ Trabajo repetible existente eliminado')
      }
    }

    // Programar actualización cada hora en punto
    await autoUpdateQueue.add(
      'hourly-auto-update',
      {
        type: 'scheduled',
        timestamp: new Date().toISOString()
      },
      {
        repeat: {
          pattern: '0 * * * *', // Cada hora en punto (minuto 0)
        },
        jobId: 'hourly-auto-update-job' // ID fijo para evitar duplicados
      }
    )

    console.log('✅ Actualizaciones automáticas programadas cada hora')

    // También agregar una ejecución inmediata para probar
    await autoUpdateQueue.add(
      'initial-auto-update',
      {
        type: 'immediate',
        timestamp: new Date().toISOString()
      },
      {
        delay: 30000 // 30 segundos de retraso para permitir que la aplicación se inicie
      }
    )

    console.log('⏱️ Primera actualización programada en 30 segundos')

  } catch (error) {
    console.error('❌ Error configurando actualizaciones automáticas:', error)
    throw error
  }
}

// Función para obtener el estado de la cola
export async function getAutoUpdateQueueStatus() {
  try {
    const [waiting, active, completed, failed, delayed, repeatableJobs] = await Promise.all([
      autoUpdateQueue.getWaiting(),
      autoUpdateQueue.getActive(),
      autoUpdateQueue.getCompleted(),
      autoUpdateQueue.getFailed(),
      autoUpdateQueue.getDelayed(),
      autoUpdateQueue.getRepeatableJobs()
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      repeatableJobs: repeatableJobs.length,
      nextExecution: repeatableJobs.length > 0 ? new Date(repeatableJobs[0].next) : null
    }
  } catch (error) {
    console.error('❌ Error obteniendo estado de la cola:', error)
    return null
  }
}

// Función para parar las actualizaciones automáticas
export async function stopHourlyUpdates() {
  try {
    console.log('⏹️ Deteniendo actualizaciones automáticas...')
    
    const repeatableJobs = await autoUpdateQueue.getRepeatableJobs()
    for (const job of repeatableJobs) {
      await autoUpdateQueue.removeRepeatableByKey(job.key)
    }
    
    await autoUpdateQueue.close()
    
    console.log('✅ Actualizaciones automáticas detenidas')
  } catch (error) {
    console.error('❌ Error deteniendo actualizaciones:', error)
  }
}

// Inicializar el scheduler cuando se importe este módulo
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
  setupHourlyUpdates().catch(console.error)
}

export default autoUpdateQueue