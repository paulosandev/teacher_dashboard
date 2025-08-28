/**
 * Endpoint de prueba para verificar conectividad con base de datos externa
 * y obtener registros de la tabla enrolment
 */

import { NextResponse } from 'next/server'
import { getEnrolmentClient } from '@/lib/db/enrolment-db'

export async function GET(request: Request) {
  try {
    console.log('🔍 Iniciando prueba de conexión a base de datos externa...')
    
    const enrolmentClient = getEnrolmentClient()
    
    // 1. Verificar estructura de la tabla
    console.log('\n📋 1. Verificando estructura de la tabla...')
    const tableStructure = await enrolmentClient.getTableStructure()
    
    // 2. Obtener estadísticas
    console.log('\n📊 2. Obteniendo estadísticas...')
    const stats = await enrolmentClient.getEnrolmentStats()
    
    // 3. Obtener algunos registros de ejemplo
    console.log('\n📚 3. Obteniendo registros de ejemplo...')
    const sampleRecords = await enrolmentClient.getAllEnrolments(10)
    
    // 4. Obtener algunos profesores con sus aulas
    console.log('\n👨‍🏫 4. Obteniendo profesores con sus aulas...')
    const teachersWithAulas = await enrolmentClient.getAllTeachersWithAulas()
    
    // Preparar respuesta
    const response = {
      success: true,
      message: 'Conexión exitosa a base de datos externa',
      timestamp: new Date().toISOString(),
      data: {
        tableStructure: {
          columns: tableStructure.map((col: any) => ({
            field: col.Field,
            type: col.Type,
            nullable: col.Null === 'YES',
            key: col.Key,
            default: col.Default
          }))
        },
        statistics: {
          totalRecords: stats.totalRecords,
          activeRecords: stats.activeRecords,
          totalTeachers: stats.totalTeachers,
          uniqueAulasCount: stats.uniqueAulas.length,
          uniqueAulas: stats.uniqueAulas.slice(0, 10), // Primeras 10 aulas
          teachersByAula: stats.teachersByAula.slice(0, 5) // Top 5 aulas con más profesores
        },
        sampleRecords: sampleRecords.slice(0, 5).map(record => ({
          userId: record.userId,
          userName: record.userName,
          userFullName: record.userFullName,
          email: record.email,
          aulaId: record.aulaId,
          aulaUrl: record.aulaUrl,
          courseName: record.courseName,
          groupName: record.groupName,
          roleName: record.roleName,
          isTeacher: record.isTeacher
        })),
        teachersSample: teachersWithAulas.slice(0, 5).map(teacher => ({
          userId: teacher.userId,
          userName: teacher.userName,
          aulasCount: teacher.aulas.length,
          aulas: teacher.aulas
        }))
      }
    }
    
    console.log('\n✅ Prueba completada exitosamente')
    console.log(`📊 Resumen:`)
    console.log(`  - Total registros: ${stats.totalRecords}`)
    console.log(`  - Registros activos: ${stats.activeRecords}`)
    console.log(`  - Total profesores: ${stats.totalTeachers}`)
    console.log(`  - Aulas únicas: ${stats.uniqueAulas.length}`)
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('❌ Error en prueba de conexión:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Error conectando a base de datos externa',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Endpoint para probar enrolments de un profesor específico
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, userId } = body
    
    if (!email && !userId) {
      return NextResponse.json({
        success: false,
        message: 'Debe proporcionar email o userId'
      }, { status: 400 })
    }
    
    const enrolmentClient = getEnrolmentClient()
    
    let enrolments = []
    let aulas = []
    
    if (email) {
      console.log(`📧 Buscando enrolments por email: ${email}`)
      enrolments = await enrolmentClient.getTeacherEnrolmentsByEmail(email)
    } else if (userId) {
      console.log(`🔍 Buscando enrolments por userId: ${userId}`)
      enrolments = await enrolmentClient.getTeacherEnrolments(userId)
      aulas = await enrolmentClient.getTeacherAulas(userId)
    }
    
    // Agrupar por aula
    const enrolmentsByAula = enrolments.reduce((acc: any, enr) => {
      if (!acc[enr.aulaId]) {
        acc[enr.aulaId] = {
          aulaId: enr.aulaId,
          aulaUrl: enr.aulaUrl,
          courses: []
        }
      }
      
      acc[enr.aulaId].courses.push({
        courseId: enr.courseId,
        courseName: enr.courseName,
        courseShortName: enr.courseShortName,
        groupId: enr.groupId,
        groupName: enr.groupName
      })
      
      return acc
    }, {})
    
    return NextResponse.json({
      success: true,
      message: `Enrolments encontrados para ${email || userId}`,
      data: {
        totalEnrolments: enrolments.length,
        aulasCount: Object.keys(enrolmentsByAula).length,
        enrolmentsByAula: Object.values(enrolmentsByAula),
        aulas: aulas,
        rawEnrolments: enrolments.slice(0, 10) // Primeros 10 para referencia
      }
    })
    
  } catch (error) {
    console.error('❌ Error buscando enrolments:', error)
    
    return NextResponse.json({
      success: false,
      message: 'Error buscando enrolments',
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}