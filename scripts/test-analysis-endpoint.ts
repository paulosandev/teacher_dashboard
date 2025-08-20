/**
 * Script para probar el endpoint de análisis
 */

async function testAnalysisEndpoint() {
  console.log('🔍 Probando endpoint de análisis...')
  
  const url = 'http://localhost:3001/api/analysis/activity'
  
  // Datos de prueba que simularían lo que envía el frontend
  const testData = {
    activityId: 1479, // Foro 1
    activityType: 'forum',
    activityData: {
      id: 1479,
      name: "Espacio Testing", // Esto debería ser el nombre que se muestra
      type: 'forum',
      intro: '',
      courseid: 229,
      groupId: "2267",
      forumDetails: {
        numdiscussions: 1,
        totalPosts: 3,
        uniqueParticipants: 3,
        discussions: [
          {
            id: 43115,
            name: "Espacio Testing",
            groupid: 2267,
            numreplies: 2
          }
        ]
      }
    },
    includeDetailedInfo: true
  }
  
  console.log(`📡 Llamando: ${url}`)
  console.log(`📋 Datos de prueba:`, JSON.stringify(testData, null, 2))
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Simular una sesión básica - en producción esto vendría de NextAuth
        'Cookie': 'next-auth.session-token=test'
      },
      body: JSON.stringify(testData)
    })
    
    const responseText = await response.text()
    console.log(`📊 Status: ${response.status}`)
    console.log(`📄 Response: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`)
    
    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status}`)
      return
    }
    
    try {
      const data = JSON.parse(responseText)
      
      if (data.success) {
        console.log('✅ Análisis exitoso')
        console.log(`📊 Resumen: ${data.analysis?.summary?.substring(0, 100)}...`)
        console.log(`💡 Recomendación: ${data.analysis?.recommendation?.substring(0, 100)}...`)
        console.log(`🎯 Insights: ${data.analysis?.insights?.length || 0} insights`)
        console.log(`⚠️ Alertas: ${data.analysis?.alerts?.length || 0} alertas`)
      } else {
        console.log('❌ Error en el análisis:', data.error)
      }
    } catch (parseError) {
      console.error('❌ Error parsing JSON:', parseError)
    }
    
  } catch (error) {
    console.error('❌ Error llamando al endpoint:', error)
  }
}

if (require.main === module) {
  testAnalysisEndpoint().catch(console.error)
}

export { testAnalysisEndpoint }