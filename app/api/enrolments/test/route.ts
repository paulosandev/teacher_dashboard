/**
 * Endpoint de prueba para verificar conectividad con cliente integrado
 * y obtener registros de la tabla enrolment
 */

import { NextResponse } from 'next/server'
import { getIntegratedEnrolmentClient } from '@/lib/db/integrated-enrolment-client'

export async function GET(request: Request) {
  try {
    console.log('🔍 Iniciando prueba de conexión integrada...')
    
    const enrolmentClient = getIntegratedEnrolmentClient()
    
    // 1. Obtener estadísticas generales
    console.log('📊 Obteniendo estadísticas...')
    const stats = await enrolmentClient.getStats()
    
    // 2. Probar un email específico conocido
    console.log('📧 Probando con email específico...')
    const testResult = await enrolmentClient.getEnrolmentsByEmail('omarobr@hotmail.com')
    
    // Preparar respuesta
    const response = {
      success: true,
      message: 'Conexión integrada exitosa',
      timestamp: new Date().toISOString(),
      connectionStatus: enrolmentClient.getConnectionStatus(),
      data: {
        statistics: stats,
        testResult: {
          email: 'omarobr@hotmail.com',
          totalEnrolments: testResult.totalEnrolments,
          aulasCount: testResult.aulasCount,
          aulas: testResult.aulas,
          sampleEnrolments: testResult.enrolments.slice(0, 3) // Primeros 3 para prueba
        }
      }
    }
    
    console.log('✅ Prueba completada exitosamente')
    console.log(`📊 Resumen:`)
    console.log(`  - Total registros: ${stats.totalRecords}`)
    console.log(`  - Total profesores: ${stats.totalTeachers}`)
    console.log(`  - Aulas únicas: ${stats.uniqueAulas.length}`)
    console.log(`  - Test email enrolments: ${testResult.totalEnrolments}`)
    
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
    const { email } = body
    
    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Debe proporcionar email'
      }, { status: 400 })
    }
    
    const enrolmentClient = getIntegratedEnrolmentClient()
    
    console.log(`📧 Buscando enrolments por email: ${email}`)
    
    // Verificar si es profesor
    const teacherCheck = await enrolmentClient.checkIfTeacher(email)
    
    if (!teacherCheck.isTeacher) {
      return NextResponse.json({
        success: false,
        message: `${email} no es profesor`
      }, { status: 404 })
    }
    
    // Obtener enrolments
    const result = await enrolmentClient.getEnrolmentsByEmail(email)
    
    return NextResponse.json({
      success: true,
      message: `Enrolments encontrados para ${email}`,
      teacherData: teacherCheck.userData,
      data: result
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