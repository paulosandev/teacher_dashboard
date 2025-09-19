/**
 * Cliente integrado para acceder a la base de datos de enrolments
 * Conexión directa a la base de datos MySQL
 */

import { createConnection } from 'mysql2/promise'
import type { Connection } from 'mysql2/promise'

export interface EnrolmentRecord {
  id: number
  userid: string
  username: string
  firstname: string
  lastname: string
  email: string
  courseid: string
  fullname: string
  courseshortname: string
  idAula: string
  timestamp: Date
  groups_name: string
  suspendido: number
  groupid: string
  roles_id: number
  roles_shortname: string
}

export interface ProcessedEnrolment {
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
  roleId: number
  roleName: string
  isTeacher: boolean
  isSuspended: boolean
}

export interface AulaInfo {
  aulaId: string
  aulaUrl: string
  coursesCount: number
}

class IntegratedEnrolmentClient {
  private readonly TEACHER_ROLE_ID = 17
  private readonly DB_HOST = process.env.ENROLMENT_DB_HOST || 'wsdata.ce9oduyxts26.us-west-1.rds.amazonaws.com'  // Conexión directa
  private readonly DB_PORT = parseInt(process.env.ENROLMENT_DB_PORT || '3306')  // Puerto MySQL estándar
  private readonly DB_USER = process.env.ENROLMENT_DB_USER || 'datos'
  private readonly DB_PASSWORD = process.env.ENROLMENT_DB_PASSWORD || 'PP7Su9e433aNZP956'
  private readonly DB_NAME = process.env.ENROLMENT_DB_NAME || 'heroku_e6e033d354ff64c'

  private connection: Connection | null = null
  private isConnected = false

  /**
   * Construir la URL del aula basado en el idAula
   */
  private buildAulaUrl(idAula: string): string {
    if (!idAula) return ''
    
    // Si el idAula contiene solo números (ej: 101, 102)
    if (/^\d+$/.test(idAula)) {
      return `https://aula${idAula}.utel.edu.mx`
    }
    
    // Si el idAula contiene letras (ej: av141, av142)
    return `https://${idAula.toLowerCase()}.utel.edu.mx`
  }

  /**
   * Procesar un registro de enrolment para formato más útil
   */
  private processEnrolmentRecord(record: EnrolmentRecord): ProcessedEnrolment {
    return {
      userId: record.userid,
      userName: record.username,
      userFullName: `${record.firstname} ${record.lastname}`.trim(),
      email: record.email,
      aulaId: record.idAula,
      aulaUrl: this.buildAulaUrl(record.idAula),
      courseId: record.courseid,
      courseName: record.fullname,
      courseShortName: record.courseshortname,
      groupId: record.groupid,
      groupName: record.groups_name,
      roleId: record.roles_id,
      roleName: record.roles_shortname,
      isTeacher: record.roles_id === this.TEACHER_ROLE_ID,
      isSuspended: record.suspendido === 1
    }
  }


  /**
   * Establecer conexión MySQL directa
   */
  private async establishDatabaseConnection(): Promise<void> {
    console.log('💾 Conectando a MySQL directamente...')
    
    this.connection = await createConnection({
      host: this.DB_HOST,
      port: this.DB_PORT,
      user: this.DB_USER,
      password: this.DB_PASSWORD,
      database: this.DB_NAME,
      connectTimeout: 30000, // 30 segundos
      idleTimeout: 300000, // 5 minutos de inactividad
      ssl: { rejectUnauthorized: false } // SSL con certificado no verificado
    })
    
    console.log('✅ Conexión MySQL directa establecida')
  }

  /**
   * Conectar a MySQL directamente
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('🔗 Ya está conectado')
      return
    }

    try {
      // Establecer conexión MySQL directa
      await this.establishDatabaseConnection()
      
      this.isConnected = true
      console.log('🎉 Conexión directa a MySQL establecida')
      
    } catch (error) {
      console.error('❌ Error estableciendo conexión:', error)
      await this.disconnect()
      throw error
    }
  }

  /**
   * Desconectar
   */
  async disconnect(): Promise<void> {
    console.log('🔒 Desconectando...')
    
    if (this.connection) {
      await this.connection.end()
      this.connection = null
      console.log('💾 Conexión MySQL cerrada')
    }

    this.isConnected = false
  }

  /**
   * Ejecutar consulta asegurando conexión
   */
  private async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.isConnected) {
      await this.connect()
    }

    try {
      if (!this.connection) {
        throw new Error('No hay conexión a la base de datos')
      }

      const [results] = await this.connection.execute(sql, params)
      return results as any[]
      
    } catch (error) {
      console.error('❌ Error ejecutando consulta:', error)
      
      // Si hay error de conexión, intentar reconectar
      if (error instanceof Error && (
        error.message.includes('Connection lost') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('PROTOCOL_CONNECTION_LOST')
      )) {
        console.log('🔄 Intentando reconectar...')
        this.isConnected = false
        await this.connect()
        
        // Reintentar la consulta
        const [results] = await this.connection!.execute(sql, params)
        return results as any[]
      }
      
      throw error
    }
  }

  /**
   * Obtener enrolments por email
   */
  async getEnrolmentsByEmail(email: string): Promise<{
    totalEnrolments: number
    aulasCount: number
    aulas: AulaInfo[]
    enrolments: ProcessedEnrolment[]
  }> {
    console.log(`📧 Consultando enrolments para: ${email}`)
    
    const results = await this.executeQuery(`
      SELECT 
        userid,
        username,
        firstname,
        lastname,
        email,
        courseid,
        fullname,
        courseshortname,
        idAula,
        groupid,
        groups_name,
        roles_id,
        roles_shortname,
        suspendido
      FROM enrolment 
      WHERE LOWER(email) = LOWER(?) 
      AND roles_id = ?
      AND suspendido = 0
      ORDER BY idAula, fullname
    `, [email, this.TEACHER_ROLE_ID])

    const processedEnrolments = results.map((record: any) => this.processEnrolmentRecord(record))
    
    // Obtener aulas únicas
    const uniqueAulaIds = [...new Set(processedEnrolments.map(e => e.aulaId))]
    const aulas: AulaInfo[] = uniqueAulaIds.map(aulaId => ({
      aulaId,
      aulaUrl: this.buildAulaUrl(aulaId),
      coursesCount: processedEnrolments.filter(e => e.aulaId === aulaId).length
    }))

    console.log(`✅ Encontrados ${processedEnrolments.length} enrolments en ${aulas.length} aulas`)

    return {
      totalEnrolments: processedEnrolments.length,
      aulasCount: aulas.length,
      aulas,
      enrolments: processedEnrolments
    }
  }

  /**
   * Verificar si un email es profesor
   */
  async checkIfTeacher(email: string): Promise<{
    isTeacher: boolean
    userData?: {
      userId: string
      userName: string
      firstName: string
      lastName: string
      fullName: string
    }
  }> {
    console.log(`🔍 Verificando si ${email} es profesor...`)
    
    const results = await this.executeQuery(`
      SELECT 
        COUNT(DISTINCT userid) as count,
        MIN(userid) as userId,
        MIN(username) as userName,
        MIN(firstname) as firstName,
        MIN(lastname) as lastName
      FROM enrolment 
      WHERE LOWER(email) = LOWER(?) 
      AND roles_id = ?
      AND suspendido = 0
    `, [email, this.TEACHER_ROLE_ID])

    const isTeacher = results[0]?.count > 0

    return {
      isTeacher,
      userData: isTeacher ? {
        userId: results[0].userId,
        userName: results[0].userName,
        firstName: results[0].firstName,
        lastName: results[0].lastName,
        fullName: `${results[0].firstName} ${results[0].lastName}`.trim()
      } : undefined
    }
  }

  /**
   * Obtener estadísticas generales
   */
  async getStats(): Promise<{
    totalRecords: number
    totalTeachers: number
    uniqueAulas: {aulaId: string, aulaUrl: string}[]
  }> {
    console.log('📊 Obteniendo estadísticas...')
    
    // Ejecutar consultas en paralelo
    const [totalResult, teachersResult, aulasResult] = await Promise.all([
      this.executeQuery('SELECT COUNT(*) as total FROM enrolment'),
      this.executeQuery('SELECT COUNT(DISTINCT userid) as total FROM enrolment WHERE roles_id = ? AND suspendido = 0', [this.TEACHER_ROLE_ID]),
      this.executeQuery('SELECT DISTINCT idAula FROM enrolment WHERE idAula IS NOT NULL')
    ])

    return {
      totalRecords: totalResult[0]?.total || 0,
      totalTeachers: teachersResult[0]?.total || 0,
      uniqueAulas: aulasResult.map((row: any) => ({
        aulaId: row.idAula,
        aulaUrl: this.buildAulaUrl(row.idAula)
      }))
    }
  }

  /**
   * Obtener estado de conexión
   */
  getConnectionStatus(): boolean {
    return this.isConnected
  }
}

// Singleton del cliente integrado
let integratedClient: IntegratedEnrolmentClient | null = null

export function getIntegratedEnrolmentClient(): IntegratedEnrolmentClient {
  if (!integratedClient) {
    integratedClient = new IntegratedEnrolmentClient()
  }
  return integratedClient
}

// Cleanup al cerrar la aplicación
process.on('SIGINT', async () => {
  if (integratedClient) {
    await integratedClient.disconnect()
  }
})

process.on('SIGTERM', async () => {
  if (integratedClient) {
    await integratedClient.disconnect()
  }
})