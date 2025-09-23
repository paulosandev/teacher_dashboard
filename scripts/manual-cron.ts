#!/usr/bin/env npx tsx
/**
 * Script para ejecutar manualmente el cron y monitorear su progreso
 */

async function triggerCron() {
  console.log('🚀 Ejecutando análisis masivo manualmente...')

  try {
    const response = await fetch('http://localhost:3000/api/cron', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'trigger' })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Análisis iniciado correctamente')
      console.log('📊 Resultado:', result)
    } else {
      console.log('❌ Error:', result)
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error)
  }
}

async function checkStatus() {
  try {
    const response = await fetch('http://localhost:3000/api/cron?action=status')
    const result = await response.json()

    console.log('📊 Estado del cron:')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('❌ Error obteniendo estado:', error)
  }
}

async function checkLogs() {
  try {
    const response = await fetch('http://localhost:3000/api/cron?action=logs')
    const result = await response.json()

    console.log('📋 Logs del cron:')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('❌ Error obteniendo logs:', error)
  }
}

async function getNextScheduled() {
  try {
    const response = await fetch('http://localhost:3000/api/cron?action=next')
    const result = await response.json()

    console.log('⏰ Próxima ejecución programada:')
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('❌ Error obteniendo próxima ejecución:', error)
  }
}

async function clearCache() {
  console.log('🧹 Limpiando caché para mostrar nuevos análisis...')

  try {
    const response = await fetch('http://localhost:3000/api/cron', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'clear-cache' })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Caché limpiado exitosamente')
      console.log('📊 Resultado:', result)
    } else {
      console.log('❌ Error:', result)
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error)
  }
}

async function testAula101(courseId?: string) {
  const courseFilter = courseId ? ` curso ${courseId}` : ''
  console.log(`🎯 Ejecutando análisis SOLO para Aula 101${courseFilter}...`)

  try {
    const bodyData: any = { action: 'test-aula-101' }
    if (courseId) {
      bodyData.courseId = courseId
    }

    const response = await fetch('http://localhost:3000/api/cron', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyData)
    })

    const result = await response.json()

    if (response.ok) {
      console.log(`✅ Análisis de Aula 101${courseFilter} completado`)
      console.log('📊 Resultado:', result)
    } else {
      console.log('❌ Error:', result)
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error)
  }
}

async function main() {
  const action = process.argv[2]

  switch (action) {
    case 'trigger':
      await triggerCron()
      break
    case 'test-101':
    case 'aula-101':
      const courseId = process.argv[3] // Permitir curso como tercer argumento
      await testAula101(courseId)
      break
    case 'status':
      await checkStatus()
      break
    case 'logs':
      await checkLogs()
      break
    case 'next':
      await getNextScheduled()
      break
    case 'clear-cache':
    case 'clear':
      await clearCache()
      break
    case 'monitor':
      console.log('🔄 Monitoreando progreso cada 5 segundos...')
      console.log('Presiona Ctrl+C para detener\n')

      setInterval(async () => {
        console.log(`--- ${new Date().toLocaleTimeString('es-ES')} ---`)
        await checkStatus()
        console.log('')
      }, 5000)
      break
    default:
      console.log('📖 Uso del script:')
      console.log('  npx tsx scripts/manual-cron.ts trigger         # Ejecutar análisis manualmente (todas las aulas)')
      console.log('  npx tsx scripts/manual-cron.ts test-101        # Ejecutar análisis SOLO para Aula 101')
      console.log('  npx tsx scripts/manual-cron.ts test-101 818    # Ejecutar análisis SOLO para Aula 101 curso 818')
      console.log('  npx tsx scripts/manual-cron.ts clear-cache     # Limpiar caché para mostrar nuevos análisis')
      console.log('  npx tsx scripts/manual-cron.ts status          # Ver estado actual')
      console.log('  npx tsx scripts/manual-cron.ts logs            # Ver logs recientes')
      console.log('  npx tsx scripts/manual-cron.ts next            # Ver próxima ejecución')
      console.log('  npx tsx scripts/manual-cron.ts monitor         # Monitorear progreso en tiempo real')
  }
}

main().catch(console.error)