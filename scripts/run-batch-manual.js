#!/usr/bin/env node

/**
 * Script para ejecutar cron batch manualmente en producción
 * Procesa todas las aulas con prioridad para aula 101
 *
 * USO: node scripts/run-batch-manual.js [--aula101-only] [--force]
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
  magenta: '\x1b[35m%s\x1b[0m',
  cyan: '\x1b[36m%s\x1b[0m',
  reset: '\x1b[0m'
}

// URL base para llamar al endpoint del cron
const API_BASE_URL = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000'

async function main() {
  const args = process.argv.slice(2)
  const aula101Only = args.includes('--aula101-only')
  const force = args.includes('--force')

  console.log(colors.cyan, '🚀 EJECUCIÓN MANUAL DEL CRON BATCH - PRODUCCIÓN')
  console.log('=' .repeat(55))

  if (aula101Only) {
    console.log(colors.yellow, '🎯 MODO: Solo Aula 101')
  } else {
    console.log(colors.blue, '🌐 MODO: Todas las aulas (prioridad Aula 101)')
  }

  const startTime = Date.now()

  try {
    // 1. Verificar si hay jobs ejecutándose
    if (!force) {
      console.log(colors.yellow, '🔍 Verificando jobs activos...')
      const runningJob = await prisma.batchJob.findFirst({
        where: { status: 'RUNNING' },
        orderBy: { startedAt: 'desc' }
      })

      if (runningJob) {
        const runningDuration = Date.now() - (runningJob.startedAt?.getTime() || 0)
        console.log(colors.red, `⚠️  Hay un job ejecutándose (ID: ${runningJob.id})`)
        console.log(colors.yellow, `   Duración actual: ${Math.round(runningDuration / 1000)}s`)
        console.log(colors.yellow, '   Use --force para ejecutar de todos modos')
        process.exit(1)
      }
    }

    // 2. Ejecutar proceso específico según modo
    if (aula101Only) {
      await executeAula101Only()
    } else {
      await executeAllAulasWithPriority()
    }

    const totalDuration = Date.now() - startTime
    console.log('')
    console.log(colors.green, '✅ PROCESO BATCH COMPLETADO EXITOSAMENTE')
    console.log(colors.cyan, `⏱️  Duración total: ${Math.round(totalDuration / 1000)}s`)

  } catch (error) {
    console.log(colors.red, `❌ Error durante ejecución: ${error.message}`)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Ejecutar solo Aula 101
 */
async function executeAula101Only() {
  console.log(colors.magenta, '🎯 Ejecutando análisis SOLO para Aula 101...')

  try {
    // Importar el servicio de análisis batch
    const { batchAnalysisService } = require('../lib/services/batch-analysis-service')

    // Ejecutar análisis específico para Aula 101
    const result = await batchAnalysisService.processAula101Only()

    console.log(colors.green, '📊 RESULTADOS AULA 101:')
    console.log(colors.cyan, `   Actividades procesadas: ${result.processedActivities}`)
    console.log(colors.cyan, `   Análisis generados: ${result.generatedAnalyses}`)
    console.log(colors.cyan, `   Errores: ${result.errors.length}`)
    console.log(colors.cyan, `   Duración: ${Math.round(result.duration / 1000)}s`)

    if (result.errors.length > 0) {
      console.log(colors.yellow, '⚠️  Errores encontrados:')
      result.errors.slice(0, 3).forEach(error => {
        console.log(colors.yellow, `   • ${error}`)
      })
      if (result.errors.length > 3) {
        console.log(colors.yellow, `   ... y ${result.errors.length - 3} errores más`)
      }
    }

  } catch (error) {
    throw new Error(`Error en análisis Aula 101: ${error.message}`)
  }
}

/**
 * Ejecutar todas las aulas con prioridad 101
 */
async function executeAllAulasWithPriority() {
  console.log(colors.blue, '🌐 Ejecutando batch completo con prioridad Aula 101...')

  try {
    // 1. Primero ejecutar Aula 101
    console.log(colors.magenta, '🎯 PASO 1: Procesando Aula 101 (PRIORIDAD)...')
    const { batchAnalysisService } = require('../lib/services/batch-analysis-service')

    const aula101Result = await batchAnalysisService.processAula101Only()

    console.log(colors.green, '✅ Aula 101 completada:')
    console.log(colors.cyan, `   • ${aula101Result.generatedAnalyses}/${aula101Result.processedActivities} análisis`)
    console.log(colors.cyan, `   • ${aula101Result.errors.length} errores`)
    console.log(colors.cyan, `   • ${Math.round(aula101Result.duration / 1000)}s`)

    // 2. Luego ejecutar el cron completo
    console.log('')
    console.log(colors.blue, '🌐 PASO 2: Ejecutando cron completo (todas las aulas)...')

    // Llamar al endpoint del cron
    const response = await fetch(`${API_BASE_URL}/api/cron/batch-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Manual-Batch-Script/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`)
    }

    const cronResult = await response.json()

    if (cronResult.success && cronResult.executed) {
      console.log(colors.green, '✅ Cron completo ejecutado:')
      console.log(colors.cyan, `   • Job ID: ${cronResult.jobId}`)
      console.log(colors.cyan, `   • Aulas: ${cronResult.results?.aulas || 'N/A'}`)
      console.log(colors.cyan, `   • Cursos: ${cronResult.results?.courses || 'N/A'}`)
      console.log(colors.cyan, `   • Actividades: ${cronResult.results?.activities || 'N/A'}`)
      console.log(colors.cyan, `   • Análisis: ${cronResult.results?.analyses || 'N/A'}`)
      console.log(colors.cyan, `   • Duración: ${Math.round((cronResult.duration || 0) / 1000)}s`)
    } else {
      console.log(colors.yellow, '⚠️  Cron no se ejecutó:')
      console.log(colors.yellow, `   Motivo: ${cronResult.message || 'Razón desconocida'}`)
    }

  } catch (error) {
    throw new Error(`Error en batch completo: ${error.message}`)
  }
}

/**
 * Mostrar estadísticas finales
 */
async function showFinalStats() {
  console.log('')
  console.log(colors.blue, '📊 ESTADÍSTICAS FINALES')
  console.log('-' .repeat(25))

  try {
    // Estadísticas de análisis
    const totalAnalyses = await prisma.activityAnalysis.count()
    const recentAnalyses = await prisma.activityAnalysis.count({
      where: {
        generatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })

    // Estadísticas por aula
    const analysesByAula = await prisma.activityAnalysis.findMany({
      select: { courseId: true }
    })

    const aulaStats = {}
    analysesByAula.forEach(analysis => {
      if (analysis.courseId) {
        const aulaId = analysis.courseId.split('-')[0]
        aulaStats[aulaId] = (aulaStats[aulaId] || 0) + 1
      }
    })

    console.log(colors.green, `📈 Total de análisis: ${totalAnalyses}`)
    console.log(colors.green, `🕐 Análisis últimas 24h: ${recentAnalyses}`)
    console.log(colors.green, '🏫 Por aula:')

    Object.entries(aulaStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([aula, count]) => {
        const highlight = aula === '101' ? colors.magenta : colors.cyan
        console.log(highlight, `   • Aula ${aula}: ${count} análisis`)
      })

  } catch (error) {
    console.log(colors.yellow, `⚠️  Error obteniendo estadísticas: ${error.message}`)
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
main()
  .then(() => showFinalStats())
  .catch(async (error) => {
    console.error(colors.red, '❌ Error fatal:', error)
    await prisma.$disconnect()
    process.exit(1)
  })