import { prisma } from '../lib/db/prisma'

async function verifyDBStatus() {
  console.log('🔍 VERIFICANDO ESTADO ACTUAL DE LA BASE DE DATOS')
  console.log('=' .repeat(60))
  
  try {
    // Verificar análisis principales
    const analysisResults = await prisma.analysisResult.findMany({
      select: {
        id: true,
        analysisType: true,
        processedAt: true,
        isLatest: true,
        llmResponse: true,
        course: {
          select: {
            name: true,
            moodleCourseId: true
          }
        }
      },
      orderBy: {
        processedAt: 'desc'
      }
    })

    console.log(`📊 Análisis en base de datos: ${analysisResults.length}`)
    
    if (analysisResults.length > 0) {
      console.log('\n📋 ANÁLISIS ENCONTRADOS:')
      analysisResults.forEach((analysis, index) => {
        const hasNewFields = analysis.llmResponse && 
                            (analysis.llmResponse.metricsTable || analysis.llmResponse.structuredInsights)
        
        console.log(`${index + 1}. ID: ${analysis.id}`)
        console.log(`   Tipo: ${analysis.analysisType}`)
        console.log(`   Curso: ${analysis.course?.name || 'Sin nombre'}`)
        console.log(`   Fecha: ${analysis.processedAt.toLocaleDateString()}`)
        console.log(`   Es último: ${analysis.isLatest}`)
        console.log(`   Tiene campos nuevos: ${hasNewFields ? '✅ SÍ' : '❌ NO'}`)
        
        if (hasNewFields) {
          const response = analysis.llmResponse as any
          console.log(`   - metricsTable: ${response.metricsTable ? '✅' : '❌'}`)
          console.log(`   - structuredInsights: ${response.structuredInsights ? '✅' : '❌'}`)
        }
        console.log('')
      })
    } else {
      console.log('✅ No hay análisis en la base de datos - LIMPIA')
    }

    // Verificar análisis de actividades
    const activityAnalysis = await prisma.activityAnalysis.count()
    console.log(`📝 Análisis de actividades: ${activityAnalysis}`)

    // Verificar jobs
    const jobLogs = await prisma.jobLog.count()
    console.log(`🔧 Logs de trabajos: ${jobLogs}`)

    // Verificar cursos
    const courses = await prisma.course.count()
    console.log(`🏫 Cursos registrados: ${courses}`)

    console.log('\n' + '=' .repeat(60))
    if (analysisResults.length === 0) {
      console.log('🎉 BASE DE DATOS COMPLETAMENTE LIMPIA')
      console.log('🚀 Lista para generar análisis con componentes mejorados')
    } else {
      console.log('⚠️ HAY ANÁLISIS EXISTENTES - Podrían estar interfiriendo')
      console.log('💡 Considera eliminarlos si quieres empezar limpio')
    }

  } catch (error) {
    console.error('❌ Error verificando base de datos:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyDBStatus()