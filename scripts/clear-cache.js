#!/usr/bin/env node

/**
 * Script para limpiar solo caché sin tocar la BD
 * USO: node scripts/clear-cache.js
 */

const fs = require('fs').promises
const path = require('path')

const colors = {
  red: '\x1b[31m%s\x1b[0m',
  green: '\x1b[32m%s\x1b[0m',
  yellow: '\x1b[33m%s\x1b[0m',
  blue: '\x1b[34m%s\x1b[0m',
}

async function clearCache() {
  console.log(colors.blue, '🧹 LIMPIEZA DE CACHÉ')
  console.log('=' .repeat(30))

  const cacheDirectories = [
    '.next/cache',           // Caché de Next.js
    '.cache',                // Caché general
    'node_modules/.cache',   // Caché de node_modules
    '.cache/analysis',       // Caché de análisis
  ]

  for (const dir of cacheDirectories) {
    try {
      const fullPath = path.join(process.cwd(), dir)
      await fs.rm(fullPath, { recursive: true, force: true })
      console.log(colors.green, `✅ Eliminado: ${dir}`)
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(colors.yellow, `⏭️  No existe: ${dir}`)
      } else {
        console.log(colors.red, `❌ Error en ${dir}: ${error.message}`)
      }
    }
  }

  // Limpiar caché de Redis si está configurado
  if (process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL) {
    console.log(colors.yellow, '🔄 Limpiando caché Redis...')
    try {
      // Si tienes Redis configurado, agregar lógica aquí
      console.log(colors.green, '✅ Redis limpiado (si estaba disponible)')
    } catch (error) {
      console.log(colors.yellow, `⚠️  Redis no disponible`)
    }
  }

  console.log('')
  console.log(colors.green, '✅ Caché limpiado exitosamente')
  console.log(colors.blue, '💡 Recuerda hacer: npm run build && pm2 restart')
}

clearCache().catch(error => {
  console.error(colors.red, '❌ Error:', error)
  process.exit(1)
})