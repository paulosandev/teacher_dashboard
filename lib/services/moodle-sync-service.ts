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

    // Primero crear/actualizar el curso en la tabla Course
    await prisma.course.upsert({
      where: {
        moodleCourseId: course.id.toString()
      },
      update: {
        name: course.fullname,
        shortName: course.shortname,
        lastSync: new Date()
      },
      create: {
        moodleCourseId: course.id.toString(),
        name: course.fullname,
        shortName: course.shortname,
        lastSync: new Date()
      }
    })

    console.log(`💾 [COURSE] Curso guardado: ${course.shortname} (${course.id})`)

    // Luego crear/actualizar la relación aula-curso
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
   * Sincronizar actividades de un curso específico usando detección avanzada
   * UNIFICADO con la lógica del endpoint /api/group/activities
   */
  private async syncCourseActivities(config: AulaConfig, course: MoodleCourse): Promise<number> {
    let totalActivities = 0

    try {
      console.log(`📚 [SYNC AVANZADO] Detectando actividades del curso ${course.id} en aula ${config.id}`)

      // PASO 1: Usar core_course_get_contents (método principal)
      let activities: any[] = []

      try {
        const contentsUrl = `${config.apiUrl}?wstoken=${config.token}&wsfunction=core_course_get_contents&moodlewsrestformat=json&courseid=${course.id}`
        const contentsResponse = await fetch(contentsUrl)

        if (contentsResponse.ok) {
          const contentsData = await contentsResponse.json()

          if (!contentsData.errorcode && Array.isArray(contentsData)) {
            console.log(`📋 [TOKEN USUARIO] Obtenidas ${contentsData.length} secciones del curso`)

            // Procesar cada sección
            for (const section of contentsData) {
              if (section.modules && Array.isArray(section.modules)) {
                for (const module of section.modules) {
                  if (['assign', 'forum'].includes(module.modname)) {
                    activities.push({
                      ...module,
                      // CORRECCIÓN: Para foros, usar instance (forum ID) en lugar de id (module ID)
                      id: module.modname === 'forum' ? module.instance : module.id,
                      sectionName: section.name,
                      detectionMethod: 'core_course_get_contents'
                    })
                  }
                }
              }
            }
          }
        }
      } catch (contentsError) {
        console.warn(`⚠️ Error con core_course_get_contents, usando métodos alternativos:`, contentsError)
      }

      // PASO 2: APIs directas como respaldo (mod_assign_get_assignments)
      try {
        const assignUrl = `${config.apiUrl}?wstoken=${config.token}&wsfunction=mod_assign_get_assignments&moodlewsrestformat=json&courseids%5B0%5D=${course.id}`
        const assignResponse = await fetch(assignUrl)

        if (assignResponse.ok) {
          const assignData = await assignResponse.json()
          if (assignData.courses && assignData.courses.length > 0) {
            const courseAssignments = assignData.courses[0].assignments || []
            console.log(`📝 Encontradas ${courseAssignments.length} tareas adicionales via API directa`)

            for (const assignment of courseAssignments) {
              // Evitar duplicados
              const exists = activities.find(a => a.id === assignment.id && a.modname === 'assign')
              if (!exists) {
                activities.push({
                  id: assignment.id,
                  name: assignment.name,
                  modname: 'assign',
                  url: `${config.baseUrl}/mod/assign/view.php?id=${assignment.id}`,
                  description: assignment.intro,
                  duedate: assignment.duedate,
                  cutoffdate: assignment.cutoffdate,
                  sectionName: 'Assignments API',
                  detectionMethod: 'mod_assign_get_assignments',
                  assignmentData: assignment
                })
              }
            }
          }
        }
      } catch (assignError) {
        console.warn(`⚠️ Error obteniendo tareas adicionales:`, assignError)
      }

      // PASO 3: APIs directas para foros (mod_forum_get_forums_by_courses)
      try {
        const forumUrl = `${config.apiUrl}?wstoken=${config.token}&wsfunction=mod_forum_get_forums_by_courses&moodlewsrestformat=json&courseids%5B0%5D=${course.id}`
        const forumResponse = await fetch(forumUrl)

        if (forumResponse.ok) {
          const forumData = await forumResponse.json()
          if (Array.isArray(forumData) && forumData.length > 0) {
            console.log(`🗣️ Encontrados ${forumData.length} foros adicionales via API directa`)

            for (const forum of forumData) {
              // Evitar duplicados
              const exists = activities.find(a => a.id === forum.id && a.modname === 'forum')
              if (!exists) {
                // Obtener discusiones del foro
                let discussions = []
                try {
                  const discUrl = `${config.apiUrl}?wstoken=${config.token}&wsfunction=mod_forum_get_forum_discussions&moodlewsrestformat=json&forumid=${forum.id}`
                  const discResponse = await fetch(discUrl)
                  if (discResponse.ok) {
                    const discData = await discResponse.json()
                    discussions = discData.discussions || []
                  }
                } catch (discError) {
                  console.warn(`⚠️ Error obteniendo discusiones del foro ${forum.id}:`, discError)
                }

                activities.push({
                  id: forum.id,
                  name: forum.name,
                  modname: 'forum',
                  url: `${config.baseUrl}/mod/forum/view.php?id=${forum.id}`,
                  description: forum.intro,
                  sectionName: 'Forums API',
                  detectionMethod: 'mod_forum_get_forums_by_courses',
                  forumData: {
                    ...forum,
                    discussions: discussions
                  }
                })
              }
            }
          }
        }
      } catch (forumError) {
        console.warn(`⚠️ Error obteniendo foros adicionales:`, forumError)
      }

      console.log(`✅ Total de actividades detectadas: ${activities.length}`)

      // PASO 4: Sincronizar cada actividad detectada
      for (const activity of activities) {
        try {
          await this.syncAdvancedActivity(config, course, activity)
          totalActivities++
        } catch (activityError) {
          console.error(`❌ Error sincronizando actividad ${activity.id} (${activity.name}):`, activityError)
        }
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

      const forums = Array.isArray(data) ? data : []
      
      // Para cada foro, intentar obtener sus discusiones
      for (const forum of forums) {
        try {
          const discussionsUrl = `${config.apiUrl}?wstoken=${config.token}&wsfunction=mod_forum_get_forum_discussions&moodlewsrestformat=json&forumid=${forum.id}`
          const discussionsResponse = await fetch(discussionsUrl)
          
          if (discussionsResponse.ok) {
            const discussionsData = await discussionsResponse.json()
            if (discussionsData.discussions && Array.isArray(discussionsData.discussions)) {
              console.log(`  📋 ${discussionsData.discussions.length} discusiones encontradas en foro "${forum.name}"`)
              
              // NUEVO: Para cada discusión, obtener los posts individuales
              for (const discussion of discussionsData.discussions) {
                try {
                  const discussionId = discussion.discussion || discussion.id
                  const postsUrl = `${config.apiUrl}?wstoken=${config.token}&wsfunction=mod_forum_get_forum_discussion_posts&moodlewsrestformat=json&discussionid=${discussionId}`
                  const postsResponse = await fetch(postsUrl)
                  
                  if (postsResponse.ok) {
                    const postsData = await postsResponse.json()
                    if (postsData.posts && Array.isArray(postsData.posts)) {
                      discussion.posts = postsData.posts
                      console.log(`    💬 Discusión "${discussion.name}": ${postsData.posts.length} posts obtenidos`)
                    } else {
                      discussion.posts = []
                    }
                  } else {
                    discussion.posts = []
                  }
                } catch (postsError) {
                  console.warn(`⚠️ Error obteniendo posts de discusión ${discussion.id}:`, postsError)
                  discussion.posts = []
                }
              }
              
              forum.discussions = discussionsData.discussions
              // Guardar el ID de la primera discusión para generar URLs correctas
              if (discussionsData.discussions.length > 0) {
                forum.firstDiscussionId = discussionsData.discussions[0].discussion || discussionsData.discussions[0].id
              }
            }
          }
        } catch (discError) {
          // Si falla obtener discusiones, continuar sin ellas
          console.warn(`⚠️ No se pudieron obtener discusiones del foro ${forum.id}`)
        }
      }

      return forums
    } catch (error) {
      console.error(`❌ Error obteniendo foros del curso ${courseId} en aula ${config.id}:`, error)
      return []
    }
  }

  /**
   * Sincronizar una actividad específica - MÉTODO AVANZADO
   * Incluye análisis de entregas para assignments y discusiones para foros
   */
  private async syncAdvancedActivity(
    config: AulaConfig,
    course: MoodleCourse,
    activity: any
  ): Promise<void> {

    // Inicializar variables de datos específicos por tipo
    let assignmentData = null
    let forumData = null

    // VALIDACIÓN MEJORADA DE FECHAS ACTIVAS (según requerimientos del usuario)
    const now = new Date()

    // Fechas de inicio
    const startDate = activity.allowsubmissionsfromdate ? new Date(activity.allowsubmissionsfromdate * 1000) : null
    const timeOpen = activity.timeopen ? new Date(activity.timeopen * 1000) : null
    const availableFrom = startDate || timeOpen

    // Fechas de fin
    const dueDate = activity.duedate ? new Date(activity.duedate * 1000) : null
    const cutoffDate = activity.cutoffdate ? new Date(activity.cutoffdate * 1000) : null
    const timeClose = activity.timeclose ? new Date(activity.timeclose * 1000) : null
    const availableUntil = cutoffDate || dueDate || timeClose

    let isActive = true
    let statusReason = 'Actividad abierta'

    // 1. Validar fecha de inicio (si existe)
    if (availableFrom && availableFrom > now) {
      isActive = false
      statusReason = `Inicia el ${availableFrom.toLocaleDateString('es-ES')} a las ${availableFrom.toLocaleTimeString('es-ES')}`
    }

    // 2. Validar fecha de fin (si existe y ya pasó el inicio)
    else if (availableUntil && availableUntil <= now) {
      isActive = false
      statusReason = `Cerró el ${availableUntil.toLocaleDateString('es-ES')} a las ${availableUntil.toLocaleTimeString('es-ES')}`
    }

    // 3. Si está en periodo activo
    else if (availableFrom && availableUntil) {
      statusReason = `Activa desde ${availableFrom.toLocaleDateString('es-ES')} hasta ${availableUntil.toLocaleDateString('es-ES')}`
    } else if (availableFrom) {
      statusReason = `Activa desde ${availableFrom.toLocaleDateString('es-ES')} (sin fecha de cierre)`
    } else if (availableUntil) {
      statusReason = `Activa hasta ${availableUntil.toLocaleDateString('es-ES')}`
    }

    console.log(`📅 [VALIDACIÓN] Actividad "${activity.name}": ${statusReason} (Activa: ${isActive})`)

    // NUEVO: Para aulas principales (101-110), analizar TODAS las actividades
    // Para av141, mantener la lógica anterior (solo activas o con contenido)
    const isMainAula = /^10[1-9]$|^110$/.test(config.id) // Aulas 101-110

    console.log(`   📅 ${activity.name}: ${isActive ? '🟢 ACTIVA' : '🔴 INACTIVA'} (${statusReason})`)

    // NUEVO: Análisis específico por tipo de actividad
    if (activity.modname === 'assign') {
      // Obtener entregas de estudiantes para analysis
      const submissions = await this.getAssignmentSubmissions(config, activity.id)

      assignmentData = {
        submissions: submissions,
        grade: activity.assignmentData?.grade || activity.grade || 0,
        submissionCount: submissions.length,
        gradedCount: submissions.filter(s => s.grade !== undefined && s.grade >= 0).length
      }


    } else if (activity.modname === 'forum') {

      const discussions = activity.forumData?.discussions || []
      let totalPosts = 0

      // Contar posts en todas las discusiones
      for (const discussion of discussions) {
        if (discussion.posts) {
          totalPosts += discussion.posts.length
        }
      }

      forumData = {
        discussions: discussions,
        discussionCount: discussions.length,
        totalPosts: totalPosts,
        firstDiscussionId: discussions.length > 0 ? discussions[0].id : null
      }

    }

    // NUEVO: Determinar si actividad tiene contenido sustancial (después de poblar datos)
    const hasSubstantialContent = (assignmentData && (
      assignmentData.submissions?.length > 0 ||
      assignmentData.submissionCount > 0
    )) || (forumData && (
      forumData.discussions?.length > 0 ||
      forumData.discussionCount > 0 ||
      forumData.totalPosts > 0
    ))

    // NUEVO: Determinar si necesita análisis
    const needsAnalysis = isMainAula ? true : (isActive || hasSubstantialContent)

    // Logs informativos
    if (hasSubstantialContent && !isActive) {
      console.log(`   📊 Contenido sustancial detectado - marcando para análisis aunque esté vencida`)
    }
    if (isMainAula && !isActive && !hasSubstantialContent) {
      console.log(`   🎯 AULA PRINCIPAL: Analizando actividad sin contenido para detectar falta de actividad`)
    }

    // Datos base de la actividad con campos específicos
    const activityData = {
      aulaId: config.id,
      courseId: course.id,
      activityId: activity.id,
      type: activity.modname,
      name: activity.name,
      description: activity.description || activity.intro || '',
      dueDate: dueDate,
      cutoffDate: cutoffDate,
      url: activity.url || `${config.baseUrl}/mod/${activity.modname}/view.php?id=${activity.id}`,
      rawData: activity as any,
      needsAnalysis: needsAnalysis,
      visible: isActive,
      lastDataSync: new Date(),
      assignmentData,
      forumData
    }

    // Guardar en base de datos
    try {

      await prisma.courseActivity.upsert({
        where: {
          aulaId_courseId_activityId_type: {
            aulaId: config.id,
            courseId: course.id,
            activityId: activity.id,
            type: activity.modname
          }
        },
        update: {
          ...activityData,
          analysisCount: { increment: 0 } // No incrementar en update
        },
        create: activityData
      })

      console.log(`   ✅ [DB] Actividad guardada exitosamente`)
    } catch (dbError) {
      console.error(`   ❌ [DB] Error detallado al guardar actividad:`)
      console.error(`   🔍 [DB] Activity Data:`, JSON.stringify({
        aulaId: config.id,
        courseId: course.id,
        activityId: activity.id,
        type: activity.modname,
        name: activity.name,
        hasAssignmentData: !!assignmentData,
        hasForumData: !!forumData,
        dataKeys: Object.keys(activityData)
      }, null, 2))
      console.error(`   🔥 [DB] Prisma Error:`, dbError)
      throw dbError // Re-throw para mantener el comportamiento existente
    }
  }

  /**
   * Obtener entregas de estudiantes para una tarea específica
   */
  private async getAssignmentSubmissions(config: AulaConfig, assignmentId: number): Promise<any[]> {
    try {
      const url = `${config.apiUrl}?wstoken=${config.token}&wsfunction=mod_assign_get_submissions&moodlewsrestformat=json&assignmentids%5B0%5D=${assignmentId}`
      const response = await fetch(url)

      if (response.ok) {
        const data = await response.json()

        if (data.assignments && data.assignments.length > 0) {
          const submissions = data.assignments[0].submissions || []

          // Para cada entrega, intentar obtener comentarios de retroalimentación
          for (const submission of submissions) {
            try {
              // Obtener comentarios del profesor
              const commentsUrl = `${config.apiUrl}?wstoken=${config.token}&wsfunction=assignsubmission_comments_get_comments&moodlewsrestformat=json&submissionid=${submission.id}`
              const commentsResponse = await fetch(commentsUrl)

              if (commentsResponse.ok) {
                const commentsData = await commentsResponse.json()
                submission.comments = commentsData.comments || []
              }
            } catch (commentsError) {
              // Opcional: comentarios no críticos
              submission.comments = []
            }
          }

          return submissions
        }
      }

      return []
    } catch (error) {
      console.warn(`⚠️ Error obteniendo entregas de assignment ${assignmentId}:`, error)
      return []
    }
  }

  /**
   * Sincronizar una actividad específica - MÉTODO LEGACY (mantener compatibilidad)
   */
  private async syncActivity(
    config: AulaConfig,
    course: MoodleCourse,
    activity: MoodleAssignment | MoodleForum,
    type: string
  ): Promise<void> {
    // Redirigir al método avanzado
    await this.syncAdvancedActivity(config, course, {
      ...activity,
      modname: type,
      id: activity.id,
      name: activity.name,
      intro: activity.intro,
      duedate: activity.duedate,
      cutoffdate: activity.cutoffdate
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

  /**
   * Sincronizar datos de un aula específica por ID
   */
  async syncAulaData(aulaId: string): Promise<{
    success: boolean
    coursesProcessed?: number
    analysisGenerated?: number
    activitiesProcessed?: number
    message?: string
  }> {
    try {
      console.log(`🔄 [UNIFIED] Sincronizando aula ${aulaId} con análisis completo`)
      
      // Buscar configuración del aula
      const aulaConfig = aulaConfigService.getAulaConfig(aulaId)
      
      if (!aulaConfig) {
        return {
          success: false,
          message: `Configuración no encontrada para aula ${aulaId}`
        }
      }

      // PASO 1: Sincronizar actividades
      console.log(`📋 [UNIFIED] Paso 1: Sincronizando actividades para aula ${aulaId}`)
      const syncResult = await this.syncAula(aulaConfig)
      
      if (!syncResult.success) {
        return {
          success: false,
          coursesProcessed: syncResult.coursesCount || 0,
          activitiesProcessed: syncResult.activitiesCount || 0,
          analysisGenerated: 0,
          message: `Error sincronizando aula ${aulaId}: ${syncResult.errors.join(', ')}`
        }
      }

      console.log(`✅ [UNIFIED] Sincronización completada: ${syncResult.activitiesCount} actividades`)

      // PASO 2: Ejecutar análisis de IA
      console.log(`🧠 [UNIFIED] Paso 2: Ejecutando análisis de IA para actividades pendientes`)
      let analysisGenerated = 0
      
      try {
        // Importar dinámicamente el servicio de análisis
        const { batchAnalysisService } = await import('@/lib/services/batch-analysis-service')
        
        // Ejecutar análisis solo para actividades de esta aula específica
        const analysisResult = await batchAnalysisService.analyzeSpecificActivities({
          aulaId: aulaId,
          forceReAnalysis: false
        })
        
        analysisGenerated = analysisResult.generatedAnalyses
        console.log(`✅ [UNIFIED] Análisis de IA completado: ${analysisGenerated} análisis generados`)
        
      } catch (analysisError) {
        console.error(`⚠️ [UNIFIED] Error en análisis de IA para aula ${aulaId}:`, analysisError)
        // No fallar todo el proceso por errores de análisis
      }
      
      console.log(`🎉 [UNIFIED] Proceso completo para aula ${aulaId}: ${syncResult.activitiesCount} actividades sincronizadas, ${analysisGenerated} análisis generados`)
      
      return {
        success: true,
        coursesProcessed: syncResult.coursesCount || 0,
        activitiesProcessed: syncResult.activitiesCount || 0,
        analysisGenerated: analysisGenerated, // ✅ AHORA REAL
        message: `Aula ${aulaId} procesada completamente: ${syncResult.activitiesCount} actividades, ${analysisGenerated} análisis`
      }
      
    } catch (error) {
      console.error(`❌ [UNIFIED] Error procesando aula ${aulaId}:`, error)
      return {
        success: false,
        message: `Error procesando aula ${aulaId}: ${error}`
      }
    }
  }
}

// Singleton export
export const moodleSyncService = MoodleSyncService.getInstance()