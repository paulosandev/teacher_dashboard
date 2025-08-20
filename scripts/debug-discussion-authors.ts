/**
 * Script para debuggear quién está iniciando las discusiones
 */

import dotenv from 'dotenv'
import { MoodleAPIClient } from '../lib/moodle/api-client'

dotenv.config()

async function debugDiscussionAuthors() {
  console.log('🔍 Debuggeando autores de discusiones...')
  
  const token = '3d39bc049d32b05fa10088e55d910d00'
  const professorUserId = 29895 // ID de julioprofe
  const moodleUrl = process.env.MOODLE_URL!
  
  const client = new MoodleAPIClient(moodleUrl, token)
  
  const courseId = 229
  const groupId = 2267 // Grupo_01
  
  console.log(`👨‍🏫 Profesor ID: ${professorUserId} (julioprofe)`)
  console.log(`🎯 Curso: ${courseId}, Grupo: ${groupId}`)
  
  try {
    // Obtener discusiones del Foro 1
    console.log('\n🔍 Obteniendo discusiones del Foro 1...')
    const discussions = await client.callMoodleAPI('mod_forum_get_forum_discussions', {
      forumid: 1479 // Foro 1
    })
    
    if (!discussions.discussions) {
      console.log('❌ No se encontraron discusiones')
      return
    }
    
    console.log(`📊 Total de discusiones: ${discussions.discussions.length}`)
    
    // Filtrar por grupo
    const groupDiscussions = discussions.discussions.filter((d: any) => d.groupid === groupId)
    console.log(`🎯 Discusiones en grupo ${groupId}: ${groupDiscussions.length}`)
    
    if (groupDiscussions.length === 0) {
      console.log('❌ No hay discusiones en el grupo especificado')
      return
    }
    
    console.log('\n=== ANÁLISIS DE AUTORES ===')
    
    // Analizar cada discusión
    groupDiscussions.forEach((discussion, index) => {
      console.log(`\n${index + 1}. "${discussion.name}"`)
      console.log(`   ID: ${discussion.id}`)
      console.log(`   Autor ID: ${discussion.userid}`)
      console.log(`   Grupo ID: ${discussion.groupid}`)
      console.log(`   Respuestas: ${discussion.numreplies}`)
      console.log(`   Creada: ${new Date(discussion.created * 1000).toLocaleString()}`)
      
      const isProfesorJulio = discussion.userid === professorUserId
      console.log(`   Es de Julio Profe: ${isProfesorJulio ? 'SÍ' : 'NO'}`)
      
      if (!isProfesorJulio) {
        console.log(`   ⚠️ Esta discusión NO sería mostrada con el filtro actual`)
      } else {
        console.log(`   ✅ Esta discusión SÍ sería mostrada`)
      }
    })
    
    // Contar discusiones por autor
    const discussionsByAuthor = groupDiscussions.reduce((acc: any, d: any) => {
      if (!acc[d.userid]) {
        acc[d.userid] = []
      }
      acc[d.userid].push(d.name)
      return acc
    }, {})
    
    console.log('\n=== RESUMEN POR AUTOR ===')
    Object.keys(discussionsByAuthor).forEach(userId => {
      const count = discussionsByAuthor[userId].length
      const isJulio = parseInt(userId) === professorUserId
      console.log(`👤 Usuario ID ${userId}: ${count} discusiones ${isJulio ? '(Julio Profe)' : '(Otro profesor)'}`)
      discussionsByAuthor[userId].forEach((name: string) => {
        console.log(`   - "${name}"`)
      })
    })
    
    // Analizar el filtrado actual
    const julioDiscussions = groupDiscussions.filter(d => d.userid === professorUserId)
    const otherDiscussions = groupDiscussions.filter(d => d.userid !== professorUserId)
    
    console.log('\n=== RESULTADO DEL FILTRADO ACTUAL ===')
    console.log(`✅ Discusiones de Julio Profe que SE MOSTRARÍAN: ${julioDiscussions.length}`)
    console.log(`❌ Discusiones de otros que NO se mostrarían: ${otherDiscussions.length}`)
    
    if (julioDiscussions.length === 0) {
      console.log('\n🚨 PROBLEMA IDENTIFICADO:')
      console.log('🚨 No hay discusiones iniciadas por Julio Profe en este grupo')
      console.log('🚨 El filtro actual causa que no se muestren discusiones')
      
      if (otherDiscussions.length > 0) {
        console.log('\n💡 SUGERENCIA:')
        console.log('💡 Considerar mostrar discusiones donde el profesor participa,')
        console.log('💡 no solo las que inicia')
      }
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error)
  }
}

if (require.main === module) {
  debugDiscussionAuthors().catch(console.error)
}

export { debugDiscussionAuthors }