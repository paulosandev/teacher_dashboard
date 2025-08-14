/**
 * Cliente real de la API de Moodle
 * Implementa las llamadas a los Web Services de Moodle
 */

interface MoodleConfig {
  baseUrl: string
  token: string
}

interface MoodleCourse {
  id: number
  shortname: string
  fullname: string
  displayname?: string
  enrolledusercount?: number
  visible?: number
  summary?: string
  category?: number
  enddate?: number
  model?: string
}

interface MoodleGroup {
  id: number
  name: string
  description: string
  courseid: number
}

interface MoodleForum {
  id: number
  course: number
  name: string
  intro: string
  type: string
  timemodified: number
}

interface MoodleDiscussion {
  id: number
  name: string
  groupid: number
  timemodified: number
  usermodified: number
  numreplies: number
  created: number
  modified: number
}

interface MoodlePost {
  id: number
  discussion: number
  parent: number
  userid: number
  created: number
  modified: number
  subject: string
  message: string
  messageformat: number
}

class MoodleAPIClient {
  private config: MoodleConfig | null = null

  constructor(baseUrl?: string, token?: string) {
    if (baseUrl && token) {
      this.config = {
        baseUrl,
        token
      }
    }
  }

  private getConfig(): MoodleConfig {
    if (!this.config) {
      this.config = {
        baseUrl: process.env.MOODLE_API_URL || '',
        token: process.env.MOODLE_API_TOKEN || '',
      }
    }
    return this.config
  }

  /**
   * Realiza una llamada a la API de Moodle
   */
  private async callMoodleAPI(wsfunction: string, params: Record<string, any> = {}): Promise<any> {
    // Obtener configuración
    const config = this.getConfig()
    
    // Validar que tengamos configuración
    if (!config.baseUrl || !config.token) {
      throw new Error('Configuración de Moodle incompleta. Verifica MOODLE_API_URL y MOODLE_API_TOKEN en tu archivo .env')
    }
    
    const url = new URL(config.baseUrl)
    
    // Parámetros base para todas las llamadas
    const baseParams = {
      wstoken: config.token,
      wsfunction: wsfunction,
      moodlewsrestformat: 'json',
    }

    // Combinar parámetros
    const allParams: Record<string, any> = { ...baseParams, ...params }

    // Agregar parámetros a la URL
    Object.keys(allParams).forEach(key => {
      if (Array.isArray(allParams[key])) {
        // Manejar arrays (ej: courseids[0]=1, courseids[1]=2)
        allParams[key].forEach((value: any, index: number) => {
          url.searchParams.append(`${key}[${index}]`, value.toString())
        })
      } else {
        url.searchParams.append(key, allParams[key].toString())
      }
    })

    try {
      console.log(`📡 Llamando Moodle API: ${wsfunction}`)
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Verificar si hay error de Moodle
      if (data.exception) {
        throw new Error(`Moodle error: ${data.message || data.exception}`)
      }

      return data
    } catch (error) {
      console.error(`❌ Error llamando Moodle API (${wsfunction}):`, error)
      throw error
    }
  }

  /**
   * Obtiene todos los cursos activos usando el plugin personalizado
   * Este endpoint no requiere permisos especiales
   */
  async getActiveCourses(): Promise<MoodleCourse[]> {
    try {
      const courses = await this.callMoodleAPI('local_get_active_courses_get_courses')
      
      // Los cursos ya vienen filtrados como activos
      return courses || []
    } catch (error) {
      console.error('Error obteniendo cursos activos:', error)
      return []
    }
  }

  /**
   * Obtiene los cursos donde el usuario es profesor
   * SEGURIDAD: SIEMPRE filtra por rol de profesor para evitar mostrar cursos donde es estudiante
   * Nota: Requiere el ID del usuario en Moodle
   */
  async getUserCourses(userId: number): Promise<MoodleCourse[]> {
    console.log(`🔒 [SEGURIDAD] Obteniendo SOLO cursos donde userId ${userId} es PROFESOR...`)
    
    // SIEMPRE usar el método de filtrado por rol por seguridad
    // No usar core_enrol_get_users_courses directamente porque incluye cursos donde es estudiante
    return this.getTeacherCoursesFiltered(userId)
  }

  /**
   * Obtiene cursos donde el usuario es profesor usando filtrado por rol
   * NUEVO: Usa los cursos del usuario directamente en lugar de filtrar todos los cursos activos
   */
  async getTeacherCoursesFiltered(userId: number): Promise<MoodleCourse[]> {
    try {
      console.log(`🔍 [SEGURIDAD] Obteniendo cursos de userId ${userId} y filtrando solo donde es profesor...`)
      
      // Obtener TODOS los cursos donde el usuario está inscrito
      const allUserCourses = await this.callMoodleAPI('core_enrol_get_users_courses', {
        userid: userId,
      })
      
      if (allUserCourses.length === 0) {
        console.log('📚 No hay cursos donde el usuario esté inscrito')
        return []
      }
      
      console.log(`📚 Encontrados ${allUserCourses.length} cursos donde está inscrito. Filtrando solo donde es profesor...`)
      
      const teacherCourses: MoodleCourse[] = []
      
      // Para cada curso donde está inscrito, verificar si es profesor
      for (let i = 0; i < allUserCourses.length; i++) {
        const course = allUserCourses[i]
        
        try {
          console.log(`🔎 [${i+1}/${allUserCourses.length}] Verificando roles en: ${course.shortname}...`)
          
          // Obtener usuarios inscritos con roles para este curso
          const enrolledUsers = await this.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: course.id
          })
          
          // Buscar específicamente nuestro usuario
          const userInCourse = enrolledUsers.find((user: any) => user.id === userId)
          
          if (userInCourse && userInCourse.roles && userInCourse.roles.length > 0) {
            const roles = userInCourse.roles.map((role: any) => ({
              id: role.roleid,
              name: role.shortname || role.name
            }))
            
            console.log(`   🎭 Roles: ${roles.map((r: any) => `${r.name}(${r.id})`).join(', ')}`)
            
            // Verificar si tiene rol de profesor
            const hasTeacherRole = userInCourse.roles.some((role: any) => {
              const roleName = (role.shortname || role.name || '').toLowerCase()
              return (
                role.roleid === 3 || // editingteacher
                role.roleid === 4 || // teacher
                role.roleid === 1 || // manager
                roleName.includes('teacher') ||
                roleName.includes('editor') ||
                roleName.includes('manager') ||
                roleName.includes('tutor')
              )
            })
            
            if (hasTeacherRole) {
              console.log(`   ✅ ES PROFESOR - Agregando curso: ${course.shortname}`)
              teacherCourses.push(course)
            } else {
              console.log(`   👨‍🎓 Es estudiante - Omitiendo: ${course.shortname}`)
            }
          } else {
            console.log(`   ⚠️ Sin roles encontrados en: ${course.shortname}`)
          }
          
        } catch (courseError) {
          console.log(`   ❌ Error verificando ${course.shortname}: ${courseError instanceof Error ? courseError.message : courseError}`)
          continue
        }
      }
      
      console.log(`📊 RESULTADO: ${teacherCourses.length} cursos como profesor de ${allUserCourses.length} total`)
      
      if (teacherCourses.length === 0) {
        console.log(`🚫 [SEGURIDAD] No se encontraron cursos donde userId ${userId} sea profesor`)
      } else {
        console.log(`🎓 [ÉXITO] Usuario ${userId} es profesor en:`);
        teacherCourses.forEach(course => {
          console.log(`   - ${course.shortname}: ${course.fullname}`)
        })
      }
      
      return teacherCourses
      
    } catch (error) {
      console.error(`❌ Error crítico en filtrado de cursos para userId ${userId}:`, error)
      return [] // En caso de error, no devolver cursos por seguridad
    }
  }

  /**
   * Obtiene todos los grupos de un curso
   */
  async getCourseGroups(courseId: number): Promise<MoodleGroup[]> {
    try {
      const groups = await this.callMoodleAPI('core_group_get_course_groups', {
        courseid: courseId,
      })
      
      return groups || []
    } catch (error) {
      console.error('Error obteniendo grupos del curso:', error)
      return []
    }
  }

  /**
   * Obtiene los foros de un curso
   */
  async getCourseForums(courseId: number): Promise<MoodleForum[]> {
    try {
      const forums = await this.callMoodleAPI('mod_forum_get_forums_by_courses', {
        courseids: [courseId],
      })
      
      return forums || []
    } catch (error) {
      console.error('Error obteniendo foros del curso:', error)
      return []
    }
  }

  /**
   * Obtiene las discusiones de un foro
   */
  async getForumDiscussions(forumId: number | string, groupId?: string): Promise<MoodleDiscussion[] | any[]> {
    try {
      const forumIdNum = typeof forumId === 'string' ? parseInt(forumId) : forumId
      
      // Usar solo el parámetro requerido, sin sortby/sortdirection que causan error
      const response = await this.callMoodleAPI('mod_forum_get_forum_discussions', {
        forumid: forumIdNum
      })
      
      return response.discussions || []
    } catch (error) {
      console.error('Error obteniendo discusiones del foro:', error)
      return []
    }
  }

  /**
   * Obtiene los posts de una discusión
   */
  async getDiscussionPosts(discussionId: number): Promise<MoodlePost[]> {
    try {
      const response = await this.callMoodleAPI('mod_forum_get_discussion_posts', {
        discussionid: discussionId,
      })
      
      return response.posts || []
    } catch (error) {
      console.error('Error obteniendo posts de la discusión:', error)
      return []
    }
  }

  /**
   * Obtiene el contenido/secciones del curso (incluye actividades)
   */
  async getCourseContents(courseId: number): Promise<any[]> {
    try {
      const contents = await this.callMoodleAPI('core_course_get_contents', {
        courseid: courseId,
      })
      
      return contents || []
    } catch (error) {
      console.error('Error obteniendo contenido del curso:', error)
      return []
    }
  }

  /**
   * Obtiene usuarios matriculados en un curso con sus roles
   */
  async getEnrolledUsers(courseId: number): Promise<any[]> {
    try {
      const users = await this.callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: courseId
      })
      
      return users || []
    } catch (error) {
      console.error('Error obteniendo usuarios matriculados:', error)
      return []
    }
  }

  /**
   * Obtiene las entregas de una tarea (assignment)
   */
  async getAssignmentSubmissions(assignmentId: number): Promise<any> {
    try {
      const submissions = await this.callMoodleAPI('mod_assign_get_submissions', {
        assignmentids: [assignmentId],
      })
      
      return submissions?.assignments?.[0] || { submissions: [] }
    } catch (error) {
      console.error(`Error obteniendo entregas de la tarea ${assignmentId}:`, error)
      return { submissions: [] }
    }
  }

  /**
   * Obtiene detalles completos de una tarea (assignment)
   */
  async getAssignmentDetails(assignmentId: number): Promise<any> {
    try {
      const assignments = await this.callMoodleAPI('mod_assign_get_assignments', {
        assignmentids: [assignmentId],
      })
      
      return assignments?.courses?.[0]?.assignments?.[0] || null
    } catch (error) {
      console.error(`Error obteniendo detalles de la tarea ${assignmentId}:`, error)
      return null
    }
  }

  /**
   * Obtiene el contenido del curso filtrado por grupo
   * Incluye el mapeo de qué módulos/actividades corresponden a cada grupo
   */
  async getCourseContentsByGroup(courseId: number, groupId: number): Promise<any[]> {
    try {
      const allContents = await this.callMoodleAPI('core_course_get_contents', {
        courseid: courseId,
        options: [
          { name: 'excludemodules', value: '0' },
          { name: 'excludecontents', value: '0' }
        ]
      })
      
      // Filtrar módulos que pertenecen al grupo específico
      // Esto requiere analizar la disponibilidad y restricciones de cada módulo
      const filteredContents = []
      
      for (const section of allContents) {
        const filteredSection = {
          ...section,
          modules: []
        }
        
        if (section.modules) {
          for (const sectionModule of section.modules) {
            // Verificar si el módulo está disponible para el grupo
            if (await this.isModuleAvailableForGroup(sectionModule, groupId)) {
              filteredSection.modules.push(sectionModule)
            }
          }
        }
        
        // Solo incluir secciones que tengan módulos para este grupo
        if (filteredSection.modules.length > 0) {
          filteredContents.push(filteredSection)
        }
      }
      
      return filteredContents
    } catch (error) {
      console.error('Error obteniendo contenido del curso por grupo:', error)
      return []
    }
  }

  /**
   * Verifica si un módulo está disponible para un grupo específico
   */
  private async isModuleAvailableForGroup(module: any, groupId: number): Promise<boolean> {
    // Si no hay restricciones de disponibilidad, está disponible para todos
    if (!module.availability) {
      return true
    }
    
    try {
      // Parsear las restricciones de disponibilidad (formato JSON)
      const availability = JSON.parse(module.availability)
      
      // Buscar restricciones de grupo
      if (availability.c && Array.isArray(availability.c)) {
        for (const condition of availability.c) {
          // type: 'group' indica restricción por grupo
          if (condition.type === 'group') {
            // Si el módulo está restringido a un grupo específico
            if (condition.id && condition.id !== groupId) {
              return false // No disponible para este grupo
            }
            if (condition.id === groupId) {
              return true // Disponible para este grupo
            }
          }
        }
      }
      
      return true // Si no hay restricciones de grupo, está disponible
    } catch (error) {
      // Si no se pueden parsear las restricciones, asumir que está disponible
      return true
    }
  }

  /**
   * Obtiene información detallada de un módulo específico
   * Incluye recursos, archivos, y configuración completa
   */
  async getModuleDetails(moduleId: number, moduleType: string): Promise<any> {
    try {
      let details = null
      
      switch (moduleType) {
        case 'assign':
          details = await this.getAssignmentDetails(moduleId)
          if (details) {
            details.submissions = await this.getAssignmentSubmissions(moduleId)
          }
          break
          
        case 'forum':
          const forums = await this.callMoodleAPI('mod_forum_get_forums_by_courses', {
            courseids: [moduleId]
          })
          details = forums?.[0] || null
          break
          
        case 'resource':
        case 'url':
        case 'page':
        case 'book':
          // Para recursos, obtener información del archivo o contenido
          details = { type: moduleType, id: moduleId }
          break
          
        case 'quiz':
          // Obtener detalles del quiz
          try {
            const quizzes = await this.callMoodleAPI('mod_quiz_get_quizzes_by_courses', {
              courseids: [moduleId]
            })
            details = quizzes?.quizzes?.[0] || null
          } catch (error) {
            console.log(`No se pudo obtener detalles del quiz ${moduleId}`)
          }
          break
          
        default:
          details = { type: moduleType, id: moduleId }
      }
      
      return details
    } catch (error) {
      console.error(`Error obteniendo detalles del módulo ${moduleId} (${moduleType}):`, error)
      return null
    }
  }

  /**
   * Obtiene las modalidades/grupos de evaluación de un curso
   * En UTEL estos grupos representan diferentes modalidades (actividades, proyectos, etc.)
   */
  async getCourseGroupsWithDetails(courseId: number): Promise<any[]> {
    try {
      const groups = await this.callMoodleAPI('core_group_get_course_groups', {
        courseid: courseId,
      })
      
      // Enriquecer cada grupo con información sobre su modalidad
      const groupsWithDetails = []
      for (const group of groups) {
        const groupDetail = {
          ...group,
          modalityType: this.identifyModalityType(group.name),
          memberCount: 0
        }
        
        // Obtener miembros del grupo
        try {
          const members = await this.callMoodleAPI('core_group_get_group_members', {
            groupids: [group.id]
          })
          groupDetail.memberCount = members?.[0]?.userids?.length || 0
        } catch (error) {
          console.log(`No se pudo obtener miembros del grupo ${group.id}`)
        }
        
        groupsWithDetails.push(groupDetail)
      }
      
      return groupsWithDetails
    } catch (error) {
      console.error('Error obteniendo grupos detallados del curso:', error)
      return []
    }
  }

  /**
   * Identifica el tipo de modalidad basado en el nombre del grupo
   */
  private identifyModalityType(groupName: string): string {
    const name = groupName.toLowerCase()
    
    if (name.includes('actividad') || name.includes('activities')) {
      return 'activities'
    } else if (name.includes('proyecto') || name.includes('project')) {
      return 'project'
    } else if (name.includes('examen') || name.includes('exam')) {
      return 'exam'
    } else if (name.includes('practica') || name.includes('practice')) {
      return 'practice'
    }
    
    return 'standard'
  }

  /**
   * Obtiene información completa para poblar el selector
   * SOLO devuelve cursos donde el usuario especificado es profesor
   * 
   * @param userMatricula - Matrícula del profesor (se mapea a userId de Moodle)
   */
  async getTeacherCoursesWithGroups(userMatricula: string): Promise<Array<{
    id: string
    name: string
    shortName: string
    model?: string
    groups: Array<{ id: string; name: string }>
  }>> {
    try {
      // Paso 1: Obtener el ID de Moodle por matrícula
      console.log(`🔍 Buscando usuario con matrícula: ${userMatricula}...`)
      const moodleUser = await this.getUserByUsername(userMatricula)
      
      if (!moodleUser) {
        console.log(`⚠️ No se encontró usuario con matrícula: ${userMatricula}`)
        return []
      }
      
      console.log(`👤 Usuario encontrado - ID: ${moodleUser.id}, Email: ${moodleUser.email}`)
      
      // Paso 2: Obtener cursos donde es profesor usando el método tradicional
      console.log('📚 Obteniendo cursos donde es profesor...')
      const courses = await this.getUserCourses(moodleUser.id)
      
      if (courses.length === 0) {
        console.log('⚠️ No se encontraron cursos para este profesor')
        return []
      }
      
      console.log(`📖 Encontrados ${courses.length} cursos para el profesor`)
      
      // Paso 3: Para cada curso, obtener sus grupos
      const coursesWithGroups = await Promise.all(
        courses.map(async (course) => {
          const groups = await this.getCourseGroups(course.id)
          
          return {
            id: course.id.toString(),
            name: course.fullname,
            shortName: course.shortname,
            model: course.model,
            groups: groups.map(group => ({
              id: group.id.toString(),
              name: group.name,
            })),
          }
        })
      )
      
      console.log(`✅ Procesados ${coursesWithGroups.length} cursos con sus grupos`)
      return coursesWithGroups
      
    } catch (error) {
      console.error('Error obteniendo cursos del profesor:', error)
      return []
    }
  }

  /**
   * @deprecated Usar getTeacherCoursesWithGroups para filtrar por profesor
   * Obtiene información completa para poblar el selector
   * Combina cursos con sus grupos
   */
  async getCoursesWithGroups(userId?: number): Promise<Array<{
    id: string
    name: string
    shortName: string
    model?: string
    groups: Array<{ id: string; name: string }>
  }>> {
    try {
      // Primero intentar con el plugin de cursos activos (no requiere userId)
      let courses: MoodleCourse[] = []
      
      try {
        console.log('Intentando obtener cursos con plugin personalizado...')
        courses = await this.getActiveCourses()
      } catch (error) {
        // Si falla, intentar con el método tradicional si tenemos userId
        if (userId) {
          console.log('Plugin personalizado falló, intentando método tradicional...')
          courses = await this.getUserCourses(userId)
        } else {
          throw new Error('No se pudo obtener cursos: plugin personalizado falló y no se proporcionó userId')
        }
      }
      
      // Para cada curso, obtener sus grupos
      const coursesWithGroups = await Promise.all(
        courses.map(async (course) => {
          const groups = await this.getCourseGroups(course.id)
          
          return {
            id: course.id.toString(),
            name: course.fullname,
            shortName: course.shortname,
            model: course.model,
            groups: groups.map(group => ({
              id: group.id.toString(),
              name: group.name,
            })),
          }
        })
      )
      
      return coursesWithGroups
    } catch (error) {
      console.error('Error obteniendo cursos con grupos:', error)
      return []
    }
  }

  /**
   * Mapeo local de matrículas a IDs de Moodle
   * TODO: En producción esto debería venir de la base de datos
   */
  private getMoodleUserMapping(): Record<string, { id: number; username: string; email: string }> {
    return {
      // Mapeo conocido de usuarios UTEL (matrículas reales de Moodle)
      'marco.arce': { id: 29791, username: 'marco.arce', email: 'marco.arce@utel.edu.mx' }, // ID real de Moodle
      'cesar.espindola': { id: 29868, username: 'cesar.espindola', email: 'mail.paulo@gmail.com' }, // ID real de Moodle
      // Mapeo de prueba (matrículas locales)
      'MAT001': { id: 29791, username: 'marco.arce', email: 'marco.arce@utel.edu.mx' }, // Mismo usuario para testing
      'MAT002': { id: 3, username: 'profesor2', email: 'profesor2@utel.edu.mx' },
      'MAT003': { id: 4, username: 'profesor3', email: 'profesor3@utel.edu.mx' },
      // Añadir más matrículas según se necesiten
    }
  }

  /**
   * Obtiene el usuario de Moodle por su matrícula usando mapeo local
   * FALLBACK: Si no se encuentra en el mapeo local, intenta con la API
   */
  async getUserByUsername(username: string): Promise<{ id: number; username: string; email: string } | null> {
    // Primero intentar con mapeo local
    const localMapping = this.getMoodleUserMapping()
    
    if (localMapping[username]) {
      console.log(`💾 Usando mapeo local para matrícula: ${username}`)
      return localMapping[username]
    }
    
    // Si no se encuentra localmente, intentar con la API
    try {
      console.log(`🌍 Intentando obtener usuario de Moodle API: ${username}`)
      const users = await this.callMoodleAPI('core_user_get_users_by_field', {
        field: 'username',
        values: [username]
      })
      
      if (users && users.length > 0) {
        const user = users[0]
        console.log(`✅ Usuario encontrado en Moodle API: ${user.username}`)
        return {
          id: user.id,
          username: user.username,
          email: user.email
        }
      }
      
      return null
    } catch (error) {
      console.log(`⚠️ API fallback falló para ${username}, usuario no encontrado en mapeo local`)
      return null
    }
  }

  /**
   * Obtiene información del usuario actual usando el token configurado
   * Si no se proporciona matrícula, obtiene la info del usuario dueño del token
   */
  async getUserInfo(matricula?: string): Promise<any> {
    // Si se proporciona matrícula, buscar ese usuario específico
    if (matricula) {
      const user = await this.getUserByUsername(matricula)
      if (user) {
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          fullname: user.username
        }
      }
      return null
    }
    
    // Si no se proporciona matrícula, obtener info del usuario del token actual
    try {
      const siteInfo = await this.callMoodleAPI('core_webservice_get_site_info')
      
      if (siteInfo && siteInfo.userid) {
        return {
          id: siteInfo.userid,
          username: siteInfo.username,
          email: siteInfo.useremail || '',
          fullname: siteInfo.fullname || siteInfo.username
        }
      }
      
      return null
    } catch (error) {
      console.error('Error obteniendo información del usuario del token:', error)
      return null
    }
  }

  /**
   * Obtiene envíos de una actividad específica
   */
  async getActivitySubmissions(activityId: string, groupId?: string): Promise<any[]> {
    try {
      return await this.getAssignmentSubmissions(parseInt(activityId))
    } catch (error) {
      console.error('Error obteniendo envíos de actividad:', error)
      return []
    }
  }


  /**
   * Crea un post en el foro (placeholder)
   */
  async createForumPost(forumId: string, subject: string, message: string): Promise<any> {
    throw new Error('createForumPost no implementado - requiere token específico del profesor')
  }

  /**
   * Obtiene el libro de calificaciones
   */
  async getGradebook(courseId: string): Promise<any> {
    try {
      // Placeholder - implementar según API de Moodle
      return []
    } catch (error) {
      console.error('Error obteniendo libro de calificaciones:', error)
      return []
    }
  }

  /**
   * Obtiene todas las tareas de un curso
   */
  async getCourseAssignments(courseId: number): Promise<any> {
    try {
      const result = await this.callMoodleAPI('mod_assign_get_assignments', {
        courseids: [courseId]
      })
      
      return result || { courses: [] }
    } catch (error) {
      console.error('Error obteniendo tareas del curso:', error)
      return { courses: [] }
    }
  }

  /**
   * Obtiene las discusiones de un foro
   */
  async getForumDiscussions(forumId: number): Promise<any> {
    try {
      const result = await this.callMoodleAPI('mod_forum_get_forum_discussions', {
        forumid: forumId
      })
      
      return result || { discussions: [] }
    } catch (error) {
      console.error('Error obteniendo discusiones del foro:', error)
      return { discussions: [] }
    }
  }

  /**
   * Obtiene las calificaciones del curso
   */
  async getCourseGrades(courseId: number): Promise<any> {
    try {
      const result = await this.callMoodleAPI('gradereport_user_get_grades_table', {
        courseid: courseId
      })
      
      return result || { tables: [] }
    } catch (error) {
      console.error('Error obteniendo calificaciones del curso:', error)
      return { tables: [] }
    }
  }

  /**
   * Verifica la conexión con Moodle
   */
  async testConnection(): Promise<boolean> {
    try {
      // Intentar obtener info del sitio (no requiere permisos especiales)
      const info = await this.callMoodleAPI('core_webservice_get_site_info')
      
      console.log('✅ Conexión con Moodle exitosa')
      console.log(`   Sitio: ${info.sitename}`)
      console.log(`   Usuario: ${info.username}`)
      
      return true
    } catch (error) {
      console.error('❌ Error al conectar con Moodle:', error)
      return false
    }
  }
}

// Exportar tanto la clase como una instancia singleton
export { MoodleAPIClient }
export const moodleClient = new MoodleAPIClient()
