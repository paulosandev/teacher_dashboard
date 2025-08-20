/**
 * Script para probar que el naming de actividades funcione correctamente
 */

import dotenv from 'dotenv'
import { MoodleAPIClient } from '../lib/moodle/api-client'

dotenv.config()

async function testActivityNaming() {
  console.log('🔍 Probando naming de actividades...')
  
  const token = '3d39bc049d32b05fa10088e55d910d00'
  const professorUserId = 29895 // ID de julioprofe
  const moodleUrl = process.env.MOODLE_URL!
  
  const client = new MoodleAPIClient(moodleUrl, token)
  
  const courseId = 229
  const groupId = 2267 // Grupo_01
  
  console.log(`👨‍🏫 Profesor ID: ${professorUserId} (julioprofe)`)
  console.log(`🎯 Curso: ${courseId}, Grupo: ${groupId}`)
  
  try {
    // === OBTENER FOROS ===
    console.log('\n💬 Obteniendo foros...')
    const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
      courseids: [courseId]
    })
    
    const foro1 = forums.find((f: any) => f.id === 1479)
    if (!foro1) {
      console.log('❌ No se encontró Foro 1')
      return
    }
    
    console.log(`✅ Foro 1 encontrado: ${foro1.name}`)
    
    // === OBTENER DISCUSIONES ===
    console.log('\n🔍 Obteniendo discusiones...')
    const discussions = await client.callMoodleAPI('mod_forum_get_forum_discussions', {
      forumid: foro1.id
    })
    
    if (!discussions.discussions) {
      console.log('❌ No se encontraron discusiones')
      return
    }
    
    // Filtrar por grupo
    const filteredDiscussions = discussions.discussions.filter((d: any) => d.groupid === groupId)
    console.log(`🎯 Discusiones en grupo ${groupId}: ${filteredDiscussions.length}`)
    
    if (filteredDiscussions.length === 0) {
      console.log('❌ No hay discusiones en el grupo')
      return
    }
    
    // === SIMULAR LA LÓGICA DE NAMING ===
    console.log('\n📋 Simulando lógica de naming...')
    
    // Obtener solo discusiones con actividad (respuestas > 0)
    const forumDiscussions = filteredDiscussions.filter(d => d.numreplies > 0)
    
    console.log(`📊 Discusiones con actividad: ${forumDiscussions.length}`)
    forumDiscussions.forEach((d: any) => {
      console.log(`   - "${d.name}" (${d.numreplies} respuestas)`)
    })
    
    // Aplicar la nueva lógica de naming
    let displayName = foro1.name // Default al nombre del foro
    
    if (forumDiscussions.length > 0) {
      // Buscar la discusión con más posts/respuestas para usar su nombre
      const mostActiveDiscussion = forumDiscussions.reduce((prev, current) => {
        return (current.numreplies > prev.numreplies) ? current : prev
      })
      
      // Si la discusión más activa tiene respuestas, usar su nombre
      if (mostActiveDiscussion.numreplies > 0) {
        displayName = mostActiveDiscussion.name
        console.log(`📋 Usando nombre de discusión activa: "${displayName}" (${mostActiveDiscussion.numreplies} respuestas)`)
      } else {
        console.log(`📋 Usando nombre del foro: "${displayName}" (no hay discusiones activas)`)
      }
    }
    
    // === RESULTADO FINAL ===
    console.log('\n=== RESULTADO FINAL ===')
    console.log(`🏷️ Nombre que aparecerá en el card: "${displayName}"`)
    console.log(`📂 Nombre original del foro: "${foro1.name}"`)
    
    if (displayName === "Espacio Testing") {
      console.log('✅ ÉXITO: El card mostrará "Espacio Testing"')
    } else if (displayName === "Foro 1") {
      console.log('❌ PROBLEMA: El card mostrará "Foro 1" en lugar de "Espacio Testing"')
    } else {
      console.log(`⚠️ INESPERADO: El card mostrará "${displayName}"`)
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error)
  }
}

if (require.main === module) {
  testActivityNaming().catch(console.error)
}

export { testActivityNaming }