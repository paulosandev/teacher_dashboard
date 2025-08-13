'use client'

import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faComments, 
  faClipboardCheck,
  faPencilAlt, 
  faUsers, 
  faExclamationTriangle,
  faFileAlt,
  faChevronRight,
  faSync,
  faTimes
} from '@fortawesome/free-solid-svg-icons'
import { AnalysisCardData } from '@/types'
import { ForumMetricsCard } from '@/components/analysis/ForumMetricsCard'
import { AnalysisInsightsCard } from '@/components/analysis/AnalysisInsightsCard'
import { CourseOverviewCard } from '@/components/analysis/CourseOverviewCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface AnalysisCardProps {
  data: AnalysisCardData
  onViewMore?: () => void
  onReanalyze?: () => void
}

export default function AnalysisCard({ data, onViewMore, onReanalyze }: AnalysisCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [isReanalyzing, setIsReanalyzing] = useState(false)

  const getTypeIcon = () => {
    switch (data.type) {
      case 'forum':
        return faComments
      case 'activity':
        return faClipboardCheck
      default:
        return faFileAlt
    }
  }

  const getTypeLabel = () => {
    switch (data.type) {
      case 'forum':
        return 'Análisis de Foros'
      case 'activity':
        return 'Análisis de Actividades'
      default:
        return 'Análisis General'
    }
  }

  const handleReanalyze = async () => {
    setIsReanalyzing(true)
    try {
      if (onReanalyze) {
        await onReanalyze()
      }
    } finally {
      setIsReanalyzing(false)
    }
  }

  // Verificar si tenemos datos enriquecidos (nuevo formato)
  const hasEnrichedData = data.rawData && (
    data.rawData.forums || 
    data.rawData.courseStructure || 
    data.rawData.overallStats
  )

  return (
    <div className="space-y-4">
      <article className="bg-white border-gray-200 rounded-lg shadow-sm border p-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-primary-darker">
              {data.title}
            </h3>
            {data.confidence && (
              <Badge variant="outline" className="text-xs">
                Confianza: {Math.round(data.confidence * 100)}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-white text-primary-dark px-3 py-1 rounded-full text-sm font-medium flex items-center border border-primary-dark">
              <FontAwesomeIcon 
                icon={getTypeIcon()} 
                className="w-4 h-4 mr-1"
              />
              {getTypeLabel()}
            </span>
          </div>
        </header>

        {hasEnrichedData ? (
          <div className="space-y-4">
            {/* Resumen mejorado */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600">
                  {data.rawData.enrolledStudents || 0}
                </div>
                <div className="text-xs text-gray-500">Estudiantes</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {data.rawData.forums?.length || 0}
                </div>
                <div className="text-xs text-gray-500">Foros</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600">
                  {data.rawData.overallStats?.totalActivities || 0}
                </div>
                <div className="text-xs text-gray-500">Actividades</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600">
                  {data.rawData.overallStats?.totalResources || 0}
                </div>
                <div className="text-xs text-gray-500">Recursos</div>
              </div>
            </div>

            {/* Alertas principales */}
            {data.alerts.length > 0 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4" />
                  Alertas Críticas
                </div>
                <div className="space-y-1">
                  {data.alerts.slice(0, 2).map((alert, index) => (
                    <p key={index} className="text-red-600 text-sm">
                      • {typeof alert === 'string' ? alert : alert.description}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Próximo paso destacado */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                <FontAwesomeIcon icon={faFileAlt} className="w-4 h-4" />
                Próximo Paso Prioritario
              </div>
              <p className="text-blue-600 text-sm">
                {typeof data.nextStep === 'string' ? data.nextStep : data.nextStep.action}
              </p>
            </div>
          </div>
        ) : (
          // Formato legacy
          <div className="space-y-4">
            {/* Actividad/Resumen */}
            <div className="flex items-start">
              <FontAwesomeIcon 
                icon={faPencilAlt} 
                className="w-5 h-5 text-gray-600 mt-0.5 mr-3 flex-shrink-0"
              />
              <div>
                <strong className="font-semibold text-gray-700">Actividad:</strong>
                <span className="text-gray-600 ml-1">
                  {data.strengths[0]?.evidence || 'Sin datos de actividad disponibles'}
                </span>
              </div>
            </div>

            {/* Fortalezas */}
            {data.strengths.length > 0 && (
              <div className="flex items-start">
                <FontAwesomeIcon 
                  icon={faUsers} 
                  className="w-5 h-5 text-gray-600 mt-0.5 mr-3 flex-shrink-0"
                />
                <div>
                  <strong className="font-semibold text-gray-700">Fortalezas:</strong>
                  <span className="text-gray-600 ml-1">
                    {data.strengths.map(s => typeof s === 'string' ? s : s.description).join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* Alertas */}
            {data.alerts.length > 0 && (
              <div className="flex items-start">
                <FontAwesomeIcon 
                  icon={faExclamationTriangle} 
                  className="w-5 h-5 text-gray-600 mt-0.5 mr-3 flex-shrink-0"
                />
                <div>
                  <strong className="font-semibold text-gray-700">Alertas:</strong>
                  <span className="text-gray-600 ml-1">
                    {data.alerts.map(a => typeof a === 'string' ? a : a.description).join('; ')}
                  </span>
                </div>
              </div>
            )}

            {/* Próximo paso */}
            <div className="flex items-start">
              <FontAwesomeIcon 
                icon={faFileAlt} 
                className="w-5 h-5 text-gray-600 mt-0.5 mr-3 flex-shrink-0"
              />
              <div>
                <strong className="font-semibold text-gray-700">Próximo paso docente:</strong>
                <span className="text-gray-600 ml-1">
                  {typeof data.nextStep === 'string' ? data.nextStep : data.nextStep.action}
                </span>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-6 flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={isReanalyzing}
              className="text-xs"
            >
              <FontAwesomeIcon 
                icon={faSync} 
                className={`w-3 h-3 mr-1 ${isReanalyzing ? 'animate-spin' : ''}`}
              />
              {isReanalyzing ? 'Analizando...' : 'Volver a analizar'}
            </Button>
          </div>
          <button
            onClick={() => setShowDetails(true)}
            className="text-primary-dark hover:text-green-700 font-medium flex items-center transition-colors text-sm"
            aria-label={`Ver más detalles de ${data.title}`}
          >
            Ver análisis detallado
            <FontAwesomeIcon 
              icon={faChevronRight} 
              className="w-4 h-4 ml-1"
            />
          </button>
        </footer>
      </article>

      {/* Modal de detalles */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-semibold">Análisis Detallado: {data.title}</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Panel izquierdo: Métricas y resumen */}
                <div className="space-y-6">
                  {hasEnrichedData && (
                    <>
                      <CourseOverviewCard courseData={data.rawData} />
                      {data.rawData.forums && (
                        <ForumMetricsCard 
                          forums={data.rawData.forums}
                          enrolledStudents={data.rawData.enrolledStudents || 0}
                        />
                      )}
                    </>
                  )}
                </div>
                
                {/* Panel derecho: Insights y recomendaciones */}
                <div>
                  <AnalysisInsightsCard 
                    analysisData={{
                      strengths: data.strengths.map(s => typeof s === 'string' ? s : s.description),
                      alerts: data.alerts.map(a => typeof a === 'string' ? a : a.description),
                      studentsAtRisk: data.llmResponse?.studentsAtRisk,
                      recommendations: data.llmResponse?.recommendations || [],
                      nextStep: typeof data.nextStep === 'string' ? data.nextStep : data.nextStep.action,
                      overallHealth: data.llmResponse?.overallHealth
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
