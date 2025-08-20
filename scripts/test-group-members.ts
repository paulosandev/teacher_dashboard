// Test para verificar que getGroupMembers ahora funciona correctamente
import { createSmartMoodleClient } from '../lib/moodle/smart-client'

async function testGroupMembers() {
  console.log('🧪 Testing getGroupMembers fix')
  
  try {
    // Crear cliente usando las credenciales de cesar.espindola
    const smartClient = createSmartMoodleClient(
      'test-user-id',
      'cesar.espindola'
    )
    
    // Probar obtener grupos de un curso conocido
    console.log('\n📚 Obteniendo grupos del curso 161...')
    const groups = await smartClient.getCourseGroups('161')
    
    if (groups.length === 0) {
      console.log('⚠️  No se encontraron grupos en el curso 161')
      return
    }
    
    console.log(`✅ Encontrados ${groups.length} grupos:`)
    groups.forEach(group => {
      console.log(`  • Grupo ${group.id}: ${group.name}`)
    })
    
    // Probar getGroupMembers con el primer grupo
    const testGroup = groups[0]
    console.log(`\n👥 Probando getGroupMembers con grupo ${testGroup.id} (${testGroup.name})...`)
    
    const members = await smartClient.getGroupMembers(testGroup.id, '161')
    
    console.log(`\n📊 RESULTADO:`)
    console.log(`   Grupo: ${testGroup.name} (ID: ${testGroup.id})`)
    console.log(`   Miembros encontrados: ${members.length}`)
    
    if (members.length > 0) {
      console.log('\n👤 Miembros del grupo:')
      members.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.fullname} (ID: ${member.id})`)
        if (member.email) {
          console.log(`     Email: ${member.email}`)
        }
        if (member.username) {
          console.log(`     Username: ${member.username}`)
        }
      })
      
      console.log('\n✅ SUCCESS: getGroupMembers funciona correctamente!')
      console.log('✅ Los análisis ahora podrán incluir datos de estudiantes')
      
    } else {
      console.log('\n⚠️  El grupo no tiene miembros o no se pudieron obtener')
      console.log('   Esto podría ser normal si el grupo está vacío')
    }
    
    // Probar con otro grupo si hay más
    if (groups.length > 1) {
      const secondGroup = groups[1]
      console.log(`\n🔄 Probando con segundo grupo: ${secondGroup.name} (ID: ${secondGroup.id})`)
      
      const secondMembers = await smartClient.getGroupMembers(secondGroup.id, '161')
      console.log(`   Miembros: ${secondMembers.length}`)
      
      if (secondMembers.length > 0) {
        console.log('   Primeros miembros:', secondMembers.slice(0, 3).map(m => m.fullname))
      }
    }
    
  } catch (error) {
    console.error('❌ Error durante el test:', error)
    
    // Mostrar información adicional para debug
    console.log('\n🔍 Información de debug:')
    console.log('   - Verificar que el usuario cesar.espindola tenga permisos de profesor')
    console.log('   - Verificar que existan grupos en el curso 161')
    console.log('   - Verificar que el token de Moodle sea válido')
  }
}

testGroupMembers().catch(console.error)