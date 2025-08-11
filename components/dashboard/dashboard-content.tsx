'use client'

import { useState, useEffect } from 'react'
import DashboardHeader from '@/components/dashboard/header'
import CourseSelector from '@/components/dashboard/course-selector'
import AnalysisCard from '@/components/dashboard/analysis-card'
import { AnalysisCardData } from '@/types'
import { useMoodleData } from '@/hooks/useMoodleData'

interface Course {
  id: string
  name: string
  shortName?: string
  groups: {
    id: string
    name: string
  }[]
}

interface DashboardContentProps {
  userName: string
  userFirstName: string
  coursesWithGroups: Course[]
  analysisCards: AnalysisCardData[]
  initialCourseId?: string
  initialGroupId?: string
}

export default function DashboardContent({
  userName,
  userFirstName,
  coursesWithGroups,
  analysisCards: initialCards,
  initialCourseId,
  initialGroupId
}: DashboardContentProps) {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(initialCourseId || null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(initialGroupId || null)
  const [analysisCards, setAnalysisCards] = useState(initialCards)
  const [shouldUseMoodleData, setShouldUseMoodleData] = useState(false)
  const [displayCourses, setDisplayCourses] = useState(coursesWithGroups)
  
  // Hook para obtener datos de Moodle
  const { courses: moodleCourses, loading, error, refetch } = useMoodleData(shouldUseMoodleData)
  
  // Actualizar cursos cuando cambie la fuente de datos
  useEffect(() => {
    if (shouldUseMoodleData && moodleCourses.length > 0) {
      setDisplayCourses(moodleCourses)
      console.log('📚 Usando datos de Moodle:', moodleCourses.length, 'cursos')
    } else if (!shouldUseMoodleData) {
      setDisplayCourses(coursesWithGroups)
      console.log('💾 Usando datos locales:', coursesWithGroups.length, 'cursos')
    }
  }, [shouldUseMoodleData, moodleCourses, coursesWithGroups])

  const handleSelectionChange = (courseId: string, groupId: string) => {
    setSelectedCourse(courseId)
    setSelectedGroup(groupId)
    
    // Aquí puedes filtrar las tarjetas basándote en la selección
    // Por ahora solo mostramos un console.log
    console.log('Curso seleccionado:', courseId, 'Grupo:', groupId)
    
    // Filtrar tarjetas por curso y grupo seleccionados
    const filteredCards = initialCards.filter(card => {
      if (card.courseId !== courseId) return false
      if (card.groupId && card.groupId !== groupId) return false
      return true
    })
    
    setAnalysisCards(filteredCards.length > 0 ? filteredCards : initialCards)
  }

  const handleViewMore = (cardId: string) => {
    console.log('Ver más detalles:', cardId)
    // Aquí puedes implementar la navegación a la vista detallada
    // Por ejemplo: router.push(`/dashboard/analysis/${cardId}`)
  }

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

        {/* Toggle para fuente de datos */}
        <section className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700">
                  Fuente de datos:
                </label>
                <button
                  onClick={() => setShouldUseMoodleData(!shouldUseMoodleData)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    shouldUseMoodleData ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                  disabled={loading}
                >
                  <span className="sr-only">Usar datos de Moodle</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      shouldUseMoodleData ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-600">
                  {shouldUseMoodleData ? '🌐 Moodle' : '💾 Local'}
                </span>
              </div>
              
              {loading && (
                <span className="text-sm text-blue-600">Cargando datos de Moodle...</span>
              )}
              
              {error && (
                <span className="text-sm text-red-600">Error: {error}</span>
              )}
              
              {shouldUseMoodleData && !loading && !error && (
                <button
                  onClick={() => refetch()}
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  🔄 Actualizar
                </button>
              )}
            </div>
            
            {shouldUseMoodleData && moodleCourses.length === 0 && !loading && (
              <div className="mt-2 text-sm text-amber-700">
                ⚠️ No se encontraron cursos en Moodle. Verifica tu configuración.
              </div>
            )}
          </div>
        </section>

        {/* Selector de grupo */}
        <section className="mb-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Resumen de las actividades
            </h2>
            <CourseSelector 
              courses={displayCourses}
              onSelectionChange={handleSelectionChange}
            />
          </header>
        </section>

        {/* Cards de actividades */}
        {analysisCards.length > 0 ? (
          <>
            {/* Agrupar tarjetas de a pares para grid de 2 columnas */}
            {(() => {
              const cards = [...analysisCards]
              const sections = []
              
              while (cards.length > 0) {
                // Si quedan 2 o más tarjetas, tomar 2 para el grid
                if (cards.length >= 2) {
                  const pair = cards.splice(0, 2)
                  sections.push(
                    <section 
                      key={`grid-${pair[0].id}`} 
                      className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8" 
                      aria-label="Resumen de actividades"
                    >
                      {pair.map((card) => (
                        <AnalysisCard 
                          key={card.id}
                          data={card}
                          onViewMore={() => handleViewMore(card.id)}
                        />
                      ))}
                    </section>
                  )
                } else {
                  // Si queda solo 1 tarjeta (impar), mostrarla a ancho completo
                  const single = cards.splice(0, 1)[0]
                  sections.push(
                    <section key={`full-${single.id}`} className="mb-8">
                      <AnalysisCard 
                        data={single}
                        onViewMore={() => handleViewMore(single.id)}
                      />
                    </section>
                  )
                }
              }
              
              return sections
            })()}
          </>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">
              {selectedCourse && selectedGroup 
                ? 'No hay análisis disponibles para el curso y grupo seleccionados.'
                : 'No hay análisis disponibles en este momento. Los análisis se generarán automáticamente cada 4 horas.'
              }
            </p>
          </div>
        )}
      </main>

      {/* Espaciado al final */}
      <div className="h-16"></div>
    </div>
  )
}
