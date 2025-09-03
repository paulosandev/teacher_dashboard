import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth/auth-options'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import { MoodleAPIClient } from '@/lib/moodle/api-client'

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

// Función para transformar la respuesta markdown de OpenAI al formato esperado por el frontend
function transformAnalysisResponse(rawAnalysisText: string): any {
  // Si la respuesta viene como markdown, procesarla
  if (typeof rawAnalysisText === 'string' && rawAnalysisText.includes('####')) {
    // Dividir por dimensiones (#### encabezados)
    const dimensions = rawAnalysisText.split('####').filter(section => section.trim().length > 0)
    
    const strengths = []
    const alerts = []
    const insights = []
    let summary = 'Análisis de foro completado'
    let nextStep = 'Continuar monitoreando la actividad'

    dimensions.forEach((dimension, index) => {
      const lines = dimension.split('\n').filter(line => line.trim().length > 0)
      const title = lines[0]?.trim() || `Dimensión ${index + 1}`
      
      // Extraer puntos principales de cada dimensión
      const bulletPoints = lines.filter(line => line.trim().startsWith('*') || line.trim().startsWith('-'))
        .map(line => line.replace(/^[\*\-]\s*/, '').trim())
        .filter(point => point.length > 0)
      
      // Extraer acción sugerida
      const actionLine = lines.find(line => line.toLowerCase().includes('acción sugerida'))
      const action = actionLine ? actionLine.replace(/^\*\*.*?\*\*:?\s*/, '').trim() : ''
      
      // Categorizar por tipo de dimensión
      if (title.toLowerCase().includes('participación') || title.toLowerCase().includes('engagement')) {
        insights.push(...bulletPoints)
        if (action) nextStep = action
      } else if (title.toLowerCase().includes('problema') || title.toLowerCase().includes('riesgo') || title.toLowerCase().includes('alerta')) {
        alerts.push(...bulletPoints)
      } else {
        strengths.push(...bulletPoints)
      }
    })

    // Crear resumen corto
    if (dimensions.length > 0) {
      const firstDimension = dimensions[0].split('\n').filter(line => line.trim().length > 0)
      if (firstDimension.length > 1) {
        const firstBullet = firstDimension.find(line => line.trim().startsWith('*') || line.trim().startsWith('-'))
        if (firstBullet) {
          summary = firstBullet.replace(/^[\*\-]\s*/, '').replace(/\*\*/g, '').substring(0, 200) + (firstBullet.length > 200 ? '...' : '')
        }
      }
    }

    return {
      summary: summary,
      positives: strengths.slice(0, 3), // Limitar para el resumen
      alerts: alerts.slice(0, 3),
      insights: insights.slice(0, 3),
      recommendation: nextStep,
      markdownContent: rawAnalysisText, // Guardar el markdown original para la vista detallada
      dimensions: dimensions // Guardar las dimensiones para renderizado individual
    }
  }

  // Si es la estructura legacy JSON
  const rawAnalysis = typeof rawAnalysisText === 'string' ? 
    JSON.parse(rawAnalysisText) : rawAnalysisText

  return {
    summary: rawAnalysis.summary || 'Análisis completado',
    positives: rawAnalysis.positives || rawAnalysis.strengths || [],
    alerts: rawAnalysis.alerts || rawAnalysis.weaknesses || [],
    insights: rawAnalysis.insights || rawAnalysis.opportunities || [],
    recommendation: rawAnalysis.recommendation || rawAnalysis.nextStep || 'Continuar monitoreando'
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    console.log('🔍 Verificando sesión para análisis:')
    console.log('  - Sesión existe:', !!session)
    console.log('  - Usuario existe:', !!session?.user)
    console.log('  - Token Moodle existe:', !!session?.user?.moodleToken)
    console.log('  - Usuario ID:', session?.user?.moodleUserId)
    
    if (!session?.user?.moodleToken) {
      console.log('❌ Error de autenticación: No hay sesión activa o token de Moodle')
      return NextResponse.json({ 
        error: 'No hay sesión activa o token de Moodle' 
      }, { status: 401 })
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

    // Crear cliente de Moodle usando la sesión del usuario
    const client = new MoodleAPIClient(
      process.env.MOODLE_URL || '',
      session.user.moodleToken || ''
    )
    const currentUserId = session.user.moodleUserId || null

    // Obtener información del curso para el prompt dinámico
    let courseName = 'este curso'
    try {
      const courseInfo = await client.getCourseInfo(courseId)
      if (courseInfo?.fullname) {
        courseName = courseInfo.fullname.toLowerCase()
      }
      console.log(`📚 Curso detectado: ${courseName}`)
    } catch (error) {
      console.log('⚠️ No se pudo obtener el nombre del curso, usando valor genérico')
    }

    let analysisResult = null

    // Análisis específico por tipo de actividad
    if (activityType === 'forum') {
      analysisResult = await analyzeForum(client, activityData, openai!, currentUserId, courseName)
    } else if (activityType === 'assign') {
      analysisResult = await analyzeAssignment(client, activityData, openai!, courseName)
    } else if (activityType === 'feedback' || activityType === 'quiz' || activityType === 'choice') {
      analysisResult = await analyzeGenericActivity(client, activityData, openai!, activityType, courseName)
    } else {
      return NextResponse.json({ 
        error: `Tipo de actividad no soportado: ${activityType}` 
      }, { status: 400 })
    }

    // Transformar la respuesta de OpenAI al formato esperado por el frontend
    const transformedResult = transformAnalysisResponse(analysisResult.analysisText || analysisResult)
    
    console.log('🔄 Datos transformados para DB:')
    console.log('  - Summary:', transformedResult.summary?.substring(0, 100) + '...')
    console.log('  - Positives:', transformedResult.positives?.length || 0)
    console.log('  - Alerts:', transformedResult.alerts?.length || 0)
    console.log('  - Insights:', transformedResult.insights?.length || 0)

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
        // Actualizar el registro existente
        await prisma.activityAnalysis.update({
          where: { id: existing.id },
          data: {
            activityName: activityData.name,
            summary: typeof transformedResult.summary === 'string' ? transformedResult.summary : JSON.stringify(transformedResult.summary || {}),
            positives: Array.isArray(transformedResult.positives) ? transformedResult.positives : [],
            alerts: Array.isArray(transformedResult.alerts) ? transformedResult.alerts : [],
            insights: Array.isArray(transformedResult.insights) ? transformedResult.insights : [],
            recommendation: typeof transformedResult.recommendation === 'string' ? transformedResult.recommendation : 'Análisis completado',
            llmResponse: {
              markdownContent: transformedResult.markdownContent,
              dimensions: transformedResult.dimensions,
              originalResponse: analysisResult
            },
            lastUpdated: new Date(),
            isValid: true
          }
        })
      } else {
        // Crear nuevo registro
        await prisma.activityAnalysis.create({
          data: {
            courseId: courseId,
            moodleCourseId: courseId,
            activityId: activityId.toString(),
            activityType: activityType,
            activityName: activityData.name,
            summary: typeof transformedResult.summary === 'string' ? transformedResult.summary : JSON.stringify(transformedResult.summary || {}),
            positives: Array.isArray(transformedResult.positives) ? transformedResult.positives : [],
            alerts: Array.isArray(transformedResult.alerts) ? transformedResult.alerts : [],
            insights: Array.isArray(transformedResult.insights) ? transformedResult.insights : [],
            recommendation: typeof transformedResult.recommendation === 'string' ? transformedResult.recommendation : 'Análisis completado',
            llmResponse: {
              markdownContent: transformedResult.markdownContent,
              dimensions: transformedResult.dimensions,
              originalResponse: analysisResult
            },
            lastUpdated: new Date(),
            isValid: true
          }
        })
      }

      console.log(`💾 Análisis guardado en cache para ${activityData.name}`)
    } catch (dbError) {
      console.error('⚠️ Error guardando en cache (continuando):', dbError)
      // No fallar si hay error en la base de datos, solo continuar
    }

    // Crear secciones estructuradas para el DynamicSectionRenderer
    const sections = []
    if (transformedResult.markdownContent) {
      const markdownSections = transformedResult.markdownContent.split(/(?=^####\s)/gm)
        .filter(section => section.trim().length > 0)
      
      markdownSections.forEach((section, index) => {
        const lines = section.split('\n').filter(line => line.trim().length > 0)
        const titleLine = lines[0]?.trim().replace(/^#+\s*/, '') || `Dimensión ${index + 1}`
        
        // Extraer puntos (bullets) del contenido
        const bulletPoints = lines.filter(line => line.trim().startsWith('*') || line.trim().startsWith('-'))
          .map(line => line.replace(/^[\*\-]\s*/, '').trim())
          .filter(point => point.length > 0)
        
        if (bulletPoints.length > 0) {
          sections.push({
            title: titleLine,
            format: 'bullet-list',
            content: bulletPoints,
            icon: '📊' // Icono por defecto
          })
        }
      })
    }

    // Preparar respuesta con toda la información recopilada
    const response = {
      success: true,
      analysis: {
        // Datos transformados para compatibilidad con el frontend
        ...transformedResult,
        // Secciones estructuradas para el detail view
        sections: sections,
        // Datos originales para análisis detallado
        rawData: analysisResult,
        llmResponse: {
          ...analysisResult,
          markdownContent: transformedResult.markdownContent,
          dimensions: transformedResult.dimensions
        },
        fullAnalysis: transformedResult.markdownContent, // Para compatibilidad con el detail view
        // Metadatos
        activityId: activityData.id,
        activityType: activityType,
        activityName: activityData.name,
        generatedAt: new Date().toISOString()
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        openaiModel: 'gpt-5-mini'
      }
    }

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
  } catch (error) {
    console.error('❌ Error en /api/analysis/activity:', error)
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

async function analyzeForum(client: MoodleAPIClient, forumData: any, openai: OpenAI, currentUserId: number | null, courseName: string) {
  console.log(`💬 Analizando foro: ${forumData.name}`)

  const prompt = `
Eres un asistente del profesor en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights accionables que contribuyan al cumplimiento de los objetivos del curso acerca del comportamiento de sus estudiantes dentro de las actividades en el foro de discusión. El propósito es que, aunque el profesor no participa directamente en la dinámica del foro, pueda mantener una visión clara de lo que ocurre en él y, en caso necesario, intervenga de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

- Redacta con un estilo conversacional dirigido al profesor de quien eres asistente, utilizando el principio de minto pyramid (no menciones que estás redactando utilizando este principio) donde la conclusión son los insights accionales.
- El análisis debe estructurarse en al menos 5 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
  #### [Nombre de la dimensión]
  * Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
  * Cada hallazgo debe resaltar con negritas los elementos relevantes.
  **Acción sugerida:** redactar una recomendación específica, breve y accionable para el profesor.
- Ordena las dimensiones de mayor a menor impacto.
- El formato de entrega solo es markdown.
- El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
- El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.
- Simpre incluye insights accionables acerca de nivel de participación y si surgen dudas o temas de conversación fuera de la consigna de la discusión.

${JSON.stringify(forumData.forumDetails?.discussions || forumData.discussions || [], null, 2)}`

  // Crear timestamp y nombre de archivo únicos
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const activityName = (forumData.name || 'forum').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)

  // GUARDAR REQUEST A OPENAI EN ARCHIVO
  const requestBody = {
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: 4000
  }

  const fs = require('fs');
  const requestFileName = `openai-request-forum-${activityName}-${timestamp}.json`
  const requestFilePath = `openai-logs/${requestFileName}`

  try {
    fs.writeFileSync(requestFilePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      activityType: 'forum',
      activityName: forumData.name,
      activityId: forumData.id,
      requestBody: requestBody,
      rawActivityData: analysisData
    }, null, 2))
    console.log(`📄 REQUEST guardado en: ${requestFilePath}`)
  } catch (writeError) {
    console.log('⚠️ No se pudo guardar el request:', writeError.message)
  }

  try {
    console.log('🤖 Llamando a OpenAI con prompt de longitud:', prompt.length)
    console.log('📊 Request body:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...')
    
    const completion = await openai.chat.completions.create(requestBody)
    console.log('🔍 OpenAI completion received:', !!completion)
    console.log('🔍 Choices length:', completion.choices?.length)
    
    const analysisText = completion.choices[0]?.message?.content || ''
    console.log('🔍 Analysis text length:', analysisText.length)
    console.log('🔍 Analysis text preview:', analysisText.substring(0, 200) + '...')

    // GUARDAR RESPONSE DE OPENAI EN ARCHIVO
    const responseFileName = `openai-response-forum-${activityName}-${timestamp}.json`
    const responseFilePath = `openai-logs/${responseFileName}`

    try {
      fs.writeFileSync(responseFilePath, JSON.stringify({
        timestamp: new Date().toISOString(),
        activityType: 'forum',
        activityName: forumData.name,
        activityId: forumData.id,
        model: 'gpt-5-mini',
        rawResponse: analysisText,
        usage: completion.usage,
        fullCompletionObject: completion
      }, null, 2))
      console.log(`📄 RESPONSE guardado en: ${responseFilePath}`)
    } catch (writeError) {
      console.log('⚠️ No se pudo guardar el response:', writeError.message)
    }

    // Procesar la respuesta markdown
    if (!analysisText || analysisText.trim() === '') {
      console.log('❌ OpenAI devolvió respuesta vacía')
      console.log('❌ Completion object:', JSON.stringify(completion, null, 2))
      throw new Error('Empty response from OpenAI')
    }

    console.log('✅ Análisis de foro completado para:', forumData.name)
    console.log('📝 Respuesta recibida es markdown, longitud:', analysisText.length)

    return {
      analysisText: analysisText, // Texto completo de markdown
      activityId: forumData.id,
      activityType: 'forum',
      activityName: forumData.name,
      rawData: {
        discussions: forumData.forumDetails?.discussions || forumData.discussions || []
      },
      prompt: prompt,
      generatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('❌ Error en análisis de foro:', error)
    throw new Error('Error al generar análisis del foro')
  }
}

async function analyzeAssignment(client: MoodleAPIClient, assignmentData: any, openai: OpenAI, courseName: string) {
  console.log(`📝 Analizando asignación: ${assignmentData.name}`)

  // Preparar datos de análisis de forma flexible
  const analysisData = {
    name: assignmentData.name || 'Asignación sin nombre',
    description: assignmentData.intro || assignmentData.description || '',
    config: assignmentData.assignDetails || assignmentData.config || {},
    stats: {
      submissionCount: assignmentData.submissionCount || 0,
      gradeCount: assignmentData.gradeCount || 0,
      avgGrade: assignmentData.avgGrade || 'N/A',
      gradingProgress: assignmentData.gradingProgress || 0
    },
    dates: {
      status: assignmentData.status || 'Activa'
    }
  }

  const prompt = `
Eres un asistente del profesor en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights educativos accionables sobre esta tarea/asignación para que pueda intervenir de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

- Enfócate en aspectos pedagógicos relevantes: calidad de las entregas, patrones de comportamiento estudiantil, oportunidades de mejora en el aprendizaje.
- Evita mencionar métricas técnicas específicas (como números de submissionCount, avgGrade, etc.). En su lugar, interpreta estos datos y ofrece insights educativos.
- Redacta con un estilo conversacional dirigido al profesor, utilizando el principio de minto pyramid donde la conclusión son los insights accionables.
- El análisis debe estructurarse en al menos 4 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
  #### [Nombre de la dimensión]
  * Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
  * Cada hallazgo debe resaltar con negritas los elementos relevantes.
  **Acción sugerida:** redactar una recomendación específica, breve y accionable para el profesor.
- Ordena las dimensiones de mayor a menor impacto educativo.
- El formato de entrega solo es markdown.
- El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
- El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.

${JSON.stringify(analysisData, null, 2)}`

  // Crear timestamp y nombre de archivo únicos
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const activityName = (assignmentData.name || 'assignment').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)

  // GUARDAR REQUEST A OPENAI EN ARCHIVO
  const requestBody = {
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: 4000
  }

  const fs = require('fs');
  const requestFileName = `openai-request-assign-${activityName}-${timestamp}.json`
  const requestFilePath = `openai-logs/${requestFileName}`

  try {
    fs.writeFileSync(requestFilePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      activityType: 'assign',
      activityName: assignmentData.name,
      activityId: assignmentData.id,
      requestBody: requestBody,
      rawActivityData: analysisData
    }, null, 2))
    console.log(`📄 REQUEST guardado en: ${requestFilePath}`)
  } catch (writeError) {
    console.log('⚠️ No se pudo guardar el request:', writeError.message)
  }

  try {
    const completion = await openai.chat.completions.create(requestBody)
    const analysisText = completion.choices[0]?.message?.content || ''

    // GUARDAR RESPONSE DE OPENAI EN ARCHIVO
    const responseFileName = `openai-response-assign-${activityName}-${timestamp}.json`
    const responseFilePath = `openai-logs/${responseFileName}`

    try {
      fs.writeFileSync(responseFilePath, JSON.stringify({
        timestamp: new Date().toISOString(),
        activityType: 'assign',
        activityName: assignmentData.name,
        activityId: assignmentData.id,
        model: 'gpt-5-mini',
        rawResponse: analysisText,
        usage: completion.usage,
        fullCompletionObject: completion
      }, null, 2))
      console.log(`📄 RESPONSE guardado en: ${responseFilePath}`)
    } catch (writeError) {
      console.log('⚠️ No se pudo guardar el response:', writeError.message)
    }

    // Procesar la respuesta markdown
    if (!analysisText || analysisText.trim() === '') {
      console.log('❌ OpenAI devolvió respuesta vacía')
      throw new Error('Empty response from OpenAI')
    }

    console.log('✅ Análisis de asignación completado para:', assignmentData.name)
    console.log('📝 Respuesta recibida es markdown, longitud:', analysisText.length)

    return {
      analysisText: analysisText, // Texto completo de markdown
      activityId: assignmentData.id,
      activityType: 'assign',
      activityName: assignmentData.name,
      rawData: analysisData,
      prompt: prompt,
      generatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('❌ Error en análisis de asignación:', error)
    throw new Error('Error al generar análisis de la asignación')
  }
}

async function analyzeGenericActivity(client: MoodleAPIClient, activityData: any, openai: OpenAI, activityType: string, courseName: string) {
  console.log(`🎯 Analizando actividad ${activityType}: ${activityData.name}`)

  // Mapeo de tipos de actividad
  const typeLabels: { [key: string]: string } = {
    'feedback': 'Encuesta/Retroalimentación',
    'quiz': 'Cuestionario/Quiz',
    'choice': 'Elección/Votación'
  }

  const typeLabel = typeLabels[activityType] || 'Actividad'

  // Preparar datos de análisis de forma flexible
  const analysisData = {
    name: activityData.name || `${typeLabel} sin nombre`,
    description: activityData.intro || activityData.description || '',
    status: activityData.status || 'Activa',
    type: typeLabel,
    participants: activityData.participants || 0,
    responses: activityData.responses || 0
  }

  const prompt = `
Eres un asistente del profesor en la Universidad UTEL. Tu tarea consiste en ayudarle a identificar insights educativos accionables sobre esta ${typeLabel.toLowerCase()} para que pueda intervenir de manera pertinente durante su próxima videoconferencia con los estudiantes (openclass).

- Enfócate en aspectos pedagógicos relevantes: participación estudiantil, patrones de comportamiento, calidad de las respuestas, oportunidades de mejora en el aprendizaje.
- Evita mencionar métricas técnicas específicas (como números de participants, responses, etc.). En su lugar, interpreta estos datos y ofrece insights educativos.
- Redacta con un estilo conversacional dirigido al profesor, utilizando el principio de minto pyramid donde la conclusión son los insights accionables.
- El análisis debe estructurarse en al menos 3 dimensiones. Cada dimensión debe presentarse con el formato siguiente:
  #### [Nombre de la dimensión]
  * Incluye hallazgos clave en viñetas, redactados de forma breve y clara.
  * Cada hallazgo debe resaltar con negritas los elementos relevantes.
  **Acción sugerida:** redactar una recomendación específica, breve y accionable para el profesor.
- Ordena las dimensiones de mayor a menor impacto educativo.
- El formato de entrega solo es markdown.
- El análisis debe limitarse únicamente al reporte solicitado, sin incluir preguntas, sugerencias adicionales, invitaciones a continuar ni ofertas de recursos complementarios.
- El análisis debe iniciar directamente con los insights accionables, sin incluir introducciones, frases de encuadre, ni explicaciones preliminares.

${JSON.stringify(analysisData, null, 2)}`

  // Crear timestamp y nombre de archivo únicos
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const activityName = (activityData.name || activityType).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)

  // GUARDAR REQUEST A OPENAI EN ARCHIVO
  const requestBody = {
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_completion_tokens: 4000
  }

  const fs = require('fs');
  const requestFileName = `openai-request-${activityType}-${activityName}-${timestamp}.json`
  const requestFilePath = `openai-logs/${requestFileName}`

  try {
    fs.writeFileSync(requestFilePath, JSON.stringify({
      timestamp: new Date().toISOString(),
      activityType: activityType,
      activityName: activityData.name,
      activityId: activityData.id,
      requestBody: requestBody,
      rawActivityData: analysisData
    }, null, 2))
    console.log(`📄 REQUEST guardado en: ${requestFilePath}`)
  } catch (writeError) {
    console.log('⚠️ No se pudo guardar el request:', writeError.message)
  }

  try {
    const completion = await openai.chat.completions.create(requestBody)
    const analysisText = completion.choices[0]?.message?.content || ''

    // GUARDAR RESPONSE DE OPENAI EN ARCHIVO
    const responseFileName = `openai-response-${activityType}-${activityName}-${timestamp}.json`
    const responseFilePath = `openai-logs/${responseFileName}`

    try {
      fs.writeFileSync(responseFilePath, JSON.stringify({
        timestamp: new Date().toISOString(),
        activityType: activityType,
        activityName: activityData.name,
        activityId: activityData.id,
        model: 'gpt-5-mini',
        rawResponse: analysisText,
        usage: completion.usage,
        fullCompletionObject: completion
      }, null, 2))
      console.log(`📄 RESPONSE guardado en: ${responseFilePath}`)
    } catch (writeError) {
      console.log('⚠️ No se pudo guardar el response:', writeError.message)
    }

    // Procesar la respuesta markdown
    if (!analysisText || analysisText.trim() === '') {
      console.log('❌ OpenAI devolvió respuesta vacía')
      throw new Error('Empty response from OpenAI')
    }

    console.log(`✅ Análisis de ${typeLabel} completado para: ${activityData.name}`)
    console.log('📝 Respuesta recibida es markdown, longitud:', analysisText.length)

    return {
      analysisText: analysisText, // Texto completo de markdown
      activityId: activityData.id,
      activityType: activityType,
      activityName: activityData.name,
      rawData: analysisData,
      prompt: prompt,
      generatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error(`❌ Error en análisis de ${typeLabel}:`, error)
    throw new Error(`Error al generar análisis de ${typeLabel}`)
  }
}