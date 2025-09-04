import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

// Use global prisma instance to avoid connection issues
declare global {
  var prisma: PrismaClient | undefined
}

const prisma = globalThis.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🧹 [CLEAN] Iniciando limpieza completa del sistema')

  try {
    const results = {
      deletedAnalyses: 0,
      deletedActivities: 0,
      deletedCourses: 0,
      deletedAulas: 0,
      deletedCache: 0
    }

    // 1. Limpiar análisis de actividades
    console.log('🗑️ [CLEAN] Eliminando análisis de actividades...')
    try {
      const deletedAnalyses = await prisma.activityAnalysis.deleteMany()
      results.deletedAnalyses = deletedAnalyses.count
      console.log(`   ✅ ${deletedAnalyses.count} análisis eliminados`)
    } catch (e) {
      console.log('   ⚠️ Tabla activityAnalysis no encontrada o vacía')
    }
    
    // 2. Limpiar actividades de cursos
    console.log('🗑️ [CLEAN] Eliminando actividades de cursos...')
    const deletedActivities = await prisma.courseActivity.deleteMany()
    results.deletedActivities = deletedActivities.count
    console.log(`   ✅ ${deletedActivities.count} actividades eliminadas`)
    
    // 3. Limpiar cursos de aulas
    console.log('🗑️ [CLEAN] Eliminando cursos de aulas...')
    const deletedCourses = await prisma.aulaCourse.deleteMany()
    results.deletedCourses = deletedCourses.count
    console.log(`   ✅ ${deletedCourses.count} cursos eliminados`)
    
    // 4. Limpiar aulas
    console.log('🗑️ [CLEAN] Eliminando aulas...')
    const deletedAulas = await prisma.aula.deleteMany()
    results.deletedAulas = deletedAulas.count
    console.log(`   ✅ ${deletedAulas.count} aulas eliminadas`)
    
    // 5. Limpiar cache de análisis
    console.log('🗑️ [CLEAN] Eliminando cache de análisis...')
    try {
      const deletedCache = await prisma.analysisCache.deleteMany()
      results.deletedCache = deletedCache.count
      console.log(`   ✅ ${deletedCache.count} entradas de cache eliminadas`)
    } catch (e) {
      console.log('   ⚠️ Tabla analysisCache no encontrada o vacía')
    }

    const duration = Date.now() - startTime
    console.log(`✅ [CLEAN] Limpieza completa finalizada en ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: 'Limpieza completa realizada exitosamente',
      results,
      duration,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [CLEAN] Error durante la limpieza:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}