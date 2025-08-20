// Script para investigar el mapeo de grupos con acceso directo al cliente
import { createSmartMoodleClient } from '../lib/moodle/smart-client'
import { hybridAuth } from '../lib/moodle/hybrid-auth-service'

async function investigateGroupMappingFixed() {
  console.log('🔍 Investigando mapeo de grupos - Versión corregida')
  
  try {
    const courseId = '161'
    console.log(`\n📚 Analizando curso ${courseId}...`)
    
    // 1. Obtener grupos básicos
    const smartClient = createSmartMoodleClient('test-user-id', 'cesar.espindola')
    const groups = await smartClient.getCourseGroups(courseId)
    
    console.log(`✅ Encontrados ${groups.length} grupos:`)
    for (const group of groups) {
      console.log(`  • ${group.name} (ID: ${group.id})`)
    }
    
    // 2. Probar diferentes métodos de acceso directo
    console.log('\n🔬 Probando métodos alternativos...')
    
    const context = {
      operation: 'test_group_methods',
      userId: 'test',
      userMatricula: 'cesar.espindola'
    }
    
    // Método 1: Intentar core_group_get_group_members directamente
    console.log('\n📋 Método 1: core_group_get_group_members directo')
    try {
      const result1 = await hybridAuth.executeWithOptimalAuth(context, async (client) => {
        return await client.callMoodleAPI('core_group_get_group_members', {
          groupids: [1926] // Grupo Actividades
        })
      })
      console.log('✅ Éxito:', JSON.stringify(result1, null, 2))
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`)
    }
    
    // Método 2: Información detallada del grupo  
    console.log('\n📋 Método 2: core_group_get_groups para info')
    try {
      const result2 = await hybridAuth.executeWithOptimalAuth(context, async (client) => {
        return await client.callMoodleAPI('core_group_get_groups', {
          groupids: [1926]
        })
      })
      console.log('✅ Info del grupo:', JSON.stringify(result2, null, 2))
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`)
    }
    
    // Método 3: Usuarios con filtro de grupo
    console.log('\n📋 Método 3: core_enrol_get_enrolled_users con filtro groupid')
    try {
      const result3 = await hybridAuth.executeWithOptimalAuth(context, async (client) => {
        return await client.callMoodleAPI('core_enrol_get_enrolled_users', {
          courseid: 161,
          options: [
            { name: 'groupid', value: 1926 }
          ]
        })
      })
      console.log(`✅ Usuarios filtrados por grupo: ${result3.length}`)
      if (result3.length > 0) {
        console.log('Primeros usuarios:', result3.slice(0, 3).map((u: any) => ({
          id: u.id,
          name: u.fullname || `${u.firstname} ${u.lastname}`,
          groups: u.groups || 'No group info'
        })))
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`)
    }
    
    // Método 4: Obtener todos los usuarios con información de grupos incluida
    console.log('\n📋 Método 4: Usuarios con información de grupos')
    try {
      const allUsers = await hybridAuth.executeWithOptimalAuth(context, async (client) => {
        return await client.callMoodleAPI('core_enrol_get_enrolled_users', {
          courseid: 161,
          options: [
            { name: 'includegroups', value: 1 }
          ]
        })
      })
      
      console.log(`✅ Total usuarios: ${allUsers.length}`)
      
      // Analizar la información de grupos en cada usuario
      let usersWithGroups = 0
      const groupMembership: any = {}
      
      for (const user of allUsers) {
        if (user.groups && user.groups.length > 0) {
          usersWithGroups++
          for (const group of user.groups) {
            if (!groupMembership[group.id]) {
              groupMembership[group.id] = {
                name: group.name,
                members: []
              }
            }
            groupMembership[group.id].members.push({
              id: user.id,
              name: user.fullname || `${user.firstname} ${user.lastname}`
            })
          }
        }
      }
      
      console.log(`👥 Usuarios con información de grupos: ${usersWithGroups}`)
      console.log('\n🎯 MAPEO DE GRUPOS ENCONTRADO:')
      
      for (const [groupId, info] of Object.entries(groupMembership)) {
        console.log(`\n  Grupo ${groupId}: ${(info as any).name}`)
        console.log(`    Miembros: ${(info as any).members.length}`)
        if ((info as any).members.length > 0) {
          console.log(`    Primeros miembros: ${(info as any).members.slice(0, 3).map((m: any) => m.name).join(', ')}`)
        }
      }
      
      return groupMembership
      
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`)
    }
    
    // 5. Análisis y recomendación final
    console.log('\n📊 CONCLUSIONES:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
  } catch (error) {
    console.error('❌ Error durante investigación:', error)
  }
}

investigateGroupMappingFixed().catch(console.error)