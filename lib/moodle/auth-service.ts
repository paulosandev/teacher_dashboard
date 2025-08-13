/**
 * Servicio de autenticación con Moodle
 * Genera tokens automáticamente usando las credenciales del profesor
 */

import { prisma } from '@/lib/db/prisma'
import { encrypt } from '@/lib/utils/encryption'

interface MoodleLoginResponse {
  token?: string
  privatetoken?: string
  userid?: number
  username?: string
  firstname?: string
  lastname?: string
  fullname?: string
  email?: string
  error?: string
  errorcode?: string
}

export class MoodleAuthService {
  private baseUrl: string
  private adminToken: string

  constructor() {
    this.baseUrl = process.env.MOODLE_API_URL?.replace('/webservice/rest/server.php', '') || ''
    this.adminToken = process.env.MOODLE_ADMIN_TOKEN || process.env.MOODLE_API_TOKEN || ''
  }

  /**
   * Método 1: Autenticación directa con credenciales de Moodle
   * El profesor usa sus credenciales de Moodle y obtenemos el token automáticamente
   */
  async authenticateWithCredentials(
    username: string, 
    password: string,
    userId: string // ID del usuario local en nuestra BD
  ): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      console.log(`🔐 Autenticando usuario ${username} en Moodle...`)
      
      // Llamar al servicio de login de Moodle
      const loginUrl = `${this.baseUrl}/login/token.php`
      
      const params = new URLSearchParams({
        username: username,
        password: password,
        service: 'moodle_mobile_app' // Servicio estándar que genera tokens
      })

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      })

      const data: MoodleLoginResponse = await response.json()

      if (data.error || !data.token) {
        console.error('❌ Error de autenticación:', data.error)
        return {
          success: false,
          message: data.error || 'Credenciales inválidas'
        }
      }

      // Guardar el token en la base de datos
      console.log(`✅ Token obtenido para ${data.fullname}`)
      
      const encryptedToken = encrypt(data.token)
      
      await prisma.userMoodleToken.upsert({
        where: { userId },
        update: {
          token: encryptedToken,
          moodleUserId: data.userid,
          moodleUsername: data.username,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          userId,
          token: encryptedToken,
          moodleUserId: data.userid,
          moodleUsername: data.username,
          isActive: true
        }
      })

      return {
        success: true,
        message: `Token configurado automáticamente para ${data.fullname}`,
        token: data.token
      }

    } catch (error: any) {
      console.error('❌ Error en autenticación con Moodle:', error)
      return {
        success: false,
        message: error.message || 'Error al conectar con Moodle'
      }
    }
  }

  /**
   * Método 2: Generar token usando privilegios de administrador
   * Requiere que el token admin tenga permisos para crear tokens para otros usuarios
   */
  async generateTokenForUser(
    moodleUsername: string,
    userId: string
  ): Promise<{ success: boolean; message: string; token?: string }> {
    try {
      console.log(`🔑 Generando token para ${moodleUsername} usando admin...`)
      
      // Primero obtener el ID del usuario en Moodle
      const url = new URL(this.baseUrl + '/webservice/rest/server.php')
      url.searchParams.append('wstoken', this.adminToken)
      url.searchParams.append('wsfunction', 'core_user_get_users_by_field')
      url.searchParams.append('moodlewsrestformat', 'json')
      url.searchParams.append('field', 'username')
      url.searchParams.append('values[0]', moodleUsername)

      const response = await fetch(url.toString())
      const users = await response.json()

      if (!users || users.length === 0) {
        return {
          success: false,
          message: 'Usuario no encontrado en Moodle'
        }
      }

      const moodleUser = users[0]
      
      // Crear token para el usuario
      // NOTA: Esto requiere un plugin personalizado o función administrativa en Moodle
      const tokenUrl = new URL(this.baseUrl + '/webservice/rest/server.php')
      tokenUrl.searchParams.append('wstoken', this.adminToken)
      tokenUrl.searchParams.append('wsfunction', 'local_wsmanager_create_user_token') // Función personalizada
      tokenUrl.searchParams.append('moodlewsrestformat', 'json')
      tokenUrl.searchParams.append('userid', moodleUser.id)
      tokenUrl.searchParams.append('service', 'moodle_mobile_app')

      const tokenResponse = await fetch(tokenUrl.toString())
      const tokenData = await tokenResponse.json()

      if (tokenData.exception) {
        // Si no existe la función personalizada, intentar método alternativo
        console.log('⚠️ Función personalizada no disponible, usando método alternativo...')
        return this.generateTokenAlternative(moodleUser, userId)
      }

      const encryptedToken = encrypt(tokenData.token)
      
      await prisma.userMoodleToken.upsert({
        where: { userId },
        update: {
          token: encryptedToken,
          moodleUserId: moodleUser.id,
          moodleUsername: moodleUser.username,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          userId,
          token: encryptedToken,
          moodleUserId: moodleUser.id,
          moodleUsername: moodleUser.username,
          isActive: true
        }
      })

      return {
        success: true,
        message: `Token generado automáticamente para ${moodleUser.fullname}`,
        token: tokenData.token
      }

    } catch (error: any) {
      console.error('❌ Error generando token:', error)
      return {
        success: false,
        message: error.message || 'Error al generar token'
      }
    }
  }

  /**
   * Método alternativo: Usar un token maestro con permisos amplios
   * y realizar las operaciones en nombre del usuario
   */
  private async generateTokenAlternative(
    moodleUser: any,
    userId: string
  ): Promise<{ success: boolean; message: string; token?: string }> {
    // En este caso, usamos el token admin pero registramos el usuario
    // para saber en nombre de quién hacer las operaciones
    
    console.log('🔄 Usando método de token maestro compartido...')
    
    await prisma.userMoodleToken.upsert({
      where: { userId },
      update: {
        token: encrypt(this.adminToken), // Usar token admin
        moodleUserId: moodleUser.id,
        moodleUsername: moodleUser.username,
        isActive: true,
        updatedAt: new Date(),
        capabilities: ['using_admin_token'] // Marcar que usa token admin
      },
      create: {
        userId,
        token: encrypt(this.adminToken),
        moodleUserId: moodleUser.id,
        moodleUsername: moodleUser.username,
        isActive: true,
        capabilities: ['using_admin_token']
      }
    })

    return {
      success: true,
      message: 'Configuración automática completada',
      token: this.adminToken
    }
  }

  /**
   * Método 3: Single Sign-On (SSO) con Moodle
   * Requiere configuración OAuth2 en Moodle
   */
  async authenticateWithSSO(
    userId: string,
    ssoToken: string
  ): Promise<{ success: boolean; message: string }> {
    // Este método requeriría configurar OAuth2 en Moodle
    // y es más complejo pero más seguro
    
    console.log('🔐 SSO con Moodle...')
    
    // Implementación dependería de la configuración OAuth2 de Moodle
    // Por ahora retornamos un placeholder
    
    return {
      success: false,
      message: 'SSO no configurado aún'
    }
  }

  /**
   * Auto-configurar token al hacer login
   * Intenta obtener el token automáticamente usando la matrícula
   */
  async autoConfigureToken(
    userId: string,
    matricula: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🤖 Auto-configurando token para matrícula ${matricula}...`)
      
      // Buscar si el usuario existe en Moodle con esa matrícula
      const url = new URL(this.baseUrl + '/webservice/rest/server.php')
      url.searchParams.append('wstoken', this.adminToken)
      url.searchParams.append('wsfunction', 'core_user_get_users_by_field')
      url.searchParams.append('moodlewsrestformat', 'json')
      url.searchParams.append('field', 'username')
      url.searchParams.append('values[0]', matricula)

      const response = await fetch(url.toString())
      const users = await response.json()

      if (!users || users.length === 0) {
        // Intentar buscar por idnumber
        url.searchParams.set('field', 'idnumber')
        const response2 = await fetch(url.toString())
        const users2 = await response2.json()
        
        if (!users2 || users2.length === 0) {
          return {
            success: false,
            message: 'Usuario no encontrado en Moodle con esa matrícula'
          }
        }
        
        return this.generateTokenForUser(users2[0].username, userId)
      }

      return this.generateTokenForUser(users[0].username, userId)
      
    } catch (error: any) {
      console.error('❌ Error en auto-configuración:', error)
      return {
        success: false,
        message: 'No se pudo auto-configurar el token'
      }
    }
  }
}

// Exportar instancia singleton
export const moodleAuthService = new MoodleAuthService()
