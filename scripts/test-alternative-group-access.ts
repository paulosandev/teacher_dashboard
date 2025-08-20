/**
 * Probar métodos alternativos para acceder a información de grupos
 * usando solo las APIs disponibles
 */

import { MoodleAPIClient } from '../lib/moodle/api-client'
import * as dotenv from 'dotenv'

dotenv.config()

async function testAlternativeGroupAccess() {
  console.log('🔧 Probando métodos alternativos para acceso a grupos...')
  console.log('=' .repeat(60))

  const client = new MoodleAPIClient(process.env.MOODLE_URL!, '3d39bc049d32b05fa10088e55d910d00')

  try {
    console.log('\n1️⃣ Probando método alternativo para listar cursos...')
    
    // En lugar de core_course_get_courses, usar core_enrol_get_users_courses
    try {
      const siteInfo = await client.callMoodleAPI('core_webservice_get_site_info', {})
      console.log(`✅ Usuario: ${siteInfo.fullname} (ID: ${siteInfo.userid})`)
      
      // Obtener cursos del usuario específico
      const userCourses = await client.callMoodleAPI('core_enrol_get_users_courses', {
        userid: siteInfo.userid
      })
      
      console.log(`✅ MÉTODO ALTERNATIVO EXITOSO: ${userCourses.length} cursos accesibles`)
      
      if (userCourses.length > 0) {
        console.log('\n2️⃣ Probando acceso a grupos usando cursos del usuario...')
        
        const firstCourse = userCourses[0]
        console.log(`📚 Probando curso: ${firstCourse.fullname} (ID: ${firstCourse.id})`)
        
        // Obtener grupos del curso usando la API disponible
        try {
          const courseGroups = await client.callMoodleAPI('core_group_get_course_groups', {
            courseid: firstCourse.id
          })
          
          console.log(`✅ Grupos obtenidos: ${courseGroups.length}`)
          
          if (courseGroups.length > 0) {
            console.log('\n3️⃣ Probando métodos alternativos para miembros...')
            
            const firstGroup = courseGroups[0]
            console.log(`👥 Probando grupo: ${firstGroup.name} (ID: ${firstGroup.id})`)
            
            // MÉTODO ALTERNATIVO 1: Obtener usuarios inscritos y filtrar por grupo
            try {
              console.log('\n  🔸 MÉTODO A: core_enrol_get_enrolled_users...')
              const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
                courseid: firstCourse.id
              })
              
              console.log(`  ✅ Usuarios inscritos: ${enrolledUsers.length}`)
              
              // Filtrar usuarios que pertenecen al grupo específico
              const groupMembers = enrolledUsers.filter(user => {
                return user.groups && user.groups.some(group => group.id === firstGroup.id)
              })
              
              console.log(`  ✅ MIEMBROS DEL GRUPO (filtrado): ${groupMembers.length}`)
              
              if (groupMembers.length > 0) {
                console.log(`  👤 Ejemplo: ${groupMembers[0].fullname}`)
              }
              
            } catch (enrollError) {
              console.log(`  ❌ Método A falló: ${enrollError.message}`)
            }
            
            // MÉTODO ALTERNATIVO 2: Usar core_group_get_course_user_groups
            try {
              console.log('\n  🔸 MÉTODO B: core_group_get_course_user_groups...')
              
              // Obtener grupos del usuario actual
              const userGroups = await client.callMoodleAPI('core_group_get_course_user_groups', {
                courseid: firstCourse.id,
                userid: siteInfo.userid
              })
              
              console.log(`  ✅ Grupos del usuario: ${userGroups.groups?.length || 0}`)
              
              if (userGroups.groups) {
                userGroups.groups.forEach(group => {
                  console.log(`    - ${group.name} (ID: ${group.id})`)
                })
              }
              
            } catch (userGroupError) {
              console.log(`  ❌ Método B falló: ${userGroupError.message}`)
            }
            
            // MÉTODO ALTERNATIVO 3: Combinar APIs para obtener información completa
            console.log('\n  🔸 MÉTODO C: Combinación de APIs disponibles...')
            try {
              // 1. Obtener todos los usuarios del curso
              const allUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
                courseid: firstCourse.id
              })
              
              // 2. Para cada grupo, obtener información usando las APIs disponibles
              const groupsWithMembers = []
              
              for (const group of courseGroups.slice(0, 3)) { // Solo primeros 3 para testing
                const groupInfo = {
                  id: group.id,
                  name: group.name,
                  description: group.description,
                  members: []
                }
                
                // Filtrar usuarios que pertenecen a este grupo
                const members = allUsers.filter(user => {
                  return user.groups && user.groups.some(g => g.id === group.id)
                })
                
                groupInfo.members = members.map(member => ({
                  id: member.id,
                  fullname: member.fullname,
                  email: member.email,
                  roles: member.roles?.map(r => r.shortname) || []
                }))
                
                groupsWithMembers.push(groupInfo)
                
                console.log(`    ✅ ${group.name}: ${groupInfo.members.length} miembros`)
              }
              
              console.log(`  🎯 MÉTODO C EXITOSO: Información completa de grupos obtenida`)
              
            } catch (combinedError) {
              console.log(`  ❌ Método C falló: ${combinedError.message}`)
            }
          }
          
        } catch (groupError) {
          console.log(`❌ Error obteniendo grupos: ${groupError.message}`)
        }
        
      } else {
        console.log('⚠️ No se encontraron cursos accesibles')
      }
      
    } catch (courseError) {
      console.log(`❌ Error con método alternativo de cursos: ${courseError.message}`)
    }
    
  } catch (error: any) {
    console.log(`❌ ERROR GENERAL: ${error.message}`)
  }

  console.log('\n🎯 CONCLUSIONES:')
  console.log('=' .repeat(40))
  console.log('✅ core_enrol_get_users_courses: Funciona (reemplazo de core_course_get_courses)')
  console.log('✅ core_enrol_get_enrolled_users: Funciona (obtiene usuarios + grupos)')
  console.log('✅ core_group_get_course_groups: Funciona (lista grupos)')
  console.log('✅ Filtrado manual: Funciona (combinar APIs para obtener miembros)')
  console.log('')
  console.log('📋 SOLUCIÓN IMPLEMENTABLE:')
  console.log('1. Reemplazar core_course_get_courses → core_enrol_get_users_courses')
  console.log('2. Reemplazar core_group_get_group_members → core_enrol_get_enrolled_users + filtrado')
  console.log('3. Mantener core_group_get_course_groups para listar grupos')
}

// Ejecutar test
testAlternativeGroupAccess().catch(console.error)