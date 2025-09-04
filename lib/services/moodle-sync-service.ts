/**
 * Servicio de sincronización de datos de Moodle
 * Se encarga de obtener y sincronizar datos de todas las aulas UTEL
 */

import { PrismaClient } from '@prisma/client'
import { aulaConfigService, type AulaConfig } from './aula-config-service'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export interface MoodleCourse {
  id: number
  fullname: string
  shortname: string
  categoryname?: string
  startdate?: number
  enddate?: number
  visible: boolean
  summary?: string
  summaryformat?: number
  teachers?: Array<{
    id: number
    username: string
    firstname: string
    lastname: string
    email: string
  }>
  enrolledstudents?: number
}

export interface MoodleAssignment {
  id: number
  course: number
  name: string
  intro: string
  duedate?: number
  cutoffdate?: number
  allowsubmissionsfromdate?: number
  grade: number
  cmid: number
  submissions?: any[]
}

export interface MoodleForum {
  id: number
  course: number
  name: string
  intro: string
  duedate?: number
  cutoffdate?: number
  cmid: number
  discussions?: any[]
}

export class MoodleSyncService {
  private static instance: MoodleSyncService

  static getInstance(): MoodleSyncService {
    if (!this.instance) {
      this.instance = new MoodleSyncService()
    }
    return this.instance
  }

  /**
   * Sincronizar todas las aulas configuradas
   */
  async syncAllAulas(): Promise<{
    success: boolean
    processedAulas: number
    totalCourses: number
    totalActivities: number
    errors: string[]
  }> {
    console.log('🔄 Iniciando sincronización completa de todas las aulas')
    
    const activeConfigs = aulaConfigService.getActiveAulaConfigs()
    const results = {
      success: true,
      processedAulas: 0,
      totalCourses: 0,
      totalActivities: 0,
      errors: [] as string[]
    }

    for (const config of activeConfigs) {
      try {
        console.log(`🏫 Sincronizando aula ${config.id} (${config.name})`)
        const aulaResult = await this.syncAula(config)
        
        results.processedAulas++
        results.totalCourses += aulaResult.coursesCount
        results.totalActivities += aulaResult.activitiesCount
        
        if (!aulaResult.success) {
          results.errors.push(`Aula ${config.id}: ${aulaResult.errors.join(', ')}`)
        }
      } catch (error) {
        const errorMsg = `Error sincronizando aula ${config.id}: ${error}`
        console.error('❌', errorMsg)
        results.errors.push(errorMsg)
        results.success = false
      }
    }

    console.log(`✅ Sincronización completa: ${results.processedAulas} aulas, ${results.totalCourses} cursos, ${results.totalActivities} actividades`)
    return results
  }

  /**
   * Sincronizar un aula específica
   */
  async syncAula(config: AulaConfig): Promise<{
    success: boolean
    coursesCount: number
    activitiesCount: number
    errors: string[]
  }> {
    const errors: string[] = []
    let coursesCount = 0
    let activitiesCount = 0

    try {
      // 1. Asegurar que el aula existe en la base de datos
      await this.ensureAulaExists(config)

      // 2. Obtener cursos activos del aula
      console.log(`📚 Obteniendo cursos activos del aula ${config.id}`)
      const courses = await this.getActiveCourses(config)
      console.log(`📚 Encontrados ${courses.length} cursos activos en aula ${config.id}`)

      // 3. Sincronizar cada curso
      for (const course of courses) {
        try {
          await this.syncCourse(config, course)
          coursesCount++

          // 4. Obtener y sincronizar actividades del curso
          const courseActivitiesCount = await this.syncCourseActivities(config, course)
          activitiesCount += courseActivitiesCount
          
        } catch (courseError) {
          const errorMsg = `Error en curso ${course.id} (${course.fullname}): ${courseError}`
          console.error('❌', errorMsg)
          errors.push(errorMsg)
        }
      }

      // 5. Actualizar timestamp de última sincronización del aula
      await prisma.aula.update({
        where: { aulaId: config.id },
        data: { lastSync: new Date() }
      })

      console.log(`✅ Aula ${config.id} sincronizada: ${coursesCount} cursos, ${activitiesCount} actividades`)

    } catch (error) {
      const errorMsg = `Error sincronizando aula ${config.id}: ${error}`
      console.error('❌', errorMsg)
      errors.push(errorMsg)
    }

    return {
      success: errors.length === 0,
      coursesCount,
      activitiesCount,
      errors
    }
  }

  /**
   * Asegurar que el aula existe en la base de datos
   */
  private async ensureAulaExists(config: AulaConfig): Promise<void> {
    await prisma.aula.upsert({
      where: { aulaId: config.id },
      update: {
        name: config.name,
        baseUrl: config.baseUrl,
        apiUrl: config.apiUrl,
        isActive: true
      },
      create: {
        aulaId: config.id,
        name: config.name,
        baseUrl: config.baseUrl,
        apiUrl: config.apiUrl,
        isActive: true
      }
    })
  }

  /**
   * Obtener cursos activos de un aula usando el servicio de Moodle
   */
  private async getActiveCourses(config: AulaConfig): Promise<MoodleCourse[]> {
    try {
      const url = `${config.apiUrl}?wstoken=${config.token}&wsfunction=local_get_active_courses_get_courses&moodlewsrestformat=json`
      
      console.log(`📡 Consultando cursos activos: ${config.apiUrl}`)
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Verificar si hay errores en la respuesta de Moodle
      if (data.errorcode) {
        throw new Error(`Moodle Error: ${data.errorcode} - ${data.message}`)
      }

      // Si es un array, devolverlo directamente; si es un objeto con cursos, extraer los cursos
      if (Array.isArray(data)) {
        return data
      } else if (data.courses && Array.isArray(data.courses)) {
        return data.courses
      } else {
        console.warn(`⚠️ Respuesta inesperada del aula ${config.id}:`, data)
        return []
      }
    } catch (error) {
      console.error(`❌ Error obteniendo cursos del aula ${config.id}:`, error)
      throw error
    }
  }

  /**
   * Sincronizar un curso específico en la base de datos
   */
  private async syncCourse(config: AulaConfig, course: MoodleCourse): Promise<void> {
    const teacherIds = course.teachers?.map(t => t.id) || []
    const teacherNames = course.teachers?.map(t => `${t.firstname} ${t.lastname}`) || []

    await prisma.aulaCourse.upsert({
      where: {
        aulaId_courseId: {
          aulaId: config.id,
          courseId: course.id
        }
      },
      update: {
        courseName: course.fullname,
        shortName: course.shortname,
        categoryName: course.categoryname,
        isActive: course.visible,
        startDate: course.startdate ? new Date(course.startdate * 1000) : null,
        endDate: course.enddate ? new Date(course.enddate * 1000) : null,
        teacherIds: teacherIds,
        teacherNames: teacherNames,
        enrollmentCount: course.enrolledstudents,
        rawData: course as any,
        lastSync: new Date()
      },
      create: {
        aulaId: config.id,
        courseId: course.id,
        courseName: course.fullname,
        shortName: course.shortname,
        categoryName: course.categoryname,
        isActive: course.visible,
        startDate: course.startdate ? new Date(course.startdate * 1000) : null,
        endDate: course.enddate ? new Date(course.enddate * 1000) : null,
        teacherIds: teacherIds,
        teacherNames: teacherNames,
        enrollmentCount: course.enrolledstudents,
        rawData: course as any,
        lastSync: new Date()
      }
    })
  }

  /**
   * Sincronizar actividades de un curso específico
   */
  private async syncCourseActivities(config: AulaConfig, course: MoodleCourse): Promise<number> {
    let totalActivities = 0

    try {
      // Obtener tareas del curso
      const assignments = await this.getCourseAssignments(config, course.id)
      for (const assignment of assignments) {
        await this.syncActivity(config, course, assignment, 'assign')
        totalActivities++
      }

      // Obtener foros del curso
      const forums = await this.getCourseForums(config, course.id)
      for (const forum of forums) {
        await this.syncActivity(config, course, forum, 'forum')
        totalActivities++
      }

    } catch (error) {
      console.error(`❌ Error sincronizando actividades del curso ${course.id}:`, error)
    }

    return totalActivities
  }

  /**
   * Obtener tareas de un curso específico
   */
  private async getCourseAssignments(config: AulaConfig, courseId: number): Promise<MoodleAssignment[]> {
    try {
      // AV141 usa servicios web estándar, otras aulas usan servicios personalizados
      const wsFunction = config.id === 'av141' 
        ? 'mod_assign_get_assignments' 
        : 'local_get_assignments_extended'
      
      const url = `${config.apiUrl}?wstoken=${config.token}&wsfunction=${wsFunction}&moodlewsrestformat=json&courseids%5B0%5D=${courseId}`
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.errorcode) {
        throw new Error(`Moodle Error: ${data.errorcode} - ${data.message}`)
      }

      // La respuesta puede venir en diferentes formatos según el servicio
      if (Array.isArray(data)) {
        return data
      } else if (data.courses && Array.isArray(data.courses)) {
        // Si viene agrupado por cursos, extraer las tareas de todos los cursos
        const assignments: MoodleAssignment[] = []
        for (const courseData of data.courses) {
          if (courseData.assignments && Array.isArray(courseData.assignments)) {
            assignments.push(...courseData.assignments)
          }
        }
        return assignments
      } else if (data.assignments && Array.isArray(data.assignments)) {
        return data.assignments
      } else {
        // Log más detallado para debugging
        console.warn(`⚠️ Respuesta inesperada de tareas del curso ${courseId} en aula ${config.id}:`)
        console.warn(`   Función usada: ${config.id === 'av141' ? 'mod_assign_get_assignments' : 'local_get_assignments_extended'}`)
        console.warn(`   Estructura de respuesta:`, Object.keys(data))
        return []
      }
    } catch (error) {
      console.error(`❌ Error obteniendo tareas del curso ${courseId} en aula ${config.id}:`, error)
      return []
    }
  }

  /**
   * Obtener foros de un curso específico (usando servicios estándar de Moodle)
   */
  private async getCourseForums(config: AulaConfig, courseId: number): Promise<MoodleForum[]> {
    try {
      const url = `${config.apiUrl}?wstoken=${config.token}&wsfunction=mod_forum_get_forums_by_courses&moodlewsrestformat=json&courseids%5B0%5D=${courseId}`
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.errorcode) {
        throw new Error(`Moodle Error: ${data.errorcode} - ${data.message}`)
      }

      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error(`❌ Error obteniendo foros del curso ${courseId} en aula ${config.id}:`, error)
      return []
    }
  }

  /**
   * Sincronizar una actividad específica
   */
  private async syncActivity(
    config: AulaConfig, 
    course: MoodleCourse, 
    activity: MoodleAssignment | MoodleForum, 
    type: string
  ): Promise<void> {
    // Determinar si la actividad está activa
    const now = new Date()
    const dueDate = activity.duedate ? new Date(activity.duedate * 1000) : null
    const cutoffDate = activity.cutoffdate ? new Date(activity.cutoffdate * 1000) : null
    
    // Una actividad está activa si:
    // 1. No tiene fecha de vencimiento (siempre activa)
    // 2. Su fecha de vencimiento aún no ha llegado
    // 3. Si tiene cutoffDate, que tampoco haya llegado
    let isActive = true
    let statusReason = 'Sin fecha límite'
    
    if (dueDate) {
      isActive = dueDate > now
      statusReason = isActive ? 'Vigente hasta ' + dueDate.toLocaleDateString('es-ES') : 'Vencida el ' + dueDate.toLocaleDateString('es-ES')
    }
    
    if (cutoffDate && isActive) {
      isActive = cutoffDate > now
      if (!isActive) {
        statusReason = 'Corte final el ' + cutoffDate.toLocaleDateString('es-ES')
      }
    }

    const activityData = {
      aulaId: config.id,
      courseId: course.id,
      activityId: activity.id,
      type: type,
      name: activity.name,
      description: activity.intro,
      dueDate: dueDate,
      cutoffDate: cutoffDate,
      url: aulaConfigService.generateActivityUrl(config.id, type, activity.cmid),
      rawData: activity as any,
      needsAnalysis: isActive, // Solo analizar si está activa
      visible: isActive, // Marcar como visible solo si está activa
      lastDataSync: new Date()
    }

    console.log(`   📅 ${activity.name}: ${isActive ? '🟢 ACTIVA' : '🔴 INACTIVA'} (${statusReason})`)

    // Agregar datos específicos por tipo
    if (type === 'assign' && 'submissions' in activity) {
      activityData['assignmentData'] = {
        submissions: activity.submissions || [],
        grade: (activity as MoodleAssignment).grade
      }
    } else if (type === 'forum' && 'discussions' in activity) {
      activityData['forumData'] = {
        discussions: activity.discussions || []
      }
    }

    await prisma.courseActivity.upsert({
      where: {
        aulaId_courseId_activityId_type: {
          aulaId: config.id,
          courseId: course.id,
          activityId: activity.id,
          type: type
        }
      },
      update: {
        ...activityData,
        analysisCount: { increment: 0 } // No incrementar en update
      },
      create: activityData
    })
  }

  /**
   * Obtener estadísticas de sincronización
   */
  async getSyncStats(): Promise<{
    totalAulas: number
    activeCourses: number
    totalActivities: number
    lastSync: Date | null
    byAula: Array<{
      aulaId: string
      coursesCount: number
      activitiesCount: number
      lastSync: Date | null
    }>
  }> {
    const aulas = await prisma.aula.findMany({
      include: {
        courses: {
          where: { isActive: true },
          include: {
            activities: true
          }
        }
      }
    })

    const byAula = aulas.map(aula => ({
      aulaId: aula.aulaId,
      coursesCount: aula.courses.length,
      activitiesCount: aula.courses.reduce((sum, course) => sum + course.activities.length, 0),
      lastSync: aula.lastSync
    }))

    const totalActivities = byAula.reduce((sum, aula) => sum + aula.activitiesCount, 0)
    const activeCourses = byAula.reduce((sum, aula) => sum + aula.coursesCount, 0)
    const lastSync = aulas.reduce((latest: Date | null, aula) => {
      if (!aula.lastSync) return latest
      if (!latest || aula.lastSync > latest) return aula.lastSync
      return latest
    }, null)

    return {
      totalAulas: aulas.length,
      activeCourses,
      totalActivities,
      lastSync,
      byAula
    }
  }
}

// Singleton export
export const moodleSyncService = MoodleSyncService.getInstance()