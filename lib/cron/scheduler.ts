/**
 * Programador de tareas (Cron Jobs)
 * Ejecuta actualizaciones automáticas a las 8:00 AM y 6:00 PM
 */

import * as cron from 'node-cron'
import { autoUpdateService } from '@/lib/services/auto-update-service'
import { activityMarkingService } from '@/lib/services/activity-marking-service'

export class CronScheduler {
  private static instance: CronScheduler
  private morningMarkingJob: cron.ScheduledTask | null = null
  private morningJob: cron.ScheduledTask | null = null
  private afternoonMarkingJob: cron.ScheduledTask | null = null
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

    // Job de marcado matutino: 11:34 AM (marcar actividades válidas)
    this.morningMarkingJob = cron.schedule('34 11 * * *', async () => {
      console.log('\n🔍 ===== MARCADO MATUTINO DE ACTIVIDADES =====')
      await this.executeActivityMarking('morning')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    })

    // Job principal matutino: 11:35 AM (limpieza → carga → análisis con prioridad)
    this.morningJob = cron.schedule('35 11 * * *', async () => {
      console.log('\n🌅 ===== PROCESO BATCH MATUTINO (PRIORIDAD 101) =====')
      await this.executeFullProcessWithPriority('morning')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    })

    // Job de marcado vespertino: 7:59 PM (marcar actividades válidas)
    this.afternoonMarkingJob = cron.schedule('58 17 * * *', async () => {
      console.log('\n🔍 ===== MARCADO VESPERTINO DE ACTIVIDADES =====')
      await this.executeActivityMarking('afternoon')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    })

    // Job principal vespertino: 8:00 PM (limpieza → carga → análisis con prioridad)
    this.afternoonJob = cron.schedule('0 18 * * *', async () => {
      console.log('\n🌆 ===== PROCESO BATCH VESPERTINO (PRIORIDAD 101) =====')
      await this.executeFullProcessWithPriority('afternoon')
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    })

    this.isInitialized = true

    console.log('✅ Programador de tareas inicializado:')
    console.log('   🔍 Marcado matutino: 11:34 AM (México) - Marcar actividades válidas para análisis')
    console.log('   📅 Proceso matutino: 11:35 AM (México) - Limpieza → Carga → Análisis [PRIORIDAD: 101, 102, 103...]')
    console.log('   🔍 Marcado vespertino: 7:59 PM (México) - Marcar actividades válidas para análisis')
    console.log('   📅 Proceso vespertino: 8:00 PM (México) - Limpieza → Carga → Análisis [PRIORIDAD: 101, 102, 103...]')
  }

  /**
   * Detener todos los cron jobs
   */
  stop() {
    console.log('🛑 Deteniendo programador de tareas...')

    if (this.morningMarkingJob) {
      this.morningMarkingJob.stop()
      this.morningMarkingJob = null
    }

    if (this.morningJob) {
      this.morningJob.stop()
      this.morningJob = null
    }

    if (this.afternoonMarkingJob) {
      this.afternoonMarkingJob.stop()
      this.afternoonMarkingJob = null
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
   * Ejecutar marcado de actividades válidas
   */
  private async executeActivityMarking(period: 'morning' | 'afternoon') {
    const startTime = Date.now()
    console.log(`\n🔍 [${period.toUpperCase()}] Iniciando marcado de actividades válidas...`)

    try {
      // Marcar actividades válidas para análisis
      const result = await activityMarkingService.markValidActivitiesForAnalysis()

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)

      if (result.success) {
        console.log(`\n✅ [${period.toUpperCase()}] Marcado completado en ${duration}s`)
        console.log(`📊 Resultados:`)
        console.log(`  - Actividades marcadas para análisis: ${result.markedActivities}`)

        // Mostrar estadísticas por aula
        const stats = await activityMarkingService.getActivityStats()
        console.log(`📋 Estado por aula:`)
        Object.entries(stats).forEach(([aulaId, data]: [string, any]) => {
          const emoji = aulaId === '101' ? '🎯' : '📊'
          console.log(`  ${emoji} Aula ${aulaId}: ${data.pending} pendientes, ${data.analyzed} analizadas`)
        })

      } else {
        console.error(`\n❌ [${period.toUpperCase()}] Error en marcado (${duration}s):`)
        result.errors.forEach(error => console.error(`  • ${error}`))
      }

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.error(`\n❌ [${period.toUpperCase()}] Error fatal en marcado (${duration}s):`, error)
    }
  }

  /**
   * Ejecutar proceso completo con prioridad ordenada: limpieza → carga → análisis
   */
  private async executeFullProcessWithPriority(period: 'morning' | 'afternoon') {
    const startTime = Date.now()
    console.log(`\n🚀 [${period.toUpperCase()}] Iniciando proceso completo con prioridad ordenada...`)

    try {
      // Paso 1: Limpieza de caché
      console.log('\n🧹 PASO 1: Limpiando caché obsoleto...')
      await this.cleanOldCache()

      // Paso 2: Carga y análisis de actividades (el servicio ya procesa con prioridad)
      console.log('\n📊 PASO 2: Ejecutando carga y análisis con prioridad (101, 102, 103...)...')
      const result = await autoUpdateService.executeUpdate('scheduled')

      const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2)
      console.log(`\n✅ [${period.toUpperCase()}] Proceso completo con prioridad finalizado en ${totalTime} minutos`)

      return result

    } catch (error) {
      const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(2)
      console.error(`\n❌ [${period.toUpperCase()}] Error en proceso completo con prioridad (${totalTime} min):`, error)
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
        morningMarking: this.morningMarkingJob ? 'active' : 'inactive',
        morning: this.morningJob ? 'active' : 'inactive',
        afternoonMarking: this.afternoonMarkingJob ? 'active' : 'inactive',
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

    // Verificar que todos los jobs existen y están programados
    const morningMarkingValid = this.morningMarkingJob !== null
    const morningValid = this.morningJob !== null
    const afternoonMarkingValid = this.afternoonMarkingJob !== null
    const afternoonValid = this.afternoonJob !== null

    if (!morningMarkingValid || !morningValid || !afternoonMarkingValid || !afternoonValid) {
      console.error('❌ Algunos jobs no están activos')
      console.error(`   Morning Marking: ${morningMarkingValid ? '✅' : '❌'}`)
      console.error(`   Morning Batch: ${morningValid ? '✅' : '❌'}`)
      console.error(`   Afternoon Marking: ${afternoonMarkingValid ? '✅' : '❌'}`)
      console.error(`   Afternoon Batch: ${afternoonValid ? '✅' : '❌'}`)
      return false
    }

    return true
  }
}

// Exportar singleton
export const cronScheduler = CronScheduler.getInstance()