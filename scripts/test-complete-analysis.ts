// Test completo del sistema de análisis inteligente
import { NextRequest } from 'next/server'

async function testCompleteAnalysis() {
  console.log('🚀 Iniciando test completo del sistema de análisis inteligente')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    // Datos de prueba (simulando lo que enviaría el frontend)
    const testData = {
      courseId: '161', // Curso que sabemos que funciona
      groupId: '1926', // Grupo "Actividades" 
      userMatricula: 'cesar.espindola' // Usuario con token funcionando
    }
    
    console.log('📊 Datos de prueba:')
    console.log(`   Curso: ${testData.courseId}`)
    console.log(`   Grupo: ${testData.groupId}`)
    console.log(`   Usuario: ${testData.userMatricula}`)
    
    // Crear una solicitud simulada
    const requestBody = JSON.stringify(testData)
    
    console.log('\n🔥 Enviando solicitud al endpoint de análisis...')
    
    // Hacer la solicitud al endpoint
    const response = await fetch('http://localhost:3000/api/analysis/generate-intelligent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Simular cookies de sesión (en un test real estas vendrían automáticamente)
        'Cookie': 'next-auth.session-token=test-session'
      },
      body: requestBody
    })
    
    console.log(`📡 Respuesta del servidor: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ Error en la respuesta:', errorText)
      return
    }
    
    const result = await response.json()
    
    console.log('\n✅ ANÁLISIS COMPLETADO EXITOSAMENTE!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Mostrar resultados principales
    if (result.success) {
      console.log('🎯 RESULTADOS DEL ANÁLISIS:')
      console.log('')
      
      if (result.analysis) {
        const analysis = result.analysis.llmResponse || result.analysis
        
        console.log('💪 FORTALEZAS:')
        analysis.strengths?.forEach((strength: string, index: number) => {
          console.log(`   ${index + 1}. ${strength}`)
        })
        
        console.log('\n🚨 ALERTAS:')
        analysis.alerts?.forEach((alert: string, index: number) => {
          console.log(`   ${index + 1}. ${alert}`)
        })
        
        console.log(`\n⚠️  ESTUDIANTES EN RIESGO: ${analysis.studentsAtRisk}`)
        
        console.log('\n📋 RECOMENDACIONES:')
        analysis.recommendations?.forEach((rec: string, index: number) => {
          console.log(`   ${index + 1}. ${rec}`)
        })
        
        console.log(`\n🎯 PRÓXIMO PASO: ${analysis.nextStep}`)
        console.log(`🏥 SALUD GENERAL: ${analysis.overallHealth?.toUpperCase()}`)
      }
      
      // Mostrar métricas técnicas
      if (result.details) {
        console.log('\n📊 MÉTRICAS TÉCNICAS:')
        console.log(`   Tiempo de procesamiento: ${result.details.processingTime}ms`)
        console.log(`   Tokens utilizados: ${result.details.tokensUsed}`)
        console.log(`   Modelo: ${result.details.model}`)
        console.log(`   Costo: $${result.details.cost?.toFixed(4)} USD`)
        console.log(`   PDF generado: ${result.details.pdfGenerated ? '✅ Sí' : '❌ No'}`)
      }
      
    } else {
      console.log('❌ Error en el análisis:', result.error)
      console.log('📋 Detalles:', result.details)
    }
    
    console.log('\n🎉 Test completo finalizado!')
    
  } catch (error) {
    console.error('❌ Error durante el test:', error)
    console.log('\n💡 Posibles causas:')
    console.log('   1. El servidor de desarrollo no está ejecutándose (npm run dev)')
    console.log('   2. Problemas de autenticación/sesión')
    console.log('   3. Variables de entorno faltantes')
    console.log('   4. Base de datos no conectada')
  }
}

// Función alternativa: test directo de la lógica sin HTTP
async function testAnalysisLogicDirectly() {
  console.log('\n🔧 ALTERNATIVA: Test directo de la lógica de análisis')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    // Importar y ejecutar la lógica directamente
    const { createSmartMoodleClient } = await import('../lib/moodle/smart-client')
    
    const smartClient = createSmartMoodleClient('test-user', 'cesar.espindola')
    
    console.log('🔗 Testing conexión...')
    const connected = await smartClient.testConnection()
    console.log(`   Conexión: ${connected ? '✅ OK' : '❌ Error'}`)
    
    if (connected) {
      console.log('\n📚 Testing obtención de cursos...')
      const courses = await smartClient.getTeacherCourses()
      console.log(`   Cursos encontrados: ${courses?.length || 0}`)
      
      console.log('\n👥 Testing getGroupMembers...')
      const members = await smartClient.getGroupMembers('1926', '161')
      console.log(`   Miembros encontrados: ${members?.length || 0}`)
      
      if (members && members.length > 0) {
        console.log('✅ Sistema completamente funcional para análisis!')
      }
    }
    
  } catch (error) {
    console.error('❌ Error en test directo:', error)
  }
}

// Ejecutar ambos tests
console.log('🧪 SUITE DE TESTS COMPLETA')
console.log('═══════════════════════════════════════════════════════════════════')

testCompleteAnalysis()
  .then(() => testAnalysisLogicDirectly())
  .catch(console.error)