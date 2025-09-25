/**
 * Servicio de configuración para aulas UTEL
 * Maneja la configuración y conexión a todas las aulas registradas
 */

export interface AulaConfig {
  id: string // "101", "102", "av141", etc.
  name: string // "Aula 101", "AV141", etc.
  baseUrl: string // "https://aula101.utel.edu.mx"
  apiUrl: string // URL completa del webservice
  token: string // Token de autenticación
  user: string // Usuario del servicio (ej: "t_assistant")
  service: string // Nombre del servicio (ej: "WS t_dash")
}

export class AulaConfigService {
  private static instance: AulaConfigService
  private aulaConfigs: Map<string, AulaConfig> = new Map()

  static getInstance(): AulaConfigService {
    if (!this.instance) {
      this.instance = new AulaConfigService()
      this.instance.initializeConfigs()
    }
    return this.instance
  }

  /**
   * Inicializar configuraciones desde variables de entorno
   */
  private initializeConfigs() {
    const aulas = [
      { id: '101', name: 'Aula 101' },
      { id: '102', name: 'Aula 102' },
      { id: '103', name: 'Aula 103' },
      { id: '104', name: 'Aula 104' },
      { id: '105', name: 'Aula 105' },
      { id: '106', name: 'Aula 106' },
      { id: '107', name: 'Aula 107' },
      { id: '108', name: 'Aula 108' },
      { id: '109', name: 'Aula 109' },
      { id: '110', name: 'Aula 110' },
    ]

    // Configurar aulas numeradas (101-110) usando tokens del .env
    for (const aula of aulas) {
      const token = process.env[`MOODLE_SERVICE_TOKEN_AULA${aula.id}`]
      const url = process.env[`MOODLE_SERVICE_URL_AULA${aula.id}`]
      
      if (token && url) {
        const baseUrl = `https://aula${aula.id}.utel.edu.mx`
        
        this.aulaConfigs.set(aula.id, {
          id: aula.id,
          name: aula.name,
          baseUrl,
          apiUrl: url,
          token,
          user: 't_assistant',
          service: 'WS t_dash'
        })
      }
    }

    // Agregar AV141 si existe
    const av141Token = process.env.MOODLE_API_TOKEN
    const av141Url = process.env.MOODLE_API_URL
    
    if (av141Token && av141Url) {
      this.aulaConfigs.set('av141', {
        id: 'av141',
        name: 'AV141',
        baseUrl: process.env.MOODLE_URL || 'https://av141.utel.edu.mx',
        apiUrl: av141Url,
        token: av141Token,
        user: 'system',
        service: 'WS main'
      })
    }

    console.log(`🏫 Configuradas ${this.aulaConfigs.size} aula(s): ${Array.from(this.aulaConfigs.keys()).join(', ')}`)
  }

  /**
   * Obtener configuración de un aula específica
   */
  getAulaConfig(aulaId: string): AulaConfig | null {
    return this.aulaConfigs.get(aulaId) || null
  }

  /**
   * Obtener todas las configuraciones de aulas
   */
  getAllAulaConfigs(): AulaConfig[] {
    return Array.from(this.aulaConfigs.values())
  }

  /**
   * Obtener solo aulas activas (que tienen token) ordenadas por prioridad
   * Orden: 101, 102, 103, ..., av141, av142, ...
   */
  getActiveAulaConfigs(): AulaConfig[] {
    return this.getAllAulaConfigs()
      .filter(config => config.token && config.apiUrl)
      .sort((a, b) => {
        // Prioridad: aula 101 primero, luego orden numérico/alfabético
        if (a.id === '101') return -1
        if (b.id === '101') return 1

        // Orden alfabético/numérico para el resto
        return a.id.localeCompare(b.id, undefined, { numeric: true })
      })
  }

  /**
   * Verificar si un aula está configurada
   */
  hasAulaConfig(aulaId: string): boolean {
    return this.aulaConfigs.has(aulaId)
  }

  /**
   * Obtener estadísticas de configuración
   */
  getConfigStats() {
    const totalConfigured = this.aulaConfigs.size
    const activeConfigs = this.getActiveAulaConfigs()
    const aulaIds = Array.from(this.aulaConfigs.keys()).sort()
    
    return {
      totalConfigured,
      activeCount: activeConfigs.length,
      configuredAulas: aulaIds,
      coverage: `${activeConfigs.length}/${totalConfigured} aulas con configuración completa`
    }
  }

  /**
   * Detectar aula desde una URL
   */
  detectAulaFromUrl(url: string): string | null {
    // Intentar detectar desde URL completa
    const match = url.match(/aula(\d+)\.utel\.edu\.mx/)
    if (match) {
      return match[1]
    }

    // Verificar si es AV141
    if (url.includes('av141.utel.edu.mx')) {
      return 'av141'
    }

    return null
  }

  /**
   * Generar URL de actividad para un aula específica
   */
  generateActivityUrl(aulaId: string, moduleType: string, moduleId: number): string | null {
    const config = this.getAulaConfig(aulaId)
    if (!config) return null

    const moduleMap: Record<string, string> = {
      'forum': 'mod/forum/view.php',
      'assign': 'mod/assign/view.php',
      'quiz': 'mod/quiz/view.php',
      'feedback': 'mod/feedback/view.php',
      'choice': 'mod/choice/view.php',
      'lesson': 'mod/lesson/view.php'
    }

    const modulePath = moduleMap[moduleType]
    if (!modulePath) return null

    return `${config.baseUrl}/${modulePath}?id=${moduleId}`
  }
}

// Singleton export
export const aulaConfigService = AulaConfigService.getInstance()

// Types export
export type { AulaConfig }