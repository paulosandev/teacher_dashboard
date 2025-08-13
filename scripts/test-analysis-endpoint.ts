#!/usr/bin/env npx tsx

/**
 * Script para probar el nuevo endpoint GET /api/analysis
 */

import { prisma } from '../lib/db/prisma'

async function testAnalysisEndpoint() {
  console.log('🧪 PRUEBA: Endpoint GET /api/analysis')
  console.log('========================================')
  
  try {
    // 1. Verificar datos en BD directamente
    console.log('📊 Paso 1: Verificando análisis en BD...')
    
    const user = await prisma.user.findUnique({
      where: { matricula: 'cesar.espindola' }
    })
    
    if (!user) {
      console.log('❌ Usuario no encontrado')
      return
    }
    
    console.log(`✅ Usuario encontrado: ${user.name} (${user.email})`)
    
    const analysisInDB = await prisma.analysisResult.findMany({
      where: {
        userId: user.id,
        isLatest: true
      },
      include: {
        group: {
          include: {
            course: true
          }
        }
      },
      orderBy: {
        processedAt: 'desc'
      },
      take: 5
    })
    
    console.log(`📈 Análisis en BD: ${analysisInDB.length}`)
    
    analysisInDB.forEach((analysis, index) => {
      const course = analysis.group?.course
      const group = analysis.group
      
      console.log(`\n[${index + 1}] ${analysis.id}`)
      console.log(`   Tipo: ${analysis.analysisType}`)
      console.log(`   Curso Local: ${course?.id || 'N/A'} (${course?.name || 'Sin nombre'})`)
      console.log(`   Moodle Curso ID: ${course?.moodleCourseId || 'N/A'}`)
      console.log(`   Grupo Local: ${group?.id || 'N/A'} (${group?.name || 'Sin nombre'})`) 
      console.log(`   Moodle Grupo ID: ${group?.moodleGroupId || 'N/A'}`)
      console.log(`   Fecha: ${analysis.processedAt.toISOString()}`)
    })
    
    // 2. Probar endpoint HTTP (sin autenticación, esperamos error 401)
    console.log('\n🌐 Paso 2: Probando endpoint HTTP...')
    
    try {
      const response = await fetch('http://localhost:3000/api/analysis')
      const result = await response.json()
      
      console.log('Status:', response.status)
      console.log('Response:', JSON.stringify(result, null, 2))
      
      if (response.status === 401) {
        console.log('✅ Endpoint responde correctamente (requiere autenticación)')
      } else if (response.ok) {
        console.log('🎉 Endpoint funcionando y devuelve datos!')
        console.log(`📊 Análisis devueltos: ${Array.isArray(result) ? result.length : 'N/A'}`)
      } else {
        console.log('⚠️ Respuesta inesperada del endpoint')
      }
    } catch (error) {
      console.log('❌ Error conectando al endpoint:', error)
    }
    
    // 3. Verificar mapeo de IDs para debug
    console.log('\n🔄 Paso 3: Verificando mapeo de IDs...')
    
    const coursesWithMapping = await prisma.course.findMany({
      where: { userId: user.id },
      include: {
        groups: true
      }
    })
    
    console.log(`📚 Cursos locales: ${coursesWithMapping.length}`)
    
    coursesWithMapping.forEach(course => {
      console.log(`\n📖 ${course.name}`)
      console.log(`   Local ID: ${course.id}`)
      console.log(`   Moodle ID: ${course.moodleCourseId}`)
      console.log(`   Grupos: ${course.groups.length}`)
      
      course.groups.forEach(group => {
        console.log(`     - ${group.name} (Local: ${group.id}, Moodle: ${group.moodleGroupId})`)
      })
    })
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testAnalysisEndpoint()
    .then(() => {
      console.log('\n🏁 Prueba completada')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Error crítico:', error)
      process.exit(1)
    })
}

export { testAnalysisEndpoint }
