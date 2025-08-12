#!/usr/bin/env tsx

/**
 * Script para verificar permisos de búsqueda de usuarios en Moodle
 * y proporcionar información sobre cómo solicitar permisos adicionales
 */

// Cargar variables de entorno
import dotenv from 'dotenv'
dotenv.config()

import { moodleClient } from '../lib/moodle/api-client'

async function main() {
  console.log('🔍 Verificando permisos de búsqueda de usuarios en Moodle...\n')

  try {
    // Verificar conexión básica
    console.log('1️⃣ Verificando conexión con Moodle...')
    const isConnected = await moodleClient.testConnection()
    
    if (!isConnected) {
      console.error('❌ No se pudo conectar con Moodle. Verifica la configuración.')
      process.exit(1)
    }

    // Intentar buscar usuario por username (requiere permisos especiales)
    console.log('\n2️⃣ Verificando permisos para core_user_get_users_by_field...')
    
    try {
      // @ts-ignore - Accedemos al método privado para testing
      const result = await (moodleClient as any).callMoodleAPI('core_user_get_users_by_field', {
        field: 'username',
        values: ['marco.arce']
      })

      console.log('✅ Permisos de búsqueda de usuarios: DISPONIBLES')
      console.log(`   Resultado: ${result.length} usuario(s) encontrado(s)`)
      
      if (result.length > 0) {
        const user = result[0]
        console.log(`   Usuario: ${user.username} (ID: ${user.id})`)
      }

    } catch (error) {
      console.log('❌ Permisos de búsqueda de usuarios: NO DISPONIBLES')
      console.log(`   Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      
      console.log('\n📋 SOLUCIÓN:')
      console.log('Para habilitar la búsqueda de usuarios por matrícula, necesitas solicitar')
      console.log('al administrador de Moodle que añada el permiso:')
      console.log('   • core_user_get_users_by_field')
      console.log('\nMientras tanto, el sistema usará el mapeo local definido en:')
      console.log('   • lib/moodle/api-client.ts -> getMoodleUserMapping()')
    }

    console.log('\n3️⃣ Verificando mapeo local...')
    
    // Verificar mapeo local para marco.arce
    const localUser = await moodleClient.getUserByUsername('marco.arce')
    
    if (localUser) {
      console.log('✅ Mapeo local: FUNCIONAL')
      console.log(`   Usuario encontrado: ${localUser.username} (ID: ${localUser.id})`)
    } else {
      console.log('❌ Mapeo local: NO ENCONTRADO')
      console.log('   Verifica que "marco.arce" esté en getMoodleUserMapping()')
    }

    console.log('\n🎯 RESUMEN:')
    console.log('• Conexión Moodle: ✅')
    console.log(`• Búsqueda API: ${localUser ? '⚠️ (usando mapeo local)' : '❌'}`)
    console.log(`• Sistema funcional: ${localUser ? '✅' : '❌'}`)

  } catch (error) {
    console.error('❌ Error durante la verificación:', error)
    process.exit(1)
  }
}

main()
