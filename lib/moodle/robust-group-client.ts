/**
 * Cliente robusto para acceso a grupos en Moodle
 * Usa solo APIs disponibles y funcionales
 */

import { MoodleAPIClient } from './api-client'

export interface GroupMember {
  id: number
  fullname: string
  email: string
  roles: string[]
  groups: GroupInfo[]
}

export interface GroupInfo {
  id: number
  name: string
  description: string
  members?: GroupMember[]
  memberCount?: number
}

export interface CourseInfo {
  id: number
  fullname: string
  shortname: string
  visible: boolean
  groups?: GroupInfo[]
}

export class RobustGroupClient {
  private client: MoodleAPIClient
  private userId?: number
  private userInfo?: any

  constructor(moodleUrl: string, token: string) {
    this.client = new MoodleAPIClient(moodleUrl, token)
  }

  /**
   * Inicializar cliente con información del usuario actual
   */
  async initialize(): Promise<void> {
    const siteInfo = await this.client.callMoodleAPI('core_webservice_get_site_info', {})
    this.userId = siteInfo.userid
    this.userInfo = siteInfo
//     console.log(`🔑 Cliente inicializado para: ${siteInfo.fullname} (ID: ${siteInfo.userid})`)
  }

  /**
   * Obtener cursos accesibles del usuario
   * REEMPLAZO DE: core_course_get_courses (que falla)
   */
  async getUserCourses(): Promise<CourseInfo[]> {
    if (!this.userId) await this.initialize()

    try {
      const userCourses = await this.client.callMoodleAPI('core_enrol_get_users_courses', {
        userid: this.userId
      })

      const courses: CourseInfo[] = userCourses.map(course => ({
        id: course.id,
        fullname: course.fullname,
        shortname: course.shortname,
        visible: course.visible !== false
      }))

//       console.log(`✅ Cursos accesibles: ${courses.length}`)
      return courses

    } catch (error) {
      console.error('❌ Error obteniendo cursos del usuario:', error)
      throw error
    }
  }

  /**
   * Obtener grupos de un curso específico
   * USA: core_group_get_course_groups (funciona)
   */
  async getCourseGroups(courseId: number): Promise<GroupInfo[]> {
    try {
      const courseGroups = await this.client.callMoodleAPI('core_group_get_course_groups', {
        courseid: courseId
      })

      const groups: GroupInfo[] = courseGroups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description || ''
      }))

//       console.log(`✅ Grupos del curso ${courseId}: ${groups.length}`)
      return groups

    } catch (error) {
      console.error(`❌ Error obteniendo grupos del curso ${courseId}:`, error)
      return []
    }
  }

  /**
   * Obtener miembros de un grupo específico
   * REEMPLAZO DE: core_group_get_group_members (que falla)
   * USA: core_enrol_get_enrolled_users + filtrado
   */
  async getGroupMembers(courseId: number, groupId: number): Promise<GroupMember[]> {
    try {
      // 1. Obtener todos los usuarios inscritos en el curso
      const enrolledUsers = await this.client.callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: courseId
      })

      // 2. Filtrar usuarios que pertenecen al grupo específico
      const groupMembers = enrolledUsers.filter(user => {
        return user.groups && user.groups.some(group => group.id === groupId)
      })

      // 3. Formatear resultado
      const members: GroupMember[] = groupMembers.map(member => ({
        id: member.id,
        fullname: member.fullname,
        email: member.email || '',
        roles: member.roles?.map(r => r.shortname) || [],
        groups: member.groups?.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description || ''
        })) || []
      }))

//       console.log(`✅ Miembros del grupo ${groupId}: ${members.length}`)
      return members

    } catch (error) {
      console.error(`❌ Error obteniendo miembros del grupo ${groupId} en curso ${courseId}:`, error)
      return []
    }
  }

  /**
   * Obtener información completa de un curso con todos sus grupos y miembros
   * MÉTODO OPTIMIZADO que combina todas las APIs funcionales
   */
  async getCourseWithGroupsAndMembers(courseId: number): Promise<CourseInfo> {
    try {
      // 1. Obtener información básica del curso
      const userCourses = await this.getUserCourses()
      const courseInfo = userCourses.find(c => c.id === courseId)
      
      if (!courseInfo) {
        throw new Error(`Curso ${courseId} no encontrado o no accesible`)
      }

      // 2. Obtener grupos del curso
      const groups = await this.getCourseGroups(courseId)

      // 3. Para optimizar, obtener usuarios una sola vez
      const enrolledUsers = await this.client.callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: courseId
      })

      // 4. Para cada grupo, calcular miembros
      const groupsWithMembers: GroupInfo[] = groups.map(group => {
        const members = enrolledUsers.filter(user => {
          return user.groups && user.groups.some(g => g.id === group.id)
        })

        return {
          ...group,
          memberCount: members.length,
          members: members.map(member => ({
            id: member.id,
            fullname: member.fullname,
            email: member.email || '',
            roles: member.roles?.map(r => r.shortname) || [],
            groups: member.groups?.map(g => ({
              id: g.id,
              name: g.name,
              description: g.description || ''
            })) || []
          }))
        }
      })

//       console.log(`✅ Curso completo cargado: ${courseInfo.fullname}`)
//       console.log(`   📊 ${groups.length} grupos, ${enrolledUsers.length} usuarios totales`)

      return {
        ...courseInfo,
        groups: groupsWithMembers
      }

    } catch (error) {
      console.error(`❌ Error obteniendo información completa del curso ${courseId}:`, error)
      throw error
    }
  }

  /**
   * Obtener grupos donde el usuario actual está inscrito
   * USA: core_group_get_course_user_groups (funciona)
   */
  async getUserGroupsInCourse(courseId: number): Promise<GroupInfo[]> {
    if (!this.userId) await this.initialize()

    try {
      const userGroups = await this.client.callMoodleAPI('core_group_get_course_user_groups', {
        courseid: courseId,
        userid: this.userId
      })

      const groups: GroupInfo[] = userGroups.groups?.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description || ''
      })) || []

//       console.log(`✅ Grupos del usuario en curso ${courseId}: ${groups.length}`)
      return groups

    } catch (error) {
      console.error(`❌ Error obteniendo grupos del usuario en curso ${courseId}:`, error)
      return []
    }
  }

  /**
   * Verificar si el usuario actual puede acceder a un grupo específico
   */
  async canAccessGroup(courseId: number, groupId: number): Promise<boolean> {
    try {
      const userGroups = await this.getUserGroupsInCourse(courseId)
      return userGroups.some(group => group.id === groupId)
    } catch (error) {
      console.error(`❌ Error verificando acceso al grupo ${groupId}:`, error)
      return false
    }
  }

  /**
   * Obtener estadísticas de un curso
   */
  async getCourseStats(courseId: number): Promise<{
    totalUsers: number,
    totalGroups: number,
    groupsWithMembers: number,
    averageMembersPerGroup: number
  }> {
    try {
      const courseInfo = await this.getCourseWithGroupsAndMembers(courseId)
      
      const totalUsers = await this.client.callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: courseId
      }).then(users => users.length)

      const totalGroups = courseInfo.groups?.length || 0
      const groupsWithMembers = courseInfo.groups?.filter(g => (g.memberCount || 0) > 0).length || 0
      const averageMembersPerGroup = totalGroups > 0 
        ? (courseInfo.groups?.reduce((sum, g) => sum + (g.memberCount || 0), 0) || 0) / totalGroups
        : 0

      const stats = {
        totalUsers,
        totalGroups,
        groupsWithMembers,
        averageMembersPerGroup: Math.round(averageMembersPerGroup * 100) / 100
      }

//       console.log(`📊 Estadísticas del curso ${courseId}:`, stats)
      return stats

    } catch (error) {
      console.error(`❌ Error obteniendo estadísticas del curso ${courseId}:`, error)
      throw error
    }
  }
}