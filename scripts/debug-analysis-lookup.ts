#!/usr/bin/env npx tsx
/**
 * Script para debuggar qué análisis se está usando
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Debuggeando análisis que se usa para Foro 2...')

  try {
    // Verificar qué análisis se está buscando con la query exacta que usa el dashboard
    const analyses = await prisma.activityAnalysis.findMany({
      where: {
        courseId: '101-818',
        activityId: '5055',
        activityType: 'forum'
      },
      orderBy: {
        generatedAt: 'desc'
      }
    })

    console.log(`📊 Total de análisis encontrados: ${analyses.length}`)

    analyses.forEach((analysis, index) => {
      console.log(`\n--- ANÁLISIS ${index + 1} ---`)
      console.log(`ID: ${analysis.id}`)
      console.log(`Activity Name: ${analysis.activityName}`)
      console.log(`Generated At: ${analysis.generatedAt}`)
      console.log(`Has Summary: ${!!analysis.summary} (${analysis.summary?.length || 0} chars)`)
      console.log(`Has FullAnalysis: ${!!analysis.fullAnalysis} (${analysis.fullAnalysis?.length || 0} chars)`)

      if (analysis.summary) {
        console.log(`Summary start: "${analysis.summary.substring(0, 100)}..."`)
      }

      if (analysis.fullAnalysis) {
        console.log(`FullAnalysis start: "${analysis.fullAnalysis.substring(0, 100)}..."`)

        // Check if it has the correct 5 dimensions
        const hasCorrectDimensions = [
          '#### Nivel de participación',
          '#### Calidad académica de las aportaciones',
          '#### Cumplimiento de la consigna',
          '#### Uso de referencias y fundamentación teórica',
          '#### Dinámica de interacción entre compañeros'
        ].every(dim => analysis.fullAnalysis?.includes(dim))

        console.log(`✅ Has correct 5 dimensions: ${hasCorrectDimensions}`)
      }
    })

    console.log('\n🎯 El dashboard debería usar el PRIMER análisis de esta lista')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)