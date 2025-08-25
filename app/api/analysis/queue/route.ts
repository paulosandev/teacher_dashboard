import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { queueAnalysisForActivities, getAnalysisQueueStatus } from '../../../../lib/queues/analysis-queue'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

const prisma = new PrismaClient()

// POST - Agregar actividades a la cola de análisis
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { courseId, activities } = body

    if (!courseId || !activities || !Array.isArray(activities)) {
      return NextResponse.json({ 
        error: 'courseId y activities son requeridos' 
      }, { status: 400 })
    }

    console.log(`🚀 Iniciando cola de análisis para ${activities.length} actividades en curso: ${courseId}`)

    const result = await queueAnalysisForActivities(
      courseId,
      activities,
      session.user?.matricula || session.user?.email
    )

    return NextResponse.json({
      success: true,
      message: `${result.added} análisis agregados a la cola`,
      stats: result
    })

  } catch (error) {
    console.error('Error agregando a cola de análisis:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}

// GET - Obtener estado de la cola para un curso
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    if (!courseId) {
      return NextResponse.json({ 
        error: 'courseId es requerido' 
      }, { status: 400 })
    }

    const status = await getAnalysisQueueStatus(courseId)

    if (!status) {
      return NextResponse.json({
        error: 'Error obteniendo estado de cola'
      }, { status: 500 })
    }

    // También obtener algunos análisis completados recientes
    const recentAnalysis = await prisma.analysisQueue.findMany({
      where: {
        courseId,
        status: 'completed'
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: 10,
      select: {
        activityName: true,
        completedAt: true,
        activityType: true
      }
    })

    return NextResponse.json({
      success: true,
      status,
      recentAnalysis
    })

  } catch (error) {
    console.error('Error obteniendo estado de cola:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}

// DELETE - Limpiar análisis fallidos y completados antiguos
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const cleanType = searchParams.get('type') || 'completed' // 'completed', 'failed', 'all'

    let whereCondition: any = {}

    if (courseId) {
      whereCondition.courseId = courseId
    }

    if (cleanType === 'completed') {
      whereCondition.status = 'completed'
      whereCondition.completedAt = {
        lt: new Date(Date.now() - (24 * 60 * 60 * 1000)) // Más de 24 horas
      }
    } else if (cleanType === 'failed') {
      whereCondition.status = 'failed'
    } else if (cleanType === 'all') {
      whereCondition.status = { in: ['completed', 'failed'] }
    }

    const deleted = await prisma.analysisQueue.deleteMany({
      where: whereCondition
    })

    return NextResponse.json({
      success: true,
      message: `${deleted.count} elementos eliminados de la cola`,
      deletedCount: deleted.count
    })

  } catch (error) {
    console.error('Error limpiando cola:', error)
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 })
  }
}