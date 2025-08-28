/**
 * API endpoints para enrolments
 * Usa el cliente integrado con túnel SSH directo
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getIntegratedEnrolmentClient } from '@/lib/db/integrated-enrolment-client'

export async function GET(
  request: Request,
  { params }: { params: { action: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const { action } = params
    const enrolmentClient = getIntegratedEnrolmentClient()

    // Health check público
    if (action === 'health') {
      const isHealthy = enrolmentClient.getConnectionStatus()
      return NextResponse.json({
        success: true,
        healthy: isHealthy,
        timestamp: new Date().toISOString()
      })
    }

    // Endpoints protegidos - requieren sesión
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userEmail = session.user.email

    switch (action) {
      case 'my-aulas': {
        // Obtener las aulas del profesor actual
        const result = await enrolmentClient.getEnrolmentsByEmail(userEmail)
        
        return NextResponse.json({
          success: true,
          email: userEmail,
          aulas: result.aulas,
          timestamp: new Date().toISOString()
        })
      }

      case 'my-enrolments': {
        // Obtener todos los enrolments del profesor actual
        const result = await enrolmentClient.getEnrolmentsByEmail(userEmail)
        
        // Agrupar por aula para el formato esperado
        const enrolmentsByAula = result.enrolments.reduce((acc: any, enr) => {
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
          email: userEmail,
          totalEnrolments: result.totalEnrolments,
          aulasCount: result.aulasCount,
          aulas: result.aulas,
          enrolmentsByAula: Object.values(enrolmentsByAula),
          rawEnrolments: result.enrolments,
          timestamp: new Date().toISOString()
        })
      }

      case 'check-teacher': {
        // Verificar si el usuario actual es profesor
        const result = await enrolmentClient.checkIfTeacher(userEmail)
        
        return NextResponse.json({
          success: true,
          email: userEmail,
          isTeacher: result.isTeacher,
          userData: result.userData,
          timestamp: new Date().toISOString()
        })
      }

      case 'stats': {
        // Obtener estadísticas generales
        const stats = await enrolmentClient.getStats()
        
        return NextResponse.json({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Acción no válida: ${action}` },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('❌ Error en API de enrolments:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

// POST endpoint para consultas específicas
export async function POST(
  request: Request,
  { params }: { params: { action: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const { action } = params
    
    // Requiere sesión para todos los POST
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const enrolmentClient = getIntegratedEnrolmentClient()

    switch (action) {
      case 'by-email': {
        // Consultar enrolments por email específico
        const { email } = body
        
        if (!email) {
          return NextResponse.json(
            { success: false, error: 'Email requerido' },
            { status: 400 }
          )
        }
        
        const result = await enrolmentClient.getEnrolmentsByEmail(email)
        
        return NextResponse.json({
          success: true,
          email,
          ...result
        })
      }

      case 'by-aula': {
        // Obtener cursos del profesor en una aula específica
        const { aulaId } = body
        const userEmail = session.user.email!
        
        if (!aulaId) {
          return NextResponse.json(
            { success: false, error: 'Aula ID requerido' },
            { status: 400 }
          )
        }
        
        const result = await enrolmentClient.getEnrolmentsByEmail(userEmail)
        const coursesInAula = result.enrolments
          .filter(enr => enr.aulaId === aulaId)
          .map(enr => ({
            courseId: enr.courseId,
            courseName: enr.courseName,
            courseShortName: enr.courseShortName,
            groupId: enr.groupId,
            groupName: enr.groupName
          }))
        
        return NextResponse.json({
          success: true,
          aulaId,
          courses: coursesInAula,
          timestamp: new Date().toISOString()
        })
      }

      default:
        return NextResponse.json(
          { success: false, error: `Acción no válida: ${action}` },
          { status: 400 }
        )
    }
    
  } catch (error) {
    console.error('❌ Error en POST de enrolments:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}