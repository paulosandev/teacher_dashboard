#!/usr/bin/env node
/**
 * Script para limpiar completamente base de datos, caché y datos temporales
 * USO: node scripts/clean-all.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function cleanDatabase() {
  console.log('🧹 Limpiando base de datos...')
  
  try {
    // Limpiar todas las tablas en el orden correcto (evitar errores de FK)
    await prisma.activityAnalysis.deleteMany()
    console.log('   ✅ ActivityAnalysis limpiado')
    
    await prisma.analysisQueue.deleteMany()
    console.log('   ✅ AnalysisQueue limpiado')
    
    await prisma.analysisResult.deleteMany()
    console.log('   ✅ AnalysisResult limpiado')
    
    await prisma.courseCache.deleteMany()
    console.log('   ✅ CourseCache limpiado')
    
    await prisma.jobLog.deleteMany()
    console.log('   ✅ JobLog limpiado')
    
    await prisma.group.deleteMany()
    console.log('   ✅ Group limpiado')
    
    await prisma.course.deleteMany()
    console.log('   ✅ Course limpiado')
    
    console.log('✅ Base de datos completamente limpiada')
  } catch (error) {
    console.error('❌ Error limpiando base de datos:', error)
    throw error
  }
}

function cleanCache() {
  console.log('🗑️ Limpiando archivos temporales y caché...')
  
  const pathsToClean = [
    'reports/',
    '.next/',
    'node_modules/.cache/',
    'tmp/',
    '/tmp/ultimo-prompt-enviado-openai.json'
  ]
  
  pathsToClean.forEach(pathToClean => {
    try {
      if (fs.existsSync(pathToClean)) {
        if (fs.statSync(pathToClean).isDirectory()) {
          fs.rmSync(pathToClean, { recursive: true, force: true })
          console.log(`   ✅ Directorio ${pathToClean} eliminado`)
        } else {
          fs.unlinkSync(pathToClean)
          console.log(`   ✅ Archivo ${pathToClean} eliminado`)
        }
      }
    } catch (error) {
      console.log(`   ⚠️ No se pudo limpiar ${pathToClean}: ${error.message}`)
    }
  })
  
  console.log('✅ Archivos temporales limpiados')
}

async function recreateDirectories() {
  console.log('📁 Recreando directorios necesarios...')
  
  const dirsToCreate = [
    'reports',
    'tmp'
  ]
  
  dirsToCreate.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`   ✅ Directorio ${dir} creado`)
    }
  })
}

async function main() {
  console.log('🚀 ===== LIMPIEZA COMPLETA DEL SISTEMA =====')
  console.log('')
  
  try {
    // Limpiar base de datos
    await cleanDatabase()
    console.log('')
    
    // Limpiar archivos temporales
    cleanCache()
    console.log('')
    
    // Recrear directorios necesarios
    await recreateDirectories()
    console.log('')
    
    console.log('✅ ===== LIMPIEZA COMPLETADA EXITOSAMENTE =====')
    console.log('📋 Próximos pasos recomendados:')
    console.log('   1. npx prisma db push (para sincronizar schema)')
    console.log('   2. npx prisma db seed (para datos iniciales)')
    console.log('   3. npx prisma generate (para cliente actualizado)')
    console.log('   4. Reiniciar servidor de desarrollo')
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()