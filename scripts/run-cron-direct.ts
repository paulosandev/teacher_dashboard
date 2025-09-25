#!/usr/bin/env npx tsx
/**
 * Script directo para ejecutar el cron sin autenticación
 */

import { batchAnalysisService } from '../lib/services/batch-analysis-service'

async function main() {
  const args = process.argv.slice(2)
  const action = args[0] || 'all'
  const courseId = args[1]

  console.log('🚀 Ejecutando análisis masivo directo...')

  try {
    let result

    switch (action) {
      case '101':
        // Si el primer argumento es 101, procesar solo aula 101
        console.log('🎯 Procesando SOLO Aula 101' + (courseId ? ` curso ${courseId}` : ''))
        result = await batchAnalysisService.processAula101Only(courseId)
        break

      case 'test-101':
        console.log('🎯 Procesando SOLO Aula 101' + (courseId ? ` curso ${courseId}` : ''))
        result = await batchAnalysisService.processAula101Only(courseId)
        break

      case 'test-818':
        console.log('🎯 Procesando SOLO Aula 101 curso 818')
        result = await batchAnalysisService.processAula101Only('818')
        break

      case 'all':
      default:
        console.log('📋 Procesando TODAS las aulas con filtros de fecha activos')
        result = await batchAnalysisService.processAllPendingAnalyses()
        break
    }

    console.log('\n📊 Resultados del análisis:')
    console.log(`✅ Éxito: ${result.success}`)
    console.log(`📋 Actividades procesadas: ${result.processedActivities}`)
    console.log(`🧠 Análisis generados: ${result.generatedAnalyses}`)
    console.log(`⏱️ Duración: ${(result.duration / 1000).toFixed(2)} segundos`)

    if (result.errors.length > 0) {
      console.log(`\n❌ Errores encontrados: ${result.errors.length}`)
      result.errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`)
      })
    } else {
      console.log('\n✨ Sin errores')
    }

    console.log('\n📈 Estadísticas:')
    const successRate = result.processedActivities > 0
      ? ((result.generatedAnalyses / result.processedActivities) * 100).toFixed(1)
      : '0'
    console.log(`- Tasa de éxito: ${successRate}%`)

    const avgSpeed = result.duration > 0
      ? (result.processedActivities / (result.duration / 1000 / 60)).toFixed(1)
      : '0'
    console.log(`- Velocidad promedio: ${avgSpeed} actividades/min`)

    console.log('\n✅ Análisis completado exitosamente')
    process.exit(0)

  } catch (error) {
    console.error('❌ Error ejecutando análisis:', error)
    process.exit(1)
  }
}

main().catch(console.error)