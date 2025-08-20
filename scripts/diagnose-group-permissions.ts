/**
 * Script para diagnosticar el problema exacto de permisos con grupos en Moodle
 */

import { MoodleAPIClient } from '../lib/moodle/api-client'
import * as dotenv from 'dotenv'

dotenv.config()

async function diagnoseGroupPermissions() {
  console.log('🔍 Diagnosticando problema de permisos de grupos en Moodle...')
  console.log('=' .repeat(60))

  const tokens = [
    { 
      name: 'Token Administrativo (.env)', 
      token: process.env.MOODLE_TOKEN!,
      description: 'Token principal del sistema'
    },
    { 
      name: 'Token Julio Profe', 
      token: '3d39bc049d32b05fa10088e55d910d00',
      description: 'Token del profesor con permisos específicos' 
    },
    { 
      name: 'Token del API (.env)', 
      token: process.env.MOODLE_API_TOKEN!,
      description: 'Token de API configurado'
    }
  ]

  for (const tokenInfo of tokens) {
    console.log(`\n📋 Probando: ${tokenInfo.name}`)
    console.log(`📝 Descripción: ${tokenInfo.description}`)
    console.log(`🔑 Token: ${tokenInfo.token.substring(0, 8)}...`)
    
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, tokenInfo.token)
    
    try {
      // 1. Probar información básica del usuario
      console.log('\n  🔸 Probando core_webservice_get_site_info...')
      const siteInfo = await client.callMoodleAPI('core_webservice_get_site_info', {})
      console.log(`  ✅ Usuario: ${siteInfo.fullname} (${siteInfo.username})`)
      console.log(`  ✅ Funciones disponibles: ${siteInfo.functions?.length || 0}`)
      
      // 2. Listar funciones disponibles
      const availableFunctions = siteInfo.functions || []
      const groupFunctions = availableFunctions.filter(f => f.name.includes('group'))
      console.log(`  📊 Funciones relacionadas con grupos: ${groupFunctions.length}`)
      
      if (groupFunctions.length > 0) {
        groupFunctions.forEach(func => {
          console.log(`    - ${func.name}`)
        })
      } else {
        console.log(`    ❌ No hay funciones de grupos disponibles`)
      }
      
      // 3. Probar acceso a cursos
      console.log('\n  🔸 Probando acceso a cursos...')
      const courses = await client.callMoodleAPI('core_course_get_courses', {})
      console.log(`  ✅ Puede acceder a ${courses.length} cursos`)
      
      if (courses.length > 0) {
        const firstCourse = courses[0]
        console.log(`  📚 Ejemplo: ${firstCourse.fullname} (ID: ${firstCourse.id})`)
        
        // 4. Probar obtener grupos del curso
        console.log('\n  🔸 Probando core_group_get_course_groups...')
        try {
          const courseGroups = await client.callMoodleAPI('core_group_get_course_groups', {
            courseid: firstCourse.id
          })
          console.log(`  ✅ Grupos encontrados: ${courseGroups.length}`)
          
          if (courseGroups.length > 0) {
            const firstGroup = courseGroups[0]
            console.log(`  👥 Ejemplo: ${firstGroup.name} (ID: ${firstGroup.id})`)
            
            // 5. Probar obtener miembros del grupo (aquí falla)
            console.log('\n  🔸 Probando core_group_get_group_members...')
            try {
              const members = await client.callMoodleAPI('core_group_get_group_members', {
                groupids: [firstGroup.id]
              })
              console.log(`  ✅ Miembros obtenidos exitosamente: ${members[0]?.userids?.length || 0}`)
            } catch (groupError: any) {
              console.log(`  ❌ FALLO EN GRUPOS: ${groupError.message}`)
              console.log(`  🔍 Tipo de error: ${groupError.name}`)
              
              if (groupError.message.includes('Excepción al control de acceso')) {
                console.log(`  💡 DIAGNÓSTICO: Falta capacidad específica para ver miembros de grupos`)
              }
            }
          }
          
        } catch (courseGroupError: any) {
          console.log(`  ❌ Error obteniendo grupos del curso: ${courseGroupError.message}`)
        }
      }
      
      // 6. Verificar capacidades específicas
      console.log('\n  🔸 Probando obtener capacidades del usuario...')
      try {
        const userInfo = await client.callMoodleAPI('core_user_get_users_by_field', {
          field: 'id',
          values: [siteInfo.userid]
        })
        
        if (userInfo && userInfo.length > 0) {
          console.log(`  ✅ Usuario válido: ${userInfo[0].fullname}`)
          // No siempre incluye capacidades detalladas en esta respuesta
        }
      } catch (userError) {
        console.log(`  ⚠️ No se pudo obtener info detallada del usuario`)
      }
      
    } catch (error: any) {
      console.log(`  ❌ ERROR GENERAL: ${error.message}`)
      console.log(`  🔍 Tipo: ${error.name}`)
    }
    
    console.log('\n' + '-'.repeat(40))
  }

  console.log('\n🎯 DIAGNÓSTICO FINAL:')
  console.log('=' .repeat(40))
  console.log('El problema "Excepción al control de acceso" en core_group_get_group_members')
  console.log('se debe a que el token no tiene la capacidad específica requerida.')
  console.log('')
  console.log('SOLUCIONES POSIBLES:')
  console.log('1. Usar método alternativo (core_enrol_get_enrolled_users + filtrado)')
  console.log('2. Configurar capacidades específicas en Moodle para el servicio web')
  console.log('3. Usar token de un usuario con más permisos administrativos')
}

// Ejecutar diagnóstico
diagnoseGroupPermissions().catch(console.error)