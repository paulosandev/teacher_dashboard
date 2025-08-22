import { prisma } from '../lib/db/prisma'

async function forceCleanAll() {
  console.log('🧽 LIMPIEZA FORZADA COMPLETA')
  console.log('=' .repeat(60))
  
  try {
    // Eliminar TODOS los análisis
    const deletedAnalysis = await prisma.analysisResult.deleteMany({})
    console.log(`🗑️ Eliminados ${deletedAnalysis.count} analysisResult`)

    // Eliminar TODOS los análisis de actividad  
    const deletedActivityAnalysis = await prisma.activityAnalysis.deleteMany({})
    console.log(`🗑️ Eliminados ${deletedActivityAnalysis.count} activityAnalysis`)

    // Eliminar TODOS los logs de trabajos
    const deletedJobLogs = await prisma.jobLog.deleteMany({})
    console.log(`🗑️ Eliminados ${deletedJobLogs.count} jobLog`)

    console.log('\n✅ LIMPIEZA COMPLETA EXITOSA')
    console.log('🎉 Base de datos completamente limpia')

  } catch (error) {
    console.error('❌ Error en limpieza forzada:', error)
  } finally {
    await prisma.$disconnect()
  }
}

forceCleanAll()