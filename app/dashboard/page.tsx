import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { prisma } from '@/lib/db/prisma'
import DashboardContent from '@/components/dashboard/dashboard-content'
import { MoodleTokenConfig } from '@/components/moodle-token-config'
import { AnalysisCardData, AnalysisStrength, AnalysisAlert } from '@/types'

export default async function DashboardPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/auth/login')
  }

  // Cargar datos del usuario y sus cursos
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      courses: {
        where: { isActive: true },
        include: {
          groups: true,
          activities: {
            where: { isOpen: true },
            take: 5
          },
          forums: {
            where: { isOpen: true },
            take: 5
          }
        }
      }
    }
  })

  // Obtener IDs de cursos del usuario actual para filtrar análisis
  const userCourseIds = user?.courses.map(c => c.id) || []
  console.log(`📊 Filtrando análisis para ${userCourseIds.length} cursos del usuario: ${user?.name}`)
  
  // Cargar los últimos análisis SOLO de cursos del usuario actual
  const latestAnalysis = await prisma.analysisResult.findMany({
    where: {
      isLatest: true,
      AND: [
        {
          OR: [
            { activity: { courseId: { in: userCourseIds } } },
            { forum: { courseId: { in: userCourseIds } } }
          ]
        }
      ]
    },
    include: {
      activity: { include: { course: true } },
      forum: { include: { course: true } },
      group: true
    },
    take: 10, // Aumentado para mostrar más tarjetas
    orderBy: { processedAt: 'desc' }
  })
  
  console.log(`📈 Encontrados ${latestAnalysis.length} análisis para los cursos del usuario`)
  
  // Log detallado de análisis encontrados
  latestAnalysis.forEach((result, index) => {
    const courseName = result.activity?.course.name || result.forum?.course.name || 'Sin curso'
    const itemName = result.activity?.name || result.forum?.name || 'Sin nombre'
    console.log(`   ${index + 1}. ${result.analysisType}: ${itemName} en ${courseName}`)
  })

  // Crear mapeo de courseId local a moodleCourseId para compatibilidad
  const courseIdMapping = new Map<string, string>()
  user?.courses.forEach(course => {
    courseIdMapping.set(course.id, course.moodleCourseId) // local -> moodle
    courseIdMapping.set(course.moodleCourseId, course.id) // moodle -> local
  })

  // Transformar los datos para las tarjetas
  const analysisCards: AnalysisCardData[] = latestAnalysis.map(result => {
    const localCourseId = result.activity?.courseId || result.forum?.courseId || ''
    const moodleCourseId = courseIdMapping.get(localCourseId) || localCourseId
    
    return {
      id: result.id,
      title: result.activity?.name || result.forum?.name || 'Sin título',
      type: result.analysisType as 'activity' | 'forum',
      courseId: localCourseId, // Mantener el ID local por defecto
      moodleCourseId: moodleCourseId, // Agregar ID de Moodle para mapeo
      groupId: result.groupId || undefined,
      strengths: (result.strengths as unknown as AnalysisStrength[]) || [],
      alerts: (result.alerts as unknown as AnalysisAlert[]) || [],
      nextStep: {
        action: result.nextStep,
        priority: 'medium' as const,
        rationale: (result.llmResponse as { rationale?: string } | null)?.rationale
      },
      lastUpdated: result.processedAt,
      confidence: result.confidence || undefined
    }
  })

  // Preparar datos de cursos para el selector
  const coursesWithGroups = user?.courses.map(course => ({
    id: course.id,
    name: course.name,
    shortName: course.shortName || undefined,
    groups: course.groups.map(group => ({
      id: group.id,
      name: group.name
    }))
  })) || []

  const userName = user?.name || 'Profesor'
  const userFirstName = userName.split(' ')[0]

  return (
    <div className="space-y-6">
      {/* Configuración de Token de Moodle */}
      <div className="px-4 sm:px-6 lg:px-8">
        <MoodleTokenConfig />
      </div>
      
      {/* Dashboard principal */}
      <DashboardContent
        userName={userName}
        userFirstName={userFirstName}
        coursesWithGroups={coursesWithGroups}
        analysisCards={analysisCards}
      />
    </div>
  )
}
