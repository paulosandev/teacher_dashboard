/**
 * Cliente integrado para acceder a la base de datos de enrolments
 * Conexión directa a la base de datos MySQL
 */

import { createPool } from 'mysql2/promise'
import type { Pool, Connection } from 'mysql2/promise'

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
  // Usar túnel SSH si está activo
  private readonly USE_SSH_TUNNEL = process.env.SSH_TUNNEL_ACTIVE === 'true'
  private readonly DB_HOST = this.USE_SSH_TUNNEL
    ? (process.env.ENROLMENT_DB_HOST_TUNNEL || 'localhost')
    : (process.env.ENROLMENT_DB_HOST || 'wsdata.ce9oduyxts26.us-west-1.rds.amazonaws.com')
  private readonly DB_PORT = this.USE_SSH_TUNNEL
    ? parseInt(process.env.ENROLMENT_DB_PORT_TUNNEL || '3307')
    : parseInt(process.env.ENROLMENT_DB_PORT || '3306')
  private readonly DB_USER = process.env.ENROLMENT_DB_USER || 'datos'
  private readonly DB_PASSWORD = process.env.ENROLMENT_DB_PASSWORD || ''
  private readonly DB_NAME = process.env.ENROLMENT_DB_NAME || 'heroku_e6e033d354ff64c'

  private pool: Pool | null = null
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
   * Establecer pool de conexiones MySQL
   */
  private async establishDatabasePool(): Promise<void> {
    console.log(`💾 Creando pool MySQL ${this.USE_SSH_TUNNEL ? 'via SSH tunnel' : 'directamente'}...`)
    console.log(`📍 Host: ${this.DB_HOST}:${this.DB_PORT}`)

    const poolConfig: any = {
      host: this.DB_HOST,
      port: this.DB_PORT,
      user: this.DB_USER,
      database: this.DB_NAME,
      connectionLimit: 10, // Máximo 10 conexiones concurrentes
      queueLimit: 0, // Sin límite de queue
      acquireTimeout: 60000, // 60 segundos para obtener conexión
      timeout: 60000, // 60 segundos timeout de query
      reconnect: true, // Reconexión automática
      idleTimeout: 300000, // 5 minutos de inactividad
      maxIdle: 5, // Máximo 5 conexiones idle
    }

    // Solo agregar password si no está vacío
    if (this.DB_PASSWORD) {
      poolConfig.password = this.DB_PASSWORD
    }

    // Solo usar SSL si no estamos usando el túnel
    if (!this.USE_SSH_TUNNEL) {
      poolConfig.ssl = { rejectUnauthorized: false }
    }

    this.pool = createPool(poolConfig)

    // Verificar conectividad inicial
    const connection = await this.pool.getConnection()
    await connection.ping()
    connection.release()

    console.log(`✅ Pool MySQL ${this.USE_SSH_TUNNEL ? 'via túnel' : 'directo'} establecido (${poolConfig.connectionLimit} conexiones)`)
  }

  /**
   * Conectar pool MySQL
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('🔗 Pool ya está conectado')
      return
    }

    try {
      // Establecer pool MySQL
      await this.establishDatabasePool()

      this.isConnected = true
      console.log('🎉 Pool MySQL establecido correctamente')

    } catch (error) {
      console.error('❌ Error estableciendo pool:', error)
      await this.disconnect()
      throw error
    }
  }

  /**
   * Desconectar pool
   */
  async disconnect(): Promise<void> {
    console.log('🔒 Cerrando pool...')

    if (this.pool) {
      await this.pool.end()
      this.pool = null
      console.log('💾 Pool MySQL cerrado')
    }

    this.isConnected = false
  }

  /**
   * Ejecutar consulta usando el pool
   */
  private async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.isConnected) {
      await this.connect()
    }

    try {
      if (!this.pool) {
        throw new Error('No hay pool de conexiones disponible')
      }

      const [results] = await this.pool.execute(sql, params)
      return results as any[]

    } catch (error) {
      console.error('❌ Error ejecutando consulta:', error)

      // Si hay error de conexión, intentar reconectar el pool
      if (error instanceof Error && (
        error.message.includes('Connection lost') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('PROTOCOL_CONNECTION_LOST') ||
        error.message.includes('closed state') ||
        error.message.includes('Pool is closed')
      )) {
        console.log('🔄 Reestableciendo pool de conexiones...')
        this.isConnected = false
        await this.connect()

        // Reintentar la consulta
        const [results] = await this.pool!.execute(sql, params)
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