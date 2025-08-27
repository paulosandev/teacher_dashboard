import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from '@/lib/moodle/api-client'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Singleton pattern para Prisma Client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Verificar si la API key está configurada correctamente
const hasValidApiKey = process.env.OPENAI_API_KEY && 
  process.env.OPENAI_API_KEY !== 'your-openai-api-key' && 
  process.env.OPENAI_API_KEY.startsWith('sk-')

const openai = hasValidApiKey ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.moodleToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar expiración del token
    if (session.user.tokenExpiry && new Date() > new Date(session.user.tokenExpiry)) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 401 })
    }

    const { activityId, activityType, activityData, includeDetailedInfo } = await request.json()

    if (!activityId || !activityType || !activityData) {
      return NextResponse.json({ 
        error: 'Se requiere activityId, activityType y activityData' 
      }, { status: 400 })
    }

    // Determinar courseId desde los datos de la actividad
    const courseId = activityData.course?.toString() || activityData.courseid?.toString()
    
    if (!courseId) {
      return NextResponse.json({ 
        error: 'No se pudo determinar el courseId de la actividad' 
      }, { status: 400 })
    }

    console.log(`🧠 Verificando análisis existente para ${activityType}: ${activityData.name}`)

    // TEMPORALMENTE DESHABILITADO: No usar caché para forzar regeneración con formato nuevo
    // Verificar si ya existe un análisis reciente (menos de 4 horas)
    // const fourHoursAgo = new Date(Date.now() - (4 * 60 * 60 * 1000))
    // const existingAnalysis = await prisma.activityAnalysis.findFirst({
    //   where: {
    //     moodleCourseId: courseId,
    //     activityId: activityId.toString(),
    //     activityType: activityType,
    //     lastUpdated: {
    //       gte: fourHoursAgo
    //     },
    //     isValid: true
    //   }
    // })

    // if (existingAnalysis) {
    //   console.log(`♻️ Usando análisis en cache para ${activityData.name}`)
    //   
    //   return NextResponse.json({
    //     success: true,
    //     analysis: {
    //       // ... análisis en caché
    //     }
    //   })
    // }

    console.log(`🆕 FORZANDO NUEVO ANÁLISIS (caché deshabilitado temporalmente)`)

    console.log(`🧠 Generando nuevo análisis para ${activityType}: ${activityData.name}`)

    // Verificar si OpenAI está disponible
    if (!hasValidApiKey) {
      console.log('⚠️ API key de OpenAI no configurada, devolviendo análisis simulado')
      return NextResponse.json({
        success: true,
        analysis: {
          summary: "Análisis no disponible - API key de OpenAI no configurada",
          positives: ["Actividad detectada correctamente"],
          alerts: ["Configurar API key de OpenAI para generar análisis real"],
          insights: ["Sistema funcionando con datos reales de Moodle"],
          recommendation: "Configurar OPENAI_API_KEY en el archivo .env para habilitar análisis inteligente"
        },
        prompt: "API key no disponible",
        collectedData: activityData
      })
    }

    // Crear cliente API con el token de julioprofe (profesor con permisos completos)
    const professorToken = '3d39bc049d32b05fa10088e55d910d00' // Token de julioprofe con permisos de profesor
    const professorUserId = 29895 // ID de julioprofe en Moodle
    console.log('🔑 Usando token de profesor para análisis completo de datos')
    console.log(`👨‍🏫 Profesor ID: ${professorUserId} (julioprofe)`)
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, professorToken)

    let analysisResult = null

    // Análisis específico por tipo de actividad
    if (activityType === 'forum') {
      analysisResult = await analyzeForum(client, activityData, openai!, professorUserId)
    } else if (activityType === 'assign') {
      analysisResult = await analyzeAssignment(client, activityData, openai!)
    } else if (activityType === 'feedback' || activityType === 'quiz' || activityType === 'choice') {
      analysisResult = await analyzeGenericActivity(client, activityData, openai!, activityType)
    } else {
      return NextResponse.json({ 
        error: `Tipo de actividad no soportado: ${activityType}` 
      }, { status: 400 })
    }

    // Guardar el análisis en la base de datos
    try {
      // Primero buscar si existe
      const existing = await prisma.activityAnalysis.findFirst({
        where: {
          moodleCourseId: courseId,
          activityId: activityId.toString(),
          activityType: activityType
        }
      })

      if (existing) {
        // Actualizar existente
        await prisma.activityAnalysis.update({
          where: { id: existing.id },
          data: {
            summary: analysisResult.summary,
            positives: analysisResult.positives || [],
            alerts: analysisResult.alerts || [],
            insights: analysisResult.insights || [],
            recommendation: analysisResult.recommendation || 'Análisis completado',
            fullAnalysis: analysisResult.fullAnalysis || analysisResult.summary,
            activityData: activityData,
            llmResponse: {
              model: 'o3-mini',
              generatedAt: new Date(),
              // Nuevo formato dinámico
              sections: analysisResult.sections,
              // Mantener compatibilidad con formato anterior
              metricsTable: analysisResult.metricsTable,
              structuredInsights: analysisResult.structuredInsights
            },
            lastUpdated: new Date()
          }
        })
      } else {
        // Crear nuevo
        await prisma.activityAnalysis.create({
          data: {
            courseId: courseId,
            moodleCourseId: courseId,
            activityId: activityId.toString(),
            activityType: activityType,
            activityName: activityData.name,
            summary: analysisResult.summary,
            positives: analysisResult.positives || [],
            alerts: analysisResult.alerts || [],
            insights: analysisResult.insights || [],
            recommendation: analysisResult.recommendation || 'Análisis completado',
            fullAnalysis: analysisResult.fullAnalysis || analysisResult.summary,
            activityData: activityData,
            llmResponse: {
              model: 'o3-mini',
              generatedAt: new Date(),
              // Nuevo formato dinámico
              sections: analysisResult.sections,
              // Mantener compatibilidad con formato anterior
              metricsTable: analysisResult.metricsTable,
              structuredInsights: analysisResult.structuredInsights
            }
          }
        })
      }

      console.log(`💾 Análisis guardado en cache para ${activityData.name}`)
    } catch (dbError) {
      console.error('⚠️ Error guardando en cache (continuando):', dbError)
      // No fallar si hay error en la base de datos, solo continuar
    }

    const response: any = {
      success: true,
      analysis: analysisResult
    }

    // Incluir información adicional si se solicita
    if (includeDetailedInfo) {
      response.prompt = analysisResult.prompt || 'No disponible'
      response.collectedData = {
        activityType,
        activityName: activityData.name,
        rawActivityData: activityData,
        processingTimestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Error en análisis de actividad:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

async function analyzeForum(client: MoodleAPIClient, forumData: any, openai: OpenAI, professorUserId: number) {
  console.log(`💬 Analizando foro: ${forumData.name}`)

  // Determinar si es un foro general o una discusión específica
  const isSpecificDiscussion = forumData.forumDetails?.discussions?.length === 1
  const discussionData = isSpecificDiscussion ? forumData.forumDetails.discussions[0] : null
  
  // Preparar datos para el análisis con nueva estructura jerárquica
  const analysisData = {
    name: forumData.name,
    description: forumData.intro || '',
    config: forumData.forumDetails || {},
    discussions: forumData.forumDetails?.discussions || [],
    allPosts: discussionData?.posts || forumData.forumDetails?.allPosts || [],
    isSpecificDiscussion: isSpecificDiscussion,
    discussionData: discussionData,
    // NUEVO: Agregar datos de jerarquía y contenido optimizado
    hierarchy: discussionData?.hierarchy || null,
    contentSummary: discussionData?.contentSummary || null,
    stats: {
      totalDiscussions: forumData.forumDetails?.numdiscussions || 0,
      totalPosts: forumData.forumDetails?.totalPosts || 0,
      uniqueParticipants: forumData.forumDetails?.uniqueParticipants || 0,
      avgPostsPerParticipant: forumData.forumDetails?.avgPostsPerParticipant || 0,
      // NUEVO: Estadísticas jerárquicas (con fallback)
      maxDepth: discussionData?.contentSummary?.stats?.maxDepth || 0,
      teacherPosts: discussionData?.contentSummary?.stats?.teacherPosts || (discussionData?.posts || []).filter(p => p.isTeacherPost).length || 0,
      studentPosts: discussionData?.contentSummary?.stats?.studentPosts || (discussionData?.posts || []).filter(p => !p.isTeacherPost).length || 0,
      totalWords: discussionData?.contentSummary?.stats?.totalWords || (discussionData?.posts || []).reduce((sum, p) => sum + (p.wordCount || 0), 0) || 0,
      conversationFlow: discussionData?.contentSummary?.conversationFlow || `${(discussionData?.posts || []).length} post(s) total`
    }
  }

  console.log(`📤 DATOS ENVIADOS A PROCESAR - FORO:`)
  console.log(`   📋 Datos del foro:`, JSON.stringify(analysisData, null, 2))
  console.log(`   📊 Estadísticas: ${analysisData.stats.totalDiscussions} discusiones, ${analysisData.stats.totalPosts} posts`)
  console.log(`   👥 ${analysisData.stats.uniqueParticipants} participantes únicos`)

  // Crear prompt dinámico UNIVERSAL para formato consistente
  let prompt: string
  
  // NUEVO: FORMATO ESTRUCTURADO UNIVERSAL para todas las actividades
  if (analysisData.isSpecificDiscussion && analysisData.discussionData) {
    // Prompt para discusión individual con FORMATO ESTRUCTURADO DINÁMICO
    const discussion = analysisData.discussionData
    // Usar ID del profesor para filtrado consistente
    const currentUserId = professorUserId
    
    // Buscar metadatos reales en los posts
    const teacherPost = discussion.posts?.find((p: any) => p.isTeacherPost) || null
    const realStudentMetadata = teacherPost?.realStudentMetadata || null
    
    console.log(`📊 Análisis con metadatos reales:`, realStudentMetadata)
    
    // Usar metadatos reales si están disponibles
    const studentResponseInfo = realStudentMetadata ? 
      `INFORMACIÓN REAL DE ESTUDIANTES:
- Respuestas reales confirmadas: ${realStudentMetadata.totalStudentReplies}
- Última actividad de estudiante: ${realStudentMetadata.lastModifiedUser}
- Fecha de última actividad: ${new Date(realStudentMetadata.lastModifiedTime * 1000).toLocaleString()}
- Hay participación real confirmada: Sí
- Palabras promedio estimadas: ${realStudentMetadata.avgWordsEstimate}

⚠️ IMPORTANTE: Esta discusión tiene ${realStudentMetadata.totalStudentReplies} respuestas reales de estudiantes, pero el contenido específico no está disponible por limitaciones técnicas del API de Moodle.` 
      : 'No se detectó participación de estudiantes'
    
    prompt = `
Eres un experto en análisis educativo. Analiza la siguiente DISCUSIÓN EDUCATIVA y genera un análisis con formato estructurado dinámico:

## CONTEXTO DE LA DISCUSIÓN:
- **Título**: "${discussion.name || discussion.subject}"
- **Descripción**: ${analysisData.description}
- **Posts totales**: ${discussion.posts?.length || 0}
- **Estructura de conversación**: ${analysisData.stats.conversationFlow}
- **Profundidad máxima**: ${analysisData.stats.maxDepth} niveles de respuestas
- **Distribución**: ${analysisData.stats.teacherPosts} posts del profesor, ${analysisData.stats.studentPosts} posts de estudiantes
- **Total palabras**: ${analysisData.stats.totalWords}

## ESTADÍSTICAS EXACTAS QUE DEBES USAR:
⚠️ IMPORTANTE: Usa EXACTAMENTE estas estadísticas en tu análisis, NO las calcules nuevamente:
- Posts del profesor: ${analysisData.stats.teacherPosts}
- Posts de estudiantes: ${analysisData.stats.studentPosts}  
- Posts totales: ${discussion.posts?.length || 0}
- Participantes únicos: ${analysisData.stats.uniqueParticipants}

## DATOS DE PARTICIPACIÓN:
${studentResponseInfo}

## ESTRUCTURA JERÁRQUICA COMPLETA:
${analysisData.hierarchy ? JSON.stringify(analysisData.hierarchy, null, 2) : 'No disponible'}

## CONTENIDO OPTIMIZADO (Primeros 5 posts con jerarquía):
${discussion.posts?.slice(0, 5).map((post: any) => `
${'  '.repeat(post.level || 0)}**${post.userFullName}** (${post.isTeacherPost ? 'Profesor' : 'Estudiante'}) - Nivel ${post.level || 0}:
${'  '.repeat(post.level || 0)}"${post.message.substring(0, 200)}${post.message.length > 200 ? '...' : ''}"
${'  '.repeat(post.level || 0)}↳ ${post.childrenCount || 0} respuesta(s) directa(s)
`).join('\n') || 'No hay posts disponibles para mostrar'}

---

**GENERA UN ANÁLISIS CON SECCIONES DINÁMICAS Y ESPECÍFICAS AL CONTEXTO**

Crea entre 5-7 secciones usando títulos descriptivos que reflejen el contenido real. Evita títulos genéricos. Adapta los nombres según el contexto de la actividad.

**EJEMPLOS DE TÍTULOS DINÁMICOS:**
- "Panorama General del Foro"
- "Patrones de Participación" 
- "Calidad de Interacción"
- "Análisis de Engagement"
- "Distribución Temporal"
- "Profundidad de Discusión"
- "Tendencias de Actividad"
- "Insights Pedagógicos"
- "Oportunidades de Mejora"
- "Estrategias Recomendadas"

**INSTRUCCIONES PARA FORMATO DINÁMICO:**
Como experto analista, decide la mejor forma de presentar cada aspecto del análisis. Puedes crear entre 3-6 secciones, cada una con el formato más apropiado:

**FORMATOS DISPONIBLES:**
- **table**: Para datos comparativos (formato "Header1 | Header2\nRow1 | Row2")
- **numbered-list**: Para pasos secuenciales o prioridades (array de strings)
- **bullet-list**: Para puntos sin orden específico (array de strings)
- **text**: Para explicaciones narrativas (string con markdown)
- **cards**: Para métricas destacadas (array de {title, value, unit?, trend?})
- **metrics**: Para indicadores clave (array de {label, value, unit?})

**INSTRUCCIONES CRÍTICAS SOBRE LAS MÉTRICAS:**
1. SIEMPRE usa las estadísticas exactas proporcionadas en "ESTADÍSTICAS EXACTAS QUE DEBES USAR"
2. Si ves "Posts de estudiantes: 2", tu análisis DEBE reflejar que hay 2 posts de estudiantes
3. NO recalcules ni asumas métricas diferentes a las proporcionadas
4. En la sección "metrics", usa EXACTAMENTE los valores proporcionados

**COLORES SUGERIDOS:** blue, green, yellow, red, purple, gray
**ICONOS:** Usa emojis relevantes (📊 📈 📋 ⚠️ 💡 🎯 📝 etc.)

**RESPONDE ÚNICAMENTE EN FORMATO JSON:**
{
  "summary": "Resumen ejecutivo conciso (1-2 líneas)",
  "sections": [
    {
      "id": "section-1",
      "title": "Título descriptivo y específico",
      "format": "table|numbered-list|bullet-list|text|cards|metrics",
      "content": "Contenido según el formato elegido",
      "priority": 1,
      "icon": "📊",
      "color": "blue"
    }
  ]
}
`
  } else {
    // Prompt para foro general con FORMATO ESTRUCTURADO DINÁMICO UNIVERSAL
    prompt = `
Eres un experto en análisis educativo. Analiza el siguiente FORO EDUCATIVO y genera un análisis con formato estructurado dinámico:

## PANORAMA DEL FORO:
- **Nombre**: ${analysisData.name}
- **Propósito**: ${analysisData.description}
- **Actividad total**: ${analysisData.stats.totalDiscussions} discusiones, ${analysisData.stats.totalPosts} posts
- **Participación**: ${analysisData.stats.uniqueParticipants} participantes únicos (promedio: ${analysisData.stats.avgPostsPerParticipant} posts por persona)

## DISCUSIONES PRINCIPALES:
${analysisData.discussions.slice(0, 5).map((d: any) => `
**"${d.name || d.subject}"**
- Respuestas: ${d.numreplies} | Estudiantes participando: ${d.studentsParticipating || 0}
- Contenido: ${d.message ? d.message.substring(0, 200) + '...' : 'Sin contenido inicial disponible'}
`).join('\n')}

## EJEMPLOS DE PARTICIPACIÓN:
${analysisData.allPosts?.filter((p: any) => p.userId !== professorUserId).slice(0, 3).map((post: any) => `
**En "${post.discussionName}":**
"${post.message.substring(0, 200)}${post.message.length > 200 ? '...' : ''}"
`).join('\n') || 'No se encontraron posts de estudiantes para mostrar'}

---

**GENERA UN ANÁLISIS CON SECCIONES DINÁMICAS Y ESPECÍFICAS AL CONTEXTO**

Crea entre 5-7 secciones usando títulos descriptivos que reflejen el contenido real del foro. Evita títulos genéricos. Adapta los nombres según las características específicas del foro.

**EJEMPLOS DE TÍTULOS DINÁMICOS PARA FOROS:**
- "Panorama General del Foro"
- "Patrones de Participación"
- "Calidad de Interacción"
- "Distribución de Actividad" 
- "Tendencias de Engagement"
- "Dinámicas de Discusión"
- "Análisis de Contenido"
- "Comportamiento Estudiantil"
- "Oportunidades de Mejora"
- "Estrategias Pedagógicas"

**INSTRUCCIONES PARA FORMATO DINÁMICO:**
Como experto analista educativo, decide la mejor forma de presentar el análisis del foro. Crea entre 3-6 secciones con el formato más apropiado para cada tipo de información:

**FORMATOS DISPONIBLES:**
- **table**: Para datos comparativos (formato "Header1 | Header2\nRow1 | Row2")
- **numbered-list**: Para pasos secuenciales o prioridades (array de strings)
- **bullet-list**: Para puntos sin orden específico (array de strings)
- **text**: Para explicaciones narrativas (string con markdown)
- **cards**: Para métricas destacadas (array de {title, value, unit?, trend?})
- **metrics**: Para indicadores clave (array de {label, value, unit?})

**DATOS DISPONIBLES PARA MÉTRICAS:**
- Discusiones: ${analysisData.stats.totalDiscussions}
- Posts: ${analysisData.stats.totalPosts}
- Participantes: ${analysisData.stats.uniqueParticipants}
- Promedio posts/persona: ${analysisData.stats.avgPostsPerParticipant}

**RESPONDE ÚNICAMENTE EN FORMATO JSON:**
{
  "summary": "Resumen ejecutivo del foro (1-2 líneas)",
  "sections": [
    {
      "id": "section-1",
      "title": "Título específico para esta información",
      "format": "table|numbered-list|bullet-list|text|cards|metrics",
      "content": "Contenido apropiado para el formato",
      "priority": 1,
      "icon": "📊",
      "color": "blue"
    }
  ]
}
`
  }

  console.log(`🚀 ENVIANDO A OpenAI - ${analysisData.isSpecificDiscussion ? 'DISCUSIÓN' : 'FORO'}:`)
  console.log(`   🔗 Modelo: o3-mini`)
  console.log(`   📝 Tipo de contenido: ${analysisData.isSpecificDiscussion ? 'Discusión individual' : 'Foro con múltiples discusiones'}`)
  console.log(`   📝 Prompt (primeros 200 chars):`, prompt.substring(0, 200) + '...')
  console.log(`   ⚙️ Configuración: max_completion_tokens=2500 (modelo o3-mini)`)

  // CAPTURAR PROMPT COMPLETO PARA DEBUGGING
  const fs = require('fs');
  const promptData = {
    timestamp: new Date().toISOString(),
    activityType: 'forum',
    activityName: forumData.name,
    activityId: forumData.id,
    systemMessage: "Eres un experto en análisis educativo. Debes responder ÚNICAMENTE en formato JSON válido con la estructura exacta solicitada. Incluye datos cuantitativos en metricsTable cuando sea relevante, y separa insights en numerados (para orden específico) y bullets (para puntos generales). El fullAnalysis debe usar markdown with secciones ##.",
    userPrompt: prompt,
    rawData: analysisData,
    model: "o3-mini",
    maxTokens: 2500
  };
  
  try {
    fs.writeFileSync('/tmp/ultimo-prompt-enviado-openai.json', JSON.stringify(promptData, null, 2));
    console.log('💾 Prompt completo guardado en /tmp/ultimo-prompt-enviado-openai.json');
  } catch (writeError) {
    console.log('⚠️ No se pudo guardar el prompt completo:', writeError.message);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "Eres un experto en análisis educativo. Debes responder ÚNICAMENTE en formato JSON válido con la estructura exacta solicitada. Incluye datos cuantitativos en metricsTable cuando sea relevante, y separa insights en numerados (para orden específico) y bullets (para puntos generales). El fullAnalysis debe usar markdown con secciones ##."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 2500
    })

    const analysisText = completion.choices[0]?.message?.content || ''
    
    console.log('📝 Respuesta de OpenAI (primeros 500 chars):', analysisText.substring(0, 500))
    
    // Procesar la respuesta JSON
    let analysis
    try {
      analysis = JSON.parse(analysisText)
      console.log('✅ JSON parseado correctamente')
      console.log('📊 Campos presentes:')
      console.log('  - summary:', analysis.summary ? '✅' : '❌')
      console.log('  - sections:', analysis.sections ? `✅ (${analysis.sections.length} secciones)` : '❌')
      if (analysis.sections) {
        analysis.sections.forEach((section: any, i: number) => {
          console.log(`    ${i+1}. "${section.title}" (${section.format}) ${section.icon || ''}`)
        })
      }
      
      // Mantener compatibilidad con formato anterior
      if (!analysis.sections && (analysis.metricsTable || analysis.structuredInsights)) {
        console.log('📋 Formato anterior detectado, manteniendo compatibilidad')
        console.log('  - metricsTable:', analysis.metricsTable ? '✅' : '❌')
        console.log('  - structuredInsights:', analysis.structuredInsights ? '✅' : '❌')
      }
      console.log('  - fullAnalysis:', analysis.fullAnalysis ? '✅' : '❌')
    } catch (parseError) {
      console.error('❌ Error parseando JSON de OpenAI:', parseError)
      console.error('❌ Respuesta recibida no es JSON válido:', analysisText.substring(0, 200))
      // Fallback a análisis básico si falla el parsing
      analysis = {
        summary: 'Análisis generado con formato de respaldo',
        fullAnalysis: analysisText,
        positives: ['Contenido disponible para revisión'],
        alerts: ['Formato de respuesta no estructurado'],
        insights: ['Requiere revisión manual'],
        recommendation: 'Revisar configuración del análisis'
      }
    }
    
    console.log(`✅ Análisis de foro completado para: ${forumData.name}`)
    
    return {
      ...analysis,
      activityId: forumData.id,
      activityType: 'forum',
      activityName: forumData.name,
      rawData: analysisData,
      prompt: prompt, // Guardar el prompt usado
      generatedAt: new Date().toISOString()
    }

  } catch (error) {
    console.error('❌ Error en análisis de foro:', error)
    throw new Error('Error al generar análisis del foro')
  }
}

async function analyzeAssignment(client: MoodleAPIClient, assignmentData: any, openai: OpenAI) {
  console.log(`📝 Analizando asignación: ${assignmentData.name}`)

  // Preparar datos para el análisis
  const analysisData = {
    name: assignmentData.name,
    description: assignmentData.intro || '',
    config: assignmentData.assignDetails || {},
    stats: {
      submissionCount: assignmentData.assignDetails?.submissionCount || 0,
      gradeCount: assignmentData.assignDetails?.gradeCount || 0,
      avgGrade: assignmentData.assignDetails?.avgGrade || 0,
      gradingProgress: assignmentData.assignDetails?.gradingProgress || 0
    },
    dates: {
      duedate: assignmentData.duedate,
      cutoffdate: assignmentData.cutoffdate,
      status: assignmentData.status
    }
  }

  console.log(`📤 DATOS ENVIADOS A PROCESAR - ASIGNACIÓN:`)
  console.log(`   📋 Datos de la asignación:`, JSON.stringify(analysisData, null, 2))
  console.log(`   📊 Entregas: ${analysisData.stats.submissionCount}, Calificadas: ${analysisData.stats.gradeCount}`)
  console.log(`   📈 Progreso: ${analysisData.stats.gradingProgress}%, Promedio: ${analysisData.stats.avgGrade}`)

  // Prompt ESTRUCTURADO DINÁMICO para asignaciones
  const prompt = `
Eres un experto en análisis educativo. Analiza la siguiente ASIGNACIÓN EDUCATIVA y genera un análisis con formato estructurado dinámico:

## DATOS DE LA ASIGNACIÓN:
- **Nombre**: ${analysisData.name}
- **Descripción**: ${analysisData.description}
- **Estado**: ${analysisData.dates.status}
- **Entregas recibidas**: ${analysisData.stats.submissionCount}
- **Calificaciones completadas**: ${analysisData.stats.gradeCount}
- **Promedio de calificación**: ${analysisData.stats.avgGrade}
- **Progreso de calificación**: ${analysisData.stats.gradingProgress}%

## CONFIGURACIÓN:
- **Intentos máximos**: ${analysisData.config.maxattempts === -1 ? 'Ilimitados' : analysisData.config.maxattempts}
- **Borradores permitidos**: ${analysisData.config.submissiondrafts ? 'Sí' : 'No'}
- **Calificación ciega**: ${analysisData.config.blindmarking ? 'Sí' : 'No'}

---

**GENERA UN ANÁLISIS CON SECCIONES DINÁMICAS Y ESPECÍFICAS AL CONTEXTO**

Crea entre 5-7 secciones usando títulos descriptivos que reflejen el contenido real de la asignación. Evita títulos genéricos. Adapta los nombres según las características específicas de la asignación.

**EJEMPLOS DE TÍTULOS DINÁMICOS PARA ASIGNACIONES:**
- "Panorama de Entregas"
- "Análisis de Cumplimiento"
- "Patrones de Submission"
- "Calidad de Trabajos"
- "Tendencias de Calificación"
- "Efectividad Pedagógica"
- "Configuración Académica"
- "Insights de Rendimiento"
- "Oportunidades de Mejora"
- "Estrategias Docentes"

**INSTRUCCIONES PARA FORMATO DINÁMICO:**
Como experto analista educativo, decide la mejor forma de presentar cada aspecto del análisis. Crea entre 3-6 secciones con el formato más apropiado:

**FORMATOS DISPONIBLES:**
- **table**: Para datos comparativos (formato "Header1 | Header2\nRow1 | Row2")
- **numbered-list**: Para pasos secuenciales o prioridades (array de strings)
- **bullet-list**: Para puntos sin orden específico (array de strings)
- **text**: Para explicaciones narrativas (string con markdown)
- **cards**: Para métricas destacadas (array de {title, value, unit?, trend?})
- **metrics**: Para indicadores clave (array de {label, value, unit?})

**RESPONDE ÚNICAMENTE EN FORMATO JSON:**
{
  "summary": "Resumen ejecutivo conciso (1-2 líneas)",
  "sections": [
    {
      "id": "section-1",
      "title": "Título descriptivo y específico",
      "format": "table|numbered-list|bullet-list|text|cards|metrics",
      "content": "Contenido según el formato elegido",
      "priority": 1,
      "icon": "📊",
      "color": "blue"
    }
  ]
}
`

  console.log(`🚀 ENVIANDO A OpenAI - ASIGNACIÓN:`)
  console.log(`   🔗 Modelo: o3-mini`)
  console.log(`   📝 Prompt (primeros 200 chars):`, prompt.substring(0, 200) + '...')
  console.log(`   ⚙️ Configuración: max_completion_tokens=2500 (modelo o3-mini)`)

  // CAPTURAR PROMPT COMPLETO PARA DEBUGGING
  const fs = require('fs');
  const promptData = {
    timestamp: new Date().toISOString(),
    activityType: 'assign',
    activityName: assignmentData.name,
    activityId: assignmentData.id,
    systemMessage: "Eres un experto en análisis educativo. Debes responder ÚNICAMENTE en formato JSON válido con la estructura exacta solicitada. Incluye datos cuantitativos en metricsTable cuando sea relevante, y separa insights en numerados (para orden específico) y bullets (para puntos generales). El fullAnalysis debe usar markdown con secciones ##.",
    userPrompt: prompt,
    rawData: analysisData,
    model: "o3-mini",
    maxTokens: 2500
  };
  
  try {
    fs.writeFileSync('/tmp/ultimo-prompt-enviado-openai.json', JSON.stringify(promptData, null, 2));
    console.log('💾 Prompt completo guardado en /tmp/ultimo-prompt-enviado-openai.json');
  } catch (writeError) {
    console.log('⚠️ No se pudo guardar el prompt completo:', writeError.message);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "Eres un experto en análisis educativo. Debes responder ÚNICAMENTE en formato JSON válido con la estructura exacta solicitada. Incluye datos cuantitativos en metricsTable cuando sea relevante, y separa insights en numerados (para orden específico) y bullets (para puntos generales). El fullAnalysis debe usar markdown con secciones ##."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 2500
    })

    const analysisText = completion.choices[0]?.message?.content || ''
    
    console.log('📝 Respuesta de OpenAI (primeros 500 chars):', analysisText.substring(0, 500))
    
    // Procesar la respuesta JSON
    let analysis
    try {
      analysis = JSON.parse(analysisText)
      console.log('✅ JSON parseado correctamente')
      console.log('📊 Campos presentes:')
      console.log('  - summary:', analysis.summary ? '✅' : '❌')
      console.log('  - sections:', analysis.sections ? `✅ (${analysis.sections.length} secciones)` : '❌')
      if (analysis.sections) {
        analysis.sections.forEach((section: any, i: number) => {
          console.log(`    ${i+1}. "${section.title}" (${section.format}) ${section.icon || ''}`)
        })
      }
      
      // Mantener compatibilidad con formato anterior
      if (!analysis.sections && (analysis.metricsTable || analysis.structuredInsights)) {
        console.log('📋 Formato anterior detectado, manteniendo compatibilidad')
        console.log('  - metricsTable:', analysis.metricsTable ? '✅' : '❌')
        console.log('  - structuredInsights:', analysis.structuredInsights ? '✅' : '❌')
      }
    } catch (parseError) {
      console.error('❌ Error parseando JSON de OpenAI:', parseError)
      // Fallback a análisis básico si falla el parsing
      analysis = {
        summary: 'Análisis generado con formato de respaldo',
        fullAnalysis: analysisText,
        positives: ['Contenido disponible para revisión'],
        alerts: ['Formato de respuesta no estructurado'],
        insights: ['Requiere revisión manual'],
        recommendation: 'Revisar configuración del análisis'
      }
    }
    
    console.log(`✅ Análisis de asignación completado para: ${assignmentData.name}`)
    
    return {
      ...analysis,
      activityId: assignmentData.id,
      activityType: 'assign',
      activityName: assignmentData.name,
      rawData: analysisData,
      prompt: prompt, // Guardar el prompt usado
      generatedAt: new Date().toISOString()
    }

  } catch (error) {
    console.error('❌ Error en análisis de asignación:', error)
    throw new Error('Error al generar análisis de la asignación')
  }
}

function parseFlexibleAnalysis(text: string) {
  // Procesar la respuesta de forma flexible - toda la respuesta como un análisis completo
  // Dividir por párrafos si hay múltiples
  const paragraphs = text
    .split('\n\n')
    .map(p => p.trim())
    .filter(p => p.length > 20) // Filtrar párrafos muy cortos
  
  if (paragraphs.length <= 1) {
    // Si es un solo bloque, usar todo como resumen
    return {
      summary: text.trim(),
      positives: [],
      alerts: [],
      insights: [],
      recommendation: '',
      fullAnalysis: text.trim()
    }
  } else {
    // Si hay múltiples párrafos, usar el primero como resumen y el resto como insights
    return {
      summary: paragraphs[0],
      positives: [],
      alerts: [],
      insights: paragraphs.slice(1),
      recommendation: '',
      fullAnalysis: text.trim()
    }
  }
}

function parseForumAnalysis(text: string) {
  // Función para extraer secciones del análisis de foro
  const sections = {
    summary: extractSection(text, ['RESUMEN GENERAL', 'RESUMEN DE PARTICIPACIÓN']),
    positives: extractListSection(text, ['ASPECTOS POSITIVOS', 'ELEMENTOS POSITIVOS']),
    alerts: extractListSection(text, ['ÁREAS DE MEJORA', 'ALERTAS', 'PROBLEMAS']),
    insights: extractListSection(text, ['INSIGHTS CLAVE', 'ELEMENTOS CLAVE']),
    recommendation: extractSection(text, ['RECOMENDACIÓN DOCENTE', 'ACCIÓN RECOMENDADA'])
  }
  
  return sections
}

function parseAssignmentAnalysis(text: string) {
  // Función para extraer secciones del análisis de asignación
  const sections = {
    summary: extractSection(text, ['RESUMEN DE ENTREGAS', 'RESUMEN GENERAL']),
    positives: extractListSection(text, ['ASPECTOS POSITIVOS', 'ELEMENTOS POSITIVOS']),
    alerts: extractListSection(text, ['ALERTAS IMPORTANTES', 'PROBLEMAS']),
    insights: extractListSection(text, ['ANÁLISIS PEDAGÓGICO', 'INSIGHTS PEDAGÓGICOS']),
    recommendation: extractSection(text, ['ACCIÓN RECOMENDADA', 'RECOMENDACIÓN'])
  }
  
  return sections
}

function extractSection(text: string, keywords: string[]): string {
  for (const keyword of keywords) {
    const regex = new RegExp(`${keyword}[^:]*:?([\\s\\S]*?)(?=\\n\\d+\\.|\\n[A-Z]{2,}|$)`, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      return match[1].trim().replace(/^\*\*|\*\*$/g, '').trim()
    }
  }
  return 'No disponible'
}

function extractListSection(text: string, keywords: string[]): string[] {
  for (const keyword of keywords) {
    const regex = new RegExp(`${keyword}[^:]*:([\\s\\S]*?)(?=\\n\\d+\\.|\\n[A-Z]{2,}|$)`, 'i')
    const match = text.match(regex)
    if (match && match[1]) {
      const items = match[1]
        .split(/\n/)
        .map(line => line.trim())
        .filter(line => line.startsWith('-') || line.startsWith('•') || line.startsWith('*'))
        .map(line => line.replace(/^[-•*]\s*/, '').trim())
        .filter(line => line.length > 10)
      
      return items.length > 0 ? items : ['Análisis en progreso']
    }
  }
  return ['No disponible']
}

async function analyzeGenericActivity(client: MoodleAPIClient, activityData: any, openai: OpenAI, activityType: string) {
  console.log(`🎯 Analizando actividad ${activityType}: ${activityData.name}`)

  // Mapeo de tipos de actividad
  const typeLabels: { [key: string]: string } = {
    'feedback': 'Encuesta/Retroalimentación',
    'quiz': 'Cuestionario/Quiz',
    'choice': 'Elección/Votación'
  }

  const typeLabel = typeLabels[activityType] || 'Actividad'

  // Preparar datos para el análisis
  const analysisData = {
    name: activityData.name,
    description: activityData.intro || '',
    status: activityData.status,
    type: typeLabel,
    participants: activityData.participants || 0,
    responses: activityData.responses || 0
  }

  console.log(`📤 DATOS ENVIADOS A PROCESAR - ${typeLabel.toUpperCase()}:`)
  console.log(`   📋 Datos de la actividad:`, JSON.stringify(analysisData, null, 2))
  console.log(`   👥 Participantes: ${analysisData.participants}, Respuestas: ${analysisData.responses}`)
  console.log(`   📊 Estado: ${analysisData.status}`)

  // Prompt ESTRUCTURADO DINÁMICO para actividades genéricas
  const prompt = `
Eres un experto en análisis educativo. Analiza la siguiente ACTIVIDAD EDUCATIVA y genera un análisis con formato estructurado dinámico:

## DATOS DE LA ACTIVIDAD:
- **Nombre**: ${analysisData.name}
- **Tipo**: ${analysisData.type}
- **Descripción**: ${analysisData.description}
- **Estado**: ${analysisData.status}
- **Participantes**: ${analysisData.participants}
- **Respuestas**: ${analysisData.responses}

---

**GENERA UN ANÁLISIS CON SECCIONES DINÁMICAS Y ESPECÍFICAS AL CONTEXTO**

Crea entre 5-7 secciones usando títulos descriptivos que reflejen el contenido real de la actividad. Evita títulos genéricos. Adapta los nombres según el tipo específico de actividad (${typeLabel}).

**EJEMPLOS DE TÍTULOS DINÁMICOS PARA ${typeLabel.toUpperCase()}:**
- "Panorama de Participación"
- "Análisis de Respuestas"
- "Patrones de Engagement"
- "Calidad de Interacción"
- "Tendencias de Actividad"
- "Efectividad Pedagógica"
- "Comportamiento Estudiantil"
- "Insights de Aprendizaje"
- "Oportunidades de Mejora"
- "Estrategias Recomendadas"

**INSTRUCCIONES ESPECIALES PARA PRESENTACIÓN VISUAL:**
- Si tienes datos cuantitativos importantes (métricas, porcentajes, conteos), incluye una tabla en "metricsTable" usando formato "Indicador | Valor"
- Para análisis complejos que requieren numeración específica, usa "structuredInsights.numbered"
- Para puntos clave sin orden específico, usa "structuredInsights.bullets"
- Incluir tanto formatos estructurados como tradicionales para compatibilidad

**RESPONDE ÚNICAMENTE EN FORMATO JSON:**
{
  "summary": "Resumen ejecutivo del análisis (2-3 líneas)",
  "fullAnalysis": "Análisis completo en markdown con secciones ## dinámicas",
  "positives": ["aspecto positivo 1", "aspecto positivo 2"],
  "alerts": ["alerta importante 1", "alerta importante 2"],
  "insights": ["insight clave 1", "insight clave 2"],
  "recommendation": "Recomendación principal específica",
  "metricsTable": "Indicador | Valor observado\nTipo de actividad | ${analysisData.name || 'Actividad educativa'}\nEstado | ${analysisData.status || 'Activa'}\nParticipantes | ${analysisData.participants}\nRespuestas | ${analysisData.responses}",
  "structuredInsights": {
    "numbered": ["1. Insight prioritario sobre la actividad", "2. Observación sobre configuración"],
    "bullets": ["• Aspecto destacado", "• Área de atención", "• Recomendación específica"]
  }
}
`

  console.log(`🚀 ENVIANDO A OpenAI - ${typeLabel.toUpperCase()}:`)
  console.log(`   🔗 Modelo: o3-mini`)
  console.log(`   📝 Prompt (primeros 200 chars):`, prompt.substring(0, 200) + '...')
  console.log(`   ⚙️ Configuración: max_completion_tokens=2500 (modelo o3-mini)`)

  // CAPTURAR PROMPT COMPLETO PARA DEBUGGING
  const fs = require('fs');
  const promptData = {
    timestamp: new Date().toISOString(),
    activityType: activityType,
    activityName: activityData.name,
    activityId: activityData.id,
    systemMessage: "Eres un experto en análisis educativo. Debes responder ÚNICAMENTE en formato JSON válido con la estructura exacta solicitada. Incluye datos cuantitativos en metricsTable cuando sea relevante, y separa insights en numerados (para orden específico) y bullets (para puntos generales). El fullAnalysis debe usar markdown con secciones ##.",
    userPrompt: prompt,
    rawData: analysisData,
    model: "o3-mini",
    maxTokens: 2500
  };
  
  try {
    fs.writeFileSync('/tmp/ultimo-prompt-enviado-openai.json', JSON.stringify(promptData, null, 2));
    console.log('💾 Prompt completo guardado en /tmp/ultimo-prompt-enviado-openai.json');
  } catch (writeError) {
    console.log('⚠️ No se pudo guardar el prompt completo:', writeError.message);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "Eres un experto en análisis educativo. Debes responder ÚNICAMENTE en formato JSON válido con la estructura exacta solicitada. Incluye datos cuantitativos en metricsTable cuando sea relevante, y separa insights en numerados (para orden específico) y bullets (para puntos generales). El fullAnalysis debe usar markdown con secciones ##."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_completion_tokens: 2500
    })

    const analysisText = completion.choices[0]?.message?.content || ''
    
    console.log('📝 Respuesta de OpenAI (primeros 500 chars):', analysisText.substring(0, 500))
    
    // Procesar la respuesta JSON
    let analysis
    try {
      analysis = JSON.parse(analysisText)
      console.log('✅ JSON parseado correctamente')
      console.log('📊 Campos presentes:')
      console.log('  - summary:', analysis.summary ? '✅' : '❌')
      console.log('  - sections:', analysis.sections ? `✅ (${analysis.sections.length} secciones)` : '❌')
      if (analysis.sections) {
        analysis.sections.forEach((section: any, i: number) => {
          console.log(`    ${i+1}. "${section.title}" (${section.format}) ${section.icon || ''}`)
        })
      }
      
      // Mantener compatibilidad con formato anterior
      if (!analysis.sections && (analysis.metricsTable || analysis.structuredInsights)) {
        console.log('📋 Formato anterior detectado, manteniendo compatibilidad')
        console.log('  - metricsTable:', analysis.metricsTable ? '✅' : '❌')
        console.log('  - structuredInsights:', analysis.structuredInsights ? '✅' : '❌')
      }
    } catch (parseError) {
      console.error('❌ Error parseando JSON de OpenAI:', parseError)
      // Fallback a análisis básico si falla el parsing
      analysis = {
        summary: 'Análisis generado con formato de respaldo',
        fullAnalysis: analysisText,
        positives: ['Contenido disponible para revisión'],
        alerts: ['Formato de respuesta no estructurado'],
        insights: ['Requiere revisión manual'],
        recommendation: 'Revisar configuración del análisis'
      }
    }
    
    console.log(`✅ Análisis de ${typeLabel} completado para: ${activityData.name}`)
    
    return {
      ...analysis,
      activityId: activityData.id,
      activityType: activityType,
      activityName: activityData.name,
      rawData: analysisData,
      prompt: prompt, // Guardar el prompt usado
      generatedAt: new Date().toISOString()
    }

  } catch (error) {
    console.error(`❌ Error en análisis de ${typeLabel}:`, error)
    throw new Error(`Error al generar análisis de ${typeLabel}`)
  }
}

function parseGenericAnalysis(text: string) {
  // Función para extraer secciones del análisis genérico
  const sections = {
    summary: extractSection(text, ['RESUMEN DE PARTICIPACIÓN', 'RESUMEN GENERAL']),
    positives: extractListSection(text, ['ASPECTOS POSITIVOS', 'ELEMENTOS POSITIVOS']),
    alerts: extractListSection(text, ['ÁREAS DE MEJORA', 'PROBLEMAS']),
    insights: extractListSection(text, ['INSIGHTS PEDAGÓGICOS', 'ELEMENTOS PEDAGÓGICOS']),
    recommendation: extractSection(text, ['RECOMENDACIÓN DOCENTE', 'ACCIÓN RECOMENDADA'])
  }
  
  return sections
}