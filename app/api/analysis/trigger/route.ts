import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/get-session'
import { analysisQueue } from '@/lib/queue/queues'
import { prisma } from '@/lib/db/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }
    
    // Obtener datos del request
    const body = await request.json()
    const { courseId, groupId, activityId, forumId, type } = body
    
    // Validar datos requeridos
    if (!courseId || !type || (type !== 'activity' && type !== 'forum')) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }
    
    if (type === 'activity' && !activityId) {
      return NextResponse.json(
        { error: 'Se requiere activityId para análisis de actividad' },
        { status: 400 }
      )
    }
    
    if (type === 'forum' && !forumId) {
      return NextResponse.json(
        { error: 'Se requiere forumId para análisis de foro' },
        { status: 400 }
      )
    }
    
    // Verificar que el curso pertenezca al usuario
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        userId: session.user.id,
      },
    })
    
    if (!course) {
      return NextResponse.json(
        { error: 'Curso no encontrado o no autorizado' },
        { status: 404 }
      )
    }
    
    // Agregar trabajo a la cola
    const job = await analysisQueue.add(
      'manual-analysis',
      {
        courseId,
        groupId,
        activityId,
        forumId,
        type,
        userId: session.user.id,
        scheduledBy: 'user',
      },
      {
        priority: 1, // Mayor prioridad para análisis manuales
      }
    )
    
    console.log(`📋 Análisis manual encolado: ${job.id}`)
    
    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Análisis iniciado. Los resultados estarán disponibles en unos momentos.',
    })
    
  } catch (error) {
    console.error('Error al disparar análisis:', error)
    return NextResponse.json(
      { error: 'Error al procesar solicitud' },
      { status: 500 }
    )
  }
}
