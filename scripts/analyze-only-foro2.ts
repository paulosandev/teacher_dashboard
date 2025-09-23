#!/usr/bin/env npx tsx
/**
 * Script para analizar únicamente Foro 2
 */

import { BatchAnalysisService } from '@/lib/services/batch-analysis-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🎯 Análisis específico de Foro 2 únicamente')
  console.log('=' * 50)

  const service = BatchAnalysisService.getInstance()

  try {
    // Encontrar específicamente la actividad Foro 2
    const forumActivity = await prisma.courseActivity.findFirst({
      where: {
        aulaId: '101',
        courseId: 818,
        name: 'Foro 2',
        type: 'forum'
      },
      include: {
        course: true,
        aula: true
      }
    })

    if (!forumActivity) {
      console.log('❌ No se encontró la actividad Foro 2')
      return
    }

    console.log('✅ Encontrada actividad Foro 2:', forumActivity.id)

    // Analizar solo esta actividad específica
    const result = await service.analyzeActivity(forumActivity)

    console.log('✅ Análisis de Foro 2 completado')
    console.log(`📊 Resultado: ${result ? 'ÉXITO' : 'ERROR'}`)

    // Verificar en BD
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
      console.log('✅ Análisis guardado en BD:')
      console.log(`📅 Fecha: ${analysis.generatedAt}`)
      console.log(`📝 Resumen: ${analysis.summary?.substring(0, 300)}...`)
    } else {
      console.log('❌ No se encontró análisis en BD')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)