#!/usr/bin/env npx tsx
/**
 * Script para eliminar el análisis de Foro 2 y regenerarlo
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️ Eliminando análisis anterior de Foro 2...')

  try {
    const deleted = await prisma.activityAnalysis.deleteMany({
      where: {
        courseId: '101-818',
        activityName: 'Foro 2'
      }
    })

    console.log(`✅ Eliminados ${deleted.count} análisis de Foro 2`)

  } catch (error) {
    console.error('❌ Error eliminando análisis:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)