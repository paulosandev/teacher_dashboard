/**
 * Cliente inteligente de Moodle que usa autenticación híbrida
 * No requiere configuración manual del profesor
 */

import { hybridAuth } from './hybrid-auth-service'

export interface SmartMoodleClientOptions {
  userId: string
  userMatricula: string
}

export class SmartMoodleClient {
  private userId: string
  private userMatricula: string

  constructor(options: SmartMoodleClientOptions) {
    this.userId = options.userId
    this.userMatricula = options.userMatricula
  }

  /**
   * Obtiene cursos del profesor usando autenticación inteligente
   */
  async getTeacherCourses() {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_courses',
        userId: this.userId,
        userMatricula: this.userMatricula
      },
      async (client) => {
        return await client.getTeacherCoursesWithGroups(this.userMatricula)
      }
    )
  }

  /**
   * Obtiene contenidos de un curso específico
   */
  async getCourseContents(courseId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_course_contents',
        userId: this.userId,
        userMatricula: this.userMatricula,
        courseId
      },
      async (client) => {
        return await client.getCourseContents(parseInt(courseId))
      }
    )
  }


  /**
   * Obtiene envíos de una actividad
   */
  async getActivitySubmissions(activityId: string, groupId?: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_submissions',
        userId: this.userId,
        userMatricula: this.userMatricula
      },
      async (client) => {
        return await client.getActivitySubmissions(activityId, groupId)
      }
    )
  }

  /**
   * Obtiene grupos de un curso
   */
  async getCourseGroups(courseId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_groups',
        userId: this.userId,
        userMatricula: this.userMatricula,
        courseId
      },
      async (client) => {
        return await client.getCourseGroups(parseInt(courseId))
      }
    )
  }

  /**
   * Verifica la conexión con Moodle
   */
  async testConnection() {
    try {
      const context = {
        operation: 'get_user_info',
        userId: this.userId,
        userMatricula: this.userMatricula
      }

      const tokenInfo = await hybridAuth.getOptimalToken(context)
      const client = await hybridAuth.createOptimalClient(context)
      
      const result = await client.testConnection()
      
      console.log(`🔍 Conexión probada con token ${tokenInfo.type} para ${this.userMatricula}: ${result ? '✅' : '❌'}`)
      
      return result
    } catch (error) {
      console.error('Error probando conexión:', error)
      return false
    }
  }

  /**
   * Obtiene información del usuario en Moodle
   */
  async getUserInfo() {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_user_info',
        userId: this.userId,
        userMatricula: this.userMatricula
      },
      async (client) => {
        return await client.getUserInfo(this.userMatricula)
      }
    )
  }

  /**
   * Operación que requiere permisos específicos del profesor
   */
  async createForumPost(forumId: string, subject: string, message: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'create_forum_post',
        userId: this.userId,
        userMatricula: this.userMatricula,
        requiresSpecificPermissions: true
      },
      async (client) => {
        // Esta operación SIEMPRE usará el token del profesor
        return await client.createForumPost(forumId, subject, message)
      }
    )
  }

  /**
   * Obtiene el libro de calificaciones
   */
  async getGradebook(courseId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_gradebook',
        userId: this.userId,
        userMatricula: this.userMatricula,
        courseId
      },
      async (client) => {
        return await client.getGradebook(courseId)
      }
    )
  }

  /**
   * Obtiene foros de un curso
   */
  async getCourseForums(courseId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_course_forums',
        userId: this.userId,
        userMatricula: this.userMatricula,
        courseId
      },
      async (client) => {
        return await client.getCourseForums(parseInt(courseId))
      }
    )
  }

  /**
   * Obtiene usuarios matriculados en un curso
   */
  async getEnrolledUsers(courseId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_enrolled_users',
        userId: this.userId,
        userMatricula: this.userMatricula,
        courseId
      },
      async (client) => {
        return await client.getEnrolledUsers(parseInt(courseId))
      }
    )
  }

  /**
   * Obtiene miembros de un grupo específico usando método alternativo
   * Debido a restricciones de permisos en Moodle, usa core_enrol_get_enrolled_users
   */
  async getGroupMembers(groupId: string, courseId?: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_group_members_alternative',
        userId: this.userId,
        userMatricula: this.userMatricula,
        requiresSpecificPermissions: false // Usar método alternativo que no requiere permisos especiales
      },
      async (client) => {
        try {
          console.log(`👥 [ALTERNATIVO] Obteniendo miembros del grupo: ${groupId}`)
          
          // Método 1: Intentar core_group_get_group_members (puede fallar por permisos)
          try {
            const members = await client.callMoodleAPI('core_group_get_group_members', {
              groupids: [parseInt(groupId)]
            });
            
            const userIds = members?.[0]?.userids || [];
            if (userIds.length > 0) {
              console.log(`✅ Método directo exitoso: ${userIds.length} miembros`)
              return await this.getUsersDetails(client, userIds);
            }
          } catch (directError) {
            console.log(`⚠️ Método directo falló (esperado): ${directError.message}`);
          }
          
          // Método 2: Alternativo - Obtener todos los usuarios del curso y filtrar por grupos
          if (!courseId) {
            console.log('⚠️ No se proporcionó courseId para método alternativo');
            return [];
          }
          
          console.log(`🔄 Usando método alternativo con curso ${courseId}...`);
          
          // Obtener todos los usuarios inscritos en el curso
          const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: parseInt(courseId)
          });
          
          console.log(`📚 Usuarios inscritos en curso: ${enrolledUsers.length}`);
          
          // Filtrar solo estudiantes (eliminar profesores y otros roles)
          const students = enrolledUsers.filter((user: any) => {
            const roles = user.roles || [];
            return roles.some((role: any) => {
              const roleName = (role.shortname || role.name || '').toLowerCase();
              return roleName.includes('student') || roleName === 'estudiante' || role.roleid === 5;
            });
          });
          
          console.log(`👨‍🎓 Estudiantes encontrados: ${students.length}`);
          
          if (students.length === 0) {
            console.log('ℹ️ No hay estudiantes en este curso');
            return [];
          }
          
          // Por ahora, retornar todos los estudiantes del curso
          // TODO: Implementar filtrado real por grupo cuando tengamos acceso a esa información
          const studentsFormatted = students.map((user: any) => ({
            id: user.id,
            username: user.username,
            firstname: user.firstname,
            lastname: user.lastname,
            fullname: user.fullname || `${user.firstname} ${user.lastname}`,
            email: user.email
          }));
          
          console.log(`✅ Retornando ${studentsFormatted.length} estudiantes del curso (aproximación por grupo)`);
          return studentsFormatted;
          
        } catch (error) {
          console.error(`❌ Error en método alternativo para grupo ${groupId}:`, error);
          return [];
        }
      }
    );
  }

  /**
   * Obtiene información detallada de usuarios por sus IDs
   */
  private async getUsersDetails(client: any, userIds: number[]) {
    try {
      const usersInfo = await client.callMoodleAPI('core_user_get_users_by_field', {
        field: 'id',
        values: userIds
      });
      
      return usersInfo.map((user: any) => ({
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        fullname: `${user.firstname} ${user.lastname}`,
        email: user.email
      }));
    } catch (error) {
      console.warn(`⚠️ No se pudo obtener información detallada de usuarios: ${error}`);
      return userIds.map((id: number) => ({ id, fullname: `Usuario ${id}` }));
    }
  }

  /**
   * Obtiene posts de una discusión específica
   */
  async getDiscussionPosts(discussionId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_discussion_posts',
        userId: this.userId,
        userMatricula: this.userMatricula,
        discussionId
      },
      async (client) => {
        return await client.getDiscussionPosts(parseInt(discussionId))
      }
    )
  }

  /**
   * Obtiene entregas de una tarea específica
   */
  async getAssignmentSubmissions(assignmentId: string, groupId?: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_assignment_submissions',
        userId: this.userId,
        userMatricula: this.userMatricula,
        requiresSpecificPermissions: true // Las entregas requieren permisos específicos
      },
      async (client) => {
        return await client.getAssignmentSubmissions(parseInt(assignmentId))
      }
    )
  }

  /**
   * Obtiene todas las tareas de un curso
   */
  async getCourseAssignments(courseId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_course_assignments',
        userId: this.userId,
        userMatricula: this.userMatricula,
        courseId
      },
      async (client) => {
        return await client.getCourseAssignments(parseInt(courseId))
      }
    )
  }

  /**
   * Obtiene discusiones de un foro específico
   */
  async getForumDiscussions(forumId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_forum_discussions',
        userId: this.userId,
        userMatricula: this.userMatricula,
        forumId
      },
      async (client) => {
        return await client.getForumDiscussions(parseInt(forumId))
      }
    )
  }

  /**
   * Obtiene estadísticas de participación de estudiantes
   */
  async getStudentParticipation(courseId: string, groupId?: string) {
    try {
      // Obtener usuarios matriculados
      const enrolledUsers = await this.getEnrolledUsers(courseId)
      
      // Obtener foros del curso
      const forums = await this.getCourseForums(courseId)
      
      // Obtener tareas del curso
      const assignments = await this.getCourseAssignments(courseId)
      
      // Recopilar estadísticas de participación
      const participationData: any = {
        courseId,
        groupId,
        totalStudents: enrolledUsers?.length || 0,
        forums: {
          total: forums?.length || 0,
          details: []
        },
        assignments: {
          total: 0,
          details: []
        },
        summary: {
          activeStudents: 0,
          inactiveStudents: 0,
          averageParticipation: 0
        }
      }

      // Analizar participación en foros
      if (forums && forums.length > 0) {
        for (const forum of forums.slice(0, 3)) { // Limitar a primeros 3 foros
          try {
            const discussions = await this.getForumDiscussions(forum.id)
            participationData.forums.details.push({
              forumId: forum.id,
              forumName: forum.name,
              totalDiscussions: discussions?.discussions?.length || 0
            })
          } catch (error) {
            console.error(`Error obteniendo discusiones del foro ${forum.id}:`, error)
          }
        }
      }

      // Analizar entregas de tareas
      if (assignments?.courses && assignments.courses.length > 0) {
        const courseAssignments = assignments.courses.find((c: any) => c.id == courseId)
        if (courseAssignments?.assignments) {
          participationData.assignments.total = courseAssignments.assignments.length
          
          for (const assignment of courseAssignments.assignments.slice(0, 3)) { // Limitar a primeras 3 tareas
            try {
              const submissions = await this.getAssignmentSubmissions(assignment.id)
              participationData.assignments.details.push({
                assignmentId: assignment.id,
                assignmentName: assignment.name,
                totalSubmissions: submissions?.assignments?.[0]?.submissions?.length || 0
              })
            } catch (error) {
              console.error(`Error obteniendo entregas de tarea ${assignment.id}:`, error)
            }
          }
        }
      }

      return participationData
    } catch (error) {
      console.error('Error obteniendo participación de estudiantes:', error)
      return null
    }
  }

  /**
   * Obtiene calificaciones del curso
   */
  async getCourseGrades(courseId: string) {
    return await hybridAuth.executeWithOptimalAuth(
      {
        operation: 'get_course_grades',
        userId: this.userId,
        userMatricula: this.userMatricula,
        courseId,
        requiresSpecificPermissions: true
      },
      async (client) => {
        return await client.getCourseGrades(parseInt(courseId))
      }
    )
  }
}

/**
 * Factory function para crear un cliente inteligente
 */
export function createSmartMoodleClient(userId: string, userMatricula: string): SmartMoodleClient {
  return new SmartMoodleClient({ userId, userMatricula })
}
