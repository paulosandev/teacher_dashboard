#!/usr/bin/env npx tsx
/**
 * Script para simular exactamente lo que recibe el frontend
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Simulando estructura que recibe el frontend')

  try {
    // Simular la función getPreCalculatedAnalysis del API
    const analysis = await prisma.activityAnalysis.findFirst({
      where: {
        courseId: '101-818',
        activityId: '5055',
        activityType: 'forum'
      },
      orderBy: {
        lastUpdated: 'desc'
      }
    })

    if (analysis) {
      // Estructura que devuelve la API (líneas 698-706 en route.ts)
      const apiResponse = {
        summary: analysis.summary,
        insights: analysis.insights,
        recommendations: analysis.positives,
        alerts: analysis.alerts,
        fullAnalysis: analysis.fullAnalysis,
        lastUpdated: analysis.lastUpdated,
        analysisId: analysis.id
      }

      console.log('📊 Estructura que devuelve la API:')
      console.log('- summary:', !!apiResponse.summary)
      console.log('- fullAnalysis:', !!apiResponse.fullAnalysis)
      console.log('- lastUpdated:', apiResponse.lastUpdated)
      console.log('- lastUpdated type:', typeof apiResponse.lastUpdated)
      console.log('- lastUpdated string:', apiResponse.lastUpdated?.toString())

      // Simular lo que recibe el frontend
      const rawAnalysis = {
        name: 'Foro 2',
        analysis: apiResponse
      }

      console.log('\n🖥️ Lo que ve el frontend:')
      console.log('- rawAnalysis.analysis?.lastUpdated:', rawAnalysis.analysis?.lastUpdated)
      console.log('- Type:', typeof rawAnalysis.analysis?.lastUpdated)

      // Probar la conversión de fecha
      if (rawAnalysis.analysis?.lastUpdated) {
        try {
          const date = new Date(rawAnalysis.analysis.lastUpdated)
          console.log('- new Date():', date)
          console.log('- toLocaleDateString():', date.toLocaleDateString('es-ES'))
          console.log('- toLocaleTimeString():', date.toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}))
        } catch (error) {
          console.log('❌ Error convirtiendo fecha:', error)
        }
      } else {
        console.log('❌ lastUpdated es undefined/null')
      }

    } else {
      console.log('❌ No se encontró análisis')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)