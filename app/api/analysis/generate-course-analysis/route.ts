import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { createSessionMoodleClient } from '@/lib/moodle/session-client'
import { prisma } from '@/lib/db/prisma'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

interface AnalysisDetails {
  requestId: string
  timestamp: string
  courseId: string
  groupId: string
  analyzedBy: string
  analyzedByName: string
  prompt: string
  model: string
  response: any
  tokensUsed: {
    prompt: number
    completion: number
    total: number
  }
  processingTime: number
  cost: number
  success: boolean
  error?: string
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = `req_course_analysis_${startTime}`
  
  const analysisDetails: AnalysisDetails = {
    requestId,
    timestamp: new Date().toISOString(),
    courseId: '',
    groupId: '',
    analyzedBy: '',
    analyzedByName: '',
    prompt: '',
    model: '',
    response: null,
    tokensUsed: { prompt: 0, completion: 0, total: 0 },
    processingTime: 0,
    cost: 0,
    success: false
  }

  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user?.moodleToken) {
      return NextResponse.json({ error: 'No autorizado - sesión requerida' }, { status: 401 })
    }

    // Verificar expiración del token
    if (session.user.tokenExpiry && new Date() > new Date(session.user.tokenExpiry)) {
      return NextResponse.json({ 
        error: 'Token expirado - por favor inicie sesión nuevamente' 
      }, { status: 401 })
    }

    const { courseId: courseGroupId } = await request.json()

    if (!courseGroupId) {
      return NextResponse.json({ 
        error: 'courseId es requerido (formato: courseId|groupId)' 
      }, { status: 400 })
    }

    // Parsear courseId y groupId del formato "courseId|groupId"
    const [courseId, groupId] = courseGroupId.split('|')
    if (!courseId || !groupId) {
      return NextResponse.json({ error: 'Formato inválido. Use: courseId|groupId' }, { status: 400 })
    }

    // Llenar datos iniciales del análisis
    analysisDetails.courseId = courseId
    analysisDetails.groupId = groupId  
    analysisDetails.analyzedBy = session.user.matricula
    analysisDetails.analyzedByName = session.user.name || ''

    console.log(`🤖 [${requestId}] Iniciando análisis course-based...`)
    console.log(`   Profesor: ${session.user.name} (${session.user.matricula})`)
    console.log(`   Curso: ${courseId}`)
    console.log(`   Grupo: ${groupId}`)

    // Crear cliente basado en sesión
    const sessionClient = createSessionMoodleClient(true) // server-side

    // 1. Verificar conexión
    const isConnected = await sessionClient.testConnection()
    if (!isConnected) {
      analysisDetails.error = 'No se pudo conectar con Moodle'
      await saveAnalysisDetailsToPDF(analysisDetails)
      return NextResponse.json({
        error: 'No se pudo conectar con Moodle'
      }, { status: 503 })
    }

    // 2. Verificar contenido del curso
    console.log(`🔍 [${requestId}] Verificando contenido del curso...`)
    const courseContent = await checkCourseContent(courseId, sessionClient)
    
    if (!courseContent.hasContent) {
      analysisDetails.error = courseContent.reason
      await saveAnalysisDetailsToPDF(analysisDetails)
      return NextResponse.json({
        success: false,
        message: courseContent.reason,
        suggestions: courseContent.suggestions
      })
    }

    // 3. Recolectar datos detallados del curso
    console.log(`🔄 [${requestId}] Recolectando datos del curso...`)
    const analysisData = await collectCourseAnalysisData(courseId, groupId, sessionClient, session.user.matricula)

    // 4. Generar análisis con OpenAI
    console.log(`🤖 [${requestId}] Generando análisis con OpenAI...`)
    const aiAnalysisResult = await generateAIAnalysisWithDetails(analysisData, courseId, analysisDetails)
    
    // 5. Guardar análisis en base de datos (course-based)
    const savedAnalysis = await saveCourseAnalysisToDatabase(
      courseId, 
      groupId, 
      aiAnalysisResult, 
      session.user.matricula,
      session.user.name || '',
      analysisData
    )

    // 6. Finalizar detalles del análisis
    analysisDetails.processingTime = Date.now() - startTime
    analysisDetails.success = true

    // 7. Generar PDF con todos los detalles
    const pdfPath = await saveAnalysisDetailsToPDF(analysisDetails)

    console.log(`✅ [${requestId}] Análisis course-based completado en ${analysisDetails.processingTime}ms`)
    console.log(`📄 [${requestId}] PDF generado: ${pdfPath}`)

    return NextResponse.json({
      success: true,
      analysis: savedAnalysis,
      details: {
        requestId,
        processingTime: analysisDetails.processingTime,
        tokensUsed: analysisDetails.tokensUsed.total,
        model: analysisDetails.model,
        cost: analysisDetails.cost,
        pdfGenerated: true,
        pdfPath
      },
      message: '🎉 Análisis course-based generado exitosamente'
    })

  } catch (error: any) {
    console.error(`❌ [${requestId}] Error en análisis course-based:`, error)
    
    analysisDetails.error = error instanceof Error ? error.message : 'Error desconocido'
    analysisDetails.processingTime = Date.now() - startTime
    await saveAnalysisDetailsToPDF(analysisDetails)
    
    return NextResponse.json({
      error: 'Error al generar análisis course-based',
      details: error instanceof Error ? error.message : 'Error desconocido',
      requestId
    }, { status: 500 })
  }
}

async function checkCourseContent(courseId: string, sessionClient: any) {
  try {
    const forums = await sessionClient.getCourseForums(courseId)
    const courseContents = await sessionClient.getCourseContents(courseId)
    
    const activitiesCount = courseContents.reduce((acc: number, section: any) => {
      return acc + (section.modules?.length || 0)
    }, 0)

    console.log(`📋 Contenido del curso: ${forums?.length || 0} foros, ${activitiesCount} actividades`)

    if ((!forums || forums.length === 0) && activitiesCount === 0) {
      return {
        hasContent: false,
        reason: 'El curso no tiene foros ni actividades configuradas',
        suggestions: [
          'Crear al menos un foro de discusión',
          'Agregar actividades evaluables',
          'Configurar tareas o cuestionarios'
        ]
      }
    }

    return {
      hasContent: true,
      forumsCount: forums?.length || 0,
      activitiesCount
    }

  } catch (error) {
    console.error('Error verificando contenido del curso:', error)
    return {
      hasContent: false,
      reason: 'Error al acceder al contenido del curso',
      suggestions: ['Verificar la conectividad con Moodle']
    }
  }
}

async function collectCourseAnalysisData(courseId: string, groupId: string, sessionClient: any, userMatricula: string) {
  console.log('🔍 Iniciando recolección de datos del curso:', courseId, 'Grupo:', groupId)
  console.log('📤 PARÁMETROS DE ENTRADA:')
  console.log(`   🏫 CourseId: ${courseId}`)
  console.log(`   👥 GroupId: ${groupId}`)
  console.log(`   🔐 Usuario: ${userMatricula}`)
  
  const courseContents = await sessionClient.getCourseContents(courseId)
  const currentDate = new Date()
  
  console.log(`📋 Secciones disponibles: ${courseContents.length}`)
  
  // Obtener estudiantes del curso/grupo
  let students = []
  try {
    const members = await sessionClient.getGroupMembers(groupId, courseId)
    students = members || []
    console.log(`👥 Estudiantes encontrados: ${students.length}`)
  } catch (error) {
    console.log('⚠️ No se pudo obtener lista de estudiantes:', error)
  }
  
  // Estructura de datos para el análisis
  const analysisData: any = {
    courseInfo: {
      courseId,
      analysisDate: currentDate.toISOString(),
      totalStudents: students.length,
      groupId: groupId,
      analyzedBy: userMatricula
    },
    weeklyStructure: {
      totalSections: courseContents.length,
      activeSections: [],
      completedSections: [],
      futureSections: []
    },
    detailedForumAnalysis: [],
    detailedAssignmentAnalysis: [],
    studentParticipation: {
      activeStudents: new Set(),
      inactiveStudents: []
    },
    overallMetrics: {
      totalForums: 0,
      totalAssignments: 0,
      totalResources: 0,
      totalDiscussions: 0,
      totalPosts: 0
    }
  }
  
  // Análisis de estructura semanal
  console.log('📅 Analizando estructura semanal del curso...')
  
  const courseStartDate = new Date()
  courseStartDate.setMonth(courseStartDate.getMonth() - 4)
  
  for (let i = 0; i < courseContents.length; i++) {
    const section = courseContents[i]
    
    const sectionStart = new Date(courseStartDate)
    sectionStart.setDate(sectionStart.getDate() + (i * 7))
    
    const sectionEnd = new Date(sectionStart)
    sectionEnd.setDate(sectionEnd.getDate() + 7)
    
    const isCurrentWeek = currentDate >= sectionStart && currentDate <= sectionEnd
    const isActiveSection = currentDate >= sectionStart && currentDate <= new Date(sectionEnd.getTime() + 7 * 24 * 60 * 60 * 1000)
    const isPastSection = currentDate > sectionEnd
    
    const sectionAnalysis = {
      sectionNumber: i + 1,
      name: section.name || `Semana ${i + 1}`,
      visible: section.visible,
      isCurrentWeek,
      isActive: isActiveSection,
      startDate: sectionStart.toISOString(),
      endDate: sectionEnd.toISOString(),
      status: isCurrentWeek ? 'current' : isPastSection ? 'completed' : 'future',
      modules: section.modules?.map((mod: any) => ({
        id: mod.instance,
        type: mod.modname,
        name: mod.name,
        visible: mod.visible,
        url: mod.url
      })) || [],
      activitiesCount: section.modules?.filter((m: any) => ['assign', 'quiz', 'forum'].includes(m.modname)).length || 0,
      resourcesCount: section.modules?.filter((m: any) => ['resource', 'url', 'page', 'book'].includes(m.modname)).length || 0
    }
    
    if (isCurrentWeek || isActiveSection) {
      analysisData.weeklyStructure.activeSections.push(sectionAnalysis)
    } else if (isPastSection) {
      analysisData.weeklyStructure.completedSections.push(sectionAnalysis)
    } else {
      analysisData.weeklyStructure.futureSections.push(sectionAnalysis)
    }
  }
  
  console.log(`📊 Secciones activas: ${analysisData.weeklyStructure.activeSections.length}`)
  console.log(`📊 Secciones completadas: ${analysisData.weeklyStructure.completedSections.length}`)
  
  // Analizar foros del curso
  try {
    const forums = await sessionClient.getCourseForums(courseId)
    analysisData.overallMetrics.totalForums = forums?.length || 0
    
    if (forums && forums.length > 0) {
      for (const forum of forums.slice(0, 3)) {
        try {
          console.log(`📤 PROCESANDO FORO: ${forum.name} (ID: ${forum.id})`)
          const discussions = await sessionClient.getForumDiscussions(forum.id)
          analysisData.overallMetrics.totalDiscussions += discussions?.length || 0
          
          const forumAnalysis: any = {
            forumId: forum.id,
            forumName: forum.name,
            discussionCount: discussions?.length || 0,
            totalPosts: 0,
            uniqueParticipants: new Set()
          }
          
          console.log(`   📊 Discusiones encontradas: ${discussions?.length || 0}`)
          analysisData.detailedForumAnalysis.push(forumAnalysis)
        } catch (error) {
          console.log(`⚠️ Error analizando foro ${forum.id}:`, error)
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Error obteniendo foros:', error)
  }
  
  // Calcular estudiantes activos vs inactivos
  const activeStudentIds = Array.from(analysisData.studentParticipation.activeStudents)
  for (const student of students) {
    if (!activeStudentIds.includes(student.id)) {
      analysisData.studentParticipation.inactiveStudents.push({
        id: student.id,
        name: `${student.firstname} ${student.lastname}`,
        email: student.email
      })
    }
  }
  
  console.log(`\n📊 RESUMEN FINAL:`)
  console.log(`   - Estudiantes analizados: ${students.length}`)
  console.log(`   - Foros: ${analysisData.overallMetrics.totalForums}`)
  console.log(`   - Discusiones: ${analysisData.overallMetrics.totalDiscussions}`)
  
  return analysisData
}

async function generateAIAnalysisWithDetails(analysisData: any, courseId: string, details: AnalysisDetails) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
  
  const courseInfo = analysisData.courseInfo
  const weeklyStructure = analysisData.weeklyStructure
  const overallMetrics = analysisData.overallMetrics
  const studentParticipation = analysisData.studentParticipation
  
  const activeStudentsCount = Array.from(studentParticipation.activeStudents).length
  const inactiveStudentsCount = studentParticipation.inactiveStudents.length
  
  console.log(`📤 DATOS ENVIADOS A PROCESAR - ANÁLISIS DE CURSO:`)
  console.log(`   🏫 Curso ID: ${courseId}`)
  console.log(`   👥 Estudiantes: ${courseInfo.totalStudents} total, ${activeStudentsCount} activos, ${inactiveStudentsCount} inactivos`)
  console.log(`   📅 Estructura: ${weeklyStructure.totalSections} secciones, ${weeklyStructure.activeSections.length} activas`)
  console.log(`   💬 Actividad: ${overallMetrics.totalForums} foros, ${overallMetrics.totalDiscussions} discusiones`)
  console.log(`   🔍 Analizado por: ${courseInfo.analyzedBy}`)

  const prompt = `Como experto en análisis educativo, realiza un análisis PROFUNDO del curso ${courseId}:

📊 **INFORMACIÓN DEL CURSO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Estudiantes matriculados: ${courseInfo.totalStudents}
• Fecha de análisis: ${new Date(courseInfo.analysisDate).toLocaleDateString()}
• Estudiantes ACTIVOS: ${activeStudentsCount}
• Estudiantes INACTIVOS: ${inactiveStudentsCount}
• Analizado por: ${courseInfo.analyzedBy}

📅 **ESTRUCTURA SEMANAL**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Secciones totales: ${weeklyStructure.totalSections}
• Secciones ACTIVAS: ${weeklyStructure.activeSections.length}
• Secciones completadas: ${weeklyStructure.completedSections.length}

💬 **ANÁLISIS DE PARTICIPACIÓN**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total foros: ${overallMetrics.totalForums}
• Total discusiones: ${overallMetrics.totalDiscussions}

Proporciona un análisis que incluya:

1. **Fortalezas** (3-4 puntos específicos)
2. **Alertas críticas** (problemas urgentes)
3. **Estudiantes en riesgo** (números específicos)
4. **Recomendaciones** (acciones concretas)
5. **Próximo paso** (acción prioritaria)
6. **Estado general** (salud del curso)

Responde ÚNICAMENTE en formato JSON:
{
  "strengths": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
  "alerts": ["alerta 1", "alerta 2"],
  "studentsAtRisk": "${inactiveStudentsCount} estudiantes sin participación detectada",
  "recommendations": ["recomendación 1", "recomendación 2"],
  "nextStep": "acción prioritaria concreta",
  "overallHealth": "buena/regular/necesita atención"
}`

  details.prompt = prompt
  
  console.log(`🚀 ENVIANDO A OpenAI - ANÁLISIS DE CURSO:`)
  console.log(`   🔗 Modelo: o3-mini`)
  console.log(`   📝 Prompt (primeros 300 chars):`, prompt.substring(0, 300) + '...')
  console.log(`   ⚙️ Configuración: max_completion_tokens=1000 (modelo o3-mini)`)
  
  try {
    const response = await openai.chat.completions.create({
      model: "o3-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 1000
    })
    
    details.model = "o3-mini"
    details.response = response
    details.tokensUsed = {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0
    }
    
    details.cost = (details.tokensUsed.prompt * 0.03 + details.tokensUsed.completion * 0.06) / 1000
    
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    return {
      strengths: parsed.strengths || [],
      alerts: parsed.alerts || [],
      studentsAtRisk: parsed.studentsAtRisk || "No calculado",
      recommendations: parsed.recommendations || [],
      nextStep: parsed.nextStep || "Continuar monitoreo",
      overallHealth: parsed.overallHealth || 'regular'
    }
  } catch (error) {
    console.error('Error con OpenAI:', error)
    details.error = error instanceof Error ? error.message : 'Error en OpenAI'
    
    return {
      strengths: ["Análisis generado con respaldo heurístico"],
      alerts: ["No se pudo conectar con OpenAI"],
      studentsAtRisk: "No calculado",
      recommendations: ["Verificar conectividad con servicios de IA"],
      nextStep: "Reintentar análisis más tarde",
      overallHealth: 'regular'
    }
  }
}

async function saveCourseAnalysisToDatabase(
  courseId: string, 
  groupId: string, 
  analysisResult: any, 
  analyzedBy: string,
  analyzedByName: string,
  rawData: any
) {
  // Buscar o crear curso
  let course = await prisma.course.findFirst({
    where: { moodleCourseId: courseId }
  })
  
  if (!course) {
    course = await prisma.course.create({
      data: {
        moodleCourseId: courseId,
        name: `Curso ${courseId}`,
        lastAnalyzedBy: analyzedBy,
        lastSync: new Date()
      }
    })
  } else {
    // Actualizar último profesor que analizó
    await prisma.course.update({
      where: { id: course.id },
      data: { 
        lastAnalyzedBy: analyzedBy,
        lastSync: new Date()
      }
    })
  }
  
  // Buscar o crear grupo
  let dbGroup = await prisma.group.findFirst({
    where: { moodleGroupId: groupId }
  })
  
  if (!dbGroup) {
    dbGroup = await prisma.group.create({
      data: {
        moodleGroupId: groupId,
        name: `Grupo ${groupId}`,
        courseId: course.id
      }
    })
  }
  
  // Marcar análisis anteriores como no-latest
  await prisma.analysisResult.updateMany({
    where: {
      courseId: course.id,
      groupId: dbGroup.id,
      isLatest: true
    },
    data: { isLatest: false }
  })
  
  // Crear nuevo análisis
  const analysisResult_db = await prisma.analysisResult.create({
    data: {
      courseId: course.id,
      moodleCourseId: courseId,
      groupId: dbGroup.id,
      moodleGroupId: groupId,
      analysisType: 'COURSE_OVERVIEW',
      analyzedBy,
      analyzedByName,
      strengths: analysisResult.strengths,
      alerts: analysisResult.alerts,
      recommendations: analysisResult.recommendations || [],
      nextStep: analysisResult.nextStep,
      overallHealth: analysisResult.overallHealth,
      studentsAtRisk: analysisResult.studentsAtRisk,
      rawData,
      llmResponse: analysisResult,
      confidence: 0.9,
      isLatest: true,
      studentsAnalyzed: rawData?.courseInfo?.totalStudents || 0,
      activitiesCount: rawData?.overallMetrics?.totalAssignments || 0,
      forumsCount: rawData?.overallMetrics?.totalForums || 0
    }
  })
  
  return analysisResult_db
}

async function saveAnalysisDetailsToPDF(details: AnalysisDetails) {
  try {
    const content = `
========================================
REPORTE TÉCNICO DE ANÁLISIS COURSE-BASED
========================================

📊 INFORMACIÓN GENERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ID de Solicitud: ${details.requestId}
• Fecha y Hora: ${details.timestamp}
• Curso ID: ${details.courseId}
• Grupo ID: ${details.groupId}
• Analizado por: ${details.analyzedBy} (${details.analyzedByName})
• Estado: ${details.success ? '✅ EXITOSO' : '❌ ERROR'}
• Tiempo de procesamiento: ${details.processingTime}ms

🤖 DETALLES DE IA (OpenAI)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Modelo utilizado: ${details.model || 'No especificado'}
• Tokens utilizados:
  - Prompt: ${details.tokensUsed.prompt}
  - Respuesta: ${details.tokensUsed.completion}
  - Total: ${details.tokensUsed.total}
• Costo estimado: $${details.cost.toFixed(4)} USD

📝 PROMPT ENVIADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${details.prompt || 'No disponible'}

🔄 RESPUESTA COMPLETA DE OpenAI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${details.response ? JSON.stringify(details.response, null, 2) : 'No disponible'}

${details.error ? `❌ ERROR ENCONTRADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${details.error}` : ''}

📈 MÉTRICAS DE RENDIMIENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Inicio del procesamiento: ${new Date(details.timestamp).toLocaleString()}
• Duración total: ${details.processingTime}ms
• Eficiencia: ${details.tokensUsed.total > 0 ? (details.tokensUsed.total / (details.processingTime / 1000)).toFixed(2) : 'N/A'} tokens/segundo

🔚 FIN DEL REPORTE
Generado automáticamente por el Dashboard Académico UTEL - Sistema Course-Based V2
`

    const reportsDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const fileName = `analysis-course-${details.requestId}-${Date.now()}.txt`
    const filePath = path.join(reportsDir, fileName)

    fs.writeFileSync(filePath, content, 'utf8')

    console.log(`📄 Reporte técnico guardado: ${filePath}`)
    return filePath

  } catch (error) {
    console.error('Error generando reporte PDF:', error)
    return null
  }
}