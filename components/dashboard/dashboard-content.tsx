'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  // Debug: verificar valores iniciales
  console.log('🔍 DashboardContent - Props iniciales:', {
    initialCourseId,
    initialGroupId,
    coursesWithGroupsCount: coursesWithGroups.length
  })
  
  const [selectedCourse, setSelectedCourse] = useState<string | null>(initialCourseId || null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(initialGroupId || null)
  const [analysisCards, setAnalysisCards] = useState(initialCards)
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)
  const router = useRouter()
  
  // Hook para obtener datos de Moodle - siempre habilitado
  const { courses: moodleCourses, loading, error, refetch } = useMoodleData(true)
  
  // Siempre usamos datos de Moodle
  const displayCourses = moodleCourses

  // Ya no hay selección automática - el usuario debe elegir manualmente

  const handleSelectionChange = async (courseId: string, groupId: string) => {
    setSelectedCourse(courseId)
    setSelectedGroup(groupId)
    
    console.log('Curso seleccionado:', courseId, 'Grupo:', groupId)
    
    // Filtrar tarjetas por curso y grupo seleccionados (siempre usando IDs de Moodle)
    const filteredCards = initialCards.filter(card => {
      const cardMoodleId = card.moodleCourseId || card.courseId
      const courseMatches = cardMoodleId === courseId
      console.log(`   Comparando Moodle: card(${cardMoodleId}) === selected(${courseId}) → ${courseMatches}`)
      
      if (!courseMatches) return false
      
      // Filtrar por grupo si se especifica
      if (card.groupId && card.groupId !== groupId) {
        console.log(`   Grupo no coincide: card(${card.groupId}) !== selected(${groupId})`)
        return false
      }
      
      return true
    })
    
    console.log(`Análisis filtrados: ${filteredCards.length} de ${initialCards.length} total`)
    setAnalysisCards(filteredCards)
    
    // Si no hay análisis, verificar si debemos generar uno
    if (filteredCards.length === 0) {
      await checkAndTriggerAnalysis(courseId, groupId)
    }
  }

  const refreshAnalysisForCourse = async (courseId: string, groupId: string) => {
    try {
      console.log('🔄 Refrescando análisis para curso:', courseId, 'grupo:', groupId)
      
      const response = await fetch('/api/analysis', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error('Error obteniendo análisis actualizados')
      }
      
      const freshAnalysis = await response.json()
      
      // Filtrar los análisis para el curso y grupo actuales
      const filteredCards = freshAnalysis.filter((card: AnalysisCardData) => {
        const cardMoodleId = card.moodleCourseId
        const courseMatches = cardMoodleId === courseId
        const cardMoodleGroupId = card.groupId
        const groupMatches = cardMoodleGroupId === groupId
        console.log(`   🔄 Comparando Moodle: curso card(${cardMoodleId}) === selected(${courseId}) → ${courseMatches}`)
        console.log(`   🔄 Comparando Moodle: grupo card(${cardMoodleGroupId}) === selected(${groupId}) → ${groupMatches}`)
        return courseMatches && groupMatches
      })
      
      console.log(`✅ Análisis refrescados: ${filteredCards.length} encontrados`)
      setAnalysisCards(filteredCards)
      
    } catch (error) {
      console.error('Error refrescando análisis:', error)
    }
  }

  const checkAndTriggerAnalysis = async (courseId: string, groupId: string) => {
    try {
      console.log('🔍 Verificando contenido y generando análisis...')
      setIsGeneratingAnalysis(true)
      
      const response = await fetch('/api/analysis/generate-real', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ courseId, groupId })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud')
      }
      
      console.log('📊 Resultado del análisis:', data)
      
      if (data.success) {
        console.log('🎉 Análisis generado exitosamente')
        // Refrescar los análisis del curso actual
        await refreshAnalysisForCourse(courseId, groupId)
      } else {
        console.log('⚠️ No se pudo generar el análisis:', data.message)
      }
      
    } catch (error) {
      console.error('Error verificando/generando análisis:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    } finally {
      setIsGeneratingAnalysis(false)
    }
  }

  const handleViewMore = (cardId: string) => {
    router.push(`/dashboard/analysis/${cardId}`)
  }

  const handleReanalyze = async (card: AnalysisCardData) => {
    try {
      console.log('🔄 Re-analizando tarjeta:', card.id)
      
      // Usar IDs de Moodle
      const courseId = card.moodleCourseId || card.courseId
      const groupId = card.groupId || ''
      console.log(`🌐 Re-analizando con IDs Moodle: curso=${courseId}, grupo=${groupId}`)
      
      await checkAndTriggerAnalysis(courseId, groupId)
      
    } catch (error) {
      console.error('Error en re-análisis:', error)
      alert(`❌ Error al re-analizar: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  return (
    <div className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
      {/* Saludo */}
      <section className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Hola, {userFirstName}!
          </h1>
          <p className="text-gray-600">
            Te mostramos un resumen de las actividades de tu grupo
          </p>
        </section>

        {/* Estado de carga de Moodle */}
        {loading && (
          <section className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <span className="text-sm text-blue-600">Cargando datos de Moodle...</span>
            </div>
          </section>
        )}

        {/* Error de conexión */}
        {error && (
          <section className="mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <span className="text-sm text-red-600">Error: {error}</span>
              <button
                onClick={() => refetch()}
                className="ml-4 text-sm text-red-600 hover:text-red-700 underline"
              >
                🔄 Reintentar
              </button>
            </div>
          </section>
        )}

        {/* Selector de grupo */}
        <section className="mb-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Resumen de las actividades
            </h2>
            <CourseSelector 
              courses={displayCourses}
              onSelectionChange={handleSelectionChange}
              selectedCourseId={selectedCourse}
              selectedGroupId={selectedGroup}
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
                          onReanalyze={() => handleReanalyze(card)}
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
                        onReanalyze={() => handleReanalyze(single)}
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
            {isGeneratingAnalysis ? (
              // Estado: Generando análisis
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-lg font-medium text-gray-700 mb-2">
                  🔄 Generando análisis...
                </p>
                <p className="text-sm text-gray-600">
                  Estamos analizando las actividades y foros del curso.
                  Esto puede tomar unos momentos.
                </p>
              </div>
            ) : !selectedCourse || !selectedGroup ? (
              // Estado: No hay curso seleccionado
              <div className="flex flex-col items-center justify-center py-12">
                <div className="mb-6">
                  <svg className="w-20 h-20 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-xl font-medium text-gray-700 mb-2">
                  No hay curso seleccionado
                </p>
                <p className="text-gray-600 mb-6 max-w-md">
                  Selecciona un curso y grupo del menú superior para ver el análisis de actividades y participación estudiantil.
                </p>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Los análisis se generan automáticamente al seleccionar un curso</span>
                </div>
              </div>
            ) : selectedCourse && selectedGroup ? (
              // Estado: Curso y grupo seleccionados pero sin análisis
              <>
                <div className="mb-4">
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    📁 No hay análisis disponible
                  </p>
                  <div className="text-gray-600 space-y-2">
                    <p>
                      Este curso está activo en Moodle y eres profesor.
                    </p>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4 text-left">
                      <p className="font-medium text-gray-700 mb-2">Posibles razones:</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• El curso no tiene actividades o foros abiertos para analizar</li>
                        <li>• Las actividades aún no tienen participación estudiantil</li>
                        <li>• El análisis está programado pero aún no se ha ejecutado</li>
                        <li>• El curso es nuevo y no ha sido sincronizado</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Acciones sugeridas */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-blue-800 mb-2 font-medium">
                    💡 Acciones disponibles
                  </p>
                  <ul className="text-sm text-blue-700 text-left space-y-1">
                    <li>• Verifica que el curso tenga actividades o foros activos</li>
                    <li>• El análisis automático se ejecuta cada 4 horas</li>
                    <li>• Selecciona otro curso del menú desplegable</li>
                  </ul>
                  
                  <button 
                    className="mt-3 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    onClick={() => checkAndTriggerAnalysis(selectedCourse, selectedGroup)}
                    disabled={isGeneratingAnalysis}
                  >
                    🔄 Generar análisis ahora
                  </button>
                </div>
              </>
            ) : (
              // Estado: Ningún curso seleccionado
              <>
                <p className="text-lg font-medium text-gray-700 mb-2">
                  👋 Bienvenido al Dashboard de Análisis
                </p>
                <p className="text-gray-600 mb-4">
                  Selecciona un curso y grupo del menú desplegable para ver el análisis de actividades.
                </p>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 max-w-md mx-auto text-left">
                  <p className="text-sm font-medium text-blue-800 mb-2">ℹ️ Información útil:</p>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Solo verás cursos donde eres profesor</li>
                    <li>• Los análisis se actualizan automáticamente</li>
                    <li>• Los datos provienen directamente de Moodle</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}

      {/* Espaciado al final */}
      <div className="h-16"></div>
    </div>
  )
}
