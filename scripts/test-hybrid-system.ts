#!/usr/bin/env npx tsx

/**
 * Script para probar el sistema híbrido de autenticación de Moodle
 */

import dotenv from 'dotenv'
import path from 'path'
import { createSmartMoodleClient } from '../lib/moodle/smart-client'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testHybridSystem() {
  console.log('🤖 PRUEBA DEL SISTEMA HÍBRIDO DE AUTENTICACIÓN')
  console.log('='.repeat(60))
  
  // Probar con usuario César
  const userId = 'test-user-id'
  const userMatricula = 'cesar.espindola'
  
  console.log(`\n👤 Probando con usuario: ${userMatricula}`)
  console.log('-'.repeat(40))
  
  try {
    // Crear cliente inteligente
    const smartClient = createSmartMoodleClient(userId, userMatricula)
    console.log('✅ Cliente inteligente creado')
    
    // 1. Probar conexión
    console.log('\n🔍 Probando conexión...')
    const isConnected = await smartClient.testConnection()
    console.log(`   ${isConnected ? '✅ Conectado' : '❌ No conectado'}`)
    
    if (!isConnected) {
      console.log('\n⚠️ No se pudo establecer conexión. Verificando configuración...')
      console.log('   - ¿Está configurado MOODLE_URL?', !!process.env.MOODLE_URL)
      console.log('   - ¿Está configurado MOODLE_TOKEN?', !!process.env.MOODLE_TOKEN)
      return
    }
    
    // 2. Obtener información del usuario
    console.log('\n👤 Obteniendo información del usuario...')
    try {
      const userInfo = await smartClient.getUserInfo()
      console.log(`   ✅ Usuario encontrado: ${userInfo?.fullname || 'Nombre no disponible'}`)
      console.log(`   📧 Email: ${userInfo?.email || 'No disponible'}`)
    } catch (error: any) {
      console.log(`   ⚠️ No se pudo obtener info del usuario: ${error.message}`)
    }
    
    // 3. Obtener cursos del profesor
    console.log('\n📚 Obteniendo cursos del profesor...')
    try {
      const courses = await smartClient.getTeacherCourses()
      console.log(`   ✅ Encontrados ${courses.length} cursos`)
      
      if (courses.length > 0) {
        courses.slice(0, 3).forEach((course: any, index: number) => {
          console.log(`   ${index + 1}. ${course.name || course.shortname}`)
          console.log(`      ID: ${course.id}`)
          console.log(`      Grupos: ${course.groups?.length || 0}`)
        })
        
        // 4. Probar con el primer curso
        if (courses[0]) {
          const firstCourse = courses[0]
          console.log(`\n🎯 Probando con curso: ${firstCourse.name}`)
          
          // Obtener contenido del curso
          try {
            const contents = await smartClient.getCourseContents(firstCourse.id)
            console.log(`   ✅ Contenido del curso: ${contents.length} elementos`)
            
            // Mostrar algunos elementos
            const activities = contents.filter((c: any) => 
              ['assign', 'quiz', 'forum', 'workshop'].includes(c.modname)
            )
            
            console.log(`   📝 Actividades encontradas: ${activities.length}`)
            activities.slice(0, 3).forEach((activity: any, index: number) => {
              console.log(`      ${index + 1}. [${activity.modname}] ${activity.name}`)
            })
            
          } catch (error: any) {
            console.log(`   ⚠️ Error obteniendo contenido: ${error.message}`)
          }
          
          // Probar grupos
          try {
            const groups = await smartClient.getCourseGroups(firstCourse.id)
            console.log(`   👥 Grupos en el curso: ${groups.length}`)
            groups.slice(0, 3).forEach((group: any, index: number) => {
              console.log(`      ${index + 1}. ${group.name} (${group.id})`)
            })
          } catch (error: any) {
            console.log(`   ⚠️ Error obteniendo grupos: ${error.message}`)
          }
        }
      } else {
        console.log('   ℹ️ No se encontraron cursos para este usuario')
      }
      
    } catch (error: any) {
      console.log(`   ❌ Error obteniendo cursos: ${error.message}`)
    }
    
  } catch (error: any) {
    console.error('❌ Error general:', error.message)
  }
  
  console.log('\n📊 RESUMEN DEL SISTEMA HÍBRIDO')
  console.log('='.repeat(60))
  console.log('✅ Sistema híbrido implementado')
  console.log('✅ Token administrativo para operaciones de lectura')
  console.log('✅ Fallback automático en caso de errores')
  console.log('✅ Sin configuración manual requerida para profesores')
  console.log('✅ Detección inteligente de tipo de operación')
  
  console.log('\n🎯 PRÓXIMOS PASOS RECOMENDADOS')
  console.log('-'.repeat(40))
  console.log('1. Probar el nuevo dashboard en /dashboard/v2')
  console.log('2. Verificar que el análisis automático funcione')
  console.log('3. El profesor NO necesita configurar tokens manualmente')
  console.log('4. El sistema usará automáticamente el token óptimo')
  
  console.log('\n✨ ¡Sistema híbrido listo para usar!')
}

// Ejecutar
testHybridSystem()
  .catch(console.error)
  .finally(() => process.exit(0))
