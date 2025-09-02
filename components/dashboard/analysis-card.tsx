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
  faSync
} from '@fortawesome/free-solid-svg-icons'
import { AnalysisCardData } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ContentParser } from '@/components/ui/content-parser'
import { AnalysisList } from '@/components/ui/analysis-list'

interface AnalysisCardProps {
  data: AnalysisCardData
  onViewMore?: () => void
  onReanalyze?: () => void
}

export default function AnalysisCard({ data, onViewMore, onReanalyze }: AnalysisCardProps) {
  const [isReanalyzing, setIsReanalyzing] = useState(false)

  // Función para convertir markdown a HTML y limpiar
  const processMarkdownText = (text: string): string => {
    if (!text) return ''
    return text
      // Convertir markdown a HTML
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **texto** → <strong>texto</strong>
      .replace(/\*(.*?)\*/g, '<em>$1</em>')              // *texto* → <em>texto</em>
      .replace(/`(.*?)`/g, '<code>$1</code>')            // `texto` → <code>texto</code>
      // Limpiar caracteres especiales restantes
      .replace(/~/g, '')                                 // ~ sueltos
      .replace(/\|/g, '')                               // | pipes
      .replace(/\\/g, '')                               // \ backslash
      // Limpiar patrones de inicio de línea pero mantener el contenido
      .replace(/^[\*\-\+]\s+/gm, '')                    // *, -, + al inicio
      .replace(/^\d+\.\s+/gm, '')                       // 1. 2. etc al inicio
      // Limpiar espacios múltiples
      .replace(/\s+/g, ' ')                             // Múltiples espacios → uno
      .trim()
  }
  
  // Función para crear resumen integrado más completo
  const createIntegratedSummary = (items: any[]): string => {
    if (!items || items.length === 0) return ''
    
    // Tomar más items y procesarlos
    const processedItems = items.slice(0, 5).map(item => {
      const text = typeof item === 'string' ? item : item.description || item.action || ''
      return processMarkdownText(text)
    }).filter(text => text.length > 0)
    
    if (processedItems.length === 0) return ''
    
    // Crear un texto más fluido uniendo las primeras oraciones
    let combinedText = processedItems.join('. ')
    
    // Limpiar puntos dobles y agregar punto final si no lo tiene
    combinedText = combinedText
      .replace(/\.\./g, '.')
      .replace(/\.$/, '')
    
    if (!combinedText.endsWith('.')) {
      combinedText += '.'
    }
    
    return combinedText
  }

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

  // Verificar si tenemos datos de análisis estructurado (metricsTable, structuredInsights)
  const hasStructuredAnalysis = data.llmResponse && (
    data.llmResponse.metricsTable || 
    data.llmResponse.structuredInsights
  )

  // Verificar si tenemos análisis en formato markdown con dimensiones
  const hasMarkdownAnalysis = data.llmResponse && (
    data.llmResponse.markdownContent || 
    data.llmResponse.dimensions
  )

  // Función para renderizar contenido mejorado con componentes visuales
  const renderEnhancedContent = (content: string | any, type: 'insights' | 'recommendations' | 'general' = 'general') => {
    if (typeof content === 'string') {
      return <ContentParser content={content} />
    }
    return <span>{content}</span>
  }

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

        {hasMarkdownAnalysis ? (
          // Formato markdown con dimensiones
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
                <FontAwesomeIcon icon={faFileAlt} className="w-4 h-4" />
                Análisis por Dimensiones
              </div>
              <p className="text-blue-600 text-sm">
                {data.llmResponse.dimensions?.length || 0} dimensiones de análisis identificadas con insights accionables
              </p>
            </div>
            
            {/* Mostrar resumen integrado de hallazgos */}
            {data.positives.length > 0 && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-start">
                  <FontAwesomeIcon 
                    icon={faUsers} 
                    className="w-5 h-5 text-green-600 mt-0.5 mr-3 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-700 mb-1">Principales hallazgos</div>
                    <div 
                      className="text-gray-600 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: createIntegratedSummary(data.positives).substring(0, 400) || 
                               'Se identificaron múltiples aspectos positivos en la participación estudiantil.'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Mostrar alertas integradas */}
            {data.alerts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div className="flex items-start">
                  <FontAwesomeIcon 
                    icon={faExclamationTriangle} 
                    className="w-5 h-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-700 mb-1">Áreas de oportunidad</div>
                    <div 
                      className="text-gray-600 text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: createIntegratedSummary(data.alerts).substring(0, 400) ||
                               'Se detectaron oportunidades de mejora en la dinámica del curso.'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Próxima acción mejorada */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-start">
                <FontAwesomeIcon 
                  icon={faFileAlt} 
                  className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-700 mb-1">Acción recomendada</div>
                  <div 
                    className="text-gray-600 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const text = typeof data.recommendation === 'string' 
                          ? data.recommendation 
                          : data.recommendation?.action || 'Revisar el análisis detallado para obtener recomendaciones específicas.'
                        return processMarkdownText(text).substring(0, 350)
                      })()
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : hasEnrichedData ? (
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

            {/* Análisis estructurado mejorado */}
            {hasStructuredAnalysis && (
              <div className="space-y-4 border-t pt-4">
                {/* Tabla de métricas */}
                {data.llmResponse.metricsTable && (
                  <ContentParser content={data.llmResponse.metricsTable} />
                )}
                
                {/* Insights estructurados */}
                {data.llmResponse.structuredInsights && (
                  <div className="space-y-4">
                    {data.llmResponse.structuredInsights.numbered && (
                      <AnalysisList
                        title="Insights clave para la evaluación"
                        items={data.llmResponse.structuredInsights.numbered}
                        numbered={true}
                      />
                    )}
                    
                    {data.llmResponse.structuredInsights.bullets && (
                      <AnalysisList
                        title="Observaciones adicionales"
                        items={data.llmResponse.structuredInsights.bullets}
                        numbered={false}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
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
                  <span 
                    className="text-gray-600 ml-1"
                    dangerouslySetInnerHTML={{
                      __html: data.strengths.map(s => processMarkdownText(typeof s === 'string' ? s : s.description)).join(', ')
                    }}
                  />
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
                  <span 
                    className="text-gray-600 ml-1"
                    dangerouslySetInnerHTML={{
                      __html: data.alerts.map(a => processMarkdownText(typeof a === 'string' ? a : a.description)).join('; ')
                    }}
                  />
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
                <span 
                  className="text-gray-600 ml-1"
                  dangerouslySetInnerHTML={{
                    __html: processMarkdownText(typeof data.nextStep === 'string' ? data.nextStep : data.nextStep.action)
                  }}
                />
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
            onClick={onViewMore}
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
    </div>
  )
}
