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
    ]

    for (const { aulaId, token } of serviceTokens) {
      if (token) {
        this.serviceTokens.set(aulaId, {
          aulaId,
          aulaUrl: `https://aula${aulaId}.utel.edu.mx`,
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
    const aulaIds = Array.from(this.serviceTokens.keys()).sort((a, b) => parseInt(a) - parseInt(b))
    
    return {
      totalServiceTokens: totalTokens,
      availableAulas: aulaIds,
      coverage: `${totalTokens}/10 aulas con tokens de servicio`
    }
  }
}

// Exportar singleton
export const serviceTokenManager = ServiceTokenManager.getInstance()

// Tipos para usar en otras partes del código
export type { ServiceTokenInfo }