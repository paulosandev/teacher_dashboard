import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import { prisma } from '@/lib/db/prisma'
import DashboardHeader from '@/components/dashboard/header'
import CourseSelector from '@/components/dashboard/course-selector'
import AnalysisCard from '@/components/dashboard/analysis-card'
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
    <div className="bg-white min-h-screen">
      <DashboardHeader 
        userName={userName}
        notificationCount={3}
      />

      {/* Main Content */}
      <main className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
        {/* Saludo */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Hola, {userFirstName}!
          </h1>
          <p className="text-gray-600">
            Te mostramos un resumen de las actividades de tu grupo
          </p>
        </section>

        {/* Selector de grupo */}
        <section className="mb-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Resumen de las actividades
            </h2>
            <CourseSelector 
              courses={coursesWithGroups}
              onSelectionChange={(courseId, groupId) => {
                // Aquí puedes manejar el cambio de selección
                console.log('Curso seleccionado:', courseId, 'Grupo:', groupId)
              }}
            />
          </header>
        </section>

        {/* Cards de actividades */}
        {analysisCards.length > 0 ? (
          <>
            {/* Grid de 2 columnas para las primeras tarjetas */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" aria-label="Resumen de actividades">
              {analysisCards.slice(0, 2).map((card) => (
                <AnalysisCard 
                  key={card.id}
                  data={card}
                  onViewMore={() => {
                    console.log('Ver más:', card.id)
                  }}
                />
              ))}
            </section>

            {/* Tarjetas adicionales a ancho completo */}
            {analysisCards.slice(2).map((card) => (
              <section key={card.id} className="mb-6">
                <AnalysisCard 
                  data={card}
                  onViewMore={() => {
                    console.log('Ver más:', card.id)
                  }}
                />
              </section>
            ))}
          </>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">
              No hay análisis disponibles en este momento. Los análisis se generarán automáticamente cada 4 horas.
            </p>
          </div>
        )}
      </main>

      {/* Espaciado al final */}
      <div className="h-16"></div>
    </div>
  )
}
