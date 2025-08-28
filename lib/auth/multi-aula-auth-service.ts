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
  error?: string
}

class MultiAulaAuthService {
  /**
   * Proceso completo de autenticación multi-aula
   */
  async authenticateUser(username: string, password: string): Promise<MultiAulaAuthResult> {
    console.log(`🔐 Iniciando autenticación multi-aula para: ${username}`)

    try {
      // PASO 1: Buscar en qué aulas está enrolado el profesor
      const enrolmentClient = getIntegratedEnrolmentClient()
      
      // Buscar por username (matrícula) en la base de datos
      const userEnrolments = await this.findUserEnrolments(username)
      
      if (userEnrolments.length === 0) {
        console.log(`❌ Usuario ${username} no encontrado como profesor en ninguna aula`)
        return {
          success: false,
          user: {} as any,
          totalAulas: 0,
          validAulas: 0,
          invalidAulas: 0,
          aulaResults: [],
          error: 'Usuario no encontrado como profesor en el sistema'
        }
      }

      console.log(`📚 Usuario encontrado en ${userEnrolments.length} aulas: ${userEnrolments.map(e => e.aulaId).join(', ')}`)

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

      // PASO 4: Preparar resultado exitoso
      console.log(`✅ Autenticación exitosa: ${validAulas}/${userEnrolments.length} aulas válidas`)
      
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
        primaryToken: primaryToken
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
   * Validar credenciales en una aula específica
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
      
      console.log(`🔍 Probando credenciales en ${domain} (${aulaUrl})`)

      // Crear cliente Moodle para esta aula específica
      const moodleClient = new MoodleAPIClient(aulaUrl, '')
      
      // Intentar obtener token con las credenciales
      const tokenResult = await moodleClient.getTokenWithCredentials(username, password)
      
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

      // Crear cliente con el token obtenido
      const authenticatedClient = new MoodleAPIClient(aulaUrl, tokenResult.token)
      
      // Obtener información del usuario
      const userInfo = await authenticatedClient.callMoodleAPI('core_webservice_get_site_info', {})
      
      if (!userInfo || !userInfo.userid) {
        console.log(`❌ No se pudo obtener información del usuario en ${domain}`)
        return {
          aulaId,
          aulaUrl,
          domain,
          isValidCredentials: false,
          error: 'No se pudo obtener información del usuario'
        }
      }

      console.log(`✅ Credenciales válidas en ${domain} para: ${userInfo.fullname}`)
      
      // Verificar si también hay token de servicio disponible
      const serviceToken = serviceTokenManager.getServiceToken(aulaId)
      
      return {
        aulaId,
        aulaUrl,
        domain,
        isValidCredentials: true,
        token: tokenResult.token,
        tokenExpiry: tokenResult.expiry,
        userInfo: {
          id: userInfo.userid,
          username: userInfo.username,
          fullname: userInfo.fullname,
          email: userInfo.useremail || ''
        },
        serviceToken,
        hasServiceAccess: !!serviceToken
      }

    } catch (error) {
      console.error(`❌ Error validando credenciales en ${aulaId}:`, error)
      return {
        aulaId,
        aulaUrl,
        domain: this.extractDomainFromUrl(aulaUrl),
        isValidCredentials: false,
        error: error instanceof Error ? error.message : 'Error de conexión'
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
}

// Singleton
export const multiAulaAuthService = new MultiAulaAuthService()