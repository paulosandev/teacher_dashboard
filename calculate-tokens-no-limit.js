// Script para calcular tokens utilizados sin limitaciones de caracteres
// Estimación de tokens para el foro 3227 con contenido completo

const fetch = require('node-fetch');

// Función simple para estimar tokens (aproximación: 1 token ≈ 4 caracteres para español)
function estimateTokens(text) {
  // Conteo más preciso para análisis de tokens
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length
  const charCount = text.length
  
  // Estimación conservadora para español/inglés:
  // - ~0.75 tokens por palabra (palabras en español tienden a ser más largas)
  // - ~0.25 tokens por carácter (incluyendo espacios y puntuación)
  const tokensByWords = Math.ceil(wordCount * 0.75)
  const tokensByChars = Math.ceil(charCount * 0.25)
  
  // Usar el promedio como estimación más realista
  return Math.ceil((tokensByWords + tokensByChars) / 2)
}

async function calculateTokensWithoutLimits() {
  console.log('🧮 CALCULADORA DE TOKENS SIN LIMITACIONES')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🎯 Foro: "Ruta hacia el éxito profesional | Punto de partida"')
  console.log('🆔 Discusión ID: 3227')
  console.log('📏 Modo: SIN limitaciones de caracteres')
  console.log('═══════════════════════════════════════════════════════════════\n')
  
  const moodleToken = '3d39bc049d32b05fa10088e55d910d00'
  const moodleUrl = 'https://av141.utel.edu.mx'
  const discussionId = '3227'
  const professorUserId = 29947
  
  try {
    // 1. Obtener posts de Moodle
    console.log('📋 OBTENIENDO POSTS DE MOODLE...')
    const postsUrl = `${moodleUrl}/webservice/rest/server.php?wstoken=${moodleToken}&moodlewsrestformat=json&wsfunction=mod_forum_get_discussion_posts&discussionid=${discussionId}`
    const postsResponse = await fetch(postsUrl)
    const postsData = await postsResponse.json()
    
    if (!postsData.posts || postsData.posts.length === 0) {
      console.log('❌ No se encontraron posts')
      return
    }
    
    console.log(`✅ ${postsData.posts.length} posts obtenidos\n`)
    
    // 2. Procesar posts sin limitaciones
    console.log('⚙️ PROCESANDO POSTS SIN LIMITACIONES...')
    let totalContentChars = 0
    let totalContentWords = 0
    const postsProcessed = []
    
    postsData.posts.forEach((post, index) => {
      const cleanMessage = post.message ? post.message.replace(/<[^>]*>/g, '').trim() : ''
      const isTeacher = (post.author?.id || post.userid) === professorUserId
      const wordCount = cleanMessage.split(/\s+/).filter(w => w.length > 0).length
      
      totalContentChars += cleanMessage.length
      totalContentWords += wordCount
      
      postsProcessed.push({
        id: post.id,
        author: post.author?.fullname || 'Desconocido',
        isTeacher: isTeacher,
        subject: post.subject,
        messageLength: cleanMessage.length,
        wordCount: wordCount,
        estimatedTokens: estimateTokens(cleanMessage),
        fullMessage: cleanMessage // Contenido completo sin truncar
      })
    })
    
    // 3. Construir jerarquía completa para análisis
    console.log('🌳 CONSTRUYENDO JERARQUÍA COMPLETA...')
    
    // Construir mapa de posts
    const postsMap = new Map()
    const rootPosts = []
    
    postsData.posts.forEach(post => {
      const postUserId = post.author?.id || post.userid || post.userId
      const cleanMessage = post.message ? post.message.replace(/<[^>]*>/g, '').trim() : ''
      const isTeacherPost = postUserId === professorUserId
      
      const processedPost = {
        id: post.id,
        userId: postUserId,
        userFullName: post.author?.fullname || 'Usuario desconocido',
        subject: post.subject || 'Sin asunto',
        message: cleanMessage, // ✅ CONTENIDO COMPLETO SIN LIMITACIÓN
        created: post.timecreated || post.created,
        modified: post.timemodified || post.modified,
        parent: post.parentid || post.parent || 0,
        hasAttachments: (post.attachments?.length > 0) || false,
        wordCount: cleanMessage.split(/\s+/).filter(w => w.length > 0).length,
        isTeacherPost: isTeacherPost,
        isDeleted: post.isdeleted || false,
        children: [],
        level: 0
      }
      
      postsMap.set(post.id, processedPost)
      
      if (processedPost.parent === 0) {
        rootPosts.push(processedPost)
      }
    })
    
    // Construir jerarquía
    postsMap.forEach(post => {
      if (post.parent > 0 && postsMap.has(post.parent)) {
        const parent = postsMap.get(post.parent)
        parent.children.push(post)
        post.level = parent.level + 1
      }
    })
    
    // 4. Generar contenido para jerarquía (SIN LIMITACIONES)
    function generateContentSummary(posts, level = 0) {
      return posts.map(post => {
        const childrenSummary = post.children.length > 0 
          ? generateContentSummary(post.children, level + 1)
          : []
        
        return {
          id: post.id,
          level: level,
          author: post.isTeacherPost ? `👨‍🏫 ${post.userFullName}` : `👤 ${post.userFullName}`,
          subject: post.subject,
          message: post.message, // ✅ MENSAJE COMPLETO SIN TRUNCAR
          wordCount: post.wordCount,
          created: new Date(post.created * 1000).toLocaleDateString(),
          hasAttachments: post.hasAttachments,
          repliesCount: post.children.length,
          children: childrenSummary
        }
      })
    }
    
    const hierarchy = generateContentSummary(rootPosts)
    
    // 5. Generar estadísticas
    const allProcessedPosts = Array.from(postsMap.values())
    const stats = {
      totalPosts: postsData.posts.length,
      rootPosts: rootPosts.length,
      maxDepth: Math.max(...allProcessedPosts.map(p => p.level), 0),
      teacherPosts: allProcessedPosts.filter(p => p.isTeacherPost).length,
      studentPosts: allProcessedPosts.filter(p => !p.isTeacherPost).length,
      totalParticipants: new Set(postsData.posts.map(p => p.author?.id || p.userid || p.userId)).size,
      totalWords: allProcessedPosts.reduce((sum, p) => sum + p.wordCount, 0),
      totalChars: totalContentChars,
      postsWithAttachments: allProcessedPosts.filter(p => p.hasAttachments).length,
      averageWordCount: Math.round(allProcessedPosts.reduce((sum, p) => sum + p.wordCount, 0) / postsData.posts.length)
    }
    
    // 6. Simular prompt completo que se enviaría a OpenAI
    const discussionData = {
      name: "Ruta hacia el éxito profesional | Punto de partida",
      posts: allProcessedPosts // Posts con contenido completo
    }
    
    const analysisData = {
      name: "Ruta hacia el éxito profesional | Punto de partida",
      description: "Presentación y expectativas del curso",
      hierarchy: hierarchy,
      stats: stats
    }
    
    // 7. Generar prompt COMPLETO sin limitaciones
    const fullPrompt = `
Eres un experto en análisis educativo. Analiza la siguiente DISCUSIÓN EDUCATIVA y genera un análisis con formato estructurado dinámico:

## CONTEXTO DE LA DISCUSIÓN:
- **Título**: "${discussionData.name}"
- **Descripción**: ${analysisData.description}
- **Posts totales**: ${discussionData.posts?.length || 0}
- **Estructura de conversación**: ${stats.rootPosts} tema(s) principal(es) → ${stats.totalPosts - stats.rootPosts} respuesta(s) → máx. ${stats.maxDepth} niveles de profundidad
- **Profundidad máxima**: ${stats.maxDepth} niveles de respuestas
- **Distribución**: ${stats.teacherPosts} posts del profesor, ${stats.studentPosts} posts de estudiantes
- **Total palabras**: ${stats.totalWords}

## ESTADÍSTICAS EXACTAS QUE DEBES USAR:
⚠️ IMPORTANTE: Usa EXACTAMENTE estas estadísticas en tu análisis, NO las calcules nuevamente:
- Posts del profesor: ${stats.teacherPosts}
- Posts de estudiantes: ${stats.studentPosts}  
- Posts totales: ${discussionData.posts?.length || 0}
- Participantes únicos: ${stats.totalParticipants}

## ESTRUCTURA JERÁRQUICA COMPLETA:
${JSON.stringify(hierarchy, null, 2)}

## CONTENIDO OPTIMIZADO (Todos los posts con contenido completo):
${discussionData.posts?.map((post) => `
${'  '.repeat(post.level || 0)}**${post.userFullName}** (${post.isTeacherPost ? 'Profesor' : 'Estudiante'}) - Nivel ${post.level || 0}:
${'  '.repeat(post.level || 0)}Asunto: "${post.subject}"
${'  '.repeat(post.level || 0)}Mensaje completo: "${post.message}"
${'  '.repeat(post.level || 0)}Palabras: ${post.wordCount}, Respuestas: ${post.children?.length || 0}
${'  '.repeat(post.level || 0)}---
`).join('\n') || 'No hay posts disponibles para mostrar'}

---

**GENERA UN ANÁLISIS CON SECCIONES DINÁMICAS Y ESPECÍFICAS AL CONTEXTO**

[...resto del prompt estándar...]
`
    
    // 8. Calcular tokens del prompt completo
    const promptTokens = estimateTokens(fullPrompt)
    const hierarchyTokens = estimateTokens(JSON.stringify(hierarchy, null, 2))
    const contentTokens = estimateTokens(discussionData.posts?.map(p => p.message).join('\n') || '')
    
    // 9. Mostrar resultados
    console.log('✅ Procesamiento completado\n')
    
    console.log('📊 ANÁLISIS DE CONTENIDO SIN LIMITACIONES:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📝 Posts totales: ${stats.totalPosts}`)
    console.log(`👨‍🏫 Posts del profesor: ${stats.teacherPosts}`)
    console.log(`🎓 Posts de estudiantes: ${stats.studentPosts}`)
    console.log(`👥 Participantes únicos: ${stats.totalParticipants}`)
    console.log(`🔤 Palabras totales: ${stats.totalWords.toLocaleString()}`)
    console.log(`📏 Caracteres totales: ${stats.totalChars.toLocaleString()}`)
    console.log(`📊 Promedio palabras/post: ${stats.averageWordCount}`)
    console.log(`🌳 Profundidad máxima: ${stats.maxDepth} niveles`)
    
    console.log('\n🎯 ESTIMACIÓN DE TOKENS (SIN LIMITACIONES):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📤 Tokens del prompt completo: ${promptTokens.toLocaleString()}`)
    console.log(`🌳 Tokens de jerarquía JSON: ${hierarchyTokens.toLocaleString()}`)
    console.log(`💬 Tokens de contenido puro: ${contentTokens.toLocaleString()}`)
    console.log(`📋 Tokens de contexto/instrucciones: ${(promptTokens - hierarchyTokens - contentTokens).toLocaleString()}`)
    
    console.log('\n📈 COMPARACIÓN CON LÍMITES:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Calcular con límites anteriores (300 chars por post)
    const contentWithLimits = discussionData.posts?.map(p => p.message.substring(0, 300)).join('\n') || ''
    const tokensWithLimits = estimateTokens(contentWithLimits)
    
    console.log(`🔒 Con límites (300 chars/post): ${tokensWithLimits.toLocaleString()} tokens`)
    console.log(`🔓 Sin límites (completo): ${contentTokens.toLocaleString()} tokens`)
    console.log(`📈 Incremento: ${(contentTokens - tokensWithLimits).toLocaleString()} tokens (+${Math.round(((contentTokens - tokensWithLimits) / tokensWithLimits) * 100)}%)`)
    
    console.log('\n💰 ESTIMACIÓN DE COSTOS (OpenAI o3-mini):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    // Costos aproximados para o3-mini (estos valores pueden cambiar)
    const costPer1000InputTokens = 0.00015 // USD por 1000 tokens de entrada
    const costPer1000OutputTokens = 0.0006  // USD por 1000 tokens de salida
    const estimatedOutputTokens = 2500 // Basado en max_completion_tokens
    
    const inputCost = (promptTokens / 1000) * costPer1000InputTokens
    const outputCost = (estimatedOutputTokens / 1000) * costPer1000OutputTokens
    const totalCost = inputCost + outputCost
    
    console.log(`💰 Costo entrada (${promptTokens.toLocaleString()} tokens): $${inputCost.toFixed(6)} USD`)
    console.log(`💰 Costo salida (~${estimatedOutputTokens.toLocaleString()} tokens): $${outputCost.toFixed(6)} USD`)
    console.log(`💰 Costo total estimado: $${totalCost.toFixed(6)} USD por análisis`)
    
    console.log('\n📋 POSTS CON MÁS CONTENIDO (Top 5):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const sortedByLength = postsProcessed
      .filter(p => !p.isTeacher) // Solo estudiantes
      .sort((a, b) => b.messageLength - a.messageLength)
      .slice(0, 5)
    
    sortedByLength.forEach((post, index) => {
      console.log(`${index + 1}. ${post.author}`)
      console.log(`   📏 ${post.messageLength} chars, ${post.wordCount} palabras, ~${post.estimatedTokens} tokens`)
      console.log(`   📋 "${post.subject}"`)
      console.log(`   💬 "${post.fullMessage.substring(0, 150)}${post.fullMessage.length > 150 ? '...' : ''}"`)
      console.log('')
    })
    
    // 10. Guardar datos completos
    console.log('💾 GUARDANDO ANÁLISIS COMPLETO...')
    const fs = require('fs')
    
    const tokenAnalysis = {
      timestamp: new Date().toISOString(),
      forum: {
        id: discussionId,
        name: "Ruta hacia el éxito profesional | Punto de partida"
      },
      contentAnalysis: {
        totalPosts: stats.totalPosts,
        totalWords: stats.totalWords,
        totalChars: stats.totalChars,
        teacherPosts: stats.teacherPosts,
        studentPosts: stats.studentPosts,
        participants: stats.totalParticipants
      },
      tokenEstimation: {
        fullPromptTokens: promptTokens,
        hierarchyTokens: hierarchyTokens,
        contentTokens: contentTokens,
        contextTokens: promptTokens - hierarchyTokens - contentTokens,
        withLimitsTokens: tokensWithLimits,
        incrementTokens: contentTokens - tokensWithLimits,
        incrementPercentage: Math.round(((contentTokens - tokensWithLimits) / tokensWithLimits) * 100)
      },
      costEstimation: {
        inputCostUSD: inputCost,
        outputCostUSD: outputCost,
        totalCostUSD: totalCost,
        costPer1000InputTokens: costPer1000InputTokens,
        costPer1000OutputTokens: costPer1000OutputTokens
      },
      fullPromptGenerated: fullPrompt,
      postsWithFullContent: postsProcessed,
      hierarchyWithFullContent: hierarchy
    }
    
    fs.writeFileSync('token-analysis-no-limits.json', JSON.stringify(tokenAnalysis, null, 2))
    console.log('✅ Análisis guardado en: token-analysis-no-limits.json')
    
    console.log('\n🎯 RESUMEN FINAL:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Limitaciones removidas del código`)
    console.log(`✅ Contenido completo: ${stats.totalWords.toLocaleString()} palabras, ${stats.totalChars.toLocaleString()} caracteres`)
    console.log(`✅ Tokens estimados: ${promptTokens.toLocaleString()} (${Math.round(((contentTokens - tokensWithLimits) / tokensWithLimits) * 100)}% más que con límites)`)
    console.log(`✅ Costo estimado: $${totalCost.toFixed(6)} USD por análisis`)
    console.log(`✅ Análisis será mucho más profundo con contenido completo`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Ejecutar
calculateTokensWithoutLimits()