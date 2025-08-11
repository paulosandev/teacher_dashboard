import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { prisma } from '@/lib/db/prisma'
import DashboardContent from '@/components/dashboard/dashboard-content'
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

  // Cargar los últimos análisis
  const latestAnalysis = await prisma.analysisResult.findMany({
    where: {
      isLatest: true,
      OR: [
        { activity: { courseId: { in: user?.courses.map(c => c.id) || [] } } },
        { forum: { courseId: { in: user?.courses.map(c => c.id) || [] } } }
      ]
    },
    include: {
      activity: true,
      forum: true,
      group: true
    },
    take: 4,
    orderBy: { processedAt: 'desc' }
  })

  // Transformar los datos para las tarjetas
  const analysisCards: AnalysisCardData[] = latestAnalysis.map(result => ({
    id: result.id,
    title: result.activity?.name || result.forum?.name || 'Sin título',
    type: result.analysisType as 'activity' | 'forum',
    courseId: result.activity?.courseId || result.forum?.courseId || '',
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
  }))

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
    <DashboardContent
      userName={userName}
      userFirstName={userFirstName}
      coursesWithGroups={coursesWithGroups}
      analysisCards={analysisCards}
    />
  )
}
