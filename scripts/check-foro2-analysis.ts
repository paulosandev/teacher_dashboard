#!/usr/bin/env npx tsx
/**
 * Script para verificar el análisis de Foro 2
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando análisis de Foro 2...')

  try {
    const analysis = await prisma.activityAnalysis.findFirst({
      where: {
        courseId: '101-818',
        activityName: 'Foro 2'
      },
      orderBy: {
        generatedAt: 'desc'
      },
      select: {
        id: true,
        generatedAt: true,
        summary: true,
        fullAnalysis: true
      }
    })

    if (analysis) {
      console.log('✅ Análisis encontrado:')
      console.log(`📅 Fecha: ${analysis.generatedAt}`)
      console.log(`📋 ID: ${analysis.id}`)
      console.log('\n📝 Resumen:')
      console.log(analysis.summary?.substring(0, 500) + '...')

      console.log('\n📊 Análisis completo:')
      console.log(analysis.fullAnalysis?.substring(0, 2000) + '...')

      // Check if it has the 5 dimensions
      const hasAllDimensions = [
        '#### Nivel de participación',
        '#### Calidad académica de las aportaciones',
        '#### Cumplimiento de la consigna',
        '#### Uso de referencias y fundamentación teórica',
        '#### Dinámica de interacción entre compañeros'
      ].every(dimension => analysis.fullAnalysis?.includes(dimension))

      console.log(`\n🎯 ¿Tiene las 5 dimensiones correctas? ${hasAllDimensions ? '✅ SÍ' : '❌ NO'}`)

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