/**
 * Programador de tareas (Cron Jobs)
 * Ejecuta actualizaciones automáticas a las 8:00 AM y 6:00 PM
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

    // Job principal: 8:00 AM (limpieza → carga → análisis)
    this.morningJob = cron.schedule('0 8 * * *', async () => {
      console.log('\n🌅 ===== PROCESO BATCH MATUTINO =====')
      await this.executeFullProcess('morning')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    })

    // Job vespertino: 6:00 PM (limpieza → carga → análisis)
    this.afternoonJob = cron.schedule('0 18 * * *', async () => {
      console.log('\n🌆 ===== PROCESO BATCH VESPERTINO =====')
      await this.executeFullProcess('afternoon')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    })

    this.isInitialized = true

    console.log('✅ Programador de tareas inicializado:')
    console.log('   📅 Proceso matutino: 8:00 AM (México) - Limpieza → Carga → Análisis [TODAS LAS AULAS]')
    console.log('   📅 Proceso vespertino: 6:00 PM (México) - Limpieza → Carga → Análisis [TODAS LAS AULAS]')
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
   * Ejecutar proceso completo: limpieza → carga → análisis
   */
  private async executeFullProcess(period: 'morning' | 'afternoon') {
    const startTime = Date.now()
    console.log(`\n🚀 [${period.toUpperCase()}] Iniciando proceso completo...`)

    try {
      // Paso 1: Limpieza de caché
      console.log('\n🧹 PASO 1: Limpiando caché obsoleto...')
      await this.cleanOldCache()

      // Paso 2: Carga y análisis de actividades
      console.log('\n📊 PASO 2: Ejecutando carga y análisis...')
      const result = await autoUpdateService.executeUpdate('scheduled')

      const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2)
      console.log(`\n✅ [${period.toUpperCase()}] Proceso completo finalizado en ${totalTime} minutos`)
      
      return result

    } catch (error) {
      const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2)
      console.error(`\n❌ [${period.toUpperCase()}] Error en proceso completo (${totalTime} min):`, error)
      throw error
    }
  }

  /**
   * Ejecutar actualización manual (para pruebas o emergencias)
   */
  async triggerManualUpdate() {
    console.log('\n🔧 ===== ACTUALIZACIÓN MANUAL SOLICITADA =====')
    return await this.executeFullProcess('manual' as any)
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

      // Crear directorio de caché si no existe
      try {
        await fs.mkdir(cacheDir, { recursive: true })
        console.log(`📁 Directorio de caché creado: ${cacheDir}`)
      } catch (mkdirError) {
        // Ignorar si ya existe
      }

      try {
        const files = await fs.readdir(cacheDir)

        let deleted = 0
        for (const file of files) {
          const filePath = path.join(cacheDir, file)
          try {
            const stats = await fs.stat(filePath)

            if (now - stats.mtime.getTime() > maxAge) {
              await fs.unlink(filePath)
              deleted++
            }
          } catch (fileError) {
            console.log(`⚠️ Error procesando archivo ${file}:`, fileError.message)
          }
        }

        console.log(`🧹 Limpieza completada: ${deleted} archivos de caché eliminados`)
      } catch (readdirError) {
        console.log(`📁 Directorio de caché vacío o no accesible: ${cacheDir}`)
      }

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