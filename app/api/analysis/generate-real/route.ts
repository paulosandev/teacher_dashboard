import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClientEnhanced } from '@/lib/moodle/client-enhanced'
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
  const requestId = `req_${startTime}`
  
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
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { courseId, groupId } = await request.json()
    
    if (!courseId || !groupId) {
      return NextResponse.json(
        { error: 'Se requiere courseId y groupId' },
        { status: 400 }
      )
    }

    // Verificar que el usuario tenga matrícula
    if (!session.user.matricula) {
      return NextResponse.json(
        { error: 'Usuario sin matrícula registrada' },
        { status: 400 }
      )
    }

    // Llenar datos iniciales del análisis
    analysisDetails.courseId = courseId
    analysisDetails.groupId = groupId  
    analysisDetails.userId = session.user.id
    analysisDetails.userMatricula = session.user.matricula

    console.log(`🔍 [${requestId}] Iniciando análisis real: Curso ${courseId}, Grupo ${groupId}`)

    // Crear cliente Moodle con token del usuario
    const moodleClient = new MoodleAPIClientEnhanced(session.user.id, session.user.email)

    // 1. Verificar que el usuario sea profesor de este curso
    const teacherCourses = await moodleClient.getUserCourses()
    
    const isTeacher = teacherCourses.some(course => course.id === courseId)
    if (!isTeacher) {
      analysisDetails.error = 'No tienes permisos para este curso'
      await saveAnalysisDetailsToPDF(analysisDetails)
      return NextResponse.json(
        { error: 'No tienes permisos para este curso' },
        { status: 403 }
      )
    }

    // 2. Verificar contenido del curso
    const courseContent = await checkCourseContent(parseInt(courseId), moodleClient)
    
    if (!courseContent.hasContent) {
      analysisDetails.error = courseContent.reason
      await saveAnalysisDetailsToPDF(analysisDetails)
      return NextResponse.json({
        success: false,
        message: courseContent.reason,
        suggestions: courseContent.suggestions
      })
    }

    // 3. Recolectar datos detallados
    console.log(`🔄 [${requestId}] Recolectando datos detallados del curso y grupo...`)
    const analysisData = await collectDetailedCourseData(parseInt(courseId), parseInt(groupId), moodleClient)

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

    console.log(`✅ [${requestId}] Análisis completado en ${analysisDetails.processingTime}ms`)
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
      message: '🎉 Análisis generado exitosamente con detalles técnicos'
    })

  } catch (error) {
    console.error(`❌ [${requestId}] Error en generación de análisis:`, error)
    
    analysisDetails.error = error instanceof Error ? error.message : 'Error desconocido'
    analysisDetails.processingTime = Date.now() - startTime
    await saveAnalysisDetailsToPDF(analysisDetails)
    
    return NextResponse.json(
      { 
        error: 'Error al generar análisis',
        details: error instanceof Error ? error.message : 'Error desconocido',
        requestId
      },
      { status: 500 }
    )
  }
}

async function checkCourseContent(courseId: number, moodleClient: MoodleAPIClientEnhanced) {
  try {
    const forums = await moodleClient.getCourseForums(courseId)
    const courseContents = await moodleClient.getCourseContents(courseId)
    
    const activitiesCount = courseContents.reduce((acc, section) => {
      return acc + (section.modules?.length || 0)
    }, 0)

    console.log(`📋 Contenido del curso: ${forums.length} foros, ${activitiesCount} actividades`)

    if (forums.length === 0 && activitiesCount === 0) {
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
      forumsCount: forums.length,
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

async function collectDetailedCourseData(courseId: number, groupId: number, moodleClient: MoodleAPIClientEnhanced) {
  console.log('🔍 Iniciando recolección de datos profunda del curso:', courseId, 'Grupo/Modalidad:', groupId)
  
  // Obtener contenido completo del curso (por ahora sin filtro de grupo)
  const courseContents = await moodleClient.getCourseContents(courseId)
  const currentDate = new Date()
  
  console.log(`📋 Secciones disponibles: ${courseContents.length}`)
  
  // Obtener estudiantes matriculados
  let students = []
  try {
    const allUsers = await moodleClient.getEnrolledUsers(courseId)
    students = allUsers.filter((u: any) => 
      u.roles?.some((r: any) => r.roleid === 5) // Rol estudiante
    )
    console.log(`👥 Estudiantes matriculados: ${students.length}`)
  } catch (error) {
    console.log('⚠️ No se pudo obtener lista de estudiantes')
  }
  
  // Estructura de datos para el análisis
  const analysisData: any = {
    courseInfo: {
      courseId,
      analysisDate: currentDate.toISOString(),
      totalStudents: students.length,
      groupId: groupId
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
  
  // Calcular fechas aproximadas
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
  
  // Análisis de módulos en secciones activas
  const sectionsToAnalyze = [
    ...analysisData.weeklyStructure.activeSections,
    ...analysisData.weeklyStructure.completedSections.slice(-2)
  ]
  
  for (const section of sectionsToAnalyze) {
    console.log(`\n📅 Analizando sección: ${section.name}`)
    
    for (const sectionModule of section.modules) {
      try {
        // Analizar FOROS
        if (sectionModule.type === 'forum') {
          console.log(`   💬 Analizando foro: ${sectionModule.name}`)
          
          const discussions = await moodleClient.getForumDiscussions(sectionModule.id)
          analysisData.overallMetrics.totalDiscussions += discussions.length
          analysisData.overallMetrics.totalForums++
          
          const forumAnalysis: any = {
            forumId: sectionModule.id,
            forumName: sectionModule.name,
            sectionName: section.name,
            discussionCount: discussions.length,
            totalPosts: 0,
            uniqueParticipants: new Set(),
            discussionDetails: []
          }
          
          // Analizar discusiones (limitadas)
          for (const discussion of discussions.slice(0, 5)) {
            try {
              const posts = await moodleClient.getDiscussionPosts(discussion.id)
              
              let totalWordCount = 0
              const discussionParticipants = new Set()
              
              for (const post of posts) {
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
              
              forumAnalysis.totalPosts += posts.length
              analysisData.overallMetrics.totalPosts += posts.length
              
              forumAnalysis.discussionDetails.push({
                discussionId: discussion.id,
                name: discussion.name,
                totalPosts: posts.length,
                uniqueParticipants: discussionParticipants.size,
                averageWordCount: posts.length > 0 ? Math.round(totalWordCount / posts.length) : 0,
                hasRecentActivity: (currentDate.getTime() - discussion.timemodified * 1000) < (7 * 24 * 60 * 60 * 1000)
              })
              
            } catch (error: any) {
              // Si es un error conocido de Moodle, simplemente registrarlo sin detener
              if (error.message?.includes('get_forum_id()')) {
                console.log(`     ⚠️ No se pudo obtener posts de la discusión: ${discussion.name}`)
              } else {
                console.log(`     ❌ Error en discusión ${discussion.id}: ${error.message}`)
              }
              
              // Agregar información parcial de la discusión
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
          
          analysisData.detailedForumAnalysis.push(forumAnalysis)
        }
        
        // Analizar TAREAS
        else if (sectionModule.type === 'assign') {
          console.log(`   📝 Analizando tarea: ${sectionModule.name}`)
          
          let submissions: any = { submissions: [] }
          let hasPermissionError = false
          
          try {
            submissions = await moodleClient.getAssignmentSubmissions(sectionModule.id)
          } catch (error: any) {
            if (error.message?.includes('Excepción al control de acceso') || 
                error.message?.includes('Access control exception')) {
              console.log(`     ⚠️ Sin permisos para ver entregas de: ${sectionModule.name}`)
              hasPermissionError = true
            } else {
              console.log(`     ❌ Error obteniendo entregas: ${error.message}`)
            }
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
          
          // Si es una tarea de modalidad de actividades, marcarla especialmente
          if (sectionModule.name.includes('Modalidad de actividades')) {
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
        console.log(`     ❌ Error analizando módulo ${sectionModule.name}`)
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
  
  // Contar tareas con problemas de permisos
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
  
  // Agregar información sobre permisos al análisis
  analysisData.permissionIssues = {
    assignmentsWithoutAccess: assignmentsWithPermissionErrors,
    totalAssignments: analysisData.overallMetrics.totalAssignments,
    hasLimitedAccess: assignmentsWithPermissionErrors > 0
  }
  
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
  
  // Información sobre permisos
  const permissionNote = analysisData.permissionIssues?.hasLimitedAccess ? 
    `\n⚠️ **NOTA IMPORTANTE**: No se pudo acceder a las entregas de ${analysisData.permissionIssues.assignmentsWithoutAccess} tareas debido a restricciones de permisos. Los datos de entregas pueden estar incompletos.` : ''
  
  const prompt = `Como experto en análisis educativo, realiza un análisis PROFUNDO del curso ${courseId}:

📊 **INFORMACIÓN DEL CURSO**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Estudiantes matriculados: ${courseInfo.totalStudents}
• Fecha de análisis: ${new Date(courseInfo.analysisDate).toLocaleDateString()}
• Estudiantes ACTIVOS: ${activeStudentsCount} (${courseInfo.totalStudents > 0 ? Math.round((activeStudentsCount / courseInfo.totalStudents) * 100) : 0}%)
• Estudiantes INACTIVOS: ${inactiveStudentsCount} (${courseInfo.totalStudents > 0 ? Math.round((inactiveStudentsCount / courseInfo.totalStudents) * 100) : 0}%)${permissionNote}

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
- Estudiantes que entregaron: ${Array.from(assignment.submissionStats.studentsSubmitted).length}/${courseInfo.totalStudents}`).join('')}

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
      analysisType: 'GROUP_SPECIFIC_ANALYSIS',
      strengths: analysisResult.strengths,
      alerts: analysisResult.alerts,
      nextStep: analysisResult.nextStep,
      rawData,
      llmResponse: analysisResult,
      confidence: 0.8,
      isLatest: true
    }
  })
  
  return analysisResult_db
}

async function saveAnalysisDetailsToPDF(details: AnalysisDetails) {
  try {
    const content = `
========================================
REPORTE TÉCNICO DE ANÁLISIS EDUCATIVO
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
Generado automáticamente por el Dashboard Académico UTEL
`

    const reportsDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const fileName = `analysis-${details.requestId}-${Date.now()}.txt`
    const filePath = path.join(reportsDir, fileName)

    fs.writeFileSync(filePath, content, 'utf8')

    console.log(`📄 Reporte técnico guardado: ${filePath}`)
    return filePath

  } catch (error) {
    console.error('Error generando reporte PDF:', error)
    return null
  }
}
