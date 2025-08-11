'use client'

import { useState } from 'react'
import DashboardHeader from '@/components/dashboard/header'
import CourseSelector from '@/components/dashboard/course-selector'
import AnalysisCard from '@/components/dashboard/analysis-card'
import { AnalysisCardData } from '@/types'

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

        {/* Selector de grupo */}
        <section className="mb-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Resumen de las actividades
            </h2>
            <CourseSelector 
              courses={coursesWithGroups}
              onSelectionChange={handleSelectionChange}
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
                  onViewMore={() => handleViewMore(card.id)}
                />
              ))}
            </section>

            {/* Tarjetas adicionales a ancho completo */}
            {analysisCards.slice(2).map((card) => (
              <section key={card.id} className="mb-6">
                <AnalysisCard 
                  data={card}
                  onViewMore={() => handleViewMore(card.id)}
                />
              </section>
            ))}
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
