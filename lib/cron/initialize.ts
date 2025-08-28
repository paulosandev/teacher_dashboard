/**
 * Inicializador del sistema de cron jobs
 * Se ejecuta cuando el servidor Next.js arranca
 */

import { cronScheduler } from './scheduler'

let isInitialized = false

export function initializeCronJobs() {
  if (isInitialized) {
    console.log('⚠️ Cron jobs ya inicializados')
    return
  }

  // Solo inicializar en producción o si está explícitamente habilitado
  const enableCron = process.env.ENABLE_CRON === 'true' || process.env.NODE_ENV === 'production'
  
  if (!enableCron) {
    console.log('ℹ️ Cron jobs deshabilitados (ENABLE_CRON !== true)')
    return
  }

  console.log('\n🚀 ===== INICIALIZANDO SISTEMA DE ACTUALIZACIONES AUTOMÁTICAS =====')
  
  try {
    // Inicializar scheduler
    cronScheduler.initialize()
    
    // Validar que todo está funcionando
    const status = cronScheduler.getStatus()
    
    if (status.initialized) {
      console.log('✅ Sistema de actualizaciones automáticas inicializado correctamente')
      console.log(`📍 Estado: ${JSON.stringify(status, null, 2)}`)
      isInitialized = true
      
      // Registrar shutdown handler
      process.on('SIGINT', handleShutdown)
      process.on('SIGTERM', handleShutdown)
      
    } else {
      console.error('❌ Error: El scheduler no se inicializó correctamente')
    }
    
  } catch (error) {
    console.error('❌ Error crítico inicializando cron jobs:', error)
  }
}

/**
 * Manejar shutdown graceful
 */
function handleShutdown() {
  console.log('\n🛑 Recibida señal de shutdown, deteniendo cron jobs...')
  
  try {
    cronScheduler.stop()
    console.log('✅ Cron jobs detenidos correctamente')
  } catch (error) {
    console.error('❌ Error deteniendo cron jobs:', error)
  }
  
  process.exit(0)
}

// Auto-inicializar si está en el contexto correcto
if (typeof window === 'undefined') {
  // Solo en server-side
  initializeCronJobs()
}