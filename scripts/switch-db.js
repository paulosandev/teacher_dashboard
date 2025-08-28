#!/usr/bin/env node
/**
 * Script para cambiar entre PostgreSQL y MySQL en schema.prisma
 * USO: 
 *   node scripts/switch-db.js postgresql
 *   node scripts/switch-db.js mysql
 */

const fs = require('fs')
const path = require('path')

const schemaPath = path.join(__dirname, '../prisma/schema.prisma')

function switchDatabase(provider) {
  if (!['postgresql', 'mysql'].includes(provider)) {
    console.error('❌ Provider debe ser "postgresql" o "mysql"')
    process.exit(1)
  }
  
  console.log(`🔄 Cambiando schema.prisma a ${provider.toUpperCase()}...`)
  
  try {
    let schemaContent = fs.readFileSync(schemaPath, 'utf8')
    
    // Cambiar el provider
    const providerRegex = /provider\s*=\s*"(postgresql|mysql)"/
    const currentMatch = schemaContent.match(providerRegex)
    
    if (!currentMatch) {
      console.error('❌ No se pudo encontrar el provider en schema.prisma')
      process.exit(1)
    }
    
    const currentProvider = currentMatch[1]
    if (currentProvider === provider) {
      console.log(`✅ El schema ya está configurado para ${provider.toUpperCase()}`)
      return
    }
    
    // Reemplazar provider
    schemaContent = schemaContent.replace(
      providerRegex,
      `provider = "${provider}"`
    )
    
    // Actualizar comentarios
    const commentRegex = /\/\/ Configuración para.*$/m
    schemaContent = schemaContent.replace(
      commentRegex,
      `// Configuración para ${provider === 'postgresql' ? 'desarrollo (PostgreSQL)' : 'producción (MySQL)'}`
    )
    
    // Escribir archivo actualizado
    fs.writeFileSync(schemaPath, schemaContent)
    
    console.log(`✅ Schema actualizado de ${currentProvider.toUpperCase()} a ${provider.toUpperCase()}`)
    console.log('')
    console.log('📋 Próximos pasos recomendados:')
    console.log('   1. npx prisma db push')
    console.log('   2. npx prisma generate')
    console.log('   3. Reiniciar servidor de desarrollo')
    
    if (provider === 'mysql') {
      console.log('')
      console.log('⚠️  IMPORTANTE para MySQL:')
      console.log('   - Asegúrate de que DATABASE_URL apunte a una base MySQL')
      console.log('   - Los tipos @db.Text funcionan correctamente en MySQL')
    } else {
      console.log('')
      console.log('✅ PostgreSQL configurado:')
      console.log('   - Los tipos @db.Text se mapean correctamente a text')
    }
    
  } catch (error) {
    console.error('❌ Error actualizando schema:', error)
    process.exit(1)
  }
}

// Obtener argumento de línea de comandos
const provider = process.argv[2]

if (!provider) {
  console.error('❌ Debe especificar el provider: postgresql o mysql')
  console.log('')
  console.log('Uso:')
  console.log('  node scripts/switch-db.js postgresql')
  console.log('  node scripts/switch-db.js mysql')
  process.exit(1)
}

switchDatabase(provider)