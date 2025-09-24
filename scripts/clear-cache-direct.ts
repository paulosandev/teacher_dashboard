#!/usr/bin/env npx tsx
/**
 * Script directo para limpiar caché sin autenticación
 */

import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
})

async function clearCache() {
  console.log('🧹 Limpiando caché para mostrar nuevos análisis...')

  try {
    // 1. Limpiar análisis antiguos de DB (mantener últimos 500)
    const deleteResult = await prisma.$executeRaw`
      DELETE FROM ActivityAnalysis
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id FROM ActivityAnalysis
          ORDER BY generatedAt DESC
          LIMIT 500
        ) AS keep_these
      )
    `
    console.log(`📊 Eliminados ${deleteResult} análisis antiguos de la DB`)

    // 2. Limpiar caché de Redis
    await redis.flushdb()
    console.log('🔄 Caché de Redis limpiado completamente')

    // 3. Mostrar estadísticas
    const totalAnalyses = await prisma.activityAnalysis.count()
    console.log(`✅ Total de análisis en DB: ${totalAnalyses}`)

    console.log('✨ Caché limpiado exitosamente')
    console.log('📝 Los nuevos análisis pedagógicos ya están disponibles')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error limpiando caché:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    redis.disconnect()
  }
}

clearCache()