/**
 * Gestor de tokens de servicio general para aulas UTEL
 * Maneja tokens t_assistant para funciones que no requieren tokens específicos del profesor
 */

interface ServiceTokenInfo {
  aulaId: string
  aulaUrl: string
  token: string
  user: string
  service: string
}

export class ServiceTokenManager {
  private static instance: ServiceTokenManager
  private serviceTokens: Map<string, ServiceTokenInfo> = new Map()

  static getInstance(): ServiceTokenManager {
    if (!this.instance) {
      this.instance = new ServiceTokenManager()
      this.instance.initializeServiceTokens()
    }
    return this.instance
  }

  /**
   * Inicializar tokens de servicio desde variables de entorno
   */
  private initializeServiceTokens() {
    const serviceTokens = [
      { aulaId: '101', token: process.env.MOODLE_SERVICE_TOKEN_AULA101 },
      { aulaId: '102', token: process.env.MOODLE_SERVICE_TOKEN_AULA102 },
      { aulaId: '103', token: process.env.MOODLE_SERVICE_TOKEN_AULA103 },
      { aulaId: '104', token: process.env.MOODLE_SERVICE_TOKEN_AULA104 },
      { aulaId: '105', token: process.env.MOODLE_SERVICE_TOKEN_AULA105 },
      { aulaId: '106', token: process.env.MOODLE_SERVICE_TOKEN_AULA106 },
      { aulaId: '107', token: process.env.MOODLE_SERVICE_TOKEN_AULA107 },
      { aulaId: '108', token: process.env.MOODLE_SERVICE_TOKEN_AULA108 },
      { aulaId: '109', token: process.env.MOODLE_SERVICE_TOKEN_AULA109 },
      { aulaId: '110', token: process.env.MOODLE_SERVICE_TOKEN_AULA110 },
      // Additional aulas for extended coverage
      { aulaId: '111', token: process.env.MOODLE_SERVICE_TOKEN_AULA111 },
      { aulaId: '112', token: process.env.MOODLE_SERVICE_TOKEN_AULA112 },
      { aulaId: '113', token: process.env.MOODLE_SERVICE_TOKEN_AULA113 },
      { aulaId: '114', token: process.env.MOODLE_SERVICE_TOKEN_AULA114 },
      { aulaId: '115', token: process.env.MOODLE_SERVICE_TOKEN_AULA115 },
      { aulaId: '122', token: process.env.MOODLE_SERVICE_TOKEN_AULA122 },
      // Special aulas
      { aulaId: 'av141', token: process.env.MOODLE_SERVICE_TOKEN_AV141 },
      // Extended aulas (1100 series)
      { aulaId: '1101', token: process.env.MOODLE_SERVICE_TOKEN_AULA1101 },
      { aulaId: '1102', token: process.env.MOODLE_SERVICE_TOKEN_AULA1102 },
      { aulaId: '1103', token: process.env.MOODLE_SERVICE_TOKEN_AULA1103 },
      { aulaId: '1104', token: process.env.MOODLE_SERVICE_TOKEN_AULA1104 },
      { aulaId: '1105', token: process.env.MOODLE_SERVICE_TOKEN_AULA1105 },
      { aulaId: '1106', token: process.env.MOODLE_SERVICE_TOKEN_AULA1106 },
      { aulaId: '1107', token: process.env.MOODLE_SERVICE_TOKEN_AULA1107 },
      { aulaId: '1108', token: process.env.MOODLE_SERVICE_TOKEN_AULA1108 },
      { aulaId: '1109', token: process.env.MOODLE_SERVICE_TOKEN_AULA1109 },
      { aulaId: '1110', token: process.env.MOODLE_SERVICE_TOKEN_AULA1110 },
      { aulaId: '1111', token: process.env.MOODLE_SERVICE_TOKEN_AULA1111 },
      { aulaId: '1112', token: process.env.MOODLE_SERVICE_TOKEN_AULA1112 },
      { aulaId: '1113', token: process.env.MOODLE_SERVICE_TOKEN_AULA1113 },
    ]

    for (const { aulaId, token } of serviceTokens) {
      if (token) {
        // Generate appropriate URL based on aulaId
        let aulaUrl: string
        if (aulaId.startsWith('av')) {
          aulaUrl = `https://${aulaId.toLowerCase()}.utel.edu.mx`
        } else {
          aulaUrl = `https://aula${aulaId}.utel.edu.mx`
        }

        this.serviceTokens.set(aulaId, {
          aulaId,
          aulaUrl,
          token,
          user: 't_assistant',
          service: 'WS t_dash'
        })
      }
    }

    console.log(`🔑 Tokens de servicio inicializados para ${this.serviceTokens.size} aulas`)
  }

  /**
   * Obtener token de servicio para un aula específica
   */
  getServiceToken(aulaId: string): ServiceTokenInfo | null {
    // Normalizar aulaId (remover prefijos como "aula")
    const normalizedAulaId = aulaId.replace(/^aula/i, '')
    return this.serviceTokens.get(normalizedAulaId) || null
  }

  /**
   * Verificar si hay token de servicio disponible para un aula
   */
  hasServiceToken(aulaId: string): boolean {
    return this.getServiceToken(aulaId) !== null
  }

  /**
   * Obtener todos los tokens de servicio disponibles
   */
  getAllServiceTokens(): ServiceTokenInfo[] {
    return Array.from(this.serviceTokens.values())
  }

  /**
   * Obtener token de servicio basado en URL del aula
   */
  getServiceTokenByUrl(aulaUrl: string): ServiceTokenInfo | null {
    // Extraer aulaId de la URL (ej: https://aula101.utel.edu.mx -> 101)
    const match = aulaUrl.match(/aula(\d+)\.utel\.edu\.mx/)
    if (match) {
      return this.getServiceToken(match[1])
    }
    return null
  }

  /**
   * Determinar si se debe usar token de servicio o token del profesor
   * para una función específica
   */
  shouldUseServiceToken(context: {
    functionType: 'general' | 'teacher_specific'
    hasTeacherToken: boolean
    aulaId: string
  }): boolean {
    const { functionType, hasTeacherToken, aulaId } = context

    // Si la función es específica del profesor y tenemos su token, usar el token del profesor
    if (functionType === 'teacher_specific' && hasTeacherToken) {
      return false
    }

    // Si la función es general y tenemos token de servicio, usarlo
    if (functionType === 'general' && this.hasServiceToken(aulaId)) {
      return true
    }

    // Fallback: usar token del profesor si está disponible
    return !hasTeacherToken && this.hasServiceToken(aulaId)
  }

  /**
   * Obtener estadísticas de tokens de servicio
   */
  getStats() {
    const totalTokens = this.serviceTokens.size
    const aulaIds = Array.from(this.serviceTokens.keys()).sort((a, b) => {
      // Handle mixed numeric and alphanumeric sorting
      const aNum = parseInt(a)
      const bNum = parseInt(b)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum
      }
      return a.localeCompare(b)
    })

    return {
      totalServiceTokens: totalTokens,
      availableAulas: aulaIds,
      coverage: `${totalTokens} aulas con tokens de servicio configurados`
    }
  }
}

// Exportar singleton
export const serviceTokenManager = ServiceTokenManager.getInstance()

// Tipos para usar en otras partes del código
export type { ServiceTokenInfo }