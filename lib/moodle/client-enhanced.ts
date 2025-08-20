/**
 * Cliente mejorado de la API de Moodle con soporte para tokens de usuario
 */

import { prisma } from '@/lib/db/prisma';

interface MoodleConfig {
  baseUrl: string;
  token: string;
  userToken?: string;
}

interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  displayname?: string;
  enrolledusercount?: number;
  visible?: number;
  summary?: string;
  category?: number;
  enddate?: number;
  model?: string;
}

interface MoodleGroup {
  id: number;
  name: string;
  description: string;
  courseid: number;
}

interface MoodleForum {
  id: number;
  course: number;
  name: string;
  intro: string;
  type: string;
  timemodified: number;
}

interface MoodleDiscussion {
  id: number;
  name: string;
  groupid: number;
  timemodified: number;
  usermodified: number;
  numreplies: number;
  created: number;
  modified: number;
}

interface MoodlePost {
  id: number;
  discussion: number;
  parent: number;
  userid: number;
  created: number;
  modified: number;
  subject: string;
  message: string;
  messageformat: number;
}

export class MoodleAPIClientEnhanced {
  private config: MoodleConfig | null = null;
  private userId?: string;
  private userEmail?: string;

  constructor(userId?: string, userEmail?: string) {
    this.userId = userId;
    this.userEmail = userEmail;
  }

  private async getConfig(): Promise<MoodleConfig> {
    if (!this.config) {
      this.config = {
        baseUrl: process.env.MOODLE_API_URL || '',
        token: process.env.MOODLE_API_TOKEN || '',
      };

      // Intentar obtener token del usuario si está disponible
      if (this.userId) {
        try {
          const userToken = await prisma.userMoodleToken.findUnique({
            where: { userId: this.userId }
          });
          
          if (userToken?.token) {
            console.log(`🔑 Usando token personalizado del usuario ${this.userEmail || this.userId}`);
            this.config.userToken = userToken.token;
          } else {
            console.log(`🔑 No hay token personalizado para el usuario ${this.userEmail || this.userId}, usando token global`);
          }
        } catch (error) {
          console.log('⚠️ Error obteniendo token de usuario, usando token global:', error);
        }
      }
    }
    return this.config;
  }

  /**
   * Obtiene el token apropiado según el contexto
   */
  private async getToken(): Promise<string> {
    const config = await this.getConfig();
    
    // Priorizar token de usuario si está disponible
    if (config.userToken) {
      return config.userToken;
    }
    
    // Usar token global como fallback
    return config.token;
  }

  /**
   * Realiza una llamada a la API de Moodle
   */
  private async callMoodleAPI(wsfunction: string, params: Record<string, any> = {}, useGlobalToken = false): Promise<any> {
    const config = await this.getConfig();
    
    // Validar que tengamos configuración
    if (!config.baseUrl) {
      throw new Error('Configuración de Moodle incompleta. Verifica MOODLE_API_URL en tu archivo .env');
    }
    
    // Decidir qué token usar
    const token = useGlobalToken ? config.token : await this.getToken();
    
    if (!token) {
      throw new Error('No se encontró token de Moodle. El usuario necesita autenticarse con Moodle.');
    }
    
    const url = new URL(config.baseUrl);
    
    // Parámetros base para todas las llamadas
    const baseParams = {
      wstoken: token,
      wsfunction: wsfunction,
      moodlewsrestformat: 'json',
    };

    // Combinar parámetros
    const allParams: Record<string, any> = { ...baseParams, ...params };

    // Agregar parámetros a la URL
    Object.keys(allParams).forEach(key => {
      if (Array.isArray(allParams[key])) {
        // Manejar arrays (ej: courseids[0]=1, courseids[1]=2)
        allParams[key].forEach((value: any, index: number) => {
          url.searchParams.append(`${key}[${index}]`, value.toString());
        });
      } else {
        url.searchParams.append(key, allParams[key].toString());
      }
    });

    try {
      const tokenType = useGlobalToken ? 'global' : (config.userToken ? 'usuario' : 'global (fallback)');
      console.log(`📡 Llamando Moodle API: ${wsfunction} [Token: ${tokenType}]`);
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Verificar si hay error de Moodle
      if (data.exception) {
        // Si el error es de permisos y estamos usando token de usuario, intentar con token global
        if (!useGlobalToken && data.errorcode === 'nopermission' && config.token) {
          console.log('⚠️ Error de permisos con token de usuario, intentando con token global...');
          return this.callMoodleAPI(wsfunction, params, true);
        }
        throw new Error(`Moodle error: ${data.message || data.exception}`);
      }

      return data;
    } catch (error) {
      // Reducir ruido de logs para errores de permisos esperados
      if (wsfunction === 'core_group_get_group_members' && error.message?.includes('Excepción al control de acceso')) {
        console.log(`⚠️ ${wsfunction}: Sin permisos para acceder al grupo (esperado)`);
      } else {
        console.error(`❌ Error llamando Moodle API (${wsfunction}):`, error);
      }
      throw error;
    }
  }

  /**
   * Obtiene información del usuario actual en Moodle
   */
  async getCurrentUser(): Promise<any> {
    try {
      const info = await this.callMoodleAPI('core_webservice_get_site_info');
      return {
        userid: info.userid,
        username: info.username,
        firstname: info.firstname,
        lastname: info.lastname,
        fullname: info.fullname,
        email: info.userprivateaccesskey ? null : info.email, // Email puede estar oculto
      };
    } catch (error) {
      console.error('Error obteniendo información del usuario actual:', error);
      return null;
    }
  }

  /**
   * Obtiene todos los cursos activos usando el plugin personalizado
   * Este endpoint no requiere permisos especiales
   */
  async getActiveCourses(): Promise<MoodleCourse[]> {
    try {
      const courses = await this.callMoodleAPI('local_get_active_courses_get_courses');
      return courses || [];
    } catch (error) {
      console.error('Error obteniendo cursos activos:', error);
      return [];
    }
  }

  /**
   * Obtiene los cursos donde el usuario es profesor
   */
  async getUserCourses(userId?: number): Promise<MoodleCourse[]> {
    // Si no se proporciona userId, obtener el del usuario actual
    if (!userId) {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        console.error('No se pudo obtener información del usuario actual');
        return [];
      }
      userId = currentUser.userid;
    }

    // Verificación adicional de tipo para TypeScript
    if (!userId) {
      console.error('❌ No se pudo obtener userId válido');
      return [];
    }

    console.log(`🔒 [SEGURIDAD] Obteniendo SOLO cursos donde userId ${userId} es PROFESOR...`);
    return this.getTeacherCoursesFiltered(userId);
  }

  /**
   * Obtiene cursos donde el usuario es profesor usando filtrado por rol
   */
  async getTeacherCoursesFiltered(userId: number): Promise<MoodleCourse[]> {
    try {
      console.log(`🔍 [SEGURIDAD] Obteniendo cursos de userId ${userId} y filtrando solo donde es profesor...`);
      
      // Obtener TODOS los cursos donde el usuario está inscrito
      const allUserCourses = await this.callMoodleAPI('core_enrol_get_users_courses', {
        userid: userId,
      });
      
      if (allUserCourses.length === 0) {
        console.log('📚 No hay cursos donde el usuario esté inscrito');
        return [];
      }
      
      console.log(`📚 Encontrados ${allUserCourses.length} cursos donde está inscrito. Filtrando solo donde es profesor...`);
      
      const teacherCourses: MoodleCourse[] = [];
      
      // Para cada curso donde está inscrito, verificar si es profesor
      for (let i = 0; i < allUserCourses.length; i++) {
        const course = allUserCourses[i];
        
        try {
          console.log(`🔎 [${i+1}/${allUserCourses.length}] Verificando roles en: ${course.shortname}...`);
          
          // Obtener usuarios inscritos con roles para este curso
          const enrolledUsers = await this.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: course.id
          });
          
          // Buscar específicamente nuestro usuario
          const userInCourse = enrolledUsers.find((user: any) => user.id === userId);
          
          if (userInCourse && userInCourse.roles && userInCourse.roles.length > 0) {
            const roles = userInCourse.roles.map((role: any) => ({
              id: role.roleid,
              name: role.shortname || role.name
            }));
            
            console.log(`   🎭 Roles: ${roles.map((r: any) => `${r.name}(${r.id})`).join(', ')}`);
            
            // Verificar si tiene rol de profesor
            const hasTeacherRole = userInCourse.roles.some((role: any) => {
              const roleName = (role.shortname || role.name || '').toLowerCase();
              return (
                role.roleid === 3 || // editingteacher
                role.roleid === 4 || // teacher
                role.roleid === 1 || // manager
                roleName.includes('teacher') ||
                roleName.includes('editor') ||
                roleName.includes('manager') ||
                roleName.includes('tutor')
              );
            });
            
            if (hasTeacherRole) {
              console.log(`   ✅ ES PROFESOR - Agregando curso: ${course.shortname}`);
              teacherCourses.push(course);
            } else {
              console.log(`   👨‍🎓 Es estudiante - Omitiendo: ${course.shortname}`);
            }
          } else {
            console.log(`   ⚠️ Sin roles encontrados en: ${course.shortname}`);
          }
          
        } catch (courseError) {
          console.log(`   ❌ Error verificando ${course.shortname}: ${courseError instanceof Error ? courseError.message : courseError}`);
          continue;
        }
      }
      
      console.log(`📊 RESULTADO: ${teacherCourses.length} cursos como profesor de ${allUserCourses.length} total`);
      
      if (teacherCourses.length === 0) {
        console.log(`🚫 [SEGURIDAD] No se encontraron cursos donde userId ${userId} sea profesor`);
      } else {
        console.log(`🎓 [ÉXITO] Usuario ${userId} es profesor en:`);
        teacherCourses.forEach(course => {
          console.log(`   - ${course.shortname}: ${course.fullname}`);
        });
      }
      
      return teacherCourses;
      
    } catch (error) {
      console.error(`❌ Error crítico en filtrado de cursos para userId ${userId}:`, error);
      return []; // En caso de error, no devolver cursos por seguridad
    }
  }

  /**
   * Obtiene todos los grupos de un curso
   */
  async getCourseGroups(courseId: number): Promise<MoodleGroup[]> {
    try {
      const groups = await this.callMoodleAPI('core_group_get_course_groups', {
        courseid: courseId,
      });
      return groups || [];
    } catch (error) {
      console.error('Error obteniendo grupos del curso:', error);
      return [];
    }
  }

  /**
   * Obtiene los foros de un curso
   */
  async getCourseForums(courseId: number): Promise<MoodleForum[]> {
    try {
      const forums = await this.callMoodleAPI('mod_forum_get_forums_by_courses', {
        courseids: [courseId],
      });
      return forums || [];
    } catch (error) {
      console.error('Error obteniendo foros del curso:', error);
      return [];
    }
  }

  /**
   * Obtiene las discusiones de un foro
   */
  async getForumDiscussions(forumId: number): Promise<MoodleDiscussion[]> {
    try {
      const response = await this.callMoodleAPI('mod_forum_get_forum_discussions', {
        forumid: forumId
      });
      return response.discussions || [];
    } catch (error) {
      console.error('Error obteniendo discusiones del foro:', error);
      return [];
    }
  }

  /**
   * Obtiene los posts de una discusión
   */
  async getDiscussionPosts(discussionId: number): Promise<MoodlePost[]> {
    try {
      const response = await this.callMoodleAPI('mod_forum_get_discussion_posts', {
        discussionid: discussionId,
      });
      return response.posts || [];
    } catch (error) {
      console.error('Error obteniendo posts de la discusión:', error);
      return [];
    }
  }

  /**
   * Obtiene el contenido/secciones del curso
   */
  async getCourseContents(courseId: number): Promise<any[]> {
    try {
      const contents = await this.callMoodleAPI('core_course_get_contents', {
        courseid: courseId,
      });
      return contents || [];
    } catch (error) {
      console.error('Error obteniendo contenido del curso:', error);
      return [];
    }
  }

  /**
   * Obtiene usuarios matriculados en un curso con sus roles
   */
  async getEnrolledUsers(courseId: number): Promise<any[]> {
    try {
      const users = await this.callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: courseId
      });
      return users || [];
    } catch (error) {
      console.error('Error obteniendo usuarios matriculados:', error);
      return [];
    }
  }

  /**
   * Obtiene las entregas de una tarea
   */
  async getAssignmentSubmissions(assignmentId: number): Promise<any> {
    try {
      const submissions = await this.callMoodleAPI('mod_assign_get_submissions', {
        assignmentids: [assignmentId],
      });
      return submissions?.assignments?.[0] || { submissions: [] };
    } catch (error) {
      console.error(`Error obteniendo entregas de la tarea ${assignmentId}:`, error);
      return { submissions: [] };
    }
  }

  /**
   * Obtiene detalles completos de una tarea
   */
  async getAssignmentDetails(assignmentId: number): Promise<any> {
    try {
      const assignments = await this.callMoodleAPI('mod_assign_get_assignments', {
        assignmentids: [assignmentId],
      });
      return assignments?.courses?.[0]?.assignments?.[0] || null;
    } catch (error) {
      console.error(`Error obteniendo detalles de la tarea ${assignmentId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene el contenido del curso filtrado por grupo
   */
  async getCourseContentsByGroup(courseId: number, groupId: number): Promise<any[]> {
    try {
      const allContents = await this.callMoodleAPI('core_course_get_contents', {
        courseid: courseId,
      });

      // Filtrar contenido según restricciones de grupo
      const filteredContents = allContents.map((section: any) => ({
        ...section,
        modules: section.modules?.filter((module: any) => {
          // Si no hay restricciones de disponibilidad, incluir el módulo
          if (!module.availability) return true;

          try {
            const availability = JSON.parse(module.availability);
            
            // Verificar si hay restricciones de grupo
            if (availability.c && Array.isArray(availability.c)) {
              for (const condition of availability.c) {
                if (condition.type === 'group') {
                  // Si hay restricción de grupo, verificar si coincide
                  return condition.id === groupId;
                }
              }
            }
            
            // Si no hay restricciones de grupo específicas, incluir
            return true;
          } catch {
            // Si no se puede parsear, incluir por defecto
            return true;
          }
        }) || []
      }));

      return filteredContents;
    } catch (error) {
      console.error('Error obteniendo contenido filtrado por grupo:', error);
      return [];
    }
  }

  /**
   * Obtiene miembros de un grupo específico
   */
  async getGroupMembers(groupId: number): Promise<any[]> {
    try {
      const members = await this.callMoodleAPI('core_group_get_group_members', {
        groupids: [groupId],
      });
      return members?.[0]?.userids || [];
    } catch (error) {
      console.error('Error obteniendo miembros del grupo:', error);
      return [];
    }
  }
}

// Exportar instancia singleton para uso global
export const moodleClient = new MoodleAPIClientEnhanced();
