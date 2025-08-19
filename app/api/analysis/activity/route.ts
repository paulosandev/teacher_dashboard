import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from '@/lib/moodle/api-client'
import { PrismaClient } from '@prisma/client'
import OpenAI from 'openai'

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

    // Verificar si ya existe un análisis reciente (menos de 4 horas)
    const fourHoursAgo = new Date(Date.now() - (4 * 60 * 60 * 1000))
    const existingAnalysis = await prisma.activityAnalysis.findFirst({
      where: {
        moodleCourseId: courseId,
        activityId: activityId.toString(),
        activityType: activityType,
        lastUpdated: {
          gte: fourHoursAgo
        },
        isValid: true
      }
    })

    if (existingAnalysis) {
      console.log(`♻️ Usando análisis en cache para ${activityData.name}`)
      
      return NextResponse.json({
        success: true,
        analysis: {
          summary: existingAnalysis.summary,
          positives: existingAnalysis.positives,
          alerts: existingAnalysis.alerts,
          insights: existingAnalysis.insights,
          recommendation: existingAnalysis.recommendation,
          generatedAt: existingAnalysis.generatedAt.toISOString(),
          activityName: existingAnalysis.activityName,
          activityId: existingAnalysis.activityId,
          activityType: existingAnalysis.activityType,
          fromCache: true
        }
      })
    }

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
            positives: analysisResult.positives,
            alerts: analysisResult.alerts,
            insights: analysisResult.insights,
            recommendation: analysisResult.recommendation,
            activityData: activityData,
            llmResponse: { model: 'gpt-4', generatedAt: new Date() },
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
            positives: analysisResult.positives,
            alerts: analysisResult.alerts,
            insights: analysisResult.insights,
            recommendation: analysisResult.recommendation,
            activityData: activityData,
            llmResponse: { model: 'gpt-4', generatedAt: new Date() }
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
  
  // Preparar datos para el análisis
  const analysisData = {
    name: forumData.name,
    description: forumData.intro || '',
    config: forumData.forumDetails || {},
    discussions: forumData.forumDetails?.discussions || [],
    allPosts: forumData.forumDetails?.allPosts || [],
    isSpecificDiscussion: isSpecificDiscussion,
    discussionData: discussionData,
    stats: {
      totalDiscussions: forumData.forumDetails?.numdiscussions || 0,
      totalPosts: forumData.forumDetails?.totalPosts || 0,
      uniqueParticipants: forumData.forumDetails?.uniqueParticipants || 0,
      avgPostsPerParticipant: forumData.forumDetails?.avgPostsPerParticipant || 0
    }
  }

  console.log(`📤 DATOS ENVIADOS A PROCESAR - FORO:`)
  console.log(`   📋 Datos del foro:`, JSON.stringify(analysisData, null, 2))
  console.log(`   📊 Estadísticas: ${analysisData.stats.totalDiscussions} discusiones, ${analysisData.stats.totalPosts} posts`)
  console.log(`   👥 ${analysisData.stats.uniqueParticipants} participantes únicos`)

  // Crear prompt dinámico basado en el tipo de contenido
  let prompt: string
  
  if (analysisData.isSpecificDiscussion && analysisData.discussionData) {
    // Prompt específico para una discusión individual
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
Analiza la siguiente DISCUSIÓN EDUCATIVA (espacio dentro de un foro) y proporciona un análisis completo:

## DATOS DE LA DISCUSIÓN:
- Título: "${discussion.name || discussion.subject}"
- Descripción del foro: ${analysisData.description}
- Posts totales: ${discussion.posts?.length || 0}
- Mensaje inicial del profesor: ${discussion.message ? discussion.message.substring(0, 300) + '...' : 'Sin contenido inicial'}

## ${studentResponseInfo}

Por favor, proporciona un análisis estructurado con:

1. **RESUMEN DE PARTICIPACIÓN EN LA DISCUSIÓN** (2-3 líneas):
   - Nivel de engagement de los estudiantes
   - Calidad de las respuestas

2. **ASPECTOS POSITIVOS** (3-4 puntos específicos):
   - Elementos destacables de las aportaciones
   - Profundidad del diálogo
   - Evidencia de aprendizaje

3. **ÁREAS DE MEJORA** (2-3 alertas o recomendaciones):
   - Patrones problemáticos identificados
   - Oportunidades para incrementar participación

4. **INSIGHTS PEDAGÓGICOS** (2-3 puntos):
   - Elementos relevantes para la evaluación
   - Indicadores de comprensión del tema

5. **RECOMENDACIÓN DOCENTE INMEDIATA**:
   - Una estrategia específica para mejorar esta discusión

El análisis debe enfocarse en la calidad del diálogo y el aprendizaje evidenciado.
`
  } else {
    // Prompt para foro general con múltiples discusiones
    prompt = `
Analiza el siguiente FORO EDUCATIVO con múltiples discusiones y proporciona un análisis completo:

## DATOS DEL FORO:
- Nombre: ${analysisData.name}
- Descripción: ${analysisData.description}
- Discusiones totales: ${analysisData.stats.totalDiscussions}
- Posts totales: ${analysisData.stats.totalPosts}
- Participantes únicos: ${analysisData.stats.uniqueParticipants}
- Promedio posts por participante: ${analysisData.stats.avgPostsPerParticipant}

## DISCUSIONES ACTIVAS:
${analysisData.discussions.slice(0, 5).map((d: any) => `
- "${d.name || d.subject}"
  Respuestas: ${d.numreplies} | Estudiantes: ${d.studentsParticipating || 0}
  Contenido inicial: ${d.message ? d.message.substring(0, 200) + '...' : 'Sin contenido'}
`).join('\n')}

## APORTACIONES DE ESTUDIANTES:
${analysisData.allPosts?.filter((p: any) => p.userId !== professorUserId).slice(0, 3).map((post: any) => `
- En "${post.discussionName}":
  ${post.message.substring(0, 150)}${post.message.length > 150 ? '...' : ''}
`).join('\n') || 'No hay posts de estudiantes disponibles'}

Por favor, proporciona un análisis estructurado con:

1. **RESUMEN GENERAL DEL FORO** (2-3 líneas):
   - Nivel de actividad general
   - Distribución de participación entre discusiones

2. **ASPECTOS POSITIVOS** (3-4 puntos específicos):
   - Elementos destacables de la participación
   - Calidad de las interacciones
   - Cumplimiento de objetivos pedagógicos

3. **ÁREAS DE MEJORA** (2-3 alertas o recomendaciones):
   - Problemas identificados
   - Discusiones con baja participación

4. **INSIGHTS CLAVE PARA EVALUACIÓN** (2-3 puntos):
   - Elementos relevantes para la evaluación académica
   - Patrones de comportamiento estudiantil

5. **RECOMENDACIÓN DOCENTE INMEDIATA**:
   - Una acción específica y práctica que el profesor puede tomar

El análisis debe ser profesional, basado en datos pedagógicos y útil para un profesor universitario.
`
  }

  console.log(`🚀 ENVIANDO A OpenAI - ${analysisData.isSpecificDiscussion ? 'DISCUSIÓN' : 'FORO'}:`)
  console.log(`   🔗 Modelo: gpt-4`)
  console.log(`   📝 Tipo de contenido: ${analysisData.isSpecificDiscussion ? 'Discusión individual' : 'Foro con múltiples discusiones'}`)
  console.log(`   📝 Prompt (primeros 200 chars):`, prompt.substring(0, 200) + '...')
  console.log(`   ⚙️ Configuración: max_tokens=1500, temperature=0.3`)

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: analysisData.isSpecificDiscussion 
            ? "Eres un experto en análisis educativo especializado en evaluar discusiones académicas individuales. Enfócate en la calidad del diálogo, profundidad de las respuestas y evidencia de aprendizaje en la conversación."
            : "Eres un experto en análisis educativo y evaluación de participación estudiantil en foros académicos. Proporciona análisis detallados, prácticos y basados en evidencia pedagógica."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })

    const analysisText = completion.choices[0]?.message?.content || ''
    
    // Parsear la respuesta en secciones estructuradas
    const analysis = parseForumAnalysis(analysisText)
    
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

  // Crear prompt específico para análisis de asignación
  const prompt = `
Analiza la siguiente asignación educativa y proporciona un análisis completo:

## DATOS DE LA ASIGNACIÓN:
- Nombre: ${analysisData.name}
- Descripción: ${analysisData.description}
- Estado: ${analysisData.dates.status}
- Entregas recibidas: ${analysisData.stats.submissionCount}
- Calificaciones completadas: ${analysisData.stats.gradeCount}
- Promedio de calificación: ${analysisData.stats.avgGrade}
- Progreso de calificación: ${analysisData.stats.gradingProgress}%

## CONFIGURACIÓN:
- Intentos máximos: ${analysisData.config.maxattempts === -1 ? 'Ilimitados' : analysisData.config.maxattempts}
- Borradores permitidos: ${analysisData.config.submissiondrafts ? 'Sí' : 'No'}
- Calificación ciega: ${analysisData.config.blindmarking ? 'Sí' : 'No'}

Por favor, proporciona un análisis estructurado con:

1. **RESUMEN DE ENTREGAS** (2-3 líneas):
   - Estado general de las entregas
   - Nivel de cumplimiento

2. **ASPECTOS POSITIVOS** (3-4 puntos):
   - Elementos destacables
   - Indicadores de éxito

3. **ALERTAS IMPORTANTES** (2-3 puntos):
   - Problemas identificados
   - Riesgos o preocupaciones

4. **ANÁLISIS PEDAGÓGICO** (2-3 puntos):
   - Efectividad de la configuración
   - Cumplimiento de objetivos de aprendizaje

5. **ACCIÓN RECOMENDADA**:
   - Una estrategia específica para el profesor

El análisis debe ser profesional y orientado a la mejora del proceso educativo.
`

  console.log(`🚀 ENVIANDO A OpenAI - ASIGNACIÓN:`)
  console.log(`   🔗 Modelo: gpt-4`)
  console.log(`   📝 Prompt (primeros 200 chars):`, prompt.substring(0, 200) + '...')
  console.log(`   ⚙️ Configuración: max_tokens=1500, temperature=0.3`)

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Eres un experto en evaluación educativa y análisis de asignaciones académicas. Proporciona análisis prácticos y orientados a la mejora pedagógica."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })

    const analysisText = completion.choices[0]?.message?.content || ''
    
    // Parsear la respuesta en secciones estructuradas
    const analysis = parseAssignmentAnalysis(analysisText)
    
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

  // Crear prompt genérico
  const prompt = `
Analiza la siguiente actividad educativa de tipo "${typeLabel}" y proporciona un análisis completo:

## DATOS DE LA ACTIVIDAD:
- Nombre: ${analysisData.name}
- Tipo: ${analysisData.type}
- Descripción: ${analysisData.description}
- Estado: ${analysisData.status}
- Participantes: ${analysisData.participants}
- Respuestas: ${analysisData.responses}

Por favor, proporciona un análisis estructurado con:

1. **RESUMEN DE PARTICIPACIÓN** (2-3 líneas):
   - Estado general de la actividad
   - Nivel de participación estudiantil

2. **ASPECTOS POSITIVOS** (3-4 puntos):
   - Elementos destacables
   - Indicadores de éxito

3. **ÁREAS DE MEJORA** (2-3 puntos):
   - Problemas identificados
   - Oportunidades de mejora

4. **INSIGHTS PEDAGÓGICOS** (2-3 puntos):
   - Elementos relevantes para el aprendizaje
   - Patrones de comportamiento estudiantil

5. **RECOMENDACIÓN DOCENTE**:
   - Una acción específica para el profesor

El análisis debe ser profesional y orientado a la mejora pedagógica.
`

  console.log(`🚀 ENVIANDO A OpenAI - ${typeLabel.toUpperCase()}:`)
  console.log(`   🔗 Modelo: gpt-4`)
  console.log(`   📝 Prompt (primeros 200 chars):`, prompt.substring(0, 200) + '...')
  console.log(`   ⚙️ Configuración: max_tokens=1500, temperature=0.3`)

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Eres un experto en análisis educativo especializado en actividades de ${typeLabel}. Proporciona análisis prácticos y orientados a la mejora pedagógica.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    })

    const analysisText = completion.choices[0]?.message?.content || ''
    
    // Parsear la respuesta en secciones estructuradas
    const analysis = parseGenericAnalysis(analysisText)
    
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