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
  faDatabase
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

      const response = await fetch(`/api/batch/analyses?aulaId=${aulaId}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📊 [BATCH] Análisis recibidos:', data.analyses?.length || 0)
        setBatchAnalyses(data.analyses || [])
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
              Análisis: {analysis.activityName}
            </h1>
            
            {/* Chip con fecha y hora de análisis */}
            <div className="flex items-center space-x-2 bg-green-50 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              <FontAwesomeIcon icon={faDatabase} />
              <span>Sistema Batch - {formatDate(analysis.generatedAt)}</span>
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

        {/* Mostrar el análisis */}
        <div className="space-y-6">
          {analysis.sections && analysis.sections.length > 0 ? (
            <div className="space-y-6">
              {analysis.sections.sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999)).map((section: any, index: number) => (
                <DynamicSectionRenderer
                  key={section.id || `section-${index}`}
                  section={section}
                  className=""
                />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Análisis Detallado</h3>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {analysis.analysisContent || 'Análisis no disponible'}
                </ReactMarkdown>
              </div>
            </div>
          )}
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
          Dashboard con <strong>Sistema Batch</strong> - Los análisis se generan automáticamente y están disponibles al instante        
        </p>

        {/* Indicador de sistema batch */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center space-x-2 bg-green-50 text-green-800 px-3 py-2 rounded-full text-sm font-medium">
            <FontAwesomeIcon icon={faDatabase} />
            <span>Sistema Batch Activo</span>
          </div>
          {syncStatus && (
            <div className="text-xs text-gray-600">
              Última sincronización: {syncStatus.lastSync ? formatDate(syncStatus.lastSync) : 'Nunca'}
            </div>
          )}
        </div>
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
                  Análisis Pre-generados
                </h2>
                {syncStatus && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <FontAwesomeIcon icon={faClock} />
                    <span>{syncStatus.totalActivities || 0} análisis disponibles</span>
                  </div>
                )}
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
                    <FontAwesomeIcon icon={faDatabase} size="4x" className="text-gray-400" />
                  </div>
                  <p className="text-xl font-medium text-gray-700 mb-2">
                    Sistema Batch Listo
                  </p>
                  <p className="text-gray-600 mb-6 max-w-md">
                    Selecciona un curso para ver los análisis pre-generados
                  </p>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <FontAwesomeIcon icon={faLightbulb} />
                    <span>Los análisis están listos y optimizados para carga instantánea</span>
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
                            <div key={analysis.id} className="bg-white border border-gray-300 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col min-h-[200px]">
                              {/* Header */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                  <h3 className="text-lg font-semibold text-primary-darker font-inter">
                                    {analysis.activityName}
                                  </h3>
                                </div>
                                <span className="bg-green-50 border border-green-300 text-green-700 px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                                  <FontAwesomeIcon icon={faDatabase} />
                                  <span>Batch</span>
                                </span>
                              </div>
                              
                              {/* Resumen del análisis */}
                              <div className="flex-grow mb-4">
                                <p className="text-sm text-gray-600">
                                  {analysis.summary || 'Análisis disponible para revisión detallada'}
                                </p>
                                <div className="mt-2 text-xs text-gray-500">
                                  Generado: {formatDate(analysis.generatedAt)}
                                </div>
                              </div>
                              
                              {/* Footer con botones */}
                              <div className="flex justify-between items-center mt-auto pt-4">
                                <div className="flex items-center space-x-1">
                                  {/* Indicador de tipo de actividad */}
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    {analysis.activityType || 'Actividad'}
                                  </span>
                                </div>
                                
                                <button 
                                  onClick={() => navigateToDetail(analysis)}
                                  className="px-3 py-2 rounded-lg text-sm font-medium font-inter transition-all flex items-center space-x-2 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow-[0_4px_10px_0_rgba(0,0,0,0.20)] shadow-[0_2px_6px_0_rgba(0,0,0,0.10)]"
                                >
                                  <span>Ver análisis</span>
                                  <FontAwesomeIcon icon={faChevronDown} className="rotate-[-90deg]" />
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