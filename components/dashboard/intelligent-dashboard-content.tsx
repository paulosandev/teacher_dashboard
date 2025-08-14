'use client'

import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faCheckCircle, 
  faExclamationTriangle, 
  faTimesCircle,
  faSpinner,
  faRefresh,
  faMagicWandSparkles,
  faChevronDown
} from '@fortawesome/free-solid-svg-icons'
import CourseSelector from '@/components/dashboard/course-selector'

interface User {
  id: string
  name: string
  firstName: string
  matricula: string
}

interface Course {
  id: string
  name: string
  shortName?: string
  groups: {
    id: string
    name: string
  }[]
}

interface IntelligentDashboardContentProps {
  user: User
  coursesWithGroups: Course[]
  connectionStatus: 'connected' | 'disconnected' | 'failed' | 'error'
  error?: string | null
}

export function IntelligentDashboardContent({
  user,
  coursesWithGroups,
  connectionStatus,
  error
}: IntelligentDashboardContentProps) {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)
  const [analysisCards, setAnalysisCards] = useState<any[]>([])

  // Selección automática del primer curso y grupo
  useEffect(() => {
    if (coursesWithGroups && coursesWithGroups.length > 0 && !selectedCourse) {
      const firstCourse = coursesWithGroups[0]
      if (firstCourse.groups && firstCourse.groups.length > 0) {
        const firstGroup = firstCourse.groups[0]
        setSelectedCourse(firstCourse.id)
        setSelectedGroup(firstGroup.id)
      }
    }
  }, [coursesWithGroups, selectedCourse])

  const handleSelectionChange = async (courseId: string, groupId: string) => {
    setSelectedCourse(courseId)
    setSelectedGroup(groupId)
    console.log('🎯 Curso seleccionado:', courseId, 'Grupo:', groupId)
    
    // Aquí podríamos cargar análisis existentes
    await loadAnalysisForSelection(courseId, groupId)
  }

  const loadAnalysisForSelection = async (courseId: string, groupId: string) => {
    try {
      // Cargar análisis existentes para este curso y grupo
      const response = await fetch(`/api/analysis?courseId=${courseId}&groupId=${groupId}`)
      if (response.ok) {
        const data = await response.json()
        setAnalysisCards(data)
      } else {
        setAnalysisCards([])
      }
    } catch (error) {
      console.error('Error cargando análisis:', error)
      setAnalysisCards([])
    }
  }

  const generateNewAnalysis = async () => {
    if (!selectedCourse || !selectedGroup) return

    try {
      setIsGeneratingAnalysis(true)
      
      const response = await fetch('/api/analysis/generate-intelligent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse,
          groupId: selectedGroup,
          userMatricula: user.matricula
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        await loadAnalysisForSelection(selectedCourse, selectedGroup)
      } else {
        alert(`Error: ${data.error || 'No se pudo generar el análisis'}`)
      }

    } catch (error) {
      console.error('Error generando análisis:', error)
      alert('Error generando análisis')
    } finally {
      setIsGeneratingAnalysis(false)
    }
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
      case 'disconnected':
        return <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500" />
      case 'failed':
      case 'error':
        return <FontAwesomeIcon icon={faTimesCircle} className="text-red-500" />
      default:
        return <FontAwesomeIcon icon={faSpinner} className="text-gray-500 animate-spin" />
    }
  }

  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Conectado a Moodle con autenticación inteligente'
      case 'disconnected':
        return 'Desconectado de Moodle'
      case 'failed':
        return 'Error de conexión con Moodle'
      case 'error':
        return error || 'Error desconocido'
      default:
        return 'Conectando...'
    }
  }

  return (
    <div className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
      {/* Saludo */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            ¡Hola, {user.firstName}!
          </h1>
          
          {selectedCourse && selectedGroup && (
            <button
              onClick={generateNewAnalysis}
              disabled={isGeneratingAnalysis}
              className="bg-white border border-primary text-gray-700 px-4 py-2 rounded-lg font-medium transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <FontAwesomeIcon 
                icon={isGeneratingAnalysis ? faSpinner : faMagicWandSparkles} 
                className={`${isGeneratingAnalysis ? 'animate-spin' : ''} text-primary`}
              />
              <span>
                {isGeneratingAnalysis ? 'Generando...' : 'Generar Análisis'}
              </span>
            </button>
          )}
        </div>
        
        <p className="text-gray-600 mb-4">
        Te mostramos un resumen de las actividades de tu grupo
        </p>
        
        {/* Estado de conexión */}
        <div className="flex items-center space-x-2 mb-4">
          {getStatusIcon()}
          <span className="text-sm text-gray-600">
            {getStatusMessage()}
          </span>
        </div>

        {/* Información del usuario */}
        {/* <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">
            🤖 Sistema de Autenticación Híbrida Activado
          </h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>Matrícula:</strong> {user.matricula}</p>
            <p><strong>Estrategia:</strong> Token administrativo para lectura, token específico solo cuando sea necesario</p>
            <p><strong>Estado:</strong> {connectionStatus === 'connected' ? 'Funcionando automáticamente' : 'Verificando configuración...'}</p>
          </div>
        </div> */}
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Selector de curso */}
      {coursesWithGroups.length > 0 && (
        <>
          {/* Sección de análisis */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Análisis Inteligente
              </h2>
              
              {/* Selector de curso movido aquí */}
              <CourseSelector
                courses={coursesWithGroups}
                selectedCourseId={selectedCourse}
                selectedGroupId={selectedGroup}
                onSelectionChange={handleSelectionChange}
              />
            </div>

            {analysisCards.length > 0 ? (
              <div className={`grid gap-6 ${analysisCards.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {analysisCards.map((card, index) => (
                  <div key={index} className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-500 font-inter">
                        {card.analysisType === 'course_overview' ? 'Vista General del Curso' :
                         card.analysisType === 'activity' ? card.title :
                         card.analysisType === 'forum' ? card.title :
                         card.title || 'Análisis'}
                      </h3>
                      <span className="bg-white border border-primary text-primary px-3 py-1 rounded-lg text-sm font-semibold flex items-center space-x-1 font-inter">
                        <FontAwesomeIcon icon={faMagicWandSparkles} className="text-primary" />
                        <span className="text-primary">
                          {card.analysisType === 'course_overview' ? 'General' :
                           card.analysisType === 'activity' ? 'Actividad' :
                           card.analysisType === 'forum' ? 'Foro' :
                           'Análisis'}
                        </span>
                      </span>
                    </div>
                    
                    {/* Actividad */}
                    {card.activity && (
                      <div className="mb-4">
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500 mt-1">✏️</span>
                          <div>
                            <h4 className="font-semibold text-gray-500 text-sm font-inter">Actividad:</h4>
                            <p className="text-gray-500 text-sm font-inter">{card.activity}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Fortalezas */}
                    {card.strengths && card.strengths.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500 mt-1">👤</span>
                          <div>
                            <h4 className="font-semibold text-gray-500 text-sm font-inter">Fortalezas:</h4>
                            <p className="text-gray-500 text-sm font-inter">
                              {card.strengths.slice(0, 3).join(', ')}
                              {card.strengths.length > 3 && '...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Alertas */}
                    {card.alerts && card.alerts.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500 mt-1">⚠️</span>
                          <div>
                            <h4 className="font-semibold text-gray-500 text-sm font-inter">Alertas:</h4>
                            <p className="text-gray-500 text-sm font-inter">
                              {card.alerts.slice(0, 3).join(', ')}
                              {card.alerts.length > 3 && '...'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Próximo paso docente */}
                    {card.nextStep && (
                      <div className="mb-4">
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500 mt-1">➡️</span>
                          <div>
                            <h4 className="font-semibold text-gray-500 text-sm font-inter">Próximo paso docente:</h4>
                            <p className="text-gray-500 text-sm font-inter">{card.nextStep}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Footer - Ver más */}
                    <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                      <button className="text-primary font-semibold text-sm flex items-center space-x-1 hover:text-green-700 transition-colors font-inter">
                        <span>Ver más</span>
                        <FontAwesomeIcon icon={faChevronDown} className="text-primary rotate-[-90deg]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <FontAwesomeIcon icon={faMagicWandSparkles} size="3x" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay análisis disponibles
                </h3>
                <p className="text-gray-600 mb-4">
                  Selecciona un curso y grupo para generar tu primer análisis inteligente
                </p>
                {selectedCourse && selectedGroup && (
                  <button
                    onClick={generateNewAnalysis}
                    disabled={isGeneratingAnalysis}
                    className="bg-white border border-primary text-gray-700 px-6 py-3 rounded-lg font-medium transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <FontAwesomeIcon 
                      icon={isGeneratingAnalysis ? faSpinner : faMagicWandSparkles} 
                      className={`${isGeneratingAnalysis ? 'animate-spin' : ''} text-primary`}
                    />
                    <span>
                      {isGeneratingAnalysis ? 'Generando primer análisis...' : 'Generar Primer Análisis'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Información sobre el sistema híbrido */}
      {/* <section className="bg-gray-50 rounded-lg p-6 mt-8">
        <h3 className="font-semibold text-gray-900 mb-3">
          🔒 Sistema de Autenticación Híbrida
        </h3>
        <div className="text-sm text-gray-700 space-y-2">
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Operaciones de lectura usan token administrativo global</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Operaciones específicas usan token del profesor automáticamente</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Sin configuración manual requerida</span>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-green-600">✓</span>
            <span>Fallback automático entre tipos de token</span>
          </div>
        </div>
      </section> */}
    </div>
  )
}
