'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faCheckCircle, 
  faExclamationTriangle, 
  faTimesCircle,
  faSpinner,
  faRefresh,
  faMagicWandSparkles,
  faChevronDown,
  faBrain,
  faRobot,
  faEye,
  faLightbulb
} from '@fortawesome/free-solid-svg-icons'
import SimpleCourseSelector from '@/components/dashboard/simple-course-selector'
import { AnalysisModal } from '@/components/dashboard/analysis-modal'

interface User {
  id: string
  name: string
  firstName: string
  matricula: string
}

interface Course {
  id: string
  name: string
  shortname?: string
  fullname?: string
  visible?: boolean
}

interface IntelligentDashboardContentProps {
  user: User
  courses: Course[]
  connectionStatus: 'connected' | 'disconnected' | 'failed' | 'error'
  error?: string | null
}

export function IntelligentDashboardContent({
  user,
  courses,
  connectionStatus,
  error
}: IntelligentDashboardContentProps) {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)
  const [analysisCards, setAnalysisCards] = useState<any[]>([])
  const [openActivities, setOpenActivities] = useState<any[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [activitiesSummary, setActivitiesSummary] = useState<any>(null)
  const [analysisResults, setAnalysisResults] = useState<{[key: string]: any}>({})
  const [analyzingActivity, setAnalyzingActivity] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null)
  const [selectedActivityName, setSelectedActivityName] = useState('')
  const [selectedActivityType, setSelectedActivityType] = useState('')
  const [visibleActivitiesCount, setVisibleActivitiesCount] = useState(5) // Número de actividades visibles
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false)
  const BATCH_SIZE = 5

  const loadAnalysisForCourse = useCallback(async (courseId: string) => {
    try {
      // Cargar análisis existentes para este curso desde cache
      const response = await fetch(`/api/analysis/cache?courseId=${courseId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.analysisResults) {
          console.log(`📦 Cargados ${data.count} análisis desde cache`)
          setAnalysisResults(data.analysisResults)
        } else {
          setAnalysisResults({})
        }
      } else {
        setAnalysisResults({})
      }
    } catch (error) {
      console.error('Error cargando análisis desde cache:', error)
      setAnalysisResults({})
    }
  }, [])

  const loadOpenActivities = useCallback(async (courseId: string) => {
    try {
      setLoadingActivities(true)
      console.log('🎯 Obteniendo actividades abiertas para curso:', courseId)
      
      const response = await fetch(`/api/activities/open?courseId=${courseId}`)
      if (response.ok) {
        const data = await response.json()
        setOpenActivities(data.activities || [])
        setActivitiesSummary(data.summary || null)
        console.log(`🟢 Actividades abiertas encontradas: ${data.activities?.length || 0}`)
      } else {
        console.log('❌ Error obteniendo actividades abiertas')
        setOpenActivities([])
        setActivitiesSummary(null)
      }
    } catch (error) {
      console.error('Error cargando actividades abiertas:', error)
      setOpenActivities([])
      setActivitiesSummary(null)
    } finally {
      setLoadingActivities(false)
    }
  }, [])

  const handleCourseChange = useCallback(async (courseId: string) => {
    setSelectedCourse(courseId)
    console.log('🎯 Curso seleccionado:', courseId)
    // La carga se hace en el useEffect, no aquí para evitar doble carga
  }, [])

  // Función para verificar si un análisis está desactualizado (>4 horas)
  const isAnalysisOutdated = useCallback((analysis: any) => {
    if (!analysis?.generatedAt) return true
    
    const fourHoursInMs = 4 * 60 * 60 * 1000
    const analysisAge = Date.now() - new Date(analysis.generatedAt).getTime()
    
    return analysisAge > fourHoursInMs
  }, [])

  // Selección automática del primer curso
  useEffect(() => {
    if (courses && courses.length > 0 && !selectedCourse) {
      const firstCourse = courses[0]
      setSelectedCourse(firstCourse.id)
    }
  }, [courses, selectedCourse])

  // Cargar datos cuando cambie el curso seleccionado
  useEffect(() => {
    if (selectedCourse) {
      // Limpiar datos anteriores para evitar flashes
      setOpenActivities([])
      setAnalysisResults({})
      setVisibleActivitiesCount(BATCH_SIZE) // Resetear a las primeras 5 actividades
      
      // Cargar nuevos datos
      loadOpenActivities(selectedCourse)
      loadAnalysisForCourse(selectedCourse)
    }
  }, [selectedCourse, loadOpenActivities, loadAnalysisForCourse])

  const generateNewAnalysis = useCallback(async () => {
    if (!selectedCourse) return

    try {
      setIsGeneratingAnalysis(true)
      
      const response = await fetch('/api/analysis/generate-course-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        await loadAnalysisForCourse(selectedCourse)
      } else {
        alert(`Error: ${data.error || 'No se pudo generar el análisis'}`)
      }

    } catch (error) {
      console.error('Error generando análisis:', error)
      alert('Error generando análisis')
    } finally {
      setIsGeneratingAnalysis(false)
    }
  }, [selectedCourse, loadAnalysisForCourse])

  // Función para analizar una actividad individual con información extendida
  const analyzeActivity = useCallback(async (activity: any, showVisualFeedback = true) => {
    const activityKey = `${activity.type}_${activity.id}`
    
    try {
      // Solo mostrar estado de análisis si showVisualFeedback es true (análisis individual)
      if (showVisualFeedback) {
        setAnalyzingActivity(activityKey)
      }
      console.log(`🧠 Iniciando análisis de actividad: ${activity.name}`)
      
      const response = await fetch('/api/analysis/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          activityType: activity.type,
          activityData: activity,
          includeDetailedInfo: true // Nuevo flag para incluir información extendida
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setAnalysisResults(prev => ({
          ...prev,
          [activityKey]: {
            ...data.analysis,
            rawActivityData: activity, // Guardar datos originales
            analysisPrompt: data.prompt, // Guardar prompt usado
            collectedData: data.collectedData // Guardar datos recopilados
          }
        }))
        console.log(`✅ Análisis completado para: ${activity.name}`)
      } else {
        console.error('❌ Error en análisis:', data.error)
        if (showVisualFeedback) {
          alert(`Error: ${data.error || 'No se pudo generar el análisis'}`)
        }
      }

    } catch (error) {
      console.error('Error analizando actividad:', error)
      if (showVisualFeedback) {
        alert('Error generando análisis de la actividad')
      }
    } finally {
      if (showVisualFeedback) {
        setAnalyzingActivity(null)
      }
    }
  }, [])

  // Función para analizar las actividades visibles actuales
  const analyzeVisibleActivities = useCallback(async () => {
    if (!openActivities.length) return

    setIsAnalyzingBatch(true)
    // Analizar solo las actividades que están visibles actualmente
    const activitiesToAnalyze = openActivities.slice(0, visibleActivitiesCount)

    console.log(`📦 Analizando ${activitiesToAnalyze.length} actividades visibles`)

    for (const activity of activitiesToAnalyze) {
      const activityKey = `${activity.type}_${activity.id}`
      // Solo analizar si no hay análisis previo o está desactualizado
      if (!analysisResults[activityKey] || isAnalysisOutdated(analysisResults[activityKey])) {
        // Pasar false para NO mostrar feedback visual (evitar tilteo)
        await analyzeActivity(activity, false)
      }
    }

    setIsAnalyzingBatch(false)
  }, [openActivities, visibleActivitiesCount, analysisResults, isAnalysisOutdated, analyzeActivity])

  // Función para cargar más actividades (acumulativo)
  const loadMoreActivities = useCallback(() => {
    const newVisibleCount = Math.min(visibleActivitiesCount + BATCH_SIZE, openActivities.length)
    setVisibleActivitiesCount(newVisibleCount)
    console.log(`📋 Mostrando ${newVisibleCount} de ${openActivities.length} actividades`)
  }, [visibleActivitiesCount, openActivities.length])

  // Resetear actividades visibles cuando cambia el curso
  useEffect(() => {
    setVisibleActivitiesCount(BATCH_SIZE) // Mostrar solo las primeras 5 al cambiar de curso
  }, [selectedCourse])

  // Función para obtener las actividades visibles (optimizada con useMemo)
  const getVisibleActivities = useMemo(() => {
    return openActivities.slice(0, visibleActivitiesCount)
  }, [openActivities, visibleActivitiesCount])
  
  // Calcular estadísticas (optimizado)
  const stats = useMemo(() => {
    return {
      visibleCount: visibleActivitiesCount,
      totalCount: openActivities.length,
      hasMore: visibleActivitiesCount < openActivities.length,
      remainingCount: openActivities.length - visibleActivitiesCount
    }
  }, [openActivities.length, visibleActivitiesCount])

  // FUNCIÓN DESHABILITADA - Ahora usamos análisis por lotes manual
  // const startAutomaticAnalysis = useCallback(async (activities: any[]) => {
  //   console.log('🤖 Iniciando análisis automático de actividades...')
  //   
  //   for (const activity of activities) {
  //     const activityKey = `${activity.type}_${activity.id}`
  //     
  //     // Solo analizar si no existe análisis previo o si es muy antiguo (>4 horas)
  //     const existingAnalysis = analysisResults[activityKey]
  //     const shouldAnalyze = !existingAnalysis || isAnalysisOutdated(existingAnalysis)
  //     
  //     if (shouldAnalyze) {
  //       // Pequeña pausa entre análisis para evitar sobrecarga
  //       await new Promise(resolve => setTimeout(resolve, 1000))
  //       await analyzeActivity(activity)
  //     }
  //   }
  // }, [analysisResults, analyzeActivity, isAnalysisOutdated])

  // DESHABILITADO: Análisis automático - ahora es manual por lotes
  // Los análisis se hacen solo cuando el usuario presiona el botón "Analizar Lote"

  // Función para crear extractos coherentes y específicos para cards
  const getAnalysisExtract = useCallback((activity: any) => {
    const activityKey = `${activity.type}_${activity.id}`
    const analysis = analysisResults[activityKey]
    
    if (!analysis) return null

    // Crear versiones resumidas específicas para card (oraciones completas)
    const extract = {
      summary: createCardSummary(analysis.summary),
      positiveHighlight: analysis.positives && analysis.positives.length > 0 
        ? createCardSummary(analysis.positives[0]) 
        : null,
      alertHighlight: analysis.alerts && analysis.alerts.length > 0 
        ? createCardSummary(analysis.alerts[0]) 
        : null,
      keyInsight: analysis.insights && analysis.insights.length > 0 
        ? createCardSummary(analysis.insights[0]) 
        : null,
      recommendationHighlight: createCardSummary(analysis.recommendation)
    }

    return extract
  }, [analysisResults])

  // Función auxiliar para crear resúmenes coherentes para cards
  const createCardSummary = (text: string, maxWords: number = 15) => {
    if (!text) return ''
    
    const words = text.split(' ')
    if (words.length <= maxWords) return text
    
    // Cortar por palabras completas y buscar un punto de parada natural
    let summary = words.slice(0, maxWords).join(' ')
    
    // Intentar terminar en un punto natural (punto, coma, etc.)
    const lastChar = summary.slice(-1)
    if (!['.', ',', ';', ':', '!', '?'].includes(lastChar)) {
      summary += '...'
    }
    
    return summary
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
        return 'Conectado a Moodle con autenticación de sesión'
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
          
        </div>
        
        <p className="text-gray-600 mb-4">
        Te mostramos un resumen de las actividades de tus cursos
        </p>
        
        {/* Estado de conexión */}
        

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
      {courses.length > 0 && (
        <>
          {/* Sección de análisis */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Resumen de actividades
              </h2>
              
              {/* Selector de curso simplificado */}
              <SimpleCourseSelector
                courses={courses}
                selectedCourseId={selectedCourse}
                onSelectionChange={handleCourseChange}
              />
            </div>

            {/* Información de actividades abiertas */}
            

            {/* Controles de lotes */}
            {openActivities.length > 0 && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900">Gestión de Actividades</h3>
                    <p className="text-sm text-blue-700">
                      Mostrando {stats.visibleCount} de {stats.totalCount} actividades
                      {stats.hasMore && ` (${stats.remainingCount} más disponibles)`}
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={analyzeVisibleActivities}
                      disabled={isAnalyzingBatch}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                    >
                      {isAnalyzingBatch ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                          Analizando...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faBrain} className="mr-2" />
                          Analizar Visibles
                        </>
                      )}
                    </button>
                    
                    {stats.hasMore && (
                      <button
                        onClick={loadMoreActivities}
                        disabled={isAnalyzingBatch}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        <FontAwesomeIcon icon={faChevronDown} className="mr-2" />
                        Cargar {Math.min(BATCH_SIZE, stats.remainingCount)} más
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cards de actividades abiertas - Acumulativas */}
            {openActivities.length > 0 && (
              <div className="mb-8">
                <div className={`grid gap-6 ${getVisibleActivities.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'}`}>
                  {getVisibleActivities.map((activity, index) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'forum': return '💬'
                        case 'assign': return '📝'
                        case 'quiz': return '📊'
                        case 'feedback': return '📋'
                        case 'choice': return '🗳️'
                        case 'survey': return '📋'
                        case 'lesson': return '📖'
                        default: return '🎯'
                      }
                    }

                    const getActivityType = (type: string) => {
                      switch (type) {
                        case 'forum': return 'Foro'
                        case 'assign': return 'Tarea'
                        case 'quiz': return 'Cuestionario'
                        case 'feedback': return 'Encuesta'
                        case 'choice': return 'Elección'
                        case 'survey': return 'Encuesta'
                        case 'lesson': return 'Lección'
                        default: return 'Actividad'
                      }
                    }

                    const getStatusColor = (status: string) => {
                      switch (status) {
                        case 'open': return 'border-green-500 text-green-700'
                        case 'overdue': return 'border-orange-500 text-orange-700'
                        case 'not_started': return 'border-blue-500 text-blue-700'
                        case 'closed': return 'border-red-500 text-red-700'
                        default: return 'border-gray-500 text-gray-700'
                      }
                    }

                    const getStatusText = (status: string) => {
                      switch (status) {
                        case 'open': return 'Disponible'
                        case 'overdue': return 'Vencida'
                        case 'not_started': return 'Próximamente'
                        case 'closed': return 'Cerrada'
                        default: return 'Desconocido'
                      }
                    }

                    return (
                      <div key={activity.id} className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            
                            <h3 className="text-lg font-semibold text-primary-darker font-inter">
                              {activity.name}
                            </h3>
                          </div>
                          <span className={`bg-white border px-3 py-1 rounded-[100px] text-sm font-semibold flex items-center space-x-1 font-inter ${getStatusColor(activity.status)}`}>
                          <span className="text-md">{getActivityIcon(activity.type)}</span><span>{getActivityType(activity.type)}</span>
                          </span>
                        </div>
                        
                        {/* Análisis inteligente, loader o indicador sin análisis */}
                        {(() => {
                          const activityKey = `${activity.type}_${activity.id}`
                          const isAnalyzing = analyzingActivity === activityKey
                          const analysisExtract = getAnalysisExtract(activity)
                          
                          if (isAnalyzing) {
                            // Mostrar loader durante análisis
                            return (
                              <div className="mb-4 py-8">
                                <div className="text-center text-purple-600">
                                  <FontAwesomeIcon icon={faSpinner} size="2x" className="mb-3 animate-spin" />
                                  <p className="text-sm font-medium">
                                    Analizando actividad...
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    Obteniendo insights inteligentes
                                  </p>
                                </div>
                              </div>
                            )
                          }
                          
                          if (analysisExtract) {
                            // Mostrar extractos del análisis con el diseño de referencia
                            return (
                              <div className="mb-4 space-y-3">
                                {/* Actividad */}
                                <div className="flex items-start space-x-3">
                                  <span className="text-gray-700 text-lg mt-1">✏️</span>
                                  <div>
                                    <p className="text-gray-700 text-sm">
                                      <span className="font-semibold">Actividad:</span> {analysisExtract.summary}
                                    </p>
                                  </div>
                                </div>

                                {/* Fortalezas */}
                                {analysisExtract.positiveHighlight && (
                                  <div className="flex items-start space-x-3">
                                    <span className="text-gray-700 text-lg mt-1">👥</span>
                                    <div>
                                      <p className="text-gray-700 text-sm">
                                        <span className="font-semibold">Fortalezas:</span> {analysisExtract.positiveHighlight}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Alertas */}
                                {analysisExtract.alertHighlight && (
                                  <div className="flex items-start space-x-3">
                                    <span className="text-gray-700 text-lg mt-1">👥</span>
                                    <div>
                                      <p className="text-gray-700 text-sm">
                                        <span className="font-semibold">Alertas:</span> {analysisExtract.alertHighlight}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Próximo paso docente */}
                                <div className="flex items-start space-x-3">
                                  <span className="text-gray-700 text-lg mt-1">⚙️</span>
                                  <div>
                                    <p className="text-gray-700 text-sm">
                                      <span className="font-semibold">Próximo paso docente:</span> {analysisExtract.recommendationHighlight}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          } else {
                            // Solo mostrar indicador de análisis pendiente
                            return (
                              <div className="mb-4 py-8">
                                <div className="text-center text-gray-400">
                                  <FontAwesomeIcon icon={faBrain} size="2x" className="mb-3" />
                                  <p className="text-sm">
                                    Actividad sin analizar
                                  </p>
                                </div>
                              </div>
                            )
                          }
                        })()}

                        
                        {/* Footer - Ver más como en el diseño */}
                        <div className="flex justify-between items-center mt-6">
                          {/* Botones de análisis ocultos para funcionalidad */}
                          <div className="flex space-x-2 opacity-0">
                            <button
                              onClick={() => analyzeActivity(activity)}
                              disabled={analyzingActivity === `${activity.type}_${activity.id}`}
                              className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                            >
                              {analyzingActivity === `${activity.type}_${activity.id}` ? 'Analizando...' : 'Analizar'}
                            </button>
                            
                            {analysisResults[`${activity.type}_${activity.id}`] && (
                              <button
                                onClick={() => {
                                  const analysis = analysisResults[`${activity.type}_${activity.id}`]
                                  setSelectedAnalysis(analysis)
                                  setSelectedActivityName(activity.name)
                                  setSelectedActivityType(activity.type)
                                  setModalOpen(true)
                                }}
                                className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                              >
                                Ver análisis
                              </button>
                            )}
                          </div>
                          
                          {/* Ver más como en el diseño de referencia */}
                          <button 
                            onClick={() => {
                              // Si no hay análisis, analizar primero
                              if (!analysisResults[`${activity.type}_${activity.id}`]) {
                                analyzeActivity(activity)
                              } else {
                                // Si ya hay análisis, mostrar modal
                                const analysis = analysisResults[`${activity.type}_${activity.id}`]
                                setSelectedAnalysis(analysis)
                                setSelectedActivityName(activity.name)
                                setSelectedActivityType(activity.type)
                                setModalOpen(true)
                              }
                            }}
                            className="text-green-600 font-semibold text-sm flex items-center space-x-1 hover:text-green-700 transition-colors"
                          >
                            <span>Ver más</span>
                            <FontAwesomeIcon icon={faChevronDown} className="rotate-[-90deg]" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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
                  Selecciona un curso para generar tu primer análisis inteligente
                </p>
                {selectedCourse && (
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

      {/* Modal de Análisis */}
      <AnalysisModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedAnalysis(null)
          setSelectedActivityName('')
          setSelectedActivityType('')
        }}
        analysis={selectedAnalysis}
        activityName={selectedActivityName}
        activityType={selectedActivityType}
      />
    </div>
  )
}
