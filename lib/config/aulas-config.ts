/**
 * Configuración de aulas UTEL
 * Mapeo de tokens y URLs para cada aula
 */

export interface AulaConfig {
  id: string
  name: string
  url: string
  apiUrl: string
  serviceToken: string
  user: string
  service: string
}

export const AULAS_CONFIG: Record<string, AulaConfig> = {
  av141: {
    id: 'av141',
    name: 'AV141',
    url: 'https://av141.utel.edu.mx',
    apiUrl: 'https://av141.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_API_TOKEN || '',
    user: 'marco.arce',
    service: 'WS marco.arce'
  },
  aula101: {
    id: 'aula101',
    name: 'AULA101',
    url: 'https://aula101.utel.edu.mx',
    apiUrl: 'https://aula101.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA101 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula102: {
    id: 'aula102',
    name: 'AULA102',
    url: 'https://aula102.utel.edu.mx',
    apiUrl: 'https://aula102.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA102 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula103: {
    id: 'aula103',
    name: 'AULA103',
    url: 'https://aula103.utel.edu.mx',
    apiUrl: 'https://aula103.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA103 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula104: {
    id: 'aula104',
    name: 'AULA104',
    url: 'https://aula104.utel.edu.mx',
    apiUrl: 'https://aula104.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA104 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula105: {
    id: 'aula105',
    name: 'AULA105',
    url: 'https://aula105.utel.edu.mx',
    apiUrl: 'https://aula105.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA105 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula106: {
    id: 'aula106',
    name: 'AULA106',
    url: 'https://aula106.utel.edu.mx',
    apiUrl: 'https://aula106.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA106 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula107: {
    id: 'aula107',
    name: 'AULA107',
    url: 'https://aula107.utel.edu.mx',
    apiUrl: 'https://aula107.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA107 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula108: {
    id: 'aula108',
    name: 'AULA108',
    url: 'https://aula108.utel.edu.mx',
    apiUrl: 'https://aula108.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA108 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula109: {
    id: 'aula109',
    name: 'AULA109',
    url: 'https://aula109.utel.edu.mx',
    apiUrl: 'https://aula109.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA109 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  },
  aula110: {
    id: 'aula110',
    name: 'AULA110',
    url: 'https://aula110.utel.edu.mx',
    apiUrl: 'https://aula110.utel.edu.mx/webservice/rest/server.php',
    serviceToken: process.env.MOODLE_SERVICE_TOKEN_AULA110 || '',
    user: 't_assistant',
    service: 'WS t_dash'
  }
}

/**
 * Obtiene la configuración de un aula por su ID
 */
export function getAulaConfig(aulaId: string): AulaConfig | undefined {
  return AULAS_CONFIG[aulaId.toLowerCase()]
}

/**
 * Extrae el ID del aula desde una URL
 */
export function extractAulaFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    
    // Buscar patrones como: av141.utel.edu.mx, aula101.utel.edu.mx
    const aulaMatch = hostname.match(/^(av\d+|aula\d+)\.utel\.edu\.mx$/)
    if (aulaMatch) {
      return aulaMatch[1].toLowerCase()
    }
    
    return 'unknown'
  } catch (error) {
    console.error('Error extrayendo aula de URL:', error)
    return 'unknown'
  }
}

/**
 * Obtiene el nombre display del aula desde una URL
 */
export function getAulaDisplayName(url: string): string {
  const aulaId = extractAulaFromUrl(url)
  const config = getAulaConfig(aulaId)
  return config?.name || 'AULA'
}