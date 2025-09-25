#!/usr/bin/env node

/**
 * Script para forzar re-análisis de actividades con análisis antiguos
 * USO: node scripts/force-reanalysis.js [--all | --before-date YYYY-MM-DD]
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const colors = {
  red: '\x1b[31m%s\x1b[0m',
  green: '\x1b[32m%s\x1b[0m',
  yellow: '\x1b[33m%s\x1b[0m',
  blue: '\x1b[34m%s\x1b[0m',
}

async function main() {
  const args = process.argv.slice(2)
  const forceAll = args.includes('--all')
  const beforeDateIndex = args.indexOf('--before-date')
  const beforeDate = beforeDateIndex > -1 ? args[beforeDateIndex + 1] : '2024-11-26'

  console.log(colors.blue, '🔄 FORZAR RE-ANÁLISIS DE ACTIVIDADES')
  console.log('=' .repeat(40))

  try {
    if (forceAll) {
      console.log(colors.yellow, '⚠️  Modo: TODAS las actividades')

      // Marcar TODAS las actividades para re-análisis
      const updated = await prisma.courseActivity.updateMany({
        data: {
          needsAnalysis: true
        }
      })

      console.log(colors.green, `✅ Marcadas ${updated.count} actividades para re-análisis`)

    } else {
      console.log(colors.yellow, `📅 Modo: Análisis anteriores a ${beforeDate}`)

      // Encontrar actividades con análisis antiguos
      const oldAnalyses = await prisma.activityAnalysis.findMany({
        where: {
          generatedAt: {
            lt: new Date(beforeDate)
          }
        },
        select: {
          activityId: true
        },
        distinct: ['activityId']
      })

      const activityIds = oldAnalyses.map(a => a.activityId)

      console.log(colors.blue, `📊 Encontradas ${activityIds.length} actividades con análisis antiguos`)

      if (activityIds.length > 0) {
        // Marcar estas actividades para re-análisis
        const updated = await prisma.courseActivity.updateMany({
          where: {
            id: {
              in: activityIds
            }
          },
          data: {
            needsAnalysis: true
          }
        })

        console.log(colors.green, `✅ Marcadas ${updated.count} actividades para re-análisis`)

        // Opcional: Eliminar análisis antiguos
        console.log(colors.yellow, '🗑️  Eliminando análisis antiguos...')
        const deleted = await prisma.activityAnalysis.deleteMany({
          where: {
            activityId: {
              in: activityIds
            },
            generatedAt: {
              lt: new Date(beforeDate)
            }
          }
        })

        console.log(colors.green, `✅ Eliminados ${deleted.count} análisis antiguos`)
      }
    }

    // Mostrar estadísticas
    const stats = await prisma.courseActivity.aggregate({
      _count: {
        _all: true,
        needsAnalysis: true
      },
      where: {
        needsAnalysis: true
      }
    })

    console.log('')
    console.log(colors.blue, '📊 ESTADÍSTICAS:')
    console.log(colors.green, `   Total actividades: ${await prisma.courseActivity.count()}`)
    console.log(colors.green, `   Pendientes de análisis: ${stats._count._all}`)
    console.log('')
    console.log(colors.green, '✅ Listo para ejecutar el cron')
    console.log(colors.yellow, '💡 Ejecuta: npm run batch:run')

  } catch (error) {
    console.error(colors.red, '❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(colors.red, '❌ Error fatal:', error)
  process.exit(1)
})