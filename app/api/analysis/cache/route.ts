import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Singleton pattern para Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// GET - Obtener análisis en cache para un curso
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    // Buscar análisis guardados para el curso
    const cachedAnalysis = await prisma.activityAnalysis.findMany({
      where: {
        moodleCourseId: courseId,
        isValid: true
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    })

    // Convertir a formato esperado por el frontend
    const analysisResults: { [key: string]: any } = {}
    
    for (const analysis of cachedAnalysis) {
      const activityKey = `${analysis.activityType}_${analysis.activityId}`
      analysisResults[activityKey] = {
        summary: analysis.summary,
        positives: analysis.positives,
        alerts: analysis.alerts,
        insights: analysis.insights,
        recommendation: analysis.recommendation,
        generatedAt: analysis.generatedAt.toISOString(),
        activityName: analysis.activityName,
        activityId: analysis.activityId,
        activityType: analysis.activityType
      }
    }

    return NextResponse.json({ 
      success: true, 
      analysisResults,
      count: cachedAnalysis.length 
    })

  } catch (error) {
    console.error('Error obteniendo análisis en cache:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}

// DELETE - Limpiar cache de análisis antiguos
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const hours = parseInt(searchParams.get('hours') || '4')
    
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000))

    const deleted = await prisma.activityAnalysis.deleteMany({
      where: {
        moodleCourseId: courseId,
        lastUpdated: {
          lt: cutoffTime
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      deletedCount: deleted.count 
    })

  } catch (error) {
    console.error('Error limpiando cache de análisis:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}