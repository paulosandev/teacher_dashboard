#!/usr/bin/env npx tsx
/**
 * Script para verificar todos los campos de fecha del análisis
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verificando campos de fecha del análisis')

  try {
    const analysis = await prisma.activityAnalysis.findFirst({
      where: {
        courseId: '101-818',
        activityId: '5055',
        activityType: 'forum'
      },
      orderBy: {
        generatedAt: 'desc'
      }
    })

    if (analysis) {
      console.log('📊 Análisis encontrado:')
      console.log(`ID: ${analysis.id}`)
      console.log(`📅 generatedAt: ${analysis.generatedAt}`)
      console.log(`📅 lastUpdated: ${analysis.lastUpdated}`)
      console.log(`📅 createdAt: ${analysis.createdAt}`)
      console.log(`📅 updatedAt: ${analysis.updatedAt}`)

      console.log('\n🎯 Campos para la API:')
      console.log(`- generatedAt: ${analysis.generatedAt?.toISOString?.() || analysis.generatedAt}`)
      console.log(`- lastUpdated: ${analysis.lastUpdated?.toISOString?.() || analysis.lastUpdated}`)

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