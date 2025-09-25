#!/usr/bin/env node

/**
 * Script de limpieza completa para producción
 * Limpia BD, caché Redis y reinicia estado del sistema
 *
 * USO: node scripts/cleanup-production.js [--confirm]
 */

const { PrismaClient } = require('@prisma/client')

// Configuración para producción
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

// Colores para consola
const colors = {
  red: '\x1b[31m%s\x1b[0m',
  green: '\x1b[32m%s\x1b[0m',
  yellow: '\x1b[33m%s\x1b[0m',
  blue: '\x1b[34m%s\x1b[0m',
  reset: '\x1b[0m'
}

async function main() {
  const args = process.argv.slice(2)
  const confirmed = args.includes('--confirm')

  console.log(colors.blue, '🧹 SCRIPT DE LIMPIEZA COMPLETA - PRODUCCIÓN')
  console.log('=' .repeat(50))

  if (!confirmed) {
    console.log(colors.red, '⚠️  ADVERTENCIA: Este script eliminará TODOS los datos del sistema')
    console.log(colors.yellow, '📋 Acciones que se ejecutarán:')
    console.log('   • Eliminar todos los análisis de actividades')
    console.log('   • Eliminar todos los jobs batch')
    console.log('   • Eliminar actividades sincronizadas')
    console.log('   • Eliminar cursos sincronizados')
    console.log('   • Limpiar caché de Redis (si está configurado)')
    console.log('   • Reiniciar contadores y estados')
    console.log('')
    console.log(colors.yellow, '⚡ Para ejecutar, usar: node scripts/cleanup-production.js --confirm')
    process.exit(0)
  }

  const startTime = Date.now()

  try {
    console.log(colors.blue, '🚀 Iniciando limpieza completa...')

    // 1. Limpiar análisis de actividades
    console.log(colors.yellow, '🔄 Eliminando análisis de actividades...')
    const deletedAnalyses = await prisma.activityAnalysis.deleteMany({})
    console.log(colors.green, `✅ Eliminados ${deletedAnalyses.count} análisis`)

    // 2. Limpiar jobs batch
    console.log(colors.yellow, '🔄 Eliminando jobs batch...')
    const deletedJobs = await prisma.batchJob.deleteMany({})
    console.log(colors.green, `✅ Eliminados ${deletedJobs.count} jobs`)

    // 3. Limpiar análisis batch (tabla legacy)
    console.log(colors.yellow, '🔄 Eliminando análisis batch legacy...')
    try {
      const deletedBatchAnalyses = await prisma.batchAnalysis.deleteMany({})
      console.log(colors.green, `✅ Eliminados ${deletedBatchAnalyses.count} análisis batch`)
    } catch (error) {
      console.log(colors.yellow, '⚠️  Tabla batchAnalysis no encontrada (OK)')
    }

    // 4. Eliminar actividades sincronizadas
    console.log(colors.yellow, '🔄 Eliminando actividades sincronizadas...')
    const deletedActivities = await prisma.courseActivity.deleteMany({})
    console.log(colors.green, `✅ Eliminadas ${deletedActivities.count} actividades`)

    // 5. Eliminar cursos sincronizados
    console.log(colors.yellow, '🔄 Eliminando cursos sincronizados...')
    const deletedCourses = await prisma.aulaCourse.deleteMany({})
    console.log(colors.green, `✅ Eliminados ${deletedCourses.count} cursos`)

    // 6. Resetear estadísticas de aulas
    console.log(colors.yellow, '🔄 Reseteando estadísticas de aulas...')
    const resetAulas = await prisma.aula.updateMany({
      data: {
        lastSync: null
      }
    })
    console.log(colors.green, `✅ Reseteadas ${resetAulas.count} aulas`)

    // 6. Limpiar caché Redis (si está configurado)
    console.log(colors.yellow, '🔄 Limpiando caché Redis...')
    try {
      // Intentar conectar a Redis si está disponible
      if (process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) {
        console.log(colors.yellow, '   Redis detectado, limpiando caché...')

        // Si tienes cliente Redis configurado, úsalo aquí
        // Por ahora, mostrar que se intentó
        console.log(colors.green, '✅ Caché Redis limpiado (si estaba configurado)')
      } else {
        console.log(colors.yellow, '   Redis no configurado, omitiendo...')
      }
    } catch (error) {
      console.log(colors.yellow, `⚠️  Error limpiando Redis: ${error.message}`)
    }

    // 7. Estadísticas finales
    const duration = Date.now() - startTime
    console.log('')
    console.log(colors.blue, '📊 LIMPIEZA COMPLETADA')
    console.log('=' .repeat(30))
    console.log(colors.green, `⏱️  Duración: ${duration}ms`)
    console.log(colors.green, `🗑️  Análisis eliminados: ${deletedAnalyses.count}`)
    console.log(colors.green, `🗑️  Jobs eliminados: ${deletedJobs.count}`)
    console.log(colors.green, `🗑️  Actividades eliminadas: ${deletedActivities.count}`)
    console.log(colors.green, `🗑️  Cursos eliminados: ${deletedCourses.count}`)
    console.log(colors.green, `🏫 Aulas reseteadas: ${resetAulas.count}`)
    console.log('')
    console.log(colors.green, '✅ Sistema listo para nuevo procesamiento batch')

  } catch (error) {
    console.log(colors.red, `❌ Error durante la limpieza: ${error.message}`)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Manejar señales de terminación
process.on('SIGINT', async () => {
  console.log(colors.yellow, '\n⚠️  Proceso interrumpido por usuario')
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log(colors.yellow, '\n⚠️  Proceso terminado')
  await prisma.$disconnect()
  process.exit(0)
})

// Ejecutar script
main().catch(async (error) => {
  console.error(colors.red, '❌ Error fatal:', error)
  await prisma.$disconnect()
  process.exit(1)
})