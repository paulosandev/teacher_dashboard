// Script para probar el endpoint real de actividades
import * as dotenv from 'dotenv'
dotenv.config()

async function testRealEndpoint() {
  console.log('🌐 PROBANDO ENDPOINT REAL DE ACTIVIDADES')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  try {
    // Simular una petición al endpoint
    const response = await fetch('http://localhost:3000/api/activities/open?courseId=232', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Aquí en el navegador se incluirían automáticamente las cookies de sesión
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Respuesta exitosa del endpoint')
      console.log('📊 Resumen:', data.summary)
      console.log(`🎯 Total de actividades: ${data.activities?.length || 0}`)
      
      if (data.activities && data.activities.length > 0) {
        console.log('\n📋 PRIMERAS 5 ACTIVIDADES:')
        data.activities.slice(0, 5).forEach((activity: any, index: number) => {
          console.log(`${index + 1}. [${activity.type.toUpperCase()}] ${activity.name}`)
          console.log(`   Estado: ${activity.status}`)
          if (activity.url) {
            console.log(`   URL: ${activity.url}`)
          }
          console.log('')
        })
      }
    } else {
      console.log('❌ Error en la respuesta:', response.status, response.statusText)
      const errorText = await response.text()
      console.log('Detalles:', errorText)
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
  }
}

testRealEndpoint().catch(console.error)