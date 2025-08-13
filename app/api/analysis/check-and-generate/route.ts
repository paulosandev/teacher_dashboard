import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { moodleClient } from '@/lib/moodle/api-client'
import { prisma } from '@/lib/db/prisma'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
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

    console.log(`🔍 Verificando contenido para análisis: Curso ${courseId}, Grupo ${groupId}`)

    // 1. Verificar que el usuario sea profesor de este curso
    const userMatricula = session.user.matricula
    
    if (!userMatricula) {
      return NextResponse.json(
        { error: 'Usuario sin matrícula registrada' },
        { status: 400 }
      )
    }
    
    const teacherCourses = await moodleClient.getTeacherCoursesWithGroups(userMatricula)
    
    const isTeacher = teacherCourses.some(course => course.id === courseId)
    if (!isTeacher) {
      return NextResponse.json(
        { error: 'No tienes permisos para este curso' },
        { status: 403 }
      )
    }

    // 2. Verificar si hay contenido analizable en el curso
    const courseContent = await checkCourseContent(parseInt(courseId))
    
    if (!courseContent.hasContent) {
      return NextResponse.json({
        success: true,
        status: 'no_content',
        message: courseContent.reason,
        suggestions: courseContent.suggestions
      })
    }

    // 3. Verificar si ya existe un análisis reciente
    const existingAnalysis = await checkExistingAnalysis(courseId, groupId, session.user.id)
    
    if (existingAnalysis) {
      return NextResponse.json({
        success: true,
        status: 'analysis_exists',
        analysis: existingAnalysis,
        message: 'Ya existe un análisis reciente para este curso y grupo'
      })
    }

    // 4. Generar análisis si hay contenido
    console.log('🔄 Iniciando generación de análisis...')
    
    // Generar análisis real
    const analysisResult = await generateRealAnalysis(courseId, groupId, courseContent, session.user.id)
    
    return NextResponse.json({
      success: true,
      status: 'analysis_generated',
      analysis: analysisResult,
      message: 'Análisis generado exitosamente'
    })

  } catch (error) {
    console.error('Error en check-and-generate:', error)
    return NextResponse.json(
      { 
        error: 'Error al procesar solicitud',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

async function checkCourseContent(courseId: number) {
  try {
    // Obtener foros del curso
    const forums = await moodleClient.getCourseForums(courseId)
    
    // Obtener contenido del curso (actividades)
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

    if (forums.length === 0) {
      return {
        hasContent: false,
        reason: 'El curso no tiene foros de discusión',
        suggestions: [
          'Crear un foro de presentación',
          'Agregar foros temáticos por unidad',
          'Configurar foros de debate'
        ]
      }
    }

    // Verificar si los foros tienen participación
    let hasParticipation = false
    for (const forum of forums) {
      const discussions = await moodleClient.getForumDiscussions(forum.id)
      if (discussions.length > 0) {
        hasParticipation = true
        break
      }
    }

    if (!hasParticipation) {
      return {
        hasContent: false,
        reason: 'Los foros del curso no tienen participación estudiantil',
        suggestions: [
          'Motivar la participación estudiantil',
          'Crear discusiones iniciales',
          'Asignar actividades que requieran participación en foros'
        ]
      }
    }

    return {
      hasContent: true,
      forumsCount: forums.length,
      activitiesCount,
      hasParticipation
    }

  } catch (error) {
    console.error('Error verificando contenido del curso:', error)
    return {
      hasContent: false,
      reason: 'Error al acceder al contenido del curso',
      suggestions: ['Verificar la conectividad con Moodle', 'Contactar al administrador']
    }
  }
}

async function checkExistingAnalysis(moodleCourseId: string, moodleGroupId: string, userId: string) {
  try {
    // 1. Buscar curso local por Moodle ID
    const localCourse = await prisma.course.findFirst({
      where: {
        moodleCourseId,
        userId
      }
    })

    if (!localCourse) {
      console.log('💾 Curso no encontrado en BD local para análisis existente')
      return null
    }

    // 2. Buscar grupo local por Moodle ID
    const localGroup = await prisma.group.findFirst({
      where: {
        moodleGroupId,
        courseId: localCourse.id
      }
    })

    if (!localGroup) {
      console.log('💾 Grupo no encontrado en BD local para análisis existente')
      return null
    }

    // 3. Buscar análisis reciente (últimas 4 horas)
    const recentAnalysis = await prisma.analysisResult.findFirst({
      where: {
        courseId: localCourse.id,
        groupId: localGroup.id,
        isLatest: true,
        processedAt: {
          gte: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 horas
        }
      },
      include: {
        activity: true,
        forum: true
      }
    })

    if (recentAnalysis) {
      console.log('✅ Análisis existente encontrado:', recentAnalysis.id)
    }

    return recentAnalysis
  } catch (error) {
    console.error('Error verificando análisis existente:', error)
    return null
  }
}

async function generateRealAnalysis(courseId: string, groupId: string, content: any, userId: string) {
  try {
    console.log('🔄 Iniciando análisis real del curso:', courseId)
    
    // 1. Obtener datos de foros para análisis
    const forumData = await collectForumData(parseInt(courseId))
    
    // 2. Generar análisis con OpenAI
    const analysisText = await generateAIAnalysis(forumData, courseId)
    
    // 3. Buscar o crear curso en BD local
    const course = await ensureCourseExists(courseId, userId)
    
    // 4. Buscar o crear grupo en BD local
    let dbGroup = await prisma.group.findFirst({
      where: {
        moodleGroupId: groupId,
        courseId: course.id  // Asegurar que el grupo pertenece al curso correcto
      }
    })
    
    if (!dbGroup) {
      // Crear grupo si no existe (esto debería manejarse por sincronización)
      console.log('⚠️  Grupo no encontrado en BD local, creando:', groupId)
      dbGroup = await prisma.group.create({
        data: {
          moodleGroupId: groupId,
          name: `Grupo ${groupId}`,
          courseId: course.id
        }
      })
    }
    
    console.log('💾 Usando IDs: Curso local:', course.id, ', Grupo local:', dbGroup.id)
    
    // 5. Marcar análisis anteriores como no-latest
    await prisma.analysisResult.updateMany({
      where: {
        courseId: course.id,  // Usar ID local del curso
        groupId: dbGroup.id,
        isLatest: true
      },
      data: {
        isLatest: false
      }
    })
    
    // 6. Guardar nuevo análisis en BD
    const analysisResult = await prisma.analysisResult.create({
      data: {
        userId,
        courseId: course.id,  // Usar ID local del curso
        groupId: dbGroup.id,
        analysisType: 'FORUM_PARTICIPATION',
        strengths: analysisText.strengths,
        alerts: analysisText.alerts,
        nextStep: analysisText.nextStep,
        rawData: forumData,
        llmResponse: analysisText,
        confidence: 0.8,
        isLatest: true
      }
    })
    
    console.log('✅ Análisis guardado con ID:', analysisResult.id)
    
    return {
      id: analysisResult.id,
      courseId,
      groupId: dbGroup.id,
      status: 'completed',
      summary: analysisText.nextStep,
      strengths: analysisText.strengths,
      alerts: analysisText.alerts,
      forumsAnalyzed: content.forumsCount,
      activitiesAnalyzed: content.activitiesCount,
      generatedAt: analysisResult.processedAt.toISOString()
    }
    
  } catch (error) {
    console.error('Error generando análisis real:', error)
    throw error
  }
}

async function collectForumData(courseId: number) {
  console.log('🔍 Recolectando datos detallados del curso:', courseId)
  
  // 1. Obtener estructura del curso (secciones/semanas)
  const courseContents = await moodleClient.getCourseContents(courseId)
  
  // 2. Obtener todos los foros del curso
  const forums = await moodleClient.getCourseForums(courseId)
  
  // 3. Obtener usuarios inscritos para calcular participación
  let enrolledStudents = 0
  try {
    const enrolled = await moodleClient.getEnrolledUsers(courseId)
    enrolledStudents = enrolled.filter((u: any) => 
      u.roles?.some((r: any) => r.roleid === 5) // Rol estudiante
    ).length
  } catch (error) {
    console.log('⚠️ No se pudo obtener lista de estudiantes')
  }
  
  const analysisData: any = {
    courseStructure: {
      totalSections: courseContents.length,
      sections: courseContents.map((section: any) => ({
        name: section.name,
        visible: section.visible,
        moduleCount: section.modules?.length || 0,
        modules: section.modules?.map((mod: any) => ({
          type: mod.modname,
          name: mod.name,
          visible: mod.visible,
          completion: mod.completiondata
        }))
      }))
    },
    enrolledStudents,
    forums: [],
    assignments: [],
    overallStats: {
      totalForums: forums.length,
      totalActivities: 0,
      totalResources: 0
    }
  }
  
  // 4. Analizar cada foro en detalle
  for (const forum of forums) {
    try {
      const discussions = await moodleClient.getForumDiscussions(forum.id)
      
      // Obtener participación detallada
      const participantsSet = new Set()
      let totalPosts = 0
      const topDiscussions = []
      
      for (const discussion of discussions.slice(0, 10)) { // Top 10 discusiones
        try {
          const posts = await moodleClient.getDiscussionPosts(discussion.id)
          totalPosts += posts.length
          
          posts.forEach((post: any) => {
            if (post.author) participantsSet.add(post.author)
          })
          
          topDiscussions.push({
            name: discussion.name,
            created: discussion.created,
            posts: posts.length,
            lastPost: posts[posts.length - 1]?.created
          })
        } catch (error) {
          console.log(`Error en discusión ${discussion.id}`)
        }
      }
      
      analysisData.forums.push({
        forumName: forum.name,
        forumId: forum.id,
        type: forum.type,
        introMessage: forum.intro?.substring(0, 200),
        stats: {
          totalDiscussions: discussions.length,
          totalPosts,
          uniqueParticipants: participantsSet.size,
          participationRate: enrolledStudents > 0 
            ? Math.round((participantsSet.size / enrolledStudents) * 100) 
            : 0,
          avgPostsPerDiscussion: discussions.length > 0 
            ? Math.round(totalPosts / discussions.length) 
            : 0
        },
        topDiscussions,
        hasActivity: discussions.length > 0,
        lastActivity: discussions[0]?.timemodified
      })
    } catch (error) {
      console.error(`Error analizando foro ${forum.id}:`, error)
    }
  }
  
  // 5. Contar actividades y recursos totales
  courseContents.forEach((section: any) => {
    section.modules?.forEach((mod: any) => {
      if (mod.modname === 'assign' || mod.modname === 'quiz') {
        analysisData.overallStats.totalActivities++
        analysisData.assignments.push({
          name: mod.name,
          type: mod.modname,
          section: section.name,
          visible: mod.visible
        })
      } else if (mod.modname === 'resource' || mod.modname === 'url' || mod.modname === 'page') {
        analysisData.overallStats.totalResources++
      }
    })
  })
  
  console.log('✅ Datos recolectados:', {
    foros: analysisData.forums.length,
    secciones: analysisData.courseStructure.totalSections,
    actividades: analysisData.overallStats.totalActivities,
    estudiantes: analysisData.enrolledStudents
  })
  
  return analysisData
}

async function generateAIAnalysis(analysisData: any, courseId: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
  
  // Preparar resumen de datos para el prompt
  const summary = {
    estudiantes: analysisData.enrolledStudents,
    secciones: analysisData.courseStructure.totalSections,
    foros: analysisData.forums.map((f: any) => ({
      nombre: f.forumName,
      discusiones: f.stats.totalDiscussions,
      participantes: f.stats.uniqueParticipants,
      tasaParticipacion: f.stats.participationRate,
      mensajesTotales: f.stats.totalPosts
    })),
    actividades: analysisData.overallStats.totalActivities,
    recursos: analysisData.overallStats.totalResources,
    tareas: analysisData.assignments.map((a: any) => a.name)
  }
  
  const prompt = `
Como experto en análisis educativo, analiza los siguientes datos del curso ${courseId}:

**RESUMEN DEL CURSO:**
- Estudiantes inscritos: ${summary.estudiantes}
- Secciones/semanas: ${summary.secciones}
- Total de actividades: ${summary.actividades}
- Total de recursos: ${summary.recursos}

**ANÁLISIS DE FOROS:**
${summary.foros.map((f: any) => `
- ${f.nombre}:
  • ${f.discusiones} discusiones
  • ${f.participantes} participantes únicos
  • Tasa de participación: ${f.tasaParticipacion}%
  • ${f.mensajesTotales} mensajes totales
`).join('')}

**TAREAS Y ACTIVIDADES:**
${summary.tareas.length > 0 ? summary.tareas.join(', ') : 'No hay tareas registradas'}

BASADO EN ESTOS DATOS, proporciona un análisis detallado y práctico que incluya:

1. **Fortalezas** (3-4 puntos específicos sobre lo que funciona bien)
2. **Alertas críticas** (problemas urgentes que requieren atención inmediata)
3. **Estudiantes en riesgo** (basado en baja o nula participación)
4. **Recomendaciones específicas** (acciones concretas para mejorar)
5. **Próximo paso prioritario** (la acción más importante a tomar)

Responde en formato JSON con la siguiente estructura:
{
  "strengths": ["fortaleza específica 1", "fortaleza 2", "fortaleza 3"],
  "alerts": ["alerta crítica 1", "alerta 2"],
  "studentsAtRisk": "número estimado o porcentaje de estudiantes con baja participación",
  "recommendations": ["recomendación 1", "recomendación 2"],
  "nextStep": "acción prioritaria concreta",
  "overallHealth": "buena/regular/necesita atención"
}
`
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    })
    
    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    // Asegurar estructura correcta
    return {
      strengths: parsed.strengths || analyzeStrengths(analysisData),
      alerts: parsed.alerts || analyzeAlerts(analysisData),
      studentsAtRisk: parsed.studentsAtRisk || calculateRiskStudents(analysisData),
      recommendations: parsed.recommendations || [],
      nextStep: parsed.nextStep || generateNextStep(analysisData),
      overallHealth: parsed.overallHealth || 'regular'
    }
  } catch (error) {
    console.error('Error con OpenAI:', error)
    // Análisis fallback basado en datos
    return {
      strengths: analyzeStrengths(analysisData),
      alerts: analyzeAlerts(analysisData),
      studentsAtRisk: calculateRiskStudents(analysisData),
      recommendations: generateRecommendations(analysisData),
      nextStep: generateNextStep(analysisData),
      overallHealth: calculateOverallHealth(analysisData)
    }
  }
}

// Funciones auxiliares para análisis fallback
function analyzeStrengths(data: any) {
  const strengths = []
  
  // Analizar participación en foros
  const activeForums = data.forums.filter((f: any) => f.stats.participationRate > 50)
  if (activeForums.length > 0) {
    strengths.push(`${activeForums.length} foros con participación activa superior al 50%`)
  }
  
  // Analizar estructura del curso
  if (data.courseStructure.totalSections > 5) {
    strengths.push(`Curso bien estructurado con ${data.courseStructure.totalSections} secciones`)
  }
  
  // Analizar recursos
  if (data.overallStats.totalResources > 10) {
    strengths.push(`Amplia variedad de recursos disponibles (${data.overallStats.totalResources})`)
  }
  
  if (strengths.length === 0) {
    strengths.push("Curso con estructura básica establecida")
  }
  
  return strengths
}

function analyzeAlerts(data: any) {
  const alerts = []
  
  // Verificar participación baja
  const lowParticipation = data.forums.filter((f: any) => 
    f.stats.participationRate < 30 && f.stats.participationRate > 0
  )
  if (lowParticipation.length > 0) {
    alerts.push(`${lowParticipation.length} foros con participación menor al 30%`)
  }
  
  // Verificar foros sin actividad
  const inactiveForums = data.forums.filter((f: any) => !f.hasActivity)
  if (inactiveForums.length > 0) {
    alerts.push(`${inactiveForums.length} foros sin ninguna actividad`)
  }
  
  // Verificar falta de actividades
  if (data.overallStats.totalActivities < 3) {
    alerts.push("Pocas actividades evaluables configuradas")
  }
  
  if (alerts.length === 0) {
    alerts.push("Sin alertas críticas detectadas")
  }
  
  return alerts
}

function calculateRiskStudents(data: any) {
  if (data.enrolledStudents === 0) return "No se pudo calcular"
  
  // Calcular promedio de participación
  const avgParticipation = data.forums.reduce((acc: number, f: any) => 
    acc + f.stats.participationRate, 0
  ) / (data.forums.length || 1)
  
  if (avgParticipation < 30) {
    return `Más del ${Math.round(100 - avgParticipation)}% de estudiantes en riesgo`
  } else if (avgParticipation < 50) {
    return `Aproximadamente ${Math.round((100 - avgParticipation) / 2)}% de estudiantes necesitan seguimiento`
  }
  
  return "Menos del 20% requiere atención especial"
}

function generateRecommendations(data: any) {
  const recommendations = []
  
  // Basado en participación
  const avgParticipation = data.forums.reduce((acc: number, f: any) => 
    acc + f.stats.participationRate, 0
  ) / (data.forums.length || 1)
  
  if (avgParticipation < 40) {
    recommendations.push("Implementar actividades obligatorias en foros")
    recommendations.push("Enviar recordatorios personalizados a estudiantes inactivos")
  }
  
  // Basado en estructura
  if (data.overallStats.totalActivities < 5) {
    recommendations.push("Agregar más actividades evaluables")
  }
  
  if (data.forums.some((f: any) => !f.hasActivity)) {
    recommendations.push("Iniciar discusiones en foros inactivos")
  }
  
  return recommendations
}

function generateNextStep(data: any) {
  // Priorizar basado en alertas
  const inactiveForums = data.forums.filter((f: any) => !f.hasActivity)
  if (inactiveForums.length > 0) {
    return `Activar el foro "${inactiveForums[0].forumName}" con una pregunta detonadora`
  }
  
  const lowParticipation = data.forums.filter((f: any) => 
    f.stats.participationRate < 30 && f.stats.participationRate > 0
  )
  if (lowParticipation.length > 0) {
    return `Contactar a estudiantes sin participación en "${lowParticipation[0].forumName}"`
  }
  
  if (data.overallStats.totalActivities < 3) {
    return "Configurar al menos una tarea o cuestionario evaluable"
  }
  
  return "Mantener el seguimiento actual y revisar en 3 días"
}

function calculateOverallHealth(data: any) {
  let score = 0
  
  // Evaluar participación
  const avgParticipation = data.forums.reduce((acc: number, f: any) => 
    acc + f.stats.participationRate, 0
  ) / (data.forums.length || 1)
  
  if (avgParticipation > 60) score += 40
  else if (avgParticipation > 40) score += 25
  else if (avgParticipation > 20) score += 10
  
  // Evaluar estructura
  if (data.courseStructure.totalSections > 5) score += 20
  if (data.overallStats.totalActivities > 5) score += 20
  if (data.overallStats.totalResources > 10) score += 20
  
  if (score >= 70) return "buena"
  if (score >= 40) return "regular"
  return "necesita atención"
}

async function ensureCourseExists(moodleCourseId: string, userId: string) {
  let course = await prisma.course.findFirst({
    where: {
      moodleCourseId,
      userId
    }
  })
  
  if (!course) {
    // Crear curso básico si no existe
    course = await prisma.course.create({
      data: {
        moodleCourseId,
        name: `Curso ${moodleCourseId}`,
        userId,
        lastSync: new Date()
      }
    })
  }
  
  return course
}

async function simulateAnalysisGeneration(courseId: string, groupId: string, content: any) {
  // Simular delay de procesamiento
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  return {
    id: `sim_${Date.now()}`,
    courseId,
    groupId,
    status: 'completed',
    summary: 'Análisis simulado generado exitosamente',
    forumsAnalyzed: content.forumsCount,
    activitiesAnalyzed: content.activitiesCount,
    generatedAt: new Date().toISOString()
  }
}
