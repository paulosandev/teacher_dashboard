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
   * Nota: Requiere el ID del usuario en Moodle
   * FALLBACK: Usa este método si el plugin personalizado no está disponible
   */
  async getUserCourses(userId: number): Promise<MoodleCourse[]> {
    try {
      const courses = await this.callMoodleAPI('core_enrol_get_users_courses', {
        userid: userId,
      })
      
      // Filtrar solo cursos visibles
      return courses.filter((course: MoodleCourse) => course.visible === 1)
    } catch (error) {
      console.error('Error obteniendo cursos del usuario:', error)
      console.log('⚠️ Fallback: obteniendo cursos usando filtrado por rol...')
      
      // NUEVO FALLBACK: Filtrar cursos activos donde el usuario es profesor
      return this.getTeacherCoursesFiltered(userId)
    }
  }

  /**
   * Obtiene cursos donde el usuario es profesor usando filtrado por rol
   * Este método implementa seguridad: solo devuelve cursos donde el usuario específico es profesor
   */
  async getTeacherCoursesFiltered(userId: number): Promise<MoodleCourse[]> {
    try {
      // Obtener todos los cursos activos
      const allCourses = await this.getActiveCourses()
      
      if (allCourses.length === 0) {
        console.log('📚 No hay cursos activos disponibles')
        return []
      }
      
      console.log(`🔍 [SEGURIDAD] Filtrando ${allCourses.length} cursos para encontrar donde userId ${userId} es profesor...`)
      
      const teacherCourses: MoodleCourse[] = []
      let coursesChecked = 0
      const maxCoursesToCheck = 10 // Limitar para rendimiento
      
      for (const course of allCourses.slice(0, maxCoursesToCheck)) {
        coursesChecked++
        
        try {
          console.log(`🔎 [${coursesChecked}/${maxCoursesToCheck}] Verificando curso: ${course.shortname}...`)
          
          // Obtener usuarios inscritos con roles en el curso
          const enrolledUsers = await this.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: course.id,
            options: [
              {
                name: 'withcapability',
                value: 'moodle/course:manageactivities' // Capacidad típica de profesores
              }
            ]
          })
          
          // Buscar específicamente nuestro usuario
          const userInCourse = enrolledUsers.find((user: any) => user.id === userId)
          
          if (userInCourse) {
            console.log(`👤 Usuario ${userId} encontrado en curso ${course.shortname}`)
            
            // Verificar roles de profesor
            if (userInCourse.roles && userInCourse.roles.length > 0) {
              const roles = userInCourse.roles.map((role: any) => ({
                id: role.roleid,
                name: role.shortname || role.name
              }))
              
              console.log(`🎭 Roles del usuario en ${course.shortname}:`, roles)
              
              // Verificar si tiene rol de profesor
              const hasTeacherRole = userInCourse.roles.some((role: any) => {
                return (
                  role.roleid === 3 || // editingteacher
                  role.roleid === 4 || // teacher
                  role.shortname === 'editingteacher' ||
                  role.shortname === 'teacher' ||
                  role.shortname === 'manager'
                )
              })
              
              if (hasTeacherRole) {
                console.log(`✅ [AUTORIZADO] Usuario ${userId} ES PROFESOR en: ${course.shortname}`)
                teacherCourses.push(course)
              } else {
                console.log(`❌ [NO AUTORIZADO] Usuario ${userId} no es profesor en: ${course.shortname}`)
              }
            } else {
              console.log(`⚠️ Usuario ${userId} sin roles definidos en: ${course.shortname}`)
            }
          } else {
            console.log(`👻 Usuario ${userId} NO INSCRITO en: ${course.shortname}`)
          }
          
        } catch (courseError) {
          console.log(`⚠️ Error verificando curso ${course.shortname}:`, courseError instanceof Error ? courseError.message : courseError)
          continue
        }
      }
      
      if (teacherCourses.length === 0) {
        console.log(`🚫 [SEGURIDAD] No se encontraron cursos donde userId ${userId} sea profesor`)
        console.log(`📊 Estadísticas: ${coursesChecked} cursos verificados de ${allCourses.length} disponibles`)
        return [] // NO devolver todos los cursos por seguridad
      }
      
      console.log(`🎓 [ÉXITO] Usuario ${userId} es profesor en ${teacherCourses.length} cursos`)
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
  async getForumDiscussions(forumId: number): Promise<MoodleDiscussion[]> {
    try {
      // Usar solo el parámetro requerido, sin sortby/sortdirection que causan error
      const response = await this.callMoodleAPI('mod_forum_get_forum_discussions', {
        forumid: forumId
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

// Exportar instancia singleton
export const moodleClient = new MoodleAPIClient()
