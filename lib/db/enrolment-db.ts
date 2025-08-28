/**
 * Cliente para acceder a la base de datos de enrolments
 * Gestiona las consultas a la tabla enrolment para obtener las aulas de cada profesor
 */

import { getSSHTunnelManager } from '@/lib/ssh/tunnel-manager'

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
  aulaName: string
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

export class EnrolmentDatabaseClient {
  private readonly TEACHER_ROLE_ID = 17

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
      aulaName: record.idAula,
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
   * Obtener todos los registros de la tabla enrolment (para pruebas)
   */
  async getAllEnrolments(limit: number = 100): Promise<ProcessedEnrolment[]> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      const query = `
        SELECT * FROM enrolment 
        WHERE suspendido = 0
        ORDER BY timestamp DESC
        LIMIT ?
      `
      
      const results = await tunnelManager.query(query, [limit])
      
      console.log(`📚 Se obtuvieron ${results.length} registros de enrolment`)
      return results.map((record: EnrolmentRecord) => this.processEnrolmentRecord(record))
      
    } catch (error) {
      console.error('❌ Error obteniendo enrolments:', error)
      throw error
    }
  }

  /**
   * Obtener las aulas donde está enrolado un profesor específico
   */
  async getTeacherEnrolments(userId: string): Promise<ProcessedEnrolment[]> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      const query = `
        SELECT * FROM enrolment 
        WHERE userid = ? 
        AND roles_id = ?
        AND suspendido = 0
        ORDER BY idAula, fullname
      `
      
      const results = await tunnelManager.query(query, [userId, this.TEACHER_ROLE_ID])
      
      console.log(`👨‍🏫 Profesor ${userId} tiene ${results.length} cursos asignados`)
      return results.map((record: EnrolmentRecord) => this.processEnrolmentRecord(record))
      
    } catch (error) {
      console.error(`❌ Error obteniendo enrolments para profesor ${userId}:`, error)
      throw error
    }
  }

  /**
   * Obtener aulas únicas donde un profesor está enrolado
   */
  async getTeacherAulas(userId: string): Promise<{aulaId: string, aulaUrl: string, coursesCount: number}[]> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      const query = `
        SELECT 
          idAula,
          COUNT(DISTINCT courseid) as courses_count
        FROM enrolment 
        WHERE userid = ? 
        AND roles_id = ?
        AND suspendido = 0
        GROUP BY idAula
        ORDER BY idAula
      `
      
      const results = await tunnelManager.query(query, [userId, this.TEACHER_ROLE_ID])
      
      return results.map((row: any) => ({
        aulaId: row.idAula,
        aulaUrl: this.buildAulaUrl(row.idAula),
        coursesCount: row.courses_count
      }))
      
    } catch (error) {
      console.error(`❌ Error obteniendo aulas del profesor ${userId}:`, error)
      throw error
    }
  }

  /**
   * Verificar si un usuario es profesor en alguna aula
   */
  async isTeacher(userId: string): Promise<boolean> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      const query = `
        SELECT COUNT(*) as count
        FROM enrolment 
        WHERE userid = ? 
        AND roles_id = ?
        AND suspendido = 0
      `
      
      const results = await tunnelManager.query(query, [userId, this.TEACHER_ROLE_ID])
      
      return results[0]?.count > 0
      
    } catch (error) {
      console.error(`❌ Error verificando si ${userId} es profesor:`, error)
      return false
    }
  }

  /**
   * Obtener todos los profesores con sus aulas
   */
  async getAllTeachersWithAulas(): Promise<{userId: string, userName: string, aulas: string[]}[]> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      const query = `
        SELECT 
          userid,
          username,
          GROUP_CONCAT(DISTINCT idAula) as aulas
        FROM enrolment 
        WHERE roles_id = ?
        AND suspendido = 0
        GROUP BY userid, username
        LIMIT 100
      `
      
      const results = await tunnelManager.query(query, [this.TEACHER_ROLE_ID])
      
      return results.map((row: any) => ({
        userId: row.userid,
        userName: row.username,
        aulas: row.aulas ? row.aulas.split(',').map((aula: string) => this.buildAulaUrl(aula)) : []
      }))
      
    } catch (error) {
      console.error('❌ Error obteniendo profesores con sus aulas:', error)
      throw error
    }
  }

  /**
   * Obtener estadísticas de la tabla enrolment
   */
  async getEnrolmentStats(): Promise<{
    totalRecords: number
    activeRecords: number
    totalTeachers: number
    uniqueAulas: string[]
    teachersByAula: {aulaId: string, aulaUrl: string, teacherCount: number}[]
  }> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      // Total de registros
      const totalQuery = 'SELECT COUNT(*) as total FROM enrolment'
      const totalResult = await tunnelManager.query(totalQuery)
      
      // Registros activos
      const activeQuery = 'SELECT COUNT(*) as active FROM enrolment WHERE suspendido = 0'
      const activeResult = await tunnelManager.query(activeQuery)
      
      // Profesores únicos
      const teachersQuery = `
        SELECT COUNT(DISTINCT userid) as total_teachers 
        FROM enrolment 
        WHERE roles_id = ? AND suspendido = 0
      `
      const teachersResult = await tunnelManager.query(teachersQuery, [this.TEACHER_ROLE_ID])
      
      // Aulas únicas
      const aulasQuery = 'SELECT DISTINCT idAula FROM enrolment WHERE idAula IS NOT NULL'
      const aulasResult = await tunnelManager.query(aulasQuery)
      
      // Profesores por aula
      const teachersByAulaQuery = `
        SELECT 
          idAula,
          COUNT(DISTINCT userid) as teacher_count
        FROM enrolment 
        WHERE roles_id = ? 
        AND suspendido = 0
        GROUP BY idAula
        ORDER BY teacher_count DESC
      `
      const teachersByAulaResult = await tunnelManager.query(teachersByAulaQuery, [this.TEACHER_ROLE_ID])
      
      return {
        totalRecords: totalResult[0]?.total || 0,
        activeRecords: activeResult[0]?.active || 0,
        totalTeachers: teachersResult[0]?.total_teachers || 0,
        uniqueAulas: aulasResult.map((row: any) => this.buildAulaUrl(row.idAula)).filter(Boolean),
        teachersByAula: teachersByAulaResult.map((row: any) => ({
          aulaId: row.idAula,
          aulaUrl: this.buildAulaUrl(row.idAula),
          teacherCount: row.teacher_count
        }))
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de enrolment:', error)
      throw error
    }
  }

  /**
   * Verificar la estructura de la tabla enrolment
   */
  async getTableStructure(): Promise<any[]> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      const query = 'DESCRIBE enrolment'
      const results = await tunnelManager.query(query)
      
      console.log('📋 Estructura de la tabla enrolment:')
      results.forEach((column: any) => {
        console.log(`  - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'}`)
      })
      
      return results
      
    } catch (error) {
      console.error('❌ Error obteniendo estructura de tabla:', error)
      throw error
    }
  }

  /**
   * Obtener enrolments por email (para login)
   */
  async getTeacherEnrolmentsByEmail(email: string): Promise<ProcessedEnrolment[]> {
    try {
      const tunnelManager = await getSSHTunnelManager()
      
      const query = `
        SELECT * FROM enrolment 
        WHERE email = ? 
        AND roles_id = ?
        AND suspendido = 0
        ORDER BY idAula, fullname
      `
      
      const results = await tunnelManager.query(query, [email, this.TEACHER_ROLE_ID])
      
      console.log(`📧 Email ${email} tiene ${results.length} cursos asignados como profesor`)
      return results.map((record: EnrolmentRecord) => this.processEnrolmentRecord(record))
      
    } catch (error) {
      console.error(`❌ Error obteniendo enrolments para email ${email}:`, error)
      throw error
    }
  }
}

// Singleton para el cliente
let enrolmentClient: EnrolmentDatabaseClient | null = null

export function getEnrolmentClient(): EnrolmentDatabaseClient {
  if (!enrolmentClient) {
    enrolmentClient = new EnrolmentDatabaseClient()
  }
  return enrolmentClient
}