#!/usr/bin/env tsx

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

console.log('🔍 Verificando configuración del sistema...\n')

interface CheckResult {
  name: string
  status: 'success' | 'warning' | 'error'
  message: string
}

const checks: CheckResult[] = []

// Verificar Node.js
try {
  const nodeVersion = process.version
  const major = parseInt(nodeVersion.slice(1).split('.')[0])
  if (major >= 18) {
    checks.push({
      name: 'Node.js',
      status: 'success',
      message: `v${nodeVersion} ✓`
    })
  } else {
    checks.push({
      name: 'Node.js',
      status: 'warning',
      message: `v${nodeVersion} (se recomienda v18+)`
    })
  }
} catch (error) {
  checks.push({
    name: 'Node.js',
    status: 'error',
    message: 'No detectado'
  })
}

// Verificar npm
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim()
  checks.push({
    name: 'npm',
    status: 'success',
    message: `v${npmVersion} ✓`
  })
} catch (error) {
  checks.push({
    name: 'npm',
    status: 'error',
    message: 'No detectado'
  })
}

// Verificar archivo .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  const requiredVars = [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'REDIS_URL',
    'MOODLE_API_URL',
    'MOODLE_API_TOKEN',
    'ANTHROPIC_API_KEY'
  ]
  
  const missingVars = requiredVars.filter(varName => 
    !envContent.includes(varName) || envContent.includes(`${varName}="your-`)
  )
  
  if (missingVars.length === 0) {
    checks.push({
      name: '.env.local',
      status: 'success',
      message: 'Configurado ✓'
    })
  } else {
    checks.push({
      name: '.env.local',
      status: 'warning',
      message: `Faltan configurar: ${missingVars.join(', ')}`
    })
  }
} else {
  checks.push({
    name: '.env.local',
    status: 'error',
    message: 'No existe (copia .env.example a .env.local)'
  })
}

// Verificar PostgreSQL
try {
  execSync('which psql', { encoding: 'utf-8' })
  checks.push({
    name: 'PostgreSQL',
    status: 'success',
    message: 'Instalado ✓'
  })
} catch (error) {
  checks.push({
    name: 'PostgreSQL',
    status: 'warning',
    message: 'No detectado (instalar con: brew install postgresql@14)'
  })
}

// Verificar Redis
try {
  execSync('which redis-cli', { encoding: 'utf-8' })
  checks.push({
    name: 'Redis',
    status: 'success',
    message: 'Instalado ✓'
  })
} catch (error) {
  checks.push({
    name: 'Redis',
    status: 'warning',
    message: 'No detectado (instalar con: brew install redis)'
  })
}

// Verificar Prisma Client
try {
  const prismaClientPath = path.join(process.cwd(), 'node_modules', '@prisma', 'client')
  if (fs.existsSync(prismaClientPath)) {
    checks.push({
      name: 'Prisma Client',
      status: 'success',
      message: 'Generado ✓'
    })
  } else {
    checks.push({
      name: 'Prisma Client',
      status: 'warning',
      message: 'No generado (ejecutar: npm run db:generate)'
    })
  }
} catch (error) {
  checks.push({
    name: 'Prisma Client',
    status: 'error',
    message: 'Error al verificar'
  })
}

// Mostrar resultados
console.log('📋 Resultados de la verificación:\n')

const icons = {
  success: '✅',
  warning: '⚠️',
  error: '❌'
}

checks.forEach(check => {
  console.log(`${icons[check.status]} ${check.name.padEnd(20)} ${check.message}`)
})

// Resumen
const successCount = checks.filter(c => c.status === 'success').length
const warningCount = checks.filter(c => c.status === 'warning').length
const errorCount = checks.filter(c => c.status === 'error').length

console.log('\n📊 Resumen:')
console.log(`   ✅ ${successCount} componentes listos`)
console.log(`   ⚠️  ${warningCount} advertencias`)
console.log(`   ❌ ${errorCount} errores`)

if (errorCount === 0 && warningCount === 0) {
  console.log('\n🎉 ¡El sistema está completamente configurado!')
} else if (errorCount === 0) {
  console.log('\n⚠️  El sistema puede funcionar pero revisa las advertencias')
  console.log('\n📝 Próximos pasos:')
  if (checks.find(c => c.name === 'PostgreSQL' && c.status === 'warning')) {
    console.log('   1. Instalar PostgreSQL: brew install postgresql@14')
    console.log('   2. Iniciar PostgreSQL: brew services start postgresql@14')
    console.log('   3. Crear la base de datos: psql -f scripts/create-db.sql')
    console.log('   4. Ejecutar migraciones: npm run db:migrate')
  }
  if (checks.find(c => c.name === 'Redis' && c.status === 'warning')) {
    console.log('   1. Instalar Redis: brew install redis')
    console.log('   2. Iniciar Redis: brew services start redis')
  }
} else {
  console.log('\n❌ Hay errores que deben corregirse antes de continuar')
}

process.exit(errorCount > 0 ? 1 : 0)
