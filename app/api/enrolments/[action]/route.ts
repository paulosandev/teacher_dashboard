/**
 * API endpoints para enrolments
 * Estos endpoints se comunican con el servicio de enrolments
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getEnrolmentServiceClient } from '@/lib/services/enrolment-client'

export async function GET(
  request: Request,
  { params }: { params: { action: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    const { action } = params
    const enrolmentClient = getEnrolmentServiceClient()

    // Health check público
    if (action === 'health') {
      const isHealthy = await enrolmentClient.checkHealth()
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
        const aulas = await enrolmentClient.getTeacherAulas(userEmail)
        
        return NextResponse.json({
          success: true,
          email: userEmail,
          aulas,
          timestamp: new Date().toISOString()
        })
      }

      case 'my-enrolments': {
        // Obtener todos los enrolments del profesor actual
        const enrolments = await enrolmentClient.getEnrolmentsByEmail(userEmail)
        
        if (!enrolments) {
          return NextResponse.json(
            { success: false, error: 'No se pudieron obtener los enrolments' },
            { status: 500 }
          )
        }
        
        return NextResponse.json({
          success: true,
          ...enrolments,
          timestamp: new Date().toISOString()
        })
      }

      case 'check-teacher': {
        // Verificar si el usuario actual es profesor
        const result = await enrolmentClient.checkIfTeacher(userEmail)
        
        if (!result) {
          return NextResponse.json(
            { success: false, error: 'No se pudo verificar el rol' },
            { status: 500 }
          )
        }
        
        return NextResponse.json({
          success: true,
          ...result,
          timestamp: new Date().toISOString()
        })
      }

      case 'stats': {
        // Obtener estadísticas generales (puede requerir permisos especiales)
        const stats = await enrolmentClient.getStats()
        
        if (!stats) {
          return NextResponse.json(
            { success: false, error: 'No se pudieron obtener las estadísticas' },
            { status: 500 }
          )
        }
        
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
    const enrolmentClient = getEnrolmentServiceClient()

    switch (action) {
      case 'by-email': {
        // Consultar enrolments por email específico (admin only?)
        const { email } = body
        
        if (!email) {
          return NextResponse.json(
            { success: false, error: 'Email requerido' },
            { status: 400 }
          )
        }
        
        const enrolments = await enrolmentClient.getEnrolmentsByEmail(email)
        
        return NextResponse.json({
          success: !!enrolments,
          ...enrolments
        })
      }

      case 'by-aula': {
        // Obtener cursos del profesor en una aula específica
        const { aulaId } = body
        const userEmail = session.user.email
        
        if (!aulaId) {
          return NextResponse.json(
            { success: false, error: 'Aula ID requerido' },
            { status: 400 }
          )
        }
        
        const courses = await enrolmentClient.getTeacherCoursesByAula(userEmail, aulaId)
        
        return NextResponse.json({
          success: true,
          aulaId,
          courses,
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