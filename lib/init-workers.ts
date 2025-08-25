// Archivo para inicializar workers automáticamente
import { setupHourlyUpdates } from './schedulers/auto-update-scheduler'

let workersInitialized = false

export async function initializeWorkers() {
  if (workersInitialized) {
    console.log('⚠️ Workers ya han sido inicializados')
    return
  }

  try {
    console.log('🚀 Inicializando workers y schedulers...')
    
    // Solo inicializar en producción o cuando esté habilitado explícitamente
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
      // Importar y inicializar el worker de auto-update
      await import('../workers/auto-update-worker')
      
      // Importar y inicializar el worker de cola de análisis
      console.log('🔬 Inicializando worker de cola de análisis...')
      const { startAnalysisQueueWorker } = await import('../workers/analysis-queue-worker')
      await startAnalysisQueueWorker()
      
      // Configurar actualizaciones programadas
      await setupHourlyUpdates()
      
      console.log('✅ Workers y schedulers inicializados correctamente')
    } else {
      console.log('ℹ️ Workers deshabilitados en desarrollo (set ENABLE_SCHEDULER=true para habilitarlos)')
    }
    
    workersInitialized = true
    
  } catch (error) {
    console.error('❌ Error inicializando workers:', error)
    throw error
  }
}

// Función para verificar si los workers están corriendo
export function areWorkersRunning(): boolean {
  return workersInitialized
}

// Función para obtener información de los workers
export function getWorkersInfo() {
  return {
    initialized: workersInitialized,
    environment: process.env.NODE_ENV,
    schedulerEnabled: process.env.ENABLE_SCHEDULER === 'true',
    timestamp: new Date().toISOString()
  }
}

export default initializeWorkers