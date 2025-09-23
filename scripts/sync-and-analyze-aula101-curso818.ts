#!/usr/bin/env npx tsx
/**
 * Script completo para:
 * 1. Sincronizar/recolectar actividades del aula 101, curso 818
 * 2. Analizar esas actividades con los nuevos prompts
 */

import { MoodleSyncService } from '@/lib/services/moodle-sync-service'
import { BatchAnalysisService } from '@/lib/services/batch-analysis-service'

async function main() {
  console.log('🎯 Proceso completo: Sincronización + Análisis')
  console.log('📍 Aula: 101')
  console.log('📚 Curso: 818')
  console.log('=' * 60)

  try {
    // PASO 1: Sincronizar datos del aula 101
    console.log('\n📡 PASO 1: Sincronizando datos del aula 101...')
    const syncService = new MoodleSyncService()
    const syncResult = await syncService.syncAulaData('101')

    if (!syncResult.success) {
      console.error('❌ Error en sincronización:', syncResult.message)
      process.exit(1)
    }

    console.log('✅ Sincronización completada:')
    console.log(`   - Cursos procesados: ${syncResult.coursesProcessed || 0}`)
    console.log(`   - Actividades procesadas: ${syncResult.activitiesProcessed || 0}`)

    // PASO 2: Analizar actividades específicas del curso 818
    console.log('\n🧠 PASO 2: Analizando actividades del curso 818...')
    const batchService = BatchAnalysisService.getInstance()

    const analysisResult = await batchService.analyzeSpecificActivities({
      aulaId: '101',
      courseId: '818',
      forceReAnalysis: true // Usar los nuevos prompts
    })

    console.log('\n✅ ========== PROCESO COMPLETADO ==========')
    console.log('📊 Resumen final:')
    console.log('📡 Sincronización:')
    console.log(`   - Cursos sincronizados: ${syncResult.coursesProcessed || 0}`)
    console.log(`   - Actividades sincronizadas: ${syncResult.activitiesProcessed || 0}`)
    console.log('🧠 Análisis:')
    console.log(`   - Actividades analizadas: ${analysisResult.processedActivities || 0}`)
    console.log(`   - Nuevos análisis generados: ${analysisResult.generatedAnalyses || 0}`)
    console.log(`   - Errores: ${analysisResult.errors?.length || 0}`)

    if (analysisResult.errors && analysisResult.errors.length > 0) {
      console.log('\n❌ Errores en análisis:')
      analysisResult.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`)
      })
    }

    console.log('\n🎉 ¡Proceso completado exitosamente!')
    console.log('📱 Puedes revisar los análisis en el dashboard')
    console.log('================================================')

  } catch (error) {
    console.error('❌ Error ejecutando el proceso completo:', error)
    process.exit(1)
  }
}

main().catch(console.error)