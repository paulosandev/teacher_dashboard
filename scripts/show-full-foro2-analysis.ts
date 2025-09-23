#!/usr/bin/env npx tsx
/**
 * Script para mostrar el análisis completo de Foro 2
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 Mostrando análisis completo de Foro 2...')

  try {
    const analysis = await prisma.activityAnalysis.findFirst({
      where: {
        courseId: '101-818',
        activityName: 'Foro 2'
      },
      orderBy: {
        generatedAt: 'desc'
      }
    })

    if (analysis) {
      console.log('=' * 80)
      console.log('ID:', analysis.id)
      console.log('Fecha:', analysis.generatedAt)
      console.log('=' * 80)
      console.log('\n📝 SUMMARY FIELD:')
      console.log('=' * 80)
      console.log(analysis.summary)
      console.log('=' * 80)
      console.log('\n📊 FULL ANALYSIS FIELD:')
      console.log('=' * 80)
      console.log(analysis.fullAnalysis || 'No full analysis')
      console.log('=' * 80)

      // Check which field has the 5 dimensions
      const hasCorrectSummary = analysis.summary?.includes('#### Nivel de participación') &&
                               analysis.summary?.includes('#### Calidad académica de las aportaciones') &&
                               analysis.summary?.includes('#### Cumplimiento de la consigna') &&
                               analysis.summary?.includes('#### Uso de referencias y fundamentación teórica') &&
                               analysis.summary?.includes('#### Dinámica de interacción entre compañeros')

      const hasCorrectFullAnalysis = analysis.fullAnalysis?.includes('#### Nivel de participación') &&
                                    analysis.fullAnalysis?.includes('#### Calidad académica de las aportaciones') &&
                                    analysis.fullAnalysis?.includes('#### Cumplimiento de la consigna') &&
                                    analysis.fullAnalysis?.includes('#### Uso de referencias y fundamentación teórica') &&
                                    analysis.fullAnalysis?.includes('#### Dinámica de interacción entre compañeros')

      console.log('\n🎯 ANÁLISIS:')
      console.log(`Summary tiene 5 dimensiones correctas: ${hasCorrectSummary ? '✅ SÍ' : '❌ NO'}`)
      console.log(`FullAnalysis tiene 5 dimensiones correctas: ${hasCorrectFullAnalysis ? '✅ SÍ' : '❌ NO'}`)

    } else {
      console.log('❌ No se encontró análisis para Foro 2')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)