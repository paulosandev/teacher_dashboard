/**
 * Instrumentación de Next.js
 * Se ejecuta una vez cuando el servidor arranca
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔧 Inicializando instrumentación del servidor...')
    
    // Importar e inicializar cron jobs
    const { initializeCronJobs } = await import('@/lib/cron/initialize')
    initializeCronJobs()
    
    console.log('Instrumentación completada')
  }
}