/**
 * Cliente de la API de Moodle con soporte para tokens por usuario
 * Cada profesor usa su propio token para acceder a sus cursos
 */

import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/utils/encryption'

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

export class UserMoodleAPIClient {
  private userId: string
  private token: string | null = null
  private baseUrl: string

  constructor(userId: string) {
    this.userId = userId
    this.baseUrl = process.env.MOODLE_API_URL || ''
  }

  /**
   * Obtiene el token del usuario de la base de datos
   */
  private async getUserToken(): Promise<string> {
    if (this.token) {
      return this.token
    }

    const userToken = await prisma.userMoodleToken.findUnique({
      where: { 
        userId: this.userId,
        isActive: true
      }
    })

    if (!userToken) {
      throw new Error('El usuario no tiene un token de Moodle configurado. Por favor, configure su token en el perfil.')
    }

    // Verificar si el token ha expirado
    if (userToken.expiresAt && userToken.expiresAt < new Date()) {
      throw new Error('El token de Moodle ha expirado. Por favor, actualice su token en el perfil.')
    }

    // Desencriptar el token
    this.token = decrypt(userToken.token)
    return this.token
  }

  /**
   * Realiza una llamada a la API de Moodle usando el token del usuario
   */
  private async callMoodleAPI(wsfunction: string, params: Record<string, any> = {}): Promise<any> {
    const token = await this.getUserToken()
    
    if (!this.baseUrl) {
      throw new Error('URL de Moodle no configurada')
    }
    
    const url = new URL(this.baseUrl)
    
    const baseParams = {
      wstoken: token,
      wsfunction: wsfunction,
      moodlewsrestformat: 'json',
    }

    const allParams: Record<string, any> = { ...baseParams, ...params }

    // Agregar parámetros a la URL
    Object.keys(allParams).forEach(key => {
      if (Array.isArray(allParams[key])) {
        allParams[key].forEach((value: any, index: number) => {
          url.searchParams.append(`${key}[${index}]`, value.toString())
        })
      } else {
        url.searchParams.append(key, allParams[key].toString())
      }
    })

    try {
      console.log(`📡 [Usuario ${this.userId}] Llamando Moodle API: ${wsfunction}`)
      
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
      // Reducir ruido de logs para errores de permisos esperados
      if (wsfunction === 'core_group_get_group_members' && error.message?.includes('Excepción al control de acceso')) {
        console.log(`⚠️ ${wsfunction}: Sin permisos para acceder al grupo (esperado)`)
      } else {
        console.error(`❌ Error llamando Moodle API (${wsfunction}):`, error)
      }
      throw error
    }
  }

  /**
   * Verifica que el token del usuario funcione
   */
  async testConnection(): Promise<boolean> {
    try {
      const siteInfo = await this.callMoodleAPI('core_webservice_get_site_info')
      console.log(`✅ Token válido para usuario: ${siteInfo.fullname} (${siteInfo.username})`)
      
      // Actualizar información del usuario en la BD si es necesario
      await prisma.userMoodleToken.update({
        where: { userId: this.userId },
        data: {
          moodleUserId: siteInfo.userid,
          moodleUsername: siteInfo.username,
          capabilities: siteInfo.functions || []
        }
      })
      
      return true
    } catch (error) {
      console.error('❌ Error verificando token:', error)
      return false
    }
  }

  /**
   * Obtiene los cursos del profesor (donde tiene rol de teacher)
   */
  async getTeacherCourses(): Promise<MoodleCourse[]> {
    try {
      // Primero obtener info del usuario
      const siteInfo = await this.callMoodleAPI('core_webservice_get_site_info')
      const moodleUserId = siteInfo.userid
      
      console.log(`🔍 Obteniendo cursos donde el usuario ${siteInfo.username} es profesor...`)
      
      // Obtener todos los cursos del usuario
      const allCourses = await this.callMoodleAPI('core_enrol_get_users_courses', {
        userid: moodleUserId,
      })
      
      if (allCourses.length === 0) {
        return []
      }
      
      // Filtrar solo cursos donde es profesor
      const teacherCourses: MoodleCourse[] = []
      
      for (const course of allCourses) {
        try {
          // Obtener usuarios inscritos para verificar rol
          const enrolledUsers = await this.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: course.id,
            options: [
              { name: 'userfields', value: 'id,username,firstname,lastname,email' },
              { name: 'limitnumber', value: '100' }
            ]
          })
          
          // Buscar al usuario actual
          const currentUser = enrolledUsers.find((u: any) => u.id === moodleUserId)
          
          if (currentUser?.roles) {
            const isTeacher = currentUser.roles.some((role: any) => 
              ['editingteacher', 'teacher', 'manager'].includes(role.shortname)
            )
            
            if (isTeacher) {
              teacherCourses.push({
                id: course.id,
                shortname: course.shortname,
                fullname: course.fullname,
                displayname: course.displayname,
                enrolledusercount: course.enrolledusercount,
                visible: course.visible,
                summary: course.summary,
                category: course.category,
                enddate: course.enddate
              })
            }
          }
        } catch (error) {
          console.log(`⚠️ No se pudo verificar rol en curso ${course.shortname}`)
        }
      }
      
      console.log(`✅ Encontrados ${teacherCourses.length} cursos donde es profesor`)
      return teacherCourses
      
    } catch (error) {
      console.error('Error obteniendo cursos del profesor:', error)
      return []
    }
  }

  /**
   * Obtiene los cursos con sus grupos donde el profesor tiene acceso
   */
  async getTeacherCoursesWithGroups(): Promise<any[]> {
    try {
      const courses = await this.getTeacherCourses()
      const coursesWithGroups = []
      
      for (const course of courses) {
        try {
          // Obtener grupos del curso
          const groups = await this.callMoodleAPI('core_group_get_course_groups', {
            courseid: course.id,
          })
          
          coursesWithGroups.push({
            id: course.id.toString(),
            name: course.fullname,
            shortName: course.shortname,
            groups: groups.map((g: MoodleGroup) => ({
              id: g.id.toString(),
              name: g.name,
              description: g.description
            }))
          })
        } catch (error) {
          console.log(`⚠️ No se pudieron obtener grupos del curso ${course.shortname}`)
          coursesWithGroups.push({
            id: course.id.toString(),
            name: course.fullname,
            shortName: course.shortname,
            groups: []
          })
        }
      }
      
      return coursesWithGroups
    } catch (error) {
      console.error('Error obteniendo cursos con grupos:', error)
      return []
    }
  }

  /**
   * Obtiene las entregas de una tarea
   */
  async getAssignmentSubmissions(assignmentId: number): Promise<any> {
    try {
      const submissions = await this.callMoodleAPI('mod_assign_get_submissions', {
        assignmentids: [assignmentId],
      })
      
      return submissions?.assignments?.[0] || { submissions: [] }
    } catch (error) {
      console.error(`Error obteniendo entregas de la tarea ${assignmentId}:`, error)
      throw error // Propagar el error para manejarlo en el llamador
    }
  }

  /**
   * Obtiene los foros de un curso
   */
  async getCourseForums(courseId: number): Promise<any[]> {
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
  async getForumDiscussions(forumId: number): Promise<any[]> {
    try {
      const discussions = await this.callMoodleAPI('mod_forum_get_forum_discussions', {
        forumid: forumId,
      })
      
      return discussions?.discussions || []
    } catch (error) {
      console.error('Error obteniendo discusiones del foro:', error)
      return []
    }
  }

  /**
   * Obtiene el contenido del curso
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
   * Obtiene usuarios matriculados en un curso
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
}

/**
 * Factory para crear clientes de Moodle por usuario
 */
export function createUserMoodleClient(userId: string): UserMoodleAPIClient {
  return new UserMoodleAPIClient(userId)
}
