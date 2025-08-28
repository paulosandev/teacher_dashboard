import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Singleton pattern para Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// GET - Obtener datos en cache persistente para un curso
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    
    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

//     console.log(`🔍 Buscando caché persistente para curso: ${courseId}`)

    // Buscar caché en la base de datos
    const cachedData = await prisma.courseCache.findUnique({
      where: {
        courseId: courseId
      }
    })

    // Si no hay caché o ha expirado, devolver vacío
    if (!cachedData || new Date() > cachedData.expiresAt) {
      if (cachedData && new Date() > cachedData.expiresAt) {
        console.log(`⏰ Caché expirado para curso ${courseId}, eliminando...`)
        await prisma.courseCache.delete({
          where: { courseId: courseId }
        }).catch(() => {}) // Ignorar errores de eliminación
      }
      
      console.log(`❌ No hay caché válido para curso: ${courseId}`)
      return NextResponse.json({ 
        success: false, 
        message: 'No cache found or expired',
        analysisResults: {},
        count: 0 
      })
    }

//     console.log(`✅ Caché encontrado para curso ${courseId}, válido hasta: ${cachedData.expiresAt}`)

    // Devolver datos del caché
    return NextResponse.json({ 
      success: true,
      analysisResults: cachedData.analysisResults,
      activities: cachedData.activities,
      activitiesSummary: cachedData.activitiesSummary,
      courseAnalysisId: cachedData.courseAnalysisId,
      count: Object.keys(cachedData.analysisResults as object || {}).length,
      lastFetched: cachedData.lastFetched.toISOString(),
      expiresAt: cachedData.expiresAt.toISOString(),
      fromPersistentCache: true
    })

  } catch (error) {
    console.error('Error obteniendo caché persistente:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}

// POST - Guardar datos en cache persistente
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      courseId, 
      activities, 
      analysisResults, 
      activitiesSummary, 
      courseAnalysisId 
    } = body

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }

//     console.log(`💾 Guardando caché persistente para curso: ${courseId}`)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 hora

    // Upsert (crear o actualizar) el caché
    const savedCache = await prisma.courseCache.upsert({
      where: {
        courseId: courseId
      },
      update: {
        activities: activities || [],
        analysisResults: analysisResults || {},
        activitiesSummary: activitiesSummary || null,
        courseAnalysisId: courseAnalysisId || null,
        lastFetched: now,
        expiresAt: expiresAt,
        isActive: true
      },
      create: {
        courseId: courseId,
        activities: activities || [],
        analysisResults: analysisResults || {},
        activitiesSummary: activitiesSummary || null,
        courseAnalysisId: courseAnalysisId || null,
        lastFetched: now,
        expiresAt: expiresAt,
        isActive: true
      }
    })

//     console.log(`✅ Caché guardado para curso ${courseId}, expira: ${expiresAt}`)

    return NextResponse.json({ 
      success: true, 
      message: 'Cache saved successfully',
      expiresAt: expiresAt.toISOString()
    })

  } catch (error) {
    console.error('Error guardando caché persistente:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}

// DELETE - Limpiar cache expirado o de un curso específico
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')
    const cleanExpired = searchParams.get('expired') === 'true'
    
    if (cleanExpired) {
      // Limpiar todos los caches expirados
      const deleted = await prisma.courseCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })

      console.log(`🧹 Limpiados ${deleted.count} caches expirados`)

      return NextResponse.json({ 
        success: true, 
        deletedCount: deleted.count,
        message: 'Expired caches cleaned'
      })
    }
    
    if (courseId) {
      // Limpiar cache de un curso específico
      await prisma.courseCache.delete({
        where: {
          courseId: courseId
        }
      })

      console.log(`🗑️ Cache eliminado para curso: ${courseId}`)

      return NextResponse.json({ 
        success: true, 
        message: 'Course cache deleted'
      })
    }

    return NextResponse.json({ 
      error: 'courseId or expired=true parameter required' 
    }, { status: 400 })

  } catch (error) {
    console.error('Error limpiando cache:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}