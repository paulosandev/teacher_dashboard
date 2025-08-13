import { encrypt } from '@/lib/utils/encryption'
import { prisma } from '@/lib/db/prisma'

interface MoodleTokenResponse {
  token?: string
  error?: string
  errorcode?: string
}

export class MoodleTokenGenerator {
  private moodleUrl: string

  constructor() {
    this.moodleUrl = process.env.MOODLE_URL || 'https://av141.utel.edu.mx'
  }

  /**
   * Genera un token de Moodle usando las credenciales del usuario
   */
  async generateToken(username: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      // Construir URL para generar token
      const tokenUrl = new URL('/login/token.php', this.moodleUrl)
      tokenUrl.searchParams.append('username', username)
      tokenUrl.searchParams.append('password', password)
      tokenUrl.searchParams.append('service', 'moodle_mobile_app') // Servicio configurado en Moodle

      // Hacer petición a Moodle
      const response = await fetch(tokenUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Error al generar token: ${response.statusText}`)
      }

      const data: MoodleTokenResponse = await response.json()

      // Verificar respuesta
      if (data.error || data.errorcode) {
        return {
          success: false,
          error: data.error || `Error: ${data.errorcode}`
        }
      }

      if (!data.token) {
        return {
          success: false,
          error: 'No se generó token'
        }
      }

      // Éxito - guardar token en base de datos
      const encryptedToken = encrypt(data.token)
      
      // Buscar usuario por matrícula/username
      const user = await prisma.user.findFirst({
        where: { 
          OR: [
            { matricula: username },
            { email: username }
          ]
        }
      })

      if (user) {
        // Actualizar o crear token
        await prisma.userMoodleToken.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            token: encryptedToken,
            moodleUsername: username,
            isActive: true,
            capabilities: []
          },
          update: {
            token: encryptedToken,
            isActive: true,
            updatedAt: new Date()
          }
        })
      }

      return {
        success: true,
        token: data.token
      }

    } catch (error) {
      console.error('Error generando token:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
    }
  }

  /**
   * Valida credenciales de Moodle sin generar token
   */
  async validateCredentials(username: string, password: string): Promise<boolean> {
    try {
      const loginUrl = new URL('/login/token.php', this.moodleUrl)
      loginUrl.searchParams.append('username', username)
      loginUrl.searchParams.append('password', password)
      loginUrl.searchParams.append('service', 'moodle_mobile_app')

      const response = await fetch(loginUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        return false
      }

      const data: MoodleTokenResponse = await response.json()
      return !data.error && !data.errorcode && !!data.token

    } catch (error) {
      console.error('Error validando credenciales:', error)
      return false
    }
  }
}
