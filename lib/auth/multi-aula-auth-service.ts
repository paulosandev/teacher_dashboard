/**
 * Servicio de autenticación multi-aula integrado
 * Proceso completo de login con validación en múltiples aulas
 */

import { getIntegratedEnrolmentClient } from '@/lib/db/integrated-enrolment-client'
import { MoodleAPIClient } from '@/lib/moodle/api-client'
import { serviceTokenManager, type ServiceTokenInfo } from '@/lib/services/service-token-manager'

export interface AulaAuthResult {
  aulaId: string
  aulaUrl: string
  domain: string  // ej: av141, aula101
  isValidCredentials: boolean
  token?: string
  tokenExpiry?: Date
  error?: string
  userInfo?: {
    id: number
    username: string
    fullname: string
    email: string
  }
  serviceToken?: ServiceTokenInfo  // Token de servicio general disponible
  hasServiceAccess?: boolean       // Si hay acceso vía token de servicio
}

export interface ProfessorCourse {
  aulaId: string
  aulaUrl: string
  courseId: number
  courseName: string
  courseShortName: string
  groups: ProfessorGroup[]
}

export interface ProfessorGroup {
  groupId: number
  groupName: string
  courseId: number
}

export interface MultiAulaAuthResult {
  success: boolean
  user: {
    id: string
    username: string
    fullname: string
    email: string
  }
  totalAulas: number
  validAulas: number
  invalidAulas: number
  aulaResults: AulaAuthResult[]
  primaryToken?: string  // Token del aula principal (primera válida)
  professorCourses?: ProfessorCourse[]  // Cursos donde es profesor con sus grupos
  error?: string
}

class MultiAulaAuthService {
  /**
   * Proceso completo de autenticación multi-aula
   */
  async authenticateUser(username: string, password: string): Promise<MultiAulaAuthResult> {
    console.log(`🔐 Iniciando autenticación multi-aula para: ${username}`)

    try {
      // PASO 1: Consultar enrolments del usuario en la base de datos
      console.log(`📚 Consultando enrolments para: ${username}`)
      const userEnrolments = await this.findUserEnrolments(username)

      if (userEnrolments.length === 0) {
        console.log(`❌ No se encontraron enrolments para la matrícula: ${username}`)
        return {
          success: false,
          user: {} as any,
          totalAulas: 0,
          validAulas: 0,
          invalidAulas: 0,
          aulaResults: [],
          error: 'Usuario no encontrado como profesor en ninguna aula'
        }
      }

      console.log(`📚 Usuario encontrado en ${userEnrolments.length} aula(s): ${userEnrolments.map(e => e.aulaId).join(', ')}`)

      // PASO 2: Validar credenciales en cada aula donde está enrolado
      const aulaResults: AulaAuthResult[] = []
      let primaryToken: string | undefined
      let userInfo: any | undefined

      for (const enrolment of userEnrolments) {
        console.log(`🏫 Validando credenciales en aula: ${enrolment.aulaId} (${enrolment.aulaUrl})`)
        
        const aulaResult = await this.validateCredentialsInAula(
          username,
          password,
          enrolment.aulaId,
          enrolment.aulaUrl
        )
        
        aulaResults.push(aulaResult)

        // La primera aula válida se convierte en la principal
        if (aulaResult.isValidCredentials && !primaryToken) {
          primaryToken = aulaResult.token
          userInfo = aulaResult.userInfo
          console.log(`✅ Aula principal establecida: ${enrolment.aulaId}`)
        }
      }

      // PASO 3: Analizar resultados
      const validAulas = aulaResults.filter(r => r.isValidCredentials).length
      const invalidAulas = aulaResults.filter(r => !r.isValidCredentials).length

      if (validAulas === 0) {
        console.log(`❌ Credenciales inválidas en todas las aulas para: ${username}`)
        return {
          success: false,
          user: {} as any,
          totalAulas: userEnrolments.length,
          validAulas: 0,
          invalidAulas: invalidAulas,
          aulaResults: aulaResults,
          error: 'Credenciales inválidas en todas las aulas'
        }
      }

      // PASO 4: Obtener cursos y grupos donde es profesor
      console.log(`Obteniendo cursos y grupos donde es profesor...`)
      const professorCourses = await this.getProfessorCoursesAndGroups(aulaResults.filter(r => r.isValidCredentials))

      // PASO 5: Preparar resultado exitoso
      console.log(`Autenticación exitosa: ${validAulas}/${userEnrolments.length} aulas válidas`)
      console.log(`Encontrados ${professorCourses.length} cursos donde es profesor`)

      if (invalidAulas > 0) {
        console.log(`⚠️ ${invalidAulas} aula(s) con credenciales diferentes`)
      }

      return {
        success: true,
        user: {
          id: userInfo?.id?.toString() || '',
          username: userInfo?.username || username,
          fullname: userInfo?.fullname || '',
          email: userInfo?.email || ''
        },
        totalAulas: userEnrolments.length,
        validAulas: validAulas,
        invalidAulas: invalidAulas,
        aulaResults: aulaResults,
        primaryToken: primaryToken,
        professorCourses: professorCourses
      }

    } catch (error) {
      console.error('❌ Error en autenticación multi-aula:', error)
      return {
        success: false,
        user: {} as any,
        totalAulas: 0,
        validAulas: 0,
        invalidAulas: 0,
        aulaResults: [],
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  /**
   * Buscar enrolments del usuario por username o email
   */
  private async findUserEnrolments(username: string): Promise<{aulaId: string, aulaUrl: string}[]> {
    const enrolmentClient = getIntegratedEnrolmentClient()
    
    // Primero intentar por username (matrícula)
    let results = await enrolmentClient.executeQuery(`
      SELECT DISTINCT idAula
      FROM enrolment 
      WHERE LOWER(username) = LOWER(?) 
      AND roles_id = 17
      AND suspendido = 0
    `, [username])

    // Si no se encontró por username, intentar por email
    if (results.length === 0) {
      console.log(`🔍 No se encontró por username, intentando por email: ${username}`)
      results = await enrolmentClient.executeQuery(`
        SELECT DISTINCT idAula
        FROM enrolment 
        WHERE LOWER(email) = LOWER(?) 
        AND roles_id = 17
        AND suspendido = 0
      `, [username])
    }

    return results.map((row: any) => ({
      aulaId: row.idAula,
      aulaUrl: this.buildAulaUrl(row.idAula)
    }))
  }

  /**
   * Validar credenciales en una aula específica usando el endpoint de Next.js
   */
  private async validateCredentialsInAula(
    username: string,
    password: string,
    aulaId: string,
    aulaUrl: string
  ): Promise<AulaAuthResult> {
    try {
      // Extraer dominio del aula (ej: av141, aula101)
      const domain = this.extractDomainFromUrl(aulaUrl)

      console.log(`🔍 Probando credenciales en ${domain} (${aulaUrl}) via API endpoint`)

      // Llamar al endpoint interno de Next.js - usar la URL base dinámica para producción
      const baseUrl = process.env.NODE_ENV === 'production'
        ? (process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000')
        : 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/moodle/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password,
          aulaUrl
        }),
        cache: 'no-store'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error de red' }))
        console.log(`❌ Error en endpoint para ${domain}: ${errorData.error}`)

        // Verificar si hay token de servicio disponible como fallback
        const serviceToken = serviceTokenManager.getServiceToken(aulaId)

        return {
          aulaId,
          aulaUrl,
          domain,
          isValidCredentials: false,
          error: errorData.error || 'Error de conexión',
          serviceToken,
          hasServiceAccess: !!serviceToken
        }
      }

      const tokenResult = await response.json()

      if (!tokenResult.success || !tokenResult.token) {
        console.log(`❌ Credenciales inválidas en ${domain}: ${tokenResult.error}`)

        // Verificar si hay token de servicio disponible como fallback
        const serviceToken = serviceTokenManager.getServiceToken(aulaId)

        return {
          aulaId,
          aulaUrl,
          domain,
          isValidCredentials: false,
          error: tokenResult.error || 'Credenciales inválidas',
          serviceToken,
          hasServiceAccess: !!serviceToken
        }
      }

      console.log(`✅ Credenciales válidas en ${domain}${tokenResult.userInfo ? ` para: ${tokenResult.userInfo.fullname}` : ''}`)

      // Verificar si también hay token de servicio disponible
      const serviceToken = serviceTokenManager.getServiceToken(aulaId)

      return {
        aulaId,
        aulaUrl,
        domain,
        isValidCredentials: true,
        token: tokenResult.token,
        tokenExpiry: tokenResult.expiry ? new Date(tokenResult.expiry) : new Date(Date.now() + 60 * 60 * 1000),
        userInfo: tokenResult.userInfo ? {
          id: tokenResult.userInfo.id,
          username: tokenResult.userInfo.username,
          fullname: tokenResult.userInfo.fullname,
          email: tokenResult.userInfo.email || ''
        } : undefined,
        serviceToken,
        hasServiceAccess: !!serviceToken
      }

    } catch (error) {
      console.error(`❌ Error validando credenciales en ${aulaId}:`, error)

      // Verificar si hay token de servicio disponible como fallback
      const serviceToken = serviceTokenManager.getServiceToken(aulaId)

      return {
        aulaId,
        aulaUrl,
        domain: this.extractDomainFromUrl(aulaUrl),
        isValidCredentials: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
        serviceToken,
        hasServiceAccess: !!serviceToken
      }
    }
  }

  /**
   * Construir URL del aula basado en idAula
   */
  private buildAulaUrl(idAula: string): string {
    if (!idAula) return ''
    
    if (/^\d+$/.test(idAula)) {
      return `https://aula${idAula}.utel.edu.mx`
    }
    
    return `https://${idAula.toLowerCase()}.utel.edu.mx`
  }

  /**
   * Extraer dominio de la URL (ej: av141, aula101)
   */
  private extractDomainFromUrl(aulaUrl: string): string {
    const match = aulaUrl.match(/https:\/\/([^.]+)\.utel\.edu\.mx/)
    return match ? match[1] : aulaUrl
  }

  /**
   * Obtener tokens válidos para usar en el dashboard
   */
  getValidTokens(aulaResults: AulaAuthResult[]): {[aulaId: string]: string} {
    const validTokens: {[aulaId: string]: string} = {}
    
    aulaResults.forEach(result => {
      if (result.isValidCredentials && result.token) {
        validTokens[result.aulaId] = result.token
      }
    })
    
    return validTokens
  }

  /**
   * Obtener mensaje de estado para mostrar al usuario
   */
  getStatusMessage(result: MultiAulaAuthResult): string {
    if (!result.success) {
      return result.error || 'Error de autenticación'
    }

    if (result.invalidAulas === 0) {
      return `✅ Acceso completo a ${result.validAulas} aula(s)`
    }

    return `⚠️ Acceso parcial: ${result.validAulas} de ${result.totalAulas} aulas (credenciales diferentes en ${result.invalidAulas} aula(s))`
  }

  /**
   * Obtener cursos y grupos donde el profesor está enrolado
   */
  private async getProfessorCoursesAndGroups(validAulas: AulaAuthResult[]): Promise<ProfessorCourse[]> {
    const professorCourses: ProfessorCourse[] = []

    for (const aula of validAulas) {
      if (!aula.token || !aula.userInfo) continue

      try {
        console.log(`🔍 Buscando cursos de profesor en ${aula.aulaId}...`)

        // Crear cliente Moodle para esta aula
        const moodleClient = new MoodleAPIClient(aula.aulaUrl, aula.token)

        // Obtener cursos donde es profesor (usando la función existente del cliente)
        const teacherCourses = await moodleClient.getTeacherCoursesFiltered(aula.userInfo.id)

        console.log(`📚 Encontrados ${teacherCourses.length} cursos como profesor en ${aula.aulaId}`)

        // Para cada curso, obtener los grupos
        for (const course of teacherCourses) {
          try {
            console.log(`👥 Obteniendo grupos del curso: ${course.shortname}`)

            // Usar token de servicio para core_group_get_course_groups ya que requiere permisos administrativos
            const courseGroups = await moodleClient.getCourseGroupsWithServiceToken(course.id, aula.aulaId)

            const groups: ProfessorGroup[] = courseGroups.map(group => ({
              groupId: group.id,
              groupName: group.name,
              courseId: course.id
            }))

            professorCourses.push({
              aulaId: aula.aulaId,
              aulaUrl: aula.aulaUrl,
              courseId: course.id,
              courseName: course.fullname,
              courseShortName: course.shortname,
              groups: groups
            })

            console.log(`✅ Curso ${course.shortname}: ${groups.length} grupo(s)`)

          } catch (courseError) {
            console.error(`Error obteniendo grupos para curso ${course.shortname}:`, courseError)
          }
        }

      } catch (aulaError) {
        console.error(`Error obteniendo cursos de ${aula.aulaId}:`, aulaError)
      }
    }

    return professorCourses
  }
}

// Singleton
export const multiAulaAuthService = new MultiAulaAuthService()