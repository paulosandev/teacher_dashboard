/**
 * Cliente para comunicarse con el servicio de enrolments
 * Este cliente se comunica con el worker que maneja el túnel SSH
 */

export interface UserEnrolment {
  userId: string
  userName: string
  userFullName: string
  email: string
  aulaId: string
  aulaUrl: string
  courseId: string
  courseName: string
  courseShortName: string
  groupId: string
  groupName: string
  roleId: string
  roleName: string
  isTeacher: boolean
}

export interface AulaInfo {
  aulaId: string
  aulaUrl: string
  coursesCount: number
}

export interface EnrolmentsByAula {
  aulaId: string
  aulaUrl: string
  courses: {
    courseId: string
    courseName: string
    courseShortName: string
    groupId: string
    groupName: string
  }[]
}

export interface TeacherCheckResult {
  email: string
  isTeacher: boolean
  userData?: {
    userId: string
    userName: string
    firstName: string
    lastName: string
    fullName: string
  }
}

export class EnrolmentServiceClient {
  private baseUrl: string

  constructor() {
    // URL del servicio de enrolments (puede ser configurado por variables de entorno)
    this.baseUrl = process.env.NEXT_PUBLIC_ENROLMENT_SERVICE_URL || 'http://localhost:3002'
  }

  /**
   * Verificar salud del servicio
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`)
      const data = await response.json()
      return data.status === 'ok' && data.connected
    } catch (error) {
      console.error('❌ Error verificando salud del servicio:', error)
      return false
    }
  }

  /**
   * Obtener enrolments por email
   */
  async getEnrolmentsByEmail(email: string): Promise<{
    success: boolean
    totalEnrolments: number
    aulasCount: number
    aulas: AulaInfo[]
    enrolmentsByAula: EnrolmentsByAula[]
    rawEnrolments: UserEnrolment[]
  } | null> {
    try {
      console.log(`📧 Consultando enrolments para: ${email}`)
      
      const response = await fetch(`${this.baseUrl}/enrolments/by-email/${encodeURIComponent(email)}`)
      
      if (!response.ok) {
        console.error('❌ Error en respuesta:', response.status)
        return null
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Encontrados ${data.totalEnrolments} enrolments en ${data.aulasCount} aulas`)
        return data
      }
      
      return null
      
    } catch (error) {
      console.error('❌ Error obteniendo enrolments por email:', error)
      return null
    }
  }

  /**
   * Obtener enrolments por userId
   */
  async getEnrolmentsByUserId(userId: string): Promise<{
    success: boolean
    userId: string
    totalEnrolments: number
    aulasCount: number
    aulas: AulaInfo[]
    enrolments: UserEnrolment[]
  } | null> {
    try {
      console.log(`🔍 Consultando enrolments para userId: ${userId}`)
      
      const response = await fetch(`${this.baseUrl}/enrolments/by-userid/${userId}`)
      
      if (!response.ok) {
        console.error('❌ Error en respuesta:', response.status)
        return null
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Encontrados ${data.totalEnrolments} enrolments en ${data.aulasCount} aulas`)
        return data
      }
      
      return null
      
    } catch (error) {
      console.error('❌ Error obteniendo enrolments por userId:', error)
      return null
    }
  }

  /**
   * Verificar si un email corresponde a un profesor
   */
  async checkIfTeacher(email: string): Promise<TeacherCheckResult | null> {
    try {
      console.log(`🔍 Verificando si ${email} es profesor...`)
      
      const response = await fetch(`${this.baseUrl}/enrolments/check-teacher/${encodeURIComponent(email)}`)
      
      if (!response.ok) {
        console.error('❌ Error en respuesta:', response.status)
        return null
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ ${email} ${data.isTeacher ? 'ES' : 'NO ES'} profesor`)
        return data
      }
      
      return null
      
    } catch (error) {
      console.error('❌ Error verificando profesor:', error)
      return null
    }
  }

  /**
   * Obtener estadísticas generales
   */
  async getStats(): Promise<{
    totalRecords: number
    totalTeachers: number
    uniqueAulas: {aulaId: string, aulaUrl: string}[]
    topTeachers: {
      userId: string
      userName: string
      fullName: string
      email: string
      coursesCount: number
      aulasCount: number
    }[]
  } | null> {
    try {
      console.log('📊 Obteniendo estadísticas...')
      
      const response = await fetch(`${this.baseUrl}/enrolments/stats`)
      
      if (!response.ok) {
        console.error('❌ Error en respuesta:', response.status)
        return null
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log(`✅ Estadísticas obtenidas: ${data.stats.totalTeachers} profesores`)
        return data.stats
      }
      
      return null
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error)
      return null
    }
  }

  /**
   * Obtener aulas únicas de un profesor para mostrar en selector
   */
  async getTeacherAulas(email: string): Promise<AulaInfo[]> {
    const enrolments = await this.getEnrolmentsByEmail(email)
    
    if (enrolments && enrolments.success) {
      return enrolments.aulas
    }
    
    return []
  }

  /**
   * Obtener cursos de un profesor en una aula específica
   */
  async getTeacherCoursesByAula(email: string, aulaId: string): Promise<any[]> {
    const enrolments = await this.getEnrolmentsByEmail(email)
    
    if (enrolments && enrolments.success) {
      const aulaData = enrolments.enrolmentsByAula.find(a => a.aulaId === aulaId)
      return aulaData?.courses || []
    }
    
    return []
  }
}

// Singleton del cliente
let enrolmentClient: EnrolmentServiceClient | null = null

export function getEnrolmentServiceClient(): EnrolmentServiceClient {
  if (!enrolmentClient) {
    enrolmentClient = new EnrolmentServiceClient()
  }
  return enrolmentClient
}