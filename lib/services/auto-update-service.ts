/**
 * Servicio de actualización automática
 * Ejecuta actualizaciones programadas dos veces al día
 */

import { MoodleAPIClient } from '@/lib/moodle/api-client'
import { CourseAnalysisService } from '@/lib/services/analysis-service'
import { getIntegratedEnrolmentClient } from '@/lib/db/integrated-enrolment-client'
import { serviceTokenManager } from '@/lib/services/service-token-manager'
import { processStateService } from '@/lib/services/process-state-service'
import fs from 'fs/promises'
import path from 'path'

interface UpdateLog {
  timestamp: Date
  type: 'scheduled' | 'manual'
  coursesUpdated: number
  analysisGenerated: number
  activitiesUpdated: number
  errors: string[]
  duration: number
}

export class AutoUpdateService {
  private static instance: AutoUpdateService
  private isUpdating = false
  private lastUpdate: Date | null = null
  private logPath = path.join(process.cwd(), 'logs', 'auto-updates.json')

  static getInstance(): AutoUpdateService {
    if (!this.instance) {
      this.instance = new AutoUpdateService()
    }
    return this.instance
  }

  /**
   * Ejecutar actualización completa
   */
  async executeUpdate(type: 'scheduled' | 'manual' = 'scheduled'): Promise<UpdateLog> {
    if (this.isUpdating) {
      console.log('⚠️ Actualización en progreso, omitiendo...')
      return {
        timestamp: new Date(),
        type,
        coursesUpdated: 0,
        analysisGenerated: 0,
        activitiesUpdated: 0,
        errors: ['Actualización ya en progreso'],
        duration: 0
      }
    }

    this.isUpdating = true
    const startTime = Date.now()
    const errors: string[] = []
    let coursesUpdated = 0
    let analysisGenerated = 0
    let activitiesUpdated = 0

    try {
      console.log(`\n🔄 ========== INICIANDO ACTUALIZACIÓN AUTOMÁTICA (${type.toUpperCase()}) ==========`)
      console.log(`📅 Timestamp: ${new Date().toISOString()}`)

      // Paso 1: Obtener todas las aulas con sus profesores
      const aulas = await this.getAllAulasWithTeachers()
      console.log(`🏫 Encontradas ${aulas.length} aulas únicas para procesar`)

      // Inicializar estado compartido
      await processStateService.initProcess(type === 'manual' ? 'manual' : 'cron', aulas.length)

      // Paso 2: Para cada aula, procesar todos sus profesores y cursos
      for (let i = 0; i < aulas.length; i++) {
        const aula = aulas[i]
        try {
          console.log(`🏫 Procesando aula: ${aula.aulaId}`)
          
          // Actualizar estado compartido
          await processStateService.updateProgress({
            currentStep: `Procesando aula ${i + 1}/${aulas.length}`,
            processedAulas: i,
            currentAula: aula.aulaId
          })
          
          // Usar el servicio de sincronización de Moodle existente para esta aula
          console.log(`🔄 Ejecutando sincronización completa para aula ${aula.aulaId}`)
          
          // Importar dinámicamente el servicio
          const { MoodleSyncService } = await import('@/lib/services/moodle-sync-service')
          const syncService = new MoodleSyncService()
          
          // Ejecutar sincronización completa para esta aula
          const result = await syncService.syncAulaData(aula.aulaId)
          
          if (result.success) {
            coursesUpdated += result.coursesProcessed || 0
            analysisGenerated += result.analysisGenerated || 0
            activitiesUpdated += result.activitiesProcessed || 0
            
            console.log(`✅ Aula ${aula.aulaId} procesada: ${result.coursesProcessed} cursos, ${result.analysisGenerated} análisis`)
          } else {
            const errorMsg = `Error en aula ${aula.aulaId}: ${result.message}`
            console.error(`❌ ${errorMsg}`)
            errors.push(errorMsg)
            await processStateService.addError(errorMsg)
          }
          
        } catch (error) {
          const errorMsg = `Error procesando aula ${aula.aulaId}: ${error}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
          await processStateService.addError(errorMsg)
        }
      }

      const duration = Date.now() - startTime
      const log: UpdateLog = {
        timestamp: new Date(),
        type,
        coursesUpdated,
        analysisGenerated,
        activitiesUpdated,
        errors,
        duration
      }

      // Guardar log
      await this.saveLog(log)
      
      console.log(`\n✅ ========== ACTUALIZACIÓN COMPLETADA ==========`)
      console.log(`📊 Resumen:`)
      console.log(`  - Cursos actualizados: ${coursesUpdated}`)
      console.log(`  - Análisis generados: ${analysisGenerated}`)
      console.log(`  - Actividades actualizadas: ${activitiesUpdated}`)
      console.log(`  - Errores: ${errors.length}`)
      console.log(`  - Duración: ${(duration / 1000).toFixed(2)} segundos`)
      console.log(`================================================\n`)

      // Finalizar estado compartido
      await processStateService.finishProcess(true)
      await processStateService.updateProgress({
        processedAulas: aulas.length,
        totalAnalysis: analysisGenerated,
        processedAnalysis: analysisGenerated,
        totalCourses: coursesUpdated,
        processedCourses: coursesUpdated
      })

      this.lastUpdate = new Date()
      return log

    } catch (error) {
      console.error('❌ Error crítico en actualización automática:', error)
      errors.push(`Error crítico: ${error}`)
      
      // Marcar proceso como fallido
      await processStateService.finishProcess(false, `Error crítico: ${error}`)
      
      return {
        timestamp: new Date(),
        type,
        coursesUpdated,
        analysisGenerated,
        activitiesUpdated,
        errors,
        duration: Date.now() - startTime
      }
    } finally {
      this.isUpdating = false
    }
  }

  /**
   * Obtener todas las aulas con sus profesores
   */
  private async getAllAulasWithTeachers(): Promise<Array<{
    aulaId: string
    aulaName: string
    aulaUrl: string
    teacherCount: number
  }>> {
    const enrolmentClient = getIntegratedEnrolmentClient()
    
    try {
      // Obtener aulas únicas con conteo de profesores
      // Procesar todas las aulas disponibles con prioridad para aula 101
      const results = await enrolmentClient.executeQuery(`
        SELECT
          idAula,
          COUNT(DISTINCT username) as teacherCount
        FROM enrolment
        WHERE roles_id = 17
        AND suspendido = 0
        GROUP BY idAula
        ORDER BY
          CASE
            WHEN idAula = '101' THEN 1
            WHEN idAula = '104' THEN 2
            WHEN idAula = '108' THEN 3
            WHEN idAula = 'av141' THEN 4
            ELSE 5
          END
      `)

      const aulas = results.map(row => ({
        aulaId: row.idAula,
        aulaName: row.idAula, // Por ahora usar ID como nombre
        aulaUrl: this.buildAulaUrl(row.idAula),
        teacherCount: parseInt(row.teacherCount) || 0
      }))

      console.log(`🏫 Encontradas ${aulas.length} aulas para procesar`)
      
      return aulas
      
    } catch (error) {
      console.error('Error obteniendo profesores:', error)
      return []
    }
  }

  /**
   * Obtener token para un profesor, con fallback a tokens de servicio
   */
  private async getTokenForTeacher(username: string, aulaId: string): Promise<string | null> {
    // 1. Intentar obtener token específico del profesor desde variables de entorno
    const teacherToken = process.env[`MOODLE_TOKEN_${aulaId.toUpperCase()}_${username.toUpperCase()}`] || 
                        process.env[`MOODLE_TOKEN_${aulaId.toUpperCase()}`] || 
                        process.env.MOODLE_TOKEN
    
    if (teacherToken) {
      console.log(`🔑 Usando token específico para ${username} en ${aulaId}`)
      return teacherToken
    }

    // 2. Fallback: usar token de servicio general si está disponible
    const serviceToken = serviceTokenManager.getServiceToken(aulaId)
    if (serviceToken) {
      console.log(`🔧 Usando token de servicio general para ${aulaId} (usuario: ${serviceToken.user})`)
      return serviceToken.token
    }

    console.warn(`⚠️ No hay token disponible para ${username} en ${aulaId}`)
    return null
  }

  /**
   * Actualizar actividades de un curso
   */
  private async updateActivities(
    moodleClient: MoodleAPIClient, 
    courseId: number, 
    groupId: number
  ): Promise<number> {
    try {
      // Obtener contenidos del curso
      const contents = await moodleClient.getCourseContents(courseId)
      
      // Obtener foros
      const forums = await moodleClient.getCourseForums(courseId)
      
      // Obtener asignaciones
      const assignments = await moodleClient.getCourseAssignments(courseId)
      
      const totalActivities = forums.length + assignments.length
      
      console.log(`    📝 ${totalActivities} actividades`)
      
      return totalActivities
      
    } catch (error) {
      console.error('Error actualizando actividades:', error)
      return 0
    }
  }

  /**
   * Construir URL del aula
   */
  private buildAulaUrl(idAula: string): string {
    if (!idAula) return ''
    
    if (/^\d+$/.test(idAula)) {
      return `https://aula${idAula}.utel.edu.mx`
    }
    
    return `https://${idAula.toLowerCase()}.utel.edu.mx`
  }

  /**
   * Guardar log de actualización
   */
  private async saveLog(log: UpdateLog): Promise<void> {
    try {
      // Crear directorio de logs si no existe
      const logsDir = path.dirname(this.logPath)
      await fs.mkdir(logsDir, { recursive: true })

      // Leer logs existentes
      let logs: UpdateLog[] = []
      try {
        const content = await fs.readFile(this.logPath, 'utf-8')
        logs = JSON.parse(content)
      } catch {
        // Archivo no existe o está vacío
      }

      // Agregar nuevo log
      logs.push(log)

      // Mantener solo los últimos 100 logs
      if (logs.length > 100) {
        logs = logs.slice(-100)
      }

      // Guardar logs
      await fs.writeFile(this.logPath, JSON.stringify(logs, null, 2))
      
    } catch (error) {
      console.error('Error guardando log:', error)
    }
  }

  /**
   * Obtener logs de actualizaciones
   */
  async getLogs(limit: number = 10): Promise<UpdateLog[]> {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8')
      const logs: UpdateLog[] = JSON.parse(content)
      return logs.slice(-limit).reverse()
    } catch {
      return []
    }
  }

  /**
   * Obtener estado del servicio
   */
  getStatus() {
    return {
      isUpdating: this.isUpdating,
      lastUpdate: this.lastUpdate,
      nextScheduledUpdates: this.getNextScheduledTimes()
    }
  }

  /**
   * Calcular próximas actualizaciones programadas
   */
  private getNextScheduledTimes(): Date[] {
    const now = new Date()
    const times: Date[] = []
    
    // 8:00 AM
    const morning = new Date(now)
    morning.setHours(8, 0, 0, 0)
    if (morning > now) {
      times.push(morning)
    } else {
      morning.setDate(morning.getDate() + 1)
      times.push(morning)
    }
    
    // 6:00 PM
    const afternoon = new Date(now)
    afternoon.setHours(18, 0, 0, 0)
    if (afternoon > now) {
      times.push(afternoon)
    } else {
      afternoon.setDate(afternoon.getDate() + 1)
      times.push(afternoon)
    }
    
    return times.sort((a, b) => a.getTime() - b.getTime()).slice(0, 2)
  }
}

// Exportar singleton
export const autoUpdateService = AutoUpdateService.getInstance()