/**
 * Cliente Moodle basado en sesión - Course-based
 * Usa el token directamente de la sesión del usuario
 */

import { getSession } from 'next-auth/react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from './api-client'
import { moodleAuthService } from '@/lib/auth/moodle-auth-service'

export interface SessionMoodleClientOptions {
  serverSide?: boolean
}

export class SessionMoodleClient {
  private serverSide: boolean

  constructor(options: SessionMoodleClientOptions = {}) {
    this.serverSide = options.serverSide || false
  }

  /**
   * Obtiene el cliente Moodle usando el token de la sesión actual
   */
  private async getClient(): Promise<MoodleAPIClient> {
    const session = this.serverSide 
      ? await getServerSession(authOptions)
      : await getSession()

    if (!session?.user?.moodleToken) {
      throw new Error('No hay sesión activa o token de Moodle no disponible')
    }

    // Verificar expiración del token
    if (session.user.tokenExpiry && new Date() > new Date(session.user.tokenExpiry)) {
      throw new Error('Token de Moodle expirado. Por favor, inicie sesión nuevamente')
    }

    return new MoodleAPIClient(
      process.env.MOODLE_URL!,
      session.user.moodleToken
    )
  }

  /**
   * Obtiene información del usuario actual
   */
  async getUserInfo() {
    const session = this.serverSide 
      ? await getServerSession(authOptions)
      : await getSession()

    if (!session?.user) {
      throw new Error('No hay sesión activa')
    }

    return {
      id: parseInt(session.user.id),
      username: session.user.username!,
      name: session.user.name!,
      email: session.user.email!,
      matricula: session.user.matricula
    }
  }

  /**
   * Obtiene cursos donde el usuario actual es profesor
   */
  async getTeacherCourses() {
    const session = this.serverSide 
      ? await getServerSession(authOptions)
      : await getSession()

    if (!session?.user?.moodleToken) {
      throw new Error('No hay sesión activa')
    }

    return await moodleAuthService.getTeacherCourses(
      session.user.moodleToken,
      parseInt(session.user.id)
    )
  }

  /**
   * Obtiene combinaciones curso-grupo donde el usuario actual es profesor y está enrolado
   */
  async getTeacherCourseGroups() {
    const session = this.serverSide 
      ? await getServerSession(authOptions)
      : await getSession()

    if (!session?.user?.moodleToken) {
      throw new Error('No hay sesión activa')
    }

    return await moodleAuthService.getTeacherCourseGroups(
      session.user.moodleToken,
      parseInt(session.user.id)
    )
  }

  /**
   * Obtiene contenidos de un curso específico
   */
  async getCourseContents(courseId: string) {
    const client = await this.getClient()
    return await client.getCourseContents(parseInt(courseId))
  }

  /**
   * Obtiene grupos de un curso
   */
  async getCourseGroups(courseId: string) {
    const client = await this.getClient()
    return await client.getCourseGroups(parseInt(courseId))
  }

  /**
   * Obtiene miembros de un grupo usando método alternativo
   */
  async getGroupMembers(groupId: string, courseId?: string) {
    const client = await this.getClient()
    
    try {
      console.log(`👥 [ALTERNATIVO] Obteniendo miembros del grupo: ${groupId}`)
      
      // Método 1: Intentar core_group_get_group_members (puede fallar por permisos)
      try {
        const members = await client.callMoodleAPI('core_group_get_group_members', {
          groupids: [parseInt(groupId)]
        })
        
        const userIds = members?.[0]?.userids || []
        if (userIds.length > 0) {
          console.log(`✅ Método directo exitoso: ${userIds.length} miembros`)
          return await this.getUsersDetails(client, userIds)
        }
      } catch (directError) {
        console.log(`⚠️ Método directo falló (esperado): ${directError.message}`)
      }
      
      // Método 2: Alternativo - Obtener todos los usuarios del curso y filtrar por grupos
      if (!courseId) {
        console.log('⚠️ No se proporcionó courseId para método alternativo')
        return []
      }
      
      console.log(`🔄 Usando método alternativo con curso ${courseId}...`)
      
      // Obtener todos los usuarios inscritos en el curso
      const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: parseInt(courseId)
      })
      
      console.log(`📚 Usuarios inscritos en curso: ${enrolledUsers.length}`)
      
      // Filtrar solo estudiantes (eliminar profesores y otros roles)
      const students = enrolledUsers.filter((user: any) => {
        const roles = user.roles || []
        return roles.some((role: any) => {
          const roleName = (role.shortname || role.name || '').toLowerCase()
          return roleName.includes('student') || roleName === 'estudiante' || role.roleid === 5
        })
      })
      
      console.log(`👨‍🎓 Estudiantes encontrados: ${students.length}`)
      
      if (students.length === 0) {
        console.log('ℹ️ No hay estudiantes en este curso')
        return []
      }
      
      // Retornar estudiantes formateados
      const studentsFormatted = students.map((user: any) => ({
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        fullname: user.fullname || `${user.firstname} ${user.lastname}`,
        email: user.email
      }))
      
      console.log(`✅ Retornando ${studentsFormatted.length} estudiantes del curso`)
      return studentsFormatted
      
    } catch (error) {
      console.error(`❌ Error en método alternativo para grupo ${groupId}:`, error)
      return []
    }
  }

  /**
   * Obtiene información detallada de usuarios por sus IDs
   */
  private async getUsersDetails(client: MoodleAPIClient, userIds: number[]) {
    try {
      const usersInfo = await client.callMoodleAPI('core_user_get_users_by_field', {
        field: 'id',
        values: userIds
      })
      
      return usersInfo.map((user: any) => ({
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        fullname: `${user.firstname} ${user.lastname}`,
        email: user.email
      }))
    } catch (error) {
      console.warn(`⚠️ No se pudo obtener información detallada de usuarios: ${error}`)
      return userIds.map((id: number) => ({ id, fullname: `Usuario ${id}` }))
    }
  }

  /**
   * Obtiene foros de un curso
   */
  async getCourseForums(courseId: string) {
    const client = await this.getClient()
    return await client.getCourseForums(parseInt(courseId))
  }

  /**
   * Obtiene usuarios matriculados en un curso
   */
  async getEnrolledUsers(courseId: string) {
    const client = await this.getClient()
    return await client.getEnrolledUsers(parseInt(courseId))
  }

  /**
   * Obtiene posts de una discusión específica
   */
  async getDiscussionPosts(discussionId: string) {
    const client = await this.getClient()
    return await client.getDiscussionPosts(parseInt(discussionId))
  }

  /**
   * Obtiene entregas de una tarea específica
   */
  async getAssignmentSubmissions(assignmentId: string) {
    const client = await this.getClient()
    return await client.getAssignmentSubmissions(parseInt(assignmentId))
  }

  /**
   * Obtiene todas las tareas de un curso
   */
  async getCourseAssignments(courseId: string) {
    const client = await this.getClient()
    return await client.getCourseAssignments(parseInt(courseId))
  }

  /**
   * Obtiene discusiones de un foro específico
   */
  async getForumDiscussions(forumId: string) {
    const client = await this.getClient()
    return await client.getForumDiscussions(parseInt(forumId))
  }

  /**
   * Verifica la conexión con Moodle
   */
  async testConnection() {
    try {
      const client = await this.getClient()
      const result = await client.testConnection()
      
      const userInfo = await this.getUserInfo()
      console.log(`🔍 Conexión probada para profesor: ${userInfo.name} (${userInfo.matricula}): ${result ? '✅' : '❌'}`)
      
      return result
    } catch (error) {
      console.error('Error probando conexión:', error)
      return false
    }
  }
}

/**
 * Factory function para crear un cliente basado en sesión
 */
export function createSessionMoodleClient(serverSide: boolean = false): SessionMoodleClient {
  return new SessionMoodleClient({ serverSide })
}