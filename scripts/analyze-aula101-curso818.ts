#!/usr/bin/env npx tsx
/**
 * Script para recolectar y analizar específicamente las actividades
 * del aula 101, curso 818 usando el proceso original del cron
 */

import { BatchAnalysisService } from '@/lib/services/batch-analysis-service'

async function main() {
  console.log('🎯 Iniciando recolección y análisis específico...')
  console.log('📍 Aula: 101')
  console.log('📚 Curso: 818')
  console.log('=' * 50)

  const batchService = BatchAnalysisService.getInstance()

  try {
    // Usar el método específico que ya existe para analizar actividades específicas
    const result = await batchService.analyzeSpecificActivities({
      aulaId: '101',
      courseId: '818',
      forceReAnalysis: true // Forzar re-análisis para obtener los nuevos prompts
    })

    console.log('\n✅ ========== PROCESO COMPLETADO ==========')
    console.log('📊 Resultado del análisis:')
    console.log(`   - Actividades procesadas: ${result.processedActivities || 0}`)
    console.log(`   - Análisis generados: ${result.generatedAnalyses || 0}`)
    console.log(`   - Errores: ${result.errors?.length || 0}`)

    if (result.errors && result.errors.length > 0) {
      console.log('\n❌ Errores encontrados:')
      result.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`)
      })
    }

    console.log('================================================')

  } catch (error) {
    console.error('❌ Error ejecutando el análisis:', error)
    process.exit(1)
  }
}

main().catch(console.error)