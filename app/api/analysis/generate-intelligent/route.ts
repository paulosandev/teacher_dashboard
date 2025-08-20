import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { createSmartMoodleClient } from '@/lib/moodle/smart-client'
import { prisma } from '@/lib/db/prisma'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

interface AnalysisDetails {
  requestId: string
  timestamp: string
  courseId: string
  groupId: string
  userId: string
  userMatricula: string
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
  const requestId = `req_intelligent_${startTime}`
  
  const analysisDetails: AnalysisDetails = {
    requestId,
    timestamp: new Date().toISOString(),
    courseId: '',
    groupId: '',
    userId: '',
    userMatricula: '',
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
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { courseId: courseGroupId, userMatricula } = await request.json()

    if (!courseGroupId || !userMatricula) {
      return NextResponse.json({ 
        error: 'courseId (formato: courseId|groupId) y userMatricula son requeridos' 
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
    analysisDetails.userId = session.user.id
    analysisDetails.userMatricula = userMatricula

    console.log(`🤖 [${requestId}] Iniciando análisis inteligente profundo...`)
    console.log(`   Usuario: ${session.user.name} (${userMatricula})`)
    console.log(`   Curso: ${courseId}`)
    console.log(`   Grupo: ${groupId}`)

    // Crear cliente inteligente
    const smartClient = createSmartMoodleClient(session.user.id, userMatricula)

    // 1. Verificar conexión
    const isConnected = await smartClient.testConnection()
    if (!isConnected) {
      analysisDetails.error = 'No se pudo conectar con Moodle usando autenticación híbrida'
      await saveAnalysisDetailsToPDF(analysisDetails)
      return NextResponse.json({
        error: 'No se pudo conectar con Moodle usando autenticación híbrida'
      }, { status: 503 })
    }

    // 2. Verificar contenido del curso
    console.log(`🔍 [${requestId}] Verificando contenido del curso...`)
    const courseContent = await checkCourseContent(courseId, smartClient)
    
    if (!courseContent.hasContent) {
      analysisDetails.error = courseContent.reason
      await saveAnalysisDetailsToPDF(analysisDetails)
      return NextResponse.json({
        success: false,
        message: courseContent.reason,
        suggestions: courseContent.suggestions
      })
    }

    // 3. Recolectar datos detallados usando el smart client
    console.log(`🔄 [${requestId}] Recolectando datos detallados del curso y grupo...`)
    const analysisData = await collectDetailedCourseDataSmart(courseId, groupId, smartClient, userMatricula)

    // 4. Generar análisis con OpenAI
    console.log(`🤖 [${requestId}] Generando análisis con OpenAI...`)
    const aiAnalysisResult = await generateAIAnalysisWithDetails(analysisData, courseId, analysisDetails)
    
    // 5. Guardar análisis en base de datos
    const savedAnalysis = await saveAnalysisToDatabase(courseId, groupId, aiAnalysisResult, session.user.id, analysisData)

    // 6. Finalizar detalles del análisis
    analysisDetails.processingTime = Date.now() - startTime
    analysisDetails.success = true

    // 7. Generar PDF con todos los detalles
    const pdfPath = await saveAnalysisDetailsToPDF(analysisDetails)

    console.log(`✅ [${requestId}] Análisis inteligente completado en ${analysisDetails.processingTime}ms`)
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
      message: '🎉 Análisis inteligente generado exitosamente con detalles técnicos'
    })

  } catch (error: any) {
    console.error(`❌ [${requestId}] Error en análisis inteligente:`, error)
    
    analysisDetails.error = error instanceof Error ? error.message : 'Error desconocido'
    analysisDetails.processingTime = Date.now() - startTime
    await saveAnalysisDetailsToPDF(analysisDetails)
    
    return NextResponse.json({
      error: 'Error al generar análisis inteligente',
      details: error instanceof Error ? error.message : 'Error desconocido',
      requestId
    }, { status: 500 })
  }
}

async function checkCourseContent(courseId: string, smartClient: any) {
  try {
    const forums = await smartClient.getCourseForums(courseId)
    const courseContents = await smartClient.getCourseContents(courseId)
    
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

async function collectDetailedCourseDataSmart(courseId: string, groupId: string, smartClient: any, userMatricula: string) {
  console.log('🔍 Iniciando recolección de datos profunda del curso:', courseId, 'Grupo/Modalidad:', groupId)
  console.log('📤 PARÁMETROS DE ENTRADA - ANÁLISIS INTELIGENTE:')
  console.log(`   🏫 CourseId: ${courseId}`)
  console.log(`   👥 GroupId/Modalidad: ${groupId}`)
  console.log(`   🔐 Usuario: ${userMatricula}`)
  
  const courseContents = await smartClient.getCourseContents(courseId)
  const currentDate = new Date()
  
  console.log(`📋 Secciones disponibles: ${courseContents.length}`)
  
  // Obtener estudiantes matriculados en el curso
  let students = []
  try {
    const courseGroups = await smartClient.getCourseGroups(courseId)
    const selectedGroup = courseGroups?.find((g: any) => g.id.toString() === groupId.toString())
    
    if (selectedGroup) {
      const groupMembers = await smartClient.getGroupMembers(groupId, courseId)
      // Ya no necesitamos filtrar por roles porque el método alternativo ya retorna solo estudiantes
      students = groupMembers || []
      console.log(`👥 Estudiantes en el grupo ${selectedGroup.name}: ${students.length}`)
    } else {
      // Fallback: todos los estudiantes del curso
      const allUsers = await smartClient.getEnrolledUsers(courseId)
      students = allUsers?.filter((u: any) => 
        u.roles?.some((r: any) => r.roleid === 5) // Rol estudiante
      ) || []
      console.log(`👥 Estudiantes matriculados en el curso: ${students.length}`)
    }
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
      userMatricula
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
  
  // Calcular fechas aproximadas (asumiendo que el curso comenzó hace 4 meses)
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
  
  // Análisis de módulos en secciones activas y recientes
  const sectionsToAnalyze = [
    ...analysisData.weeklyStructure.activeSections,
    ...analysisData.weeklyStructure.completedSections.slice(-2) // Últimas 2 semanas completadas
  ]
  
  for (const section of sectionsToAnalyze) {
    console.log(`\n📅 Analizando sección: ${section.name}`)
    
    for (const sectionModule of section.modules) {
      try {
        // Analizar FOROS
        if (sectionModule.type === 'forum') {
          console.log(`   💬 Analizando foro: ${sectionModule.name}`)
          
          const discussions = await smartClient.getForumDiscussions(sectionModule.id, groupId)
          analysisData.overallMetrics.totalDiscussions += discussions?.length || 0
          analysisData.overallMetrics.totalForums++
          
          const forumAnalysis: any = {
            forumId: sectionModule.id,
            forumName: sectionModule.name,
            sectionName: section.name,
            discussionCount: discussions?.length || 0,
            totalPosts: 0,
            uniqueParticipants: new Set(),
            discussionDetails: []
          }
          
          // Analizar discusiones (limitadas para rendimiento)
          if (discussions && discussions.length > 0) {
            for (const discussion of discussions.slice(0, 5)) {
              try {
                const posts = await smartClient.getDiscussionPosts(discussion.id)
                
                let totalWordCount = 0
                const discussionParticipants = new Set()
                
                for (const post of posts || []) {
                  if (post.userid) {
                    const studentInfo = students.find((s: any) => s.id === post.userid)
                    if (studentInfo) {
                      discussionParticipants.add(post.userid)
                      forumAnalysis.uniqueParticipants.add(post.userid)
                      analysisData.studentParticipation.activeStudents.add(post.userid)
                    }
                  }
                  
                  const wordCount = (post.message || '').split(' ').length
                  totalWordCount += wordCount
                }
                
                forumAnalysis.totalPosts += posts?.length || 0
                analysisData.overallMetrics.totalPosts += posts?.length || 0
                
                forumAnalysis.discussionDetails.push({
                  discussionId: discussion.id,
                  name: discussion.name,
                  totalPosts: posts?.length || 0,
                  uniqueParticipants: discussionParticipants.size,
                  averageWordCount: posts && posts.length > 0 ? Math.round(totalWordCount / posts.length) : 0,
                  hasRecentActivity: (currentDate.getTime() - discussion.timemodified * 1000) < (7 * 24 * 60 * 60 * 1000)
                })
                
              } catch (error: any) {
                console.log(`     ⚠️ No se pudo obtener posts de la discusión: ${discussion.name}`, error.message)
                
                forumAnalysis.discussionDetails.push({
                  discussionId: discussion.id,
                  name: discussion.name,
                  totalPosts: 0,
                  uniqueParticipants: 0,
                  averageWordCount: 0,
                  hasRecentActivity: (currentDate.getTime() - discussion.timemodified * 1000) < (7 * 24 * 60 * 60 * 1000),
                  hasError: true
                })
              }
            }
          }
          
          analysisData.detailedForumAnalysis.push(forumAnalysis)
        }
        
        // Analizar TAREAS
        else if (sectionModule.type === 'assign') {
          console.log(`   📝 Analizando tarea: ${sectionModule.name}`)
          
          let submissions: any = { submissions: [] }
          let hasPermissionError = false
          
          try {
            submissions = await smartClient.getAssignmentSubmissions(sectionModule.id, groupId)
          } catch (error: any) {
            console.log(`     ⚠️ Sin permisos para ver entregas de: ${sectionModule.name}`, error.message)
            hasPermissionError = true
          }
          
          const assignmentAnalysis: any = {
            assignmentId: sectionModule.id,
            assignmentName: sectionModule.name,
            sectionName: section.name,
            week: section.sectionNumber,
            isCurrentWeek: section.isCurrentWeek,
            visible: sectionModule.visible,
            hasPermissionError,
            submissionStats: {
              totalSubmissions: submissions.submissions?.length || 0,
              studentsSubmitted: new Set()
            }
          }
          
          // Si tenemos permisos, procesar las entregas
          if (submissions.submissions && !hasPermissionError) {
            for (const submission of submissions.submissions) {
              if (submission.userid) {
                assignmentAnalysis.submissionStats.studentsSubmitted.add(submission.userid)
                analysisData.studentParticipation.activeStudents.add(submission.userid)
              }
            }
          }
          
          // Marcar tareas especiales de modalidad
          if (sectionModule.name.toLowerCase().includes('modalidad')) {
            console.log(`     🎯 Tarea de modalidad detectada: ${sectionModule.name}`)
            assignmentAnalysis.isModalityAssignment = true
          }
          
          analysisData.overallMetrics.totalAssignments++
          analysisData.detailedAssignmentAnalysis.push(assignmentAnalysis)
        }
        
        // Contar RECURSOS
        else if (['resource', 'url', 'page', 'book'].includes(sectionModule.type)) {
          analysisData.overallMetrics.totalResources++
        }
        
      } catch (error) {
        console.log(`     ❌ Error analizando módulo ${sectionModule.name}:`, error)
      }
    }
  }
  
  // Identificar estudiantes inactivos
  const activeStudentIds = Array.from(analysisData.studentParticipation.activeStudents)
  for (const student of students) {
    if (!activeStudentIds.includes(student.id)) {
      analysisData.studentParticipation.inactiveStudents.push({
        id: student.id,
        name: `${student.firstname} ${student.lastname}`,
        email: student.email,
        lastAccess: student.lastaccess
      })
    }
  }
  
  // Estadísticas finales
  const assignmentsWithPermissionErrors = analysisData.detailedAssignmentAnalysis.filter(
    (a: any) => a.hasPermissionError
  ).length
  
  const modalityAssignments = analysisData.detailedAssignmentAnalysis.filter(
    (a: any) => a.isModalityAssignment
  ).length
  
  console.log(`\n📊 RESUMEN FINAL:`)
  console.log(`   - Estudiantes activos: ${activeStudentIds.length}/${students.length}`)
  console.log(`   - Estudiantes inactivos: ${analysisData.studentParticipation.inactiveStudents.length}`)
  console.log(`   - Total discusiones: ${analysisData.overallMetrics.totalDiscussions}`)
  console.log(`   - Total posts: ${analysisData.overallMetrics.totalPosts}`)
  console.log(`   - Total tareas: ${analysisData.overallMetrics.totalAssignments}`)
  console.log(`   - Tareas de modalidad: ${modalityAssignments}`)
  console.log(`   - Tareas sin permisos: ${assignmentsWithPermissionErrors}`)
  
  return analysisData
}

async function generateAIAnalysisWithDetails(analysisData: any, courseId: string, details: AnalysisDetails) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
  
  const courseInfo = analysisData.courseInfo
  const weeklyStructure = analysisData.weeklyStructure
  const forumAnalysis = analysisData.detailedForumAnalysis
  const assignmentAnalysis = analysisData.detailedAssignmentAnalysis
  const studentParticipation = analysisData.studentParticipation
  const overallMetrics = analysisData.overallMetrics
  
  const activeStudentsCount = Array.from(studentParticipation.activeStudents).length
  const inactiveStudentsCount = studentParticipation.inactiveStudents.length
  
  console.log(`📤 DATOS ENVIADOS A PROCESAR - ANÁLISIS INTELIGENTE:`)
  console.log(`   🏫 Curso ID: ${courseId} (Grupo/Modalidad: ${courseInfo.groupId})`)
  console.log(`   👥 Estudiantes: ${courseInfo.totalStudents} total, ${activeStudentsCount} activos, ${inactiveStudentsCount} inactivos`)
  console.log(`   📅 Estructura: ${weeklyStructure.totalSections} secciones`)
  console.log(`   💬 Foros: ${overallMetrics.totalForums} con ${overallMetrics.totalDiscussions} discusiones`)
  console.log(`   📝 Asignaciones: ${overallMetrics.totalAssignments}`)
  console.log(`   📊 Posts totales: ${overallMetrics.totalPosts}`)
  
  const prompt = `Como experto en análisis educativo, realiza un análisis PROFUNDO del curso ${courseId} (Grupo/Modalidad: ${courseInfo.groupId}):

📊 **INFORMACIÓN DEL CURSO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Estudiantes matriculados: ${courseInfo.totalStudents}
• Fecha de análisis: ${new Date(courseInfo.analysisDate).toLocaleDateString()}
• Estudiantes ACTIVOS: ${activeStudentsCount} (${courseInfo.totalStudents > 0 ? Math.round((activeStudentsCount / courseInfo.totalStudents) * 100) : 0}%)
• Estudiantes INACTIVOS: ${inactiveStudentsCount} (${courseInfo.totalStudents > 0 ? Math.round((inactiveStudentsCount / courseInfo.totalStudents) * 100) : 0}%)
• Profesor analizado: ${courseInfo.userMatricula}

📅 **ESTRUCTURA SEMANAL**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Secciones totales: ${weeklyStructure.totalSections}
• Secciones ACTIVAS: ${weeklyStructure.activeSections.length}
• Secciones completadas: ${weeklyStructure.completedSections.length}

**SECCIONES ACTIVAS:**
${weeklyStructure.activeSections.map((section: any) => `
• ${section.name} - ${section.status.toUpperCase()}
  - Actividades: ${section.activitiesCount}
  - Recursos: ${section.resourcesCount}`).join('')}

💬 **ANÁLISIS DE FOROS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total foros: ${overallMetrics.totalForums}
• Total discusiones: ${overallMetrics.totalDiscussions}
• Total posts: ${overallMetrics.totalPosts}

${forumAnalysis.map((forum: any) => `
**${forum.forumName}** (${forum.sectionName})
- Discusiones: ${forum.discussionCount}
- Posts: ${forum.totalPosts}
- Participantes: ${Array.from(forum.uniqueParticipants).length}`).join('')}

📝 **ANÁLISIS DE TAREAS**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total tareas: ${overallMetrics.totalAssignments}

${assignmentAnalysis.map((assignment: any) => `
**${assignment.assignmentName}** (${assignment.sectionName})
- Entregas: ${assignment.submissionStats.totalSubmissions}
- Estudiantes que entregaron: ${Array.from(assignment.submissionStats.studentsSubmitted).length}/${courseInfo.totalStudents}
${assignment.isModalityAssignment ? '- **TAREA DE MODALIDAD** 🎯' : ''}
${assignment.hasPermissionError ? '- ⚠️ Sin acceso a entregas' : ''}`).join('')}

🚨 **ESTUDIANTES EN RIESGO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${inactiveStudentsCount > 0 ? `
**${inactiveStudentsCount} ESTUDIANTES SIN PARTICIPACIÓN:**
${studentParticipation.inactiveStudents.slice(0, 5).map((student: any) => `• ${student.name}`).join('\n')}
${inactiveStudentsCount > 5 ? `... y ${inactiveStudentsCount - 5} más` : ''}` : 'No hay estudiantes completamente inactivos.'}

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
  "studentsAtRisk": "${inactiveStudentsCount} estudiantes (${courseInfo.totalStudents > 0 ? Math.round((inactiveStudentsCount / courseInfo.totalStudents) * 100) : 0}%) sin participación",
  "recommendations": ["recomendación 1", "recomendación 2"],
  "nextStep": "acción prioritaria concreta",
  "overallHealth": "buena/regular/necesita atención"
}`

  details.prompt = prompt
  
  console.log(`🚀 ENVIANDO A OpenAI - ANÁLISIS INTELIGENTE:`)
  console.log(`   🔗 Modelo: gpt-4`)
  console.log(`   📝 Prompt (primeros 400 chars):`, prompt.substring(0, 400) + '...')
  console.log(`   ⚙️ Configuración: max_tokens=1000, temperature=0.7`)
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    })
    
    details.model = "gpt-4"
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

async function saveAnalysisToDatabase(courseId: string, groupId: string, analysisResult: any, userId: string, rawData: any) {
  let course = await prisma.course.findFirst({
    where: { moodleCourseId: courseId, userId }
  })
  
  if (!course) {
    course = await prisma.course.create({
      data: {
        moodleCourseId: courseId,
        name: `Curso ${courseId}`,
        userId,
        lastSync: new Date()
      }
    })
  }
  
  let dbGroup = await prisma.group.findFirst({
    where: { moodleGroupId: groupId, courseId: course.id }
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
  
  await prisma.analysisResult.updateMany({
    where: {
      courseId: course.id,
      groupId: dbGroup.id,
      isLatest: true
    },
    data: { isLatest: false }
  })
  
  const analysisResult_db = await prisma.analysisResult.create({
    data: {
      userId,
      courseId: course.id,
      groupId: dbGroup.id,
      analysisType: 'INTELLIGENT_ANALYSIS',
      strengths: analysisResult.strengths,
      alerts: analysisResult.alerts,
      nextStep: analysisResult.nextStep,
      rawData,
      llmResponse: analysisResult,
      confidence: 0.9,
      isLatest: true
    }
  })
  
  return analysisResult_db
}

async function saveAnalysisDetailsToPDF(details: AnalysisDetails) {
  try {
    const content = `
========================================
REPORTE TÉCNICO DE ANÁLISIS INTELIGENTE
========================================

📊 INFORMACIÓN GENERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ID de Solicitud: ${details.requestId}
• Fecha y Hora: ${details.timestamp}
• Curso ID: ${details.courseId}
• Grupo ID: ${details.groupId}
• Usuario ID: ${details.userId}
• Matrícula: ${details.userMatricula}
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

💰 INFORMACIÓN DE COSTOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Costo por prompt: $${((details.tokensUsed.prompt * 0.03) / 1000).toFixed(4)} USD
• Costo por respuesta: $${((details.tokensUsed.completion * 0.06) / 1000).toFixed(4)} USD
• Costo total: $${details.cost.toFixed(4)} USD

🔚 FIN DEL REPORTE
Generado automáticamente por el Dashboard Académico UTEL - Análisis Inteligente V2
`

    const reportsDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const fileName = `analysis-intelligent-${details.requestId}-${Date.now()}.txt`
    const filePath = path.join(reportsDir, fileName)

    fs.writeFileSync(filePath, content, 'utf8')

    console.log(`📄 Reporte técnico guardado: ${filePath}`)
    return filePath

  } catch (error) {
    console.error('Error generando reporte PDF:', error)
    return null
  }
}
