/**
 * Servicio híbrido para gestión inteligente de tokens de Moodle
 * 
 * Estrategia:
 * 1. Token de administrador para operaciones generales (listar cursos, obtener datos básicos)
 * 2. Token de profesor solo cuando sea estrictamente necesario (crear contenido, acceso específico)
 * 3. Auto-generar tokens de profesor basado en matrícula cuando sea necesario
 */

import { prisma } from '@/lib/db/prisma'
import { encrypt, decrypt } from '@/lib/utils/encryption'
import { MoodleAPIClient } from './api-client'

interface TokenInfo {
  token: string
  type: 'admin' | 'professor'
  capabilities?: string[]
}

interface OperationContext {
  operation: string
  userId: string
  userMatricula: string
  courseId?: string
  groupId?: string
  discussionId?: string
  requiresSpecificPermissions?: boolean
}

export class HybridMoodleAuthService {
  private adminClient: MoodleAPIClient
  private professorClients: Map<string, MoodleAPIClient> = new Map()

  constructor() {
    // Cliente administrativo global
    this.adminClient = new MoodleAPIClient(
      process.env.MOODLE_URL!,
      process.env.MOODLE_TOKEN!
    )
  }

  /**
   * Determina qué token usar basado en el contexto de la operación
   */
  async getOptimalToken(context: OperationContext): Promise<TokenInfo> {
    // Operaciones que SIEMPRE requieren token de profesor específico
    const professorOnlyOperations = [
      'create_assignment',
      'grade_submission',
      'send_message',
      'create_forum_post',
      'edit_course_content',
      'manage_enrollments'
    ]

    // Operaciones que pueden usar token de administrador
    const adminCompatibleOperations = [
      'get_courses',
      'get_course_contents',
      'get_forum_discussions',
      'get_assignments',
      'get_submissions',
      'get_gradebook',
      'get_user_info',
      'get_groups',
      'get_activities'
    ]

    // Si la operación requiere permisos específicos del profesor
    if (professorOnlyOperations.includes(context.operation) || 
        context.requiresSpecificPermissions) {
      return await this.getProfessorToken(context.userMatricula)
    }

    // Para operaciones de lectura, usar token de administrador
    if (adminCompatibleOperations.includes(context.operation)) {
      return {
        token: process.env.MOODLE_TOKEN!,
        type: 'admin'
      }
    }

    // Por defecto, intentar con admin primero
    return {
      token: process.env.MOODLE_TOKEN!,
      type: 'admin'
    }
  }

  /**
   * Obtiene o genera automáticamente un token para un profesor
   */
  async getProfessorToken(matricula: string): Promise<TokenInfo> {
    try {
      // Buscar token existente en base de datos
      const user = await prisma.user.findFirst({
        where: { matricula },
        include: { moodleToken: true }
      })

      if (user?.moodleToken?.token && user.moodleToken.isActive) {
        const decryptedToken = decrypt(user.moodleToken.token)
        return {
          token: decryptedToken,
          type: 'professor',
          capabilities: user.moodleToken.capabilities as string[] || []
        }
      }

      // Si no existe token, intentar generarlo automáticamente
      const generatedToken = await this.generateProfessorTokenAutomatically(matricula)
      
      if (generatedToken) {
        return {
          token: generatedToken,
          type: 'professor'
        }
      }

      // Fallback: usar token de administrador
      console.log(`⚠️ No se pudo obtener token específico para ${matricula}, usando token de administrador`)
      return {
        token: process.env.MOODLE_TOKEN!,
        type: 'admin'
      }

    } catch (error) {
      console.error(`Error obteniendo token para ${matricula}:`, error)
      // Fallback: usar token de administrador
      return {
        token: process.env.MOODLE_TOKEN!,
        type: 'admin'
      }
    }
  }

  /**
   * Intenta generar automáticamente un token para el profesor
   * Esto requiere configuración específica en Moodle
   */
  async generateProfessorTokenAutomatically(matricula: string): Promise<string | null> {
    try {
      // Opción 1: Si Moodle permite generar tokens programáticamente
      // (requiere configuración específica en el servidor Moodle)
      
      // Opción 2: Usar un servicio de mapeo de tokens pre-configurados
      const preConfiguredTokens = await this.getPreConfiguredTokens()
      
      if (preConfiguredTokens[matricula]) {
        const token = preConfiguredTokens[matricula]
        
        // Guardar en base de datos
        const user = await prisma.user.findFirst({
          where: { matricula }
        })
        
        if (user) {
          const encryptedToken = encrypt(token)
          
          await prisma.userMoodleToken.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              token: encryptedToken,
              moodleUsername: matricula,
              isActive: true,
              capabilities: []
            },
            update: {
              token: encryptedToken,
              isActive: true,
              updatedAt: new Date()
            }
          })
          
          console.log(`✅ Token configurado automáticamente para ${matricula}`)
          return token
        }
      }

      return null
    } catch (error) {
      console.error(`Error generando token automático para ${matricula}:`, error)
      return null
    }
  }

  /**
   * Obtiene tokens pre-configurados (esto sería configurado por el administrador)
   */
  async getPreConfiguredTokens(): Promise<Record<string, string>> {
    // En un entorno real, esto podría venir de:
    // 1. Variables de entorno
    // 2. Base de datos de configuración
    // 3. Servicio externo
    // 4. Archivo de configuración seguro

    return {
      'cesar.espindola': process.env.CESAR_MOODLE_TOKEN || '',
      'paulo.cesar': process.env.PAULO_MOODLE_TOKEN || '',
      // Más profesores pueden agregarse aquí
    }
  }

  /**
   * Crea un cliente de Moodle con el token optimal para la operación
   */
  async createOptimalClient(context: OperationContext): Promise<MoodleAPIClient> {
    const tokenInfo = await this.getOptimalToken(context)
    
    if (tokenInfo.type === 'admin') {
      return this.adminClient
    }

    // Para tokens de profesor, crear cliente específico
    const cacheKey = `${context.userMatricula}-${tokenInfo.token.substring(0, 8)}`
    
    if (!this.professorClients.has(cacheKey)) {
      const client = new MoodleAPIClient(
        process.env.MOODLE_URL!,
        tokenInfo.token
      )
      this.professorClients.set(cacheKey, client)
    }

    return this.professorClients.get(cacheKey)!
  }

  /**
   * Ejecuta una operación con el cliente optimal
   */
  async executeWithOptimalAuth<T>(
    context: OperationContext,
    operation: (client: MoodleAPIClient) => Promise<T>
  ): Promise<T> {
    const client = await this.createOptimalClient(context)
    
    try {
      const result = await operation(client)
      console.log(`✅ Operación ${context.operation} ejecutada con token ${
        (await this.getOptimalToken(context)).type
      }`)
      return result
    } catch (error: any) {
      // Si falla con token de profesor, intentar con admin como fallback
      if ((await this.getOptimalToken(context)).type === 'professor') {
        console.log(`⚠️ Operación ${context.operation} falló con token de profesor, intentando con admin`)
        try {
          return await operation(this.adminClient)
        } catch (adminError) {
          console.error(`❌ Operación ${context.operation} falló también con token admin`)
          throw adminError
        }
      }
      throw error
    }
  }
}

// Instancia singleton
export const hybridAuth = new HybridMoodleAuthService()
