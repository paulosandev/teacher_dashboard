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
      // Intentar con el plugin personalizado como fallback
      console.log('Intentando con el plugin de cursos activos...')
      return this.getActiveCourses()
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
