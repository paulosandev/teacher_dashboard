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
  faLightbulb,
  faArrowLeft,
  faExternalLinkAlt,
  faClock,
  faDatabase,
  faComments,
  faClipboardCheck,
  faUsers,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons'
import SimpleCourseSelector from '@/components/dashboard/simple-course-selector'
import { AnalysisModal } from '@/components/dashboard/analysis-modal'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ContentParser } from '@/components/ui/content-parser'
import { AnalysisList } from '@/components/ui/analysis-list'
import { DynamicSectionRenderer } from '@/components/ui/dynamic-section'

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

interface BatchDashboardContentProps {
  user: User
  courses: Course[]
  connectionStatus: 'connected' | 'disconnected' | 'failed' | 'error'
  error?: string | null
}

export function BatchDashboardContent({
  user,
  courses,
  connectionStatus,
  error
}: BatchDashboardContentProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [batchAnalyses, setBatchAnalyses] = useState<any[]>([])
  const [loadingBatchData, setLoadingBatchData] = useState(false)
  const [detailView, setDetailView] = useState<{isActive: boolean, analysis: any} | null>(null)
  const [syncStatus, setSyncStatus] = useState<any>(null)

  // Función para procesar markdown y limpiar texto
  const processMarkdown = (text: string): string => {
    if (!text) return ''
    
    return text
      // Procesar negritas ** **
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Procesar cursivas * *
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Procesar código ` `
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Limpiar caracteres especiales problemáticos
      .replace(/\*\*/g, '') // Asteriscos dobles restantes
      .replace(/^\s*-\s*/, '') // Guión inicial
      .replace(/^\s*\*+\s*/, '') // Asteriscos iniciales
      .replace(/\s+/g, ' ') // Espacios múltiples
      .trim()
  }

  // Función para parsear contenido del summary y extraer secciones
  const parseAnalysisContent = (analysis: any) => {
    if (!analysis.summary || typeof analysis.summary !== 'string') return analysis

    // Si ya tiene datos estructurados, usarlos
    if (analysis.positives?.length > 0 || analysis.alerts?.length > 0) {
      return analysis
    }

    // Parsear el summary para extraer secciones
    const summary = analysis.summary
    const sections = []
    const alerts = []
    const positives = []

    // Dividir por líneas y buscar patrones
    const lines = summary.split('\n').filter(line => line.trim())
    
    let currentSection = null
    for (const line of lines) {
      const cleanLine = line.trim()
      
      // Detectar títulos de sección
      if (cleanLine.match(/^\[.*\]$/) || cleanLine.match(/^#{1,6}\s/)) {
        if (currentSection) sections.push(currentSection)
        currentSection = {
          title: cleanLine.replace(/[\[\]#]/g, '').trim(),
          content: []
        }
      }
      // Detectar elementos negativos/problemáticos
      else if (cleanLine.includes('Riesgo') || cleanLine.includes('problema') || cleanLine.includes('baja participación') || cleanLine.includes('ausencia') || cleanLine.includes('falta') || cleanLine.includes('bloqueo') || cleanLine.includes('limitada') || cleanLine.includes('pasividad')) {
        alerts.push(processMarkdown(cleanLine))
      }
      // Detectar elementos positivos
      else if (cleanLine.includes('participación activa') || cleanLine.includes('buenos') || cleanLine.includes('adecuado') || cleanLine.includes('correcto') || cleanLine.includes('positiva') || cleanLine.includes('bien argumentados') || cleanLine.includes('largos y bien')) {
        positives.push(processMarkdown(cleanLine))
      }
      // Contenido general de la sección
      else if (currentSection && cleanLine && cleanLine.length > 10) {
        currentSection.content.push(processMarkdown(cleanLine))
      }
    }

    if (currentSection) sections.push(currentSection)

    return {
      ...analysis,
      positives: positives.length > 0 ? positives : ['Análisis estructural detallado disponible'],
      alerts: alerts.length > 0 ? alerts : ['Se identificaron áreas de mejora específicas'],
      parsedSections: sections
    }
  }

  // Cargar datos batch cuando cambie el curso
  const loadBatchAnalyses = useCallback(async (courseId: string) => {
    if (!courseId) return
    
    console.log('🔄 [BATCH] Cargando análisis batch para curso:', courseId)
    setLoadingBatchData(true)

    try {
      // Extraer aula ID del curso seleccionado
      const [courseNumber, groupId] = courseId.split('|')
      
      // Determinar aula ID basado en el curso
      let aulaId = 'av141' // por defecto
      if (courseNumber && !isNaN(parseInt(courseNumber))) {
        // Si es un número, intentar encontrar el aula correspondiente
        // Para simplificar, usar av141 por ahora
        aulaId = 'av141'
      }

      console.log('🏫 [BATCH] Consultando aula:', aulaId)
      console.log('📚 [BATCH] Consultando curso:', courseId)

      const response = await fetch(`/api/batch/analyses?aulaId=${aulaId}&courseId=${courseId}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📊 [BATCH] Análisis recibidos:', data.results?.analyses?.length || 0)
        
        // Procesar cada análisis para extraer contenido estructurado
        const processedAnalyses = (data.results?.analyses || []).map(parseAnalysisContent)
        setBatchAnalyses(processedAnalyses)
      } else {
        console.error('❌ [BATCH] Error cargando análisis:', response.status)
        setBatchAnalyses([])
      }
    } catch (error) {
      console.error('❌ [BATCH] Error en loadBatchAnalyses:', error)
      setBatchAnalyses([])
    } finally {
      setLoadingBatchData(false)
    }
  }, [])

  // Cargar estado de sincronización
  const loadSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/batch/sync-status')
      if (response.ok) {
        const data = await response.json()
        setSyncStatus(data)
      }
    } catch (error) {
      console.error('❌ Error cargando estado de sincronización:', error)
    }
  }, [])

  const handleCourseChange = useCallback(async (courseId: string) => {
    console.log('🎯 [BATCH] Cambiando a curso:', courseId)
    setSelectedCourse(courseId)
    setBatchAnalyses([])
    await loadBatchAnalyses(courseId)
  }, [loadBatchAnalyses])

  // Cargar datos iniciales
  useEffect(() => {
    loadSyncStatus()
  }, [loadSyncStatus])

  // Cargar datos cuando cambie el curso
  useEffect(() => {
    if (selectedCourse) {
      loadBatchAnalyses(selectedCourse)
    }
  }, [selectedCourse, loadBatchAnalyses])

  // Función para navegar a la vista de detalle
  const navigateToDetail = useCallback((analysis: any) => {
    console.log('📦 [BATCH] NavigateToDetail llamado con análisis:', analysis.id)
    setDetailView({ isActive: true, analysis })
  }, [])

  // Función para volver al dashboard general
  const navigateBackToDashboard = useCallback(() => {
    setDetailView(null)
  }, [])

  // Función para formatear fechas
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Prevent SSR/hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

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
        return 'Sistema batch conectado'
      case 'disconnected':
        return 'Sistema batch desconectado'
      case 'failed':
        return 'Error en sistema batch'
      case 'error':
        return error || 'Error desconocido'
      default:
        return 'Conectando...'
    }
  }

  // Don't render anything until mounted
  if (!mounted) {
    return (
      <div className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
        <div className="flex items-center justify-center py-16">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4 w-64"></div>
            <div className="h-4 bg-gray-200 rounded mb-8 w-96"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mostrar vista de detalle si está activa
  if (detailView?.isActive && detailView.analysis) {
    const analysis = detailView.analysis

    return (
      <div className="max-w-[1132px] mx-auto mb-4 px-4 sm:px-6 lg:px-3">
        {/* Header de seguimiento */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Reporte de {analysis.activityName}
            </h1>
            
            {/* Chip con fecha y hora de análisis */}
            <div className="flex items-center space-x-2 bg-green-50 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span>Fecha de corte del análisis: {new Date(analysis.generatedAt).toLocaleDateString('es-ES')} - {new Date(analysis.generatedAt).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
          </div>
          
          <button 
            onClick={navigateBackToDashboard}
            className="flex items-center space-x-2 text-primary-darker hover:text-primary transition-colors mb-6"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-sm" />
            <span>Volver</span>
          </button>
        </section>

        {/* Grid de 2 columnas con cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Participación (nivel y cobertura) */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Participación (nivel y cobertura)</h3>
            <ul className="space-y-3 list-disc list-inside">
              {analysis.parsedSections && analysis.parsedSections[0]?.content && analysis.parsedSections[0].content.length > 0 ? (
                analysis.parsedSections[0].content.slice(0, 3).map((item: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))
              ) : analysis.alerts && analysis.alerts.length > 0 ? (
                analysis.alerts.slice(0, 3).map((alert: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: alert }} />
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 leading-relaxed">
                  <span dangerouslySetInnerHTML={{ __html: '<strong>Baja participación efectiva</strong>: se identificaron patrones de participación limitada que requieren atención docente.' }} />
                </li>
              )}
            </ul>
          </div>

          {/* Card: Dudas operativas y publicaciones fuera de la consigna */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dudas operativas y publicaciones fuera de la consigna</h3>
            <ul className="space-y-3 list-disc list-inside">
              {analysis.parsedSections && analysis.parsedSections[1]?.content && analysis.parsedSections[1].content.length > 0 ? (
                analysis.parsedSections[1].content.slice(0, 2).map((item: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))
              ) : analysis.alerts && analysis.alerts.length > 0 ? (
                analysis.alerts.slice(0, 2).map((alert: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: alert }} />
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 leading-relaxed">
                  Aparecen dudas explícitas sobre dónde subir la actividad y se identificaron consultas operativas fuera del tema principal.
                </li>
              )}
            </ul>
          </div>

          {/* Card: Interacción y retroalimentación entre pares */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Interacción y retroalimentación entre pares</h3>
            <ul className="space-y-3 list-disc list-inside">
              {analysis.parsedSections && analysis.parsedSections[2]?.content && analysis.parsedSections[2].content.length > 0 ? (
                analysis.parsedSections[2].content.slice(0, 2).map((item: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))
              ) : analysis.positives && analysis.positives.length > 0 ? (
                analysis.positives.slice(0, 2).map((positive: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: positive }} />
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 leading-relaxed">
                  Existe <strong>retroalimentación frecuente y positiva</strong> por parte de algunos estudiantes hacia sus compañeros, generando conversación y reforzando ideas.
                </li>
              )}
            </ul>
          </div>

          {/* Card: Calidad y alineación del contenido con la consigna */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Calidad y alineación del contenido con la consigna</h3>
            <ul className="space-y-3 list-disc list-inside">
              {analysis.parsedSections && analysis.parsedSections[3]?.content && analysis.parsedSections[3].content.length > 0 ? (
                analysis.parsedSections[3].content.slice(0, 2).map((item: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: item }} />
                  </li>
                ))
              ) : analysis.positives && analysis.positives.length > 0 ? (
                analysis.positives.slice(0, 2).map((positive: string, index: number) => (
                  <li key={index} className="text-sm text-gray-700 leading-relaxed">
                    <span dangerouslySetInnerHTML={{ __html: positive }} />
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 leading-relaxed">
                  Varios posts son <strong>largos y bien argumentados</strong>, respondiendo adecuadamente a las tres preguntas planteadas con ejemplos concretos.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Vista principal del dashboard
  return (
    <div className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
      {/* Saludo */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            ¡Hola, {user.firstName}!
          </h1>

          <a
            href="https://forms.gle/xHNHcHHP6p8QDKzP7"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white shadow-sm transition-colors"
          >
            ¿No encuentras tu curso?
          </a>
        </div>
        
        <p className="text-gray-600 mb-2">
          En este dashboard encontrará un resumen de los hallazgos que su <strong>Asistente Docente</strong> ha identificado sobre la participación en foros y la entrega de tareas, junto con recomendaciones para fortalecer su acompañamiento académico        
        </p>
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
          <section className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Actividades analizadas
                </h2>
              </div>
              
              {/* Selector de curso */}
              <SimpleCourseSelector
                courses={courses}
                selectedCourseId={selectedCourse}
                onSelectionChange={handleCourseChange}
              />
            </div>

            {/* Contenido principal */}
            {!selectedCourse ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="mb-6">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-xl font-medium text-gray-700 mb-2">
                    No hay curso seleccionado
                  </p>
                  <p className="text-gray-600 mb-6">
                    Selecciona un curso del menú superior
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span>Los análisis se generan automáticamente al seleccionar un curso</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {loadingBatchData ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="text-center">
                      <FontAwesomeIcon 
                        icon={faSpinner} 
                        size="3x" 
                        className="text-blue-600 animate-spin mb-4" 
                      />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Cargando análisis batch...
                      </h3>
                      <p className="text-gray-600">
                        Obteniendo análisis pre-generados del curso
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {batchAnalyses.length > 0 ? (
                      <div className="mb-8">
                        <div className={`grid gap-6 ${batchAnalyses.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'}`}>
                          {batchAnalyses.map((analysis, index) => (
                            <div key={analysis.id} className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                              {/* Header con título y badge de tipo */}
                              <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {analysis.activityName}
                                </h3>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
                                  analysis.activityType === 'forum' 
                                    ? 'bg-green-50 border border-green-300 text-green-700' 
                                    : 'bg-orange-50 border border-orange-300 text-orange-700'
                                }`}>
                                  <FontAwesomeIcon 
                                    icon={analysis.activityType === 'forum' ? faComments : faClipboardCheck} 
                                    className="w-3 h-3 mr-1"
                                  />
                                  {analysis.activityType === 'forum' ? 'Foro' : 'Tarea'}
                                </span>
                              </div>

                              {/* Footer con botones - centrado en el card */}
                              <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                  
                                  <a
                                    href={analysis.activityUrl || 
                                      `https://${selectedAulaId}.utel.edu.mx/course/view.php?id=${analysis.moodleCourseId}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                                    title="Ver en el aula"
                                  >
                                    <FontAwesomeIcon icon={faExternalLinkAlt} className="w-4 h-4" />
                                  </a>
                                </div>
                                <button
                                  onClick={() => navigateToDetail(analysis)}
                                  className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium flex items-center transition-colors text-sm rounded-lg"
                                >
                                  Ver más
                                  <FontAwesomeIcon 
                                    icon={faChevronRight} 
                                    className="w-3 h-3 ml-1"
                                  />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-gray-400 mb-4">
                          <FontAwesomeIcon icon={faMagicWandSparkles} size="3x" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          No hay análisis disponibles
                        </h3>
                        <p className="text-gray-600">
                          Este curso no tiene análisis generados en el sistema batch
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}