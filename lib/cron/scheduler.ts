/**
 * Programador de tareas (Cron Jobs)
 * Ejecuta actualizaciones automáticas a las 8:00 AM y 4:00 PM
 */

import * as cron from 'node-cron'
import { autoUpdateService } from '@/lib/services/auto-update-service'

export class CronScheduler {
  private static instance: CronScheduler
  private morningJob: cron.ScheduledTask | null = null
  private afternoonJob: cron.ScheduledTask | null = null
  private isInitialized = false

  static getInstance(): CronScheduler {
    if (!this.instance) {
      this.instance = new CronScheduler()
    }
    return this.instance
  }

  /**
   * Inicializar todos los cron jobs
   */
  initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Cron scheduler ya inicializado')
      return
    }

    console.log('🕐 Inicializando programador de tareas automáticas...')

    // Job de 8:00 AM (todos los días)
    this.morningJob = cron.schedule('0 8 * * *', async () => {
      console.log('\n🌅 ===== ACTUALIZACIÓN MATUTINA PROGRAMADA =====')
      await autoUpdateService.executeUpdate('scheduled')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City" // Ajusta según tu zona horaria
    })

    // Job de 4:00 PM (todos los días)
    this.afternoonJob = cron.schedule('0 16 * * *', async () => {
      console.log('\n🌆 ===== ACTUALIZACIÓN VESPERTINA PROGRAMADA =====')
      await autoUpdateService.executeUpdate('scheduled')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City" // Ajusta según tu zona horaria
    })

    // Job de limpieza de caché viejo (cada día a las 2:00 AM)
    cron.schedule('0 2 * * *', async () => {
      console.log('\n🧹 ===== LIMPIEZA DE CACHÉ PROGRAMADA =====')
      await this.cleanOldCache()
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    })

    // Job de monitoreo de salud (cada hora)
    cron.schedule('0 * * * *', () => {
      const status = autoUpdateService.getStatus()
      console.log(`💚 Health check: Sistema ${status.isUpdating ? 'actualizando' : 'inactivo'}`)
      console.log(`   Última actualización: ${status.lastUpdate?.toISOString() || 'Nunca'}`)
      console.log(`   Próximas actualizaciones: ${status.nextScheduledUpdates.map(d => d.toISOString()).join(', ')}`)
    }, {
      scheduled: true
    })

    this.isInitialized = true

    console.log('✅ Programador de tareas inicializado:')
    console.log('   📅 Actualización matutina: 8:00 AM (México)')
    console.log('   📅 Actualización vespertina: 4:00 PM (México)')
    console.log('   📅 Limpieza de caché: 2:00 AM (México)')
    console.log('   📅 Health check: Cada hora')
  }

  /**
   * Detener todos los cron jobs
   */
  stop() {
    console.log('🛑 Deteniendo programador de tareas...')
    
    if (this.morningJob) {
      this.morningJob.stop()
      this.morningJob = null
    }
    
    if (this.afternoonJob) {
      this.afternoonJob.stop()
      this.afternoonJob = null
    }
    
    this.isInitialized = false
    console.log('✅ Programador de tareas detenido')
  }

  /**
   * Reiniciar cron jobs
   */
  restart() {
    this.stop()
    this.initialize()
  }

  /**
   * Ejecutar actualización manual (para pruebas o emergencias)
   */
  async triggerManualUpdate() {
    console.log('\n🔧 ===== ACTUALIZACIÓN MANUAL SOLICITADA =====')
    return await autoUpdateService.executeUpdate('manual')
  }

  /**
   * Limpiar caché viejo
   */
  private async cleanOldCache() {
    try {
      const fs = require('fs').promises
      const path = require('path')
      
      const cacheDir = path.join(process.cwd(), '.cache', 'analysis')
      const now = Date.now()
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 días

      const files = await fs.readdir(cacheDir)
      
      let deleted = 0
      for (const file of files) {
        const filePath = path.join(cacheDir, file)
        const stats = await fs.stat(filePath)
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath)
          deleted++
        }
      }
      
      console.log(`🧹 Limpieza completada: ${deleted} archivos de caché eliminados`)
      
    } catch (error) {
      console.error('❌ Error limpiando caché:', error)
    }
  }

  /**
   * Obtener estado del scheduler
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      jobs: {
        morning: this.morningJob ? 'active' : 'inactive',
        afternoon: this.afternoonJob ? 'active' : 'inactive'
      },
      updateService: autoUpdateService.getStatus()
    }
  }

  /**
   * Validar que los jobs están funcionando
   */
  validateJobs(): boolean {
    if (!this.isInitialized) return false
    
    // Verificar que los jobs existen y están programados
    const morningValid = this.morningJob !== null
    const afternoonValid = this.afternoonJob !== null
    
    if (!morningValid || !afternoonValid) {
      console.error('❌ Algunos jobs no están activos')
      return false
    }
    
    return true
  }
}

// Exportar singleton
export const cronScheduler = CronScheduler.getInstance()