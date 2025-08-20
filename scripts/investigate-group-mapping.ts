// Script para investigar el mapeo de grupos y encontrar una solución alternativa
import { createSmartMoodleClient } from '../lib/moodle/smart-client'

async function investigateGroupMapping() {
  console.log('🔍 Investigando mapeo de grupos y miembros específicos')
  
  try {
    const smartClient = createSmartMoodleClient(
      'test-user-id',
      'cesar.espindola'
    )
    
    const courseId = '161'
    console.log(`\n📚 Analizando curso ${courseId}...`)
    
    // 1. Obtener todos los grupos del curso
    console.log('\n👥 Obteniendo grupos del curso...')
    const groups = await smartClient.getCourseGroups(courseId)
    
    console.log(`✅ Encontrados ${groups.length} grupos:`)
    for (const group of groups) {
      console.log(`  • Grupo ${group.id}: ${group.name} (${group.description || 'Sin descripción'})`)
    }
    
    // 2. Obtener todos los usuarios matriculados para entender la estructura
    console.log('\n👨‍🎓 Obteniendo todos los usuarios del curso...')
    const allUsers = await smartClient.getEnrolledUsers(courseId)
    
    console.log(`📊 Total usuarios en curso: ${allUsers.length}`)
    
    // Separar por roles
    const students = allUsers.filter((user: any) => {
      const roles = user.roles || []
      return roles.some((role: any) => {
        const roleName = (role.shortname || role.name || '').toLowerCase()
        return roleName.includes('student') || roleName === 'estudiante' || role.roleid === 5
      })
    })
    
    const teachers = allUsers.filter((user: any) => {
      const roles = user.roles || []
      return roles.some((role: any) => {
        const roleName = (role.shortname || role.name || '').toLowerCase()
        return roleName.includes('teacher') || roleName.includes('profesor') || role.roleid === 3 || role.roleid === 4
      })
    })
    
    console.log(`👨‍🎓 Estudiantes: ${students.length}`)
    console.log(`👩‍🏫 Profesores: ${teachers.length}`)
    
    // 3. Intentar diferentes métodos para obtener miembros específicos por grupo
    console.log('\n🔬 Probando diferentes métodos para obtener miembros por grupo...')
    
    for (const group of groups.slice(0, 3)) { // Solo primeros 3 grupos para no sobrecargar
      console.log(`\n🎯 Analizando grupo: ${group.name} (ID: ${group.id})`)
      
      // Método 1: core_group_get_group_members (ya sabemos que falla por permisos)
      console.log('   Método 1: core_group_get_group_members')
      try {
        // Este método lo probamos directamente para documentar el error
        const members = await smartClient['hybridAuth'].executeWithOptimalAuth(
          {
            operation: 'test_group_members',
            userId: 'test',
            userMatricula: 'cesar.espindola'
          },
          async (client: any) => {
            return await client.callMoodleAPI('core_group_get_group_members', {
              groupids: [parseInt(group.id)]
            })
          }
        )
        console.log(`     ✅ Éxito: ${members?.[0]?.userids?.length || 0} miembros`)
      } catch (error: any) {
        console.log(`     ❌ Error: ${error.message}`)
      }
      
      // Método 2: Obtener información del grupo específico
      console.log('   Método 2: core_group_get_groups (info del grupo)')
      try {
        const groupInfo = await smartClient['hybridAuth'].executeWithOptimalAuth(
          {
            operation: 'get_group_info',
            userId: 'test',
            userMatricula: 'cesar.espindola'
          },
          async (client: any) => {
            return await client.callMoodleAPI('core_group_get_groups', {
              groupids: [parseInt(group.id)]
            })
          }
        )
        console.log(`     ✅ Información del grupo obtenida`)
        console.log(`     Detalles:`, JSON.stringify(groupInfo, null, 2))
      } catch (error: any) {
        console.log(`     ❌ Error: ${error.message}`)
      }
      
      // Método 3: Intentar obtener usuarios del grupo con información de membresía
      console.log('   Método 3: core_enrol_get_enrolled_users con groupid')
      try {
        const usersWithGroup = await smartClient['hybridAuth'].executeWithOptimalAuth(
          {
            operation: 'get_users_with_group',
            userId: 'test',
            userMatricula: 'cesar.espindola'
          },
          async (client: any) => {
            return await client.callMoodleAPI('core_enrol_get_enrolled_users', {
              courseid: parseInt(courseId),
              options: [
                { name: 'withcapability', value: 'moodle/site:viewparticipants' },
                { name: 'groupid', value: parseInt(group.id) }
              ]
            })
          }
        )
        console.log(`     ✅ Usuarios con filtro de grupo: ${usersWithGroup.length}`)
        if (usersWithGroup.length > 0) {
          console.log(`     Primeros usuarios: ${usersWithGroup.slice(0, 3).map((u: any) => u.fullname || `${u.firstname} ${u.lastname}`).join(', ')}`)
        }
      } catch (error: any) {
        console.log(`     ❌ Error: ${error.message}`)
      }
    }
    
    // 4. Análisis final y recomendaciones
    console.log('\n📋 ANÁLISIS FINAL:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`• Total grupos disponibles: ${groups.length}`)
    console.log(`• Total estudiantes en curso: ${students.length}`)
    console.log(`• Problema: No podemos obtener miembros específicos por grupo debido a permisos`)
    console.log(`• Solución actual: Retornar todos los estudiantes del curso como aproximación`)
    
    console.log('\n💡 RECOMENDACIONES:')
    console.log('1. Contactar administrador Moodle para habilitar permisos core_group_get_group_members')
    console.log('2. Usar la aproximación actual (todos los estudiantes) ya que funciona para análisis')
    console.log('3. Documentar que el análisis es por curso completo, no por grupo específico')
    
    return {
      totalGroups: groups.length,
      totalStudents: students.length,
      groupsInfo: groups,
      studentsInfo: students.slice(0, 5) // Solo primeros 5 para el reporte
    }
    
  } catch (error) {
    console.error('❌ Error durante investigación:', error)
    return null
  }
}

investigateGroupMapping().then(result => {
  if (result) {
    console.log('\n✅ Investigación completa. Ver logs arriba para detalles.')
  }
}).catch(console.error)