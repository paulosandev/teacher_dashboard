/**
 * Servicio de autenticación directa contra Moodle
 * No persiste usuarios, valida en tiempo real
 */

import { MoodleAPIClient } from '@/lib/moodle/api-client'

export interface MoodleUser {
  id: number
  username: string
  firstname: string
  lastname: string
  fullname: string
  email: string
  roles: Array<{
    roleid: number
    name: string
    shortname: string
  }>
}

export interface MoodleAuthResult {
  success: boolean
  user?: MoodleUser
  isTeacher?: boolean
  token?: string
  error?: string
  tokenExpiry?: Date
}

export class MoodleAuthService {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.MOODLE_URL!
  }

  /**
   * Autentica usuario directamente contra Moodle
   * @param username - Nombre de usuario o matrícula
   * @param password - Contraseña
   * @returns Resultado de autenticación con información del usuario
   */
  async authenticateUser(username: string, password: string): Promise<MoodleAuthResult> {
    try {
      console.log(`🔐 Intentando autenticación Moodle para: ${username}`)

      // 1. Obtener token usando credenciales
      const token = await this.getTokenFromCredentials(username, password)
      if (!token) {
        return {
          success: false,
          error: 'Credenciales inválidas'
        }
      }

      // 2. Crear cliente temporal con el token
      const client = new MoodleAPIClient(this.baseUrl, token)

      // 3. Obtener información del usuario
      const siteInfo = await client.callMoodleAPI('core_webservice_get_site_info', {})
      
      // 4. Validar que es profesor
      const isTeacher = await this.validateTeacherRole(client, siteInfo.userid)
      
      if (!isTeacher) {
        return {
          success: false,
          error: 'Acceso restringido a profesores únicamente'
        }
      }

      // 5. Calcular expiración del token (asumimos 24 horas por defecto)
      const tokenExpiry = new Date()
      tokenExpiry.setHours(tokenExpiry.getHours() + 24)

      const user: MoodleUser = {
        id: siteInfo.userid,
        username: siteInfo.username,
        firstname: siteInfo.firstname,
        lastname: siteInfo.lastname,
        fullname: siteInfo.fullname,
        email: siteInfo.useremail || `${siteInfo.username}@moodle.local`,
        roles: [] // Se llenará después si es necesario
      }

//       console.log(`✅ Autenticación exitosa para profesor: ${user.fullname}`)

      return {
        success: true,
        user,
        isTeacher: true,
        token,
        tokenExpiry
      }

    } catch (error: any) {
      console.error(`❌ Error en autenticación Moodle:`, error)
      
      return {
        success: false,
        error: this.parseAuthError(error)
      }
    }
  }

  /**
   * Obtiene token de Moodle usando credenciales
   */
  private async getTokenFromCredentials(username: string, password: string): Promise<string | null> {
    try {
      const tokenUrl = `${this.baseUrl}/login/token.php`
      
      const params = new URLSearchParams({
        username,
        password,
        service: 'moodle_mobile_app' // O el servicio configurado en tu Moodle
      })

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      })

      const data = await response.json()

      if (data.error) {
        console.error(`❌ Error obteniendo token:`, data.error)
        return null
      }

      if (data.token) {
//         console.log(`🔑 Token obtenido exitosamente`)
        return data.token
      }

      return null
    } catch (error) {
      console.error(`❌ Error en solicitud de token:`, error)
      return null
    }
  }

  /**
   * Valida que el usuario tiene rol de profesor
   */
  private async validateTeacherRole(client: MoodleAPIClient, userId: number): Promise<boolean> {
    try {
      // Obtener cursos donde el usuario está inscrito
      const userCourses = await client.callMoodleAPI('core_enrol_get_users_courses', {
        userid: userId
      })

      if (!userCourses || userCourses.length === 0) {
        console.log(`👤 Usuario ${userId} no tiene cursos asignados`)
        return false
      }

      // Verificar rol en al menos un curso
      for (const course of userCourses.slice(0, 3)) { // Revisar solo primeros 3 cursos
        try {
          const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: course.id
          })

          const userInCourse = enrolledUsers.find((u: any) => u.id === userId)
          
          if (userInCourse && userInCourse.roles) {
            // Verificar si tiene rol de profesor (roleid 3 = teacher, 4 = editingteacher)
            const hasTeacherRole = userInCourse.roles.some((role: any) => 
              role.roleid === 3 || role.roleid === 4 || 
              role.shortname?.includes('teacher') ||
              role.shortname?.includes('editingteacher')
            )

            if (hasTeacherRole) {
//               console.log(`✅ Usuario ${userId} confirmado como profesor en curso ${course.id}`)
              return true
            }
          }
        } catch (error) {
          console.warn(`⚠️ No se pudo verificar rol en curso ${course.id}:`, error)
          continue
        }
      }

      console.log(`❌ Usuario ${userId} no tiene rol de profesor en ningún curso`)
      return false

    } catch (error) {
      console.error(`❌ Error validando rol de profesor:`, error)
      return false
    }
  }

  /**
   * Valida si un token sigue siendo válido
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const client = new MoodleAPIClient(this.baseUrl, token)
      const siteInfo = await client.callMoodleAPI('core_webservice_get_site_info', {})
      return !!siteInfo.userid
    } catch (error) {
      console.error(`❌ Token inválido o expirado:`, error)
      return false
    }
  }

  /**
   * Parsea errores de autenticación para mensajes user-friendly
   */
  private parseAuthError(error: any): string {
    if (error.message?.includes('Invalid login')) {
      return 'Usuario o contraseña incorrectos'
    }
    
    if (error.message?.includes('Token not valid')) {
      return 'Credenciales inválidas'
    }

    if (error.message?.includes('Access denied')) {
      return 'Acceso denegado. Solo profesores pueden acceder'
    }

    if (error.message?.includes('Network')) {
      return 'Error de conexión con Moodle'
    }

    return 'Error de autenticación. Verifique sus credenciales'
  }

  /**
   * Obtiene cursos donde el usuario es profesor (método legacy)
   */
  async getTeacherCourses(token: string, userId: number): Promise<any[]> {
    try {
      const client = new MoodleAPIClient(this.baseUrl, token)
      
      // Obtener cursos del usuario
      const userCourses = await client.callMoodleAPI('core_enrol_get_users_courses', {
        userid: userId
      })

      const teacherCourses = []

      // Filtrar solo cursos donde es profesor
      for (const course of userCourses) {
        try {
          const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: course.id
          })

          const userInCourse = enrolledUsers.find((u: any) => u.id === userId)
          
          if (userInCourse?.roles?.some((role: any) => 
            role.roleid === 3 || role.roleid === 4 ||
            role.shortname?.includes('teacher')
          )) {
            // Obtener grupos del curso
            const groups = await client.callMoodleAPI('core_group_get_course_groups', {
              courseid: course.id
            })
            
            teacherCourses.push({
              ...course,
              groups: groups || []
            })
          }
        } catch (error) {
          console.warn(`⚠️ Error procesando curso ${course.id}:`, error)
          continue
        }
      }

      return teacherCourses
    } catch (error) {
      console.error(`❌ Error obteniendo cursos del profesor:`, error)
      return []
    }
  }

  /**
   * Obtiene combinaciones curso-grupo donde el usuario es profesor y está enrolado
   * Implementa el algoritmo optimizado en lotes para verificar membresía de grupos
   */
  async getTeacherCourseGroups(token: string, userId: number): Promise<Array<{
    courseId: string,
    courseName: string,
    courseShortname: string,
    courseFullname: string,
    groupId: string,
    groupName: string,
    displayName: string, // "Curso Name | Grupo Name"
    course: any,
    group: any
  }>> {
    try {
//       console.log(`🔍 ALGORITMO OPTIMIZADO: Iniciando obtención de cursos-grupos para usuario ${userId}`)
//       console.log(`📋 PSEUDO-CÓDIGO IMPLEMENTADO:`)
      console.log(`   1. Obtener cursos del profesor`)
      console.log(`   2. Recopilar IDs de todos los grupos en lote`)
      console.log(`   3. Consultar membresía de todos los grupos de una vez`)
      console.log(`   4. Filtrar grupos donde el profesor está enrolado`)
      
      const client = new MoodleAPIClient(this.baseUrl, token)
      
      // Paso 1: Obtener sus cursos
//       console.log(`🚀 PASO 1: Obteniendo cursos del usuario ${userId}`)
      const lista_de_cursos = await client.callMoodleAPI('core_enrol_get_users_courses', {
        userid: userId
      })

      if (!lista_de_cursos || lista_de_cursos.length === 0) {
        console.log(`📚 No se encontraron cursos para el usuario ${userId}`)
        return []
      }

//       console.log(`✅ PASO 1 COMPLETADO: ${lista_de_cursos.length} cursos encontrados`)

      // Array para guardar todos los grupos encontrados
      const todos_los_ids_de_grupos: number[] = []
      const courseGroupMapping: {[key: number]: {course: any, group: any}} = {}
      const teacherCourses: any[] = []

      // Paso 2: Verificar cuales son cursos donde es profesor y recopilar grupos
//       console.log(`🚀 PASO 2: Verificando rol de profesor y recopilando grupos...`)
      
      for (const curso of lista_de_cursos) {
        try {
//           console.log(`🔄 Verificando curso: ${curso.fullname || curso.name} (ID: ${curso.id})`)
          
          // Verificar si es profesor en el curso
          const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: curso.id
          })

          const userInCourse = enrolledUsers.find((u: any) => u.id === userId)
          
          if (!userInCourse?.roles?.some((role: any) => 
            role.roleid === 3 || role.roleid === 4 ||
            role.shortname?.includes('teacher') || role.shortname?.includes('editingteacher')
          )) {
            console.log(`❌ Usuario NO es profesor en curso: ${curso.fullname || curso.name}`)
            continue // No es profesor en este curso
          }

//           console.log(`👨‍🏫 Profesor CONFIRMADO en curso: ${curso.fullname || curso.name}`)
          teacherCourses.push(curso)

          // Obtener grupos del curso
          try {
            const grupos_del_curso = await client.callMoodleAPI('core_group_get_course_groups', {
              courseid: curso.id
            })

            if (grupos_del_curso && grupos_del_curso.length > 0) {
//               console.log(`👥 Encontrados ${grupos_del_curso.length} grupos en curso ${curso.fullname || curso.name}`)
              
              // Para cada grupo en grupos_del_curso, agregar grupo.id a todos_los_ids_de_grupos
              for (const grupo of grupos_del_curso) {
                todos_los_ids_de_grupos.push(grupo.id)
                courseGroupMapping[grupo.id] = { course: curso, group: grupo }
//                 console.log(`   📌 Agregado grupo ID ${grupo.id}: ${grupo.name}`)
              }
            } else {
//               console.log(`📋 Curso sin grupos: ${curso.fullname || curso.name}`)
              // Marcar curso sin grupos para procesamiento posterior
              courseGroupMapping[0] = { course: curso, group: null }
            }
          } catch (groupError) {
            console.warn(`⚠️ Error obteniendo grupos del curso ${curso.id}:`, groupError)
            // Marcar curso con error para procesamiento posterior
            courseGroupMapping[0] = { course: curso, group: null }
          }

        } catch (error) {
          console.error(`❌ Error crítico procesando curso ${curso.id}:`, error)
          continue
        }
      }

//       console.log(`✅ PASO 2 COMPLETADO:`)
      console.log(`   - Cursos donde es profesor: ${teacherCourses.length}`)
      console.log(`   - Total IDs de grupos recopilados: ${todos_los_ids_de_grupos.length}`)
      console.log(`   - IDs de grupos: [${todos_los_ids_de_grupos.join(', ')}]`)

      // Paso 3: Obtener información de grupos desde usuarios enrolados (MÉTODO CORREGIDO)
//       console.log(`🚀 PASO 3: Obteniendo información de grupos desde usuarios enrolados...`)
      console.log(`🔧 CORRECCIÓN: Usando core_enrol_get_enrolled_users en lugar de core_group_get_group_members`)
      console.log(`   Razón: La API de miembros de grupos solo devuelve estudiantes, no profesores`)
      
      // Array final para guardar los grupos del profesor
      const grupos_finales_del_profesor: any[] = []

      // Para cada curso donde es profesor, verificar sus grupos desde enrolled_users
      for (const curso of teacherCourses) {
        try {
//           console.log(`🔍 Verificando grupos del profesor en curso: ${curso.fullname || curso.name}`)
          
          const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: curso.id
          })

          const currentUser = enrolledUsers.find((u: any) => u.id === userId)
          if (currentUser && currentUser.groups && currentUser.groups.length > 0) {
//             console.log(`✅ Profesor encontrado con ${currentUser.groups.length} grupos en curso ${curso.id}`)
            
            // Para cada grupo del profesor
            for (const userGroup of currentUser.groups) {
//               console.log(`🎯 Profesor está en grupo: ${userGroup.name} (ID: ${userGroup.id})`)
              
              // Buscar el mapping de este grupo
              const mappingInfo = courseGroupMapping[userGroup.id]
              if (mappingInfo) {
                grupos_finales_del_profesor.push({
                  courseId: mappingInfo.course.id.toString(),
                  courseName: mappingInfo.course.name || mappingInfo.course.fullname,
                  courseShortname: mappingInfo.course.shortname || '',
                  courseFullname: mappingInfo.course.fullname || mappingInfo.course.name,
                  groupId: mappingInfo.group.id.toString(),
                  groupName: mappingInfo.group.name,
                  displayName: `${mappingInfo.course.name || mappingInfo.course.fullname} | ${mappingInfo.group.name} | ${this.extractAulaFromUrl()}`,
                  course: mappingInfo.course,
                  group: mappingInfo.group
                })
//                 console.log(`✅ PROFESOR AGREGADO: ${mappingInfo.course.name || mappingInfo.course.fullname} | ${mappingInfo.group.name}`)
              } else {
                console.warn(`⚠️ Grupo ${userGroup.name} (${userGroup.id}) no encontrado en mapping`)
              }
            }
          } else {
            console.log(`ℹ️ Profesor no está en grupos específicos del curso ${curso.id}`)
          }
        } catch (error: any) {
          console.error(`❌ Error verificando grupos del curso ${curso.id}:`, error)
        }
      }

//       console.log(`✅ PASO 3 COMPLETADO usando método corregido`)
//       console.log(`📊 Grupos específicos encontrados: ${grupos_finales_del_profesor.length}`)

      // Agregar cursos sin grupos o con acceso general
//       console.log(`🚀 PASO 5: Procesando cursos sin grupos o con acceso general...`)
      for (const curso of teacherCourses) {
        // Verificar si el profesor ya está en algún grupo de este curso
        const profesorEnGruposDelCurso = grupos_finales_del_profesor.some(item => 
          item.courseId === curso.id.toString()
        )

        if (!profesorEnGruposDelCurso) {
          // El profesor es profesor del curso pero no está en ningún grupo específico
          grupos_finales_del_profesor.push({
            courseId: curso.id.toString(),
            courseName: curso.name || curso.fullname,
            courseShortname: curso.shortname || '',
            courseFullname: curso.fullname || curso.name,
            groupId: '0', // ID especial para acceso general
            groupName: 'Acceso General',
            displayName: `${curso.name || curso.fullname} | Acceso General | ${this.extractAulaFromUrl()}`,
            course: curso,
            group: null
          })
//           console.log(`👨‍🏫 Acceso general concedido para curso: ${curso.name || curso.fullname}`)
        }
      }

//       console.log(`✅ ALGORITMO COMPLETADO:`)
//       console.log(`📊 Total de combinaciones curso-grupo encontradas: ${grupos_finales_del_profesor.length}`)
      
      // ¡Listo! 'grupos_finales_del_profesor' contiene la información que necesitas.
//       console.log(`🎯 RESULTADO FINAL:`)
      grupos_finales_del_profesor.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.displayName} (Curso: ${item.courseId}, Grupo: ${item.groupId})`)
      })
      
      if (grupos_finales_del_profesor.length === 0) {
        console.warn(`⚠️ No se encontraron combinaciones curso-grupo para el usuario ${userId}`)
      }
      
      return grupos_finales_del_profesor

    } catch (error) {
      console.error(`❌ Error crítico en algoritmo optimizado:`, error)
      
      // Fallback: usar el método legacy como backup
//       console.log(`🔄 Intentando método legacy como fallback...`)
      try {
        const legacyCourses = await this.getTeacherCourses(token, userId)
        return legacyCourses.map(course => ({
          courseId: course.id.toString(),
          courseName: course.name || course.fullname,
          courseShortname: course.shortname || '',
          courseFullname: course.fullname || course.name,
          groupId: '0',
          groupName: 'Sin Grupos (Fallback)',
          displayName: `${course.name || course.fullname} | Sin Grupos (Fallback) | ${this.extractAulaFromUrl()}`,
          course: course,
          group: null
        }))
      } catch (fallbackError) {
        console.error(`❌ Error en fallback:`, fallbackError)
        return []
      }
    }
  }

  /**
   * Extrae el identificador del aula desde la URL base
   */
  private extractAulaFromUrl(): string {
    try {
      // Extraer dominio de la URL (ej: https://av141.utel.edu.mx -> av141)
      const url = new URL(this.baseUrl)
      const hostname = url.hostname
      
      // Buscar patrones como: av141.utel.edu.mx, aula101.utel.edu.mx
      const aulaMatch = hostname.match(/^(av\d+|aula\d+)\.utel\.edu\.mx$/)
      if (aulaMatch) {
        return aulaMatch[1].toUpperCase() // AV141, AULA101
      }
      
      // Fallback: usar el hostname completo si no coincide el patrón
      return hostname.split('.')[0].toUpperCase()
      
    } catch (error) {
      console.warn('⚠️ Error extrayendo aula de URL:', error)
      return 'AULA'
    }
  }
}

// Factory function para lazy loading
let moodleAuthServiceInstance: MoodleAuthService | null = null

export function getMoodleAuthService(): MoodleAuthService {
  if (!moodleAuthServiceInstance) {
    moodleAuthServiceInstance = new MoodleAuthService()
  }
  return moodleAuthServiceInstance
}

// Compatibilidad con import anterior
export const moodleAuthService = {
  authenticateUser: (...args: Parameters<MoodleAuthService['authenticateUser']>) => 
    getMoodleAuthService().authenticateUser(...args),
  getTeacherCourses: (...args: Parameters<MoodleAuthService['getTeacherCourses']>) => 
    getMoodleAuthService().getTeacherCourses(...args),
  getTeacherCourseGroups: (...args: Parameters<MoodleAuthService['getTeacherCourseGroups']>) => 
    getMoodleAuthService().getTeacherCourseGroups(...args)
}