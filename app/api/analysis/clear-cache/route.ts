import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.moodleToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    console.log('🧹 LIMPIEZA COMPLETA INICIADA')
    
    // 1. Limpiar base de datos PostgreSQL (TODAS las tablas de caché)
    try {
      await prisma.activityAnalysis.deleteMany({})
      await prisma.courseCache.deleteMany({})
      await prisma.analysisResult.deleteMany({})
      console.log('✅ Base de datos PostgreSQL completamente limpiada (ActivityAnalysis, CourseCache, AnalysisResult)')
    } catch (error) {
      console.error('❌ Error limpiando PostgreSQL:', error)
    }

    // 2. Limpiar caché Redis
    try {
      const redis = new Redis(process.env.REDIS_URL!)
      await redis.flushdb()
      await redis.quit()
      console.log('✅ Caché Redis limpiado')
    } catch (error) {
      console.error('❌ Error limpiando Redis:', error)
    }

    // 3. Headers para limpiar caché del navegador
    const response = NextResponse.json({ 
      success: true, 
      message: 'Caché completamente limpiado',
      timestamp: new Date().toISOString()
    })

    // Forzar limpieza de caché del navegador
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Clear-Site-Data', '"cache", "storage"')

    console.log('🎉 LIMPIEZA COMPLETA TERMINADA')
    
    return response

  } catch (error) {
    console.error('❌ Error en limpieza completa:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}