import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const aulaId = searchParams.get('aulaId')
    const courseId = searchParams.get('courseId')
    const activeOnly = searchParams.get('activeOnly') === 'true'
    
    console.log('📋 [ACTIVITIES] Consultando actividades:', { aulaId, courseId, activeOnly })

    let whereClause: any = {}
    
    if (aulaId) {
      whereClause.aulaId = aulaId
    }
    
    if (courseId) {
      whereClause.courseId = parseInt(courseId)
    }

    if (activeOnly) {
      whereClause.visible = true
      whereClause.needsAnalysis = true
    }

    const activities = await prisma.courseActivity.findMany({
      where: whereClause,
      orderBy: [
        { aulaId: 'asc' },
        { courseId: 'asc' },
        { dueDate: 'asc' }
      ],
      select: {
        id: true,
        aulaId: true,
        courseId: true,
        activityId: true,
        type: true,
        name: true,
        description: true,
        dueDate: true,
        cutoffDate: true,
        url: true,
        visible: true,
        needsAnalysis: true,
        analysisCount: true,
        lastDataSync: true
      }
    })

    // Agrupar por aula y curso para mejor organización
    const groupedData = activities.reduce((acc, activity) => {
      if (!acc[activity.aulaId]) {
        acc[activity.aulaId] = {}
      }
      if (!acc[activity.aulaId][activity.courseId]) {
        acc[activity.aulaId][activity.courseId] = []
      }
      acc[activity.aulaId][activity.courseId].push(activity)
      return acc
    }, {} as Record<string, Record<string, any[]>>)

    // Calcular estadísticas
    const stats = {
      total: activities.length,
      active: activities.filter(a => a.visible && a.needsAnalysis).length,
      inactive: activities.filter(a => !a.visible || !a.needsAnalysis).length,
      analyzed: activities.filter(a => a.analysisCount > 0).length,
      byAula: Object.keys(groupedData).map(aulaId => ({
        aulaId,
        courses: Object.keys(groupedData[aulaId]).length,
        activities: Object.values(groupedData[aulaId]).flat().length,
        active: Object.values(groupedData[aulaId]).flat().filter(a => a.visible && a.needsAnalysis).length
      }))
    }

    console.log(`✅ [ACTIVITIES] Encontradas ${activities.length} actividades`)

    return NextResponse.json({
      success: true,
      filters: { aulaId, courseId, activeOnly },
      stats,
      activities: aulaId || courseId ? activities : groupedData, // Si hay filtros, devolver lista, sino agrupado
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [ACTIVITIES] Error consultando actividades:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}