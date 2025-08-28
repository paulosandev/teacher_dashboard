/**
 * Servicio de actualización automática
 * Ejecuta actualizaciones programadas dos veces al día
 */

import { MoodleAPIClient } from '@/lib/moodle/api-client'
import { CourseAnalysisService } from '@/lib/services/analysis-service'
import { getIntegratedEnrolmentClient } from '@/lib/db/integrated-enrolment-client'
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

      // Paso 1: Obtener todos los profesores con sus aulas
      const teachers = await this.getAllTeachersWithAulas()
      console.log(`👥 Encontrados ${teachers.length} profesores únicos`)

      // Paso 2: Para cada profesor, obtener sus cursos y actualizar
      for (const teacher of teachers) {
        try {
          console.log(`\n👨‍🏫 Procesando profesor: ${teacher.username} (${teacher.aulas.length} aulas)`)
          
          for (const aula of teacher.aulas) {
            try {
              // Obtener token para esta aula
              const token = await this.getTokenForTeacher(teacher.username, aula.aulaId)
              
              if (!token) {
                console.log(`⚠️ No se pudo obtener token para ${teacher.username} en ${aula.aulaId}`)
                continue
              }

              // Crear cliente Moodle para esta aula
              const moodleClient = new MoodleAPIClient(aula.aulaUrl, token)
              
              // Obtener cursos del profesor en esta aula
              const courses = await moodleClient.getTeacherCoursesWithGroups(teacher.username)
              
              console.log(`📚 ${courses.length} cursos encontrados en ${aula.aulaId}`)

              // Actualizar cada curso
              for (const course of courses) {
                for (const group of course.groups) {
                  const courseGroupKey = `${course.id}|${group.id}`
                  
                  try {
                    console.log(`  📖 Actualizando curso ${course.fullname} - ${group.name}`)
                    
                    // Actualizar actividades
                    const activities = await this.updateActivities(moodleClient, course.id, group.id)
                    activitiesUpdated += activities
                    
                    // Regenerar análisis
                    const analysisService = new CourseAnalysisService()
                    const analysis = await analysisService.analyzeCourse(
                      course.id.toString(),
                      group.id.toString(),
                      teacher.username,
                      token
                    )
                    
                    if (analysis) {
                      analysisGenerated++
                      console.log(`    ✅ Análisis generado exitosamente`)
                    }
                    
                    coursesUpdated++
                    
                  } catch (error) {
                    const errorMsg = `Error actualizando ${courseGroupKey}: ${error}`
                    console.error(`    ❌ ${errorMsg}`)
                    errors.push(errorMsg)
                  }
                }
              }
              
            } catch (error) {
              const errorMsg = `Error procesando aula ${aula.aulaId}: ${error}`
              console.error(`  ❌ ${errorMsg}`)
              errors.push(errorMsg)
            }
          }
          
        } catch (error) {
          const errorMsg = `Error procesando profesor ${teacher.username}: ${error}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
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

      this.lastUpdate = new Date()
      return log

    } catch (error) {
      console.error('❌ Error crítico en actualización automática:', error)
      errors.push(`Error crítico: ${error}`)
      
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
   * Obtener todos los profesores con sus aulas
   */
  private async getAllTeachersWithAulas(): Promise<Array<{
    username: string
    email: string
    aulas: Array<{aulaId: string, aulaUrl: string}>
  }>> {
    const enrolmentClient = getIntegratedEnrolmentClient()
    
    try {
      // Obtener profesores únicos con sus aulas
      const results = await enrolmentClient.executeQuery(`
        SELECT DISTINCT username, email, idAula
        FROM enrolment 
        WHERE roles_id = 17
        AND suspendido = 0
        ORDER BY username
      `)

      // Agrupar por profesor
      const teachersMap = new Map<string, {
        username: string
        email: string
        aulas: Array<{aulaId: string, aulaUrl: string}>
      }>()

      for (const row of results) {
        const key = row.username
        
        if (!teachersMap.has(key)) {
          teachersMap.set(key, {
            username: row.username,
            email: row.email,
            aulas: []
          })
        }

        teachersMap.get(key)!.aulas.push({
          aulaId: row.idAula,
          aulaUrl: this.buildAulaUrl(row.idAula)
        })
      }

      return Array.from(teachersMap.values())
      
    } catch (error) {
      console.error('Error obteniendo profesores:', error)
      return []
    }
  }

  /**
   * Obtener token para un profesor (simulado, en producción usar sistema real)
   */
  private async getTokenForTeacher(username: string, aulaId: string): Promise<string | null> {
    // En producción, aquí se obtendría el token real del profesor
    // Por ahora retornamos el token de ambiente si está disponible
    
    // Verificar si tenemos un token almacenado en caché o base de datos
    // Este es un placeholder - en producción necesitarías:
    // 1. Sistema de tokens de servicio con permisos de lectura
    // 2. O tokens almacenados de forma segura con refresh automático
    
    const envToken = process.env[`MOODLE_TOKEN_${aulaId.toUpperCase()}`] || process.env.MOODLE_TOKEN
    
    if (envToken) {
      return envToken
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
      
      console.log(`    📝 Actividades encontradas: ${totalActivities} (${forums.length} foros, ${assignments.length} tareas)`)
      
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
    
    // 4:00 PM
    const afternoon = new Date(now)
    afternoon.setHours(16, 0, 0, 0)
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