'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faTimes, 
  faLightbulb, 
  faExclamationTriangle, 
  faCheckCircle,
  faArrowRight,
  faBrain
} from '@fortawesome/free-solid-svg-icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  analysis: any
  activityName: string
  activityType: string
}

export function AnalysisModal({ isOpen, onClose, analysis, activityName, activityType }: AnalysisModalProps) {
  if (!isOpen || !analysis) return null

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'forum': return 'Foro'
      case 'assign': return 'Tarea'
      case 'quiz': return 'Cuestionario'
      default: return 'Actividad'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'forum': return '💬'
      case 'assign': return '📝'
      case 'quiz': return '📊'
      default: return '🎯'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <FontAwesomeIcon icon={faBrain} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Análisis Inteligente</h2>
              <p className="text-sm text-gray-600">
                {getActivityIcon(activityType)} {getActivityTypeLabel(activityType)}: {activityName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Análisis Completo o Resumen General */}
          {analysis.fullAnalysis ? (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FontAwesomeIcon icon={faBrain} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Análisis Educativo Completo</h3>
              </div>
              <div className="text-blue-800 leading-relaxed prose prose-sm max-w-none prose-headings:text-blue-900 prose-strong:text-blue-900 prose-em:text-blue-700 prose-blockquote:text-blue-700 prose-blockquote:border-blue-300">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Personalizar estilos de componentes específicos
                    h1: ({children}) => <h1 className="text-xl font-bold text-blue-900 mb-3">{children}</h1>,
                    h2: ({children}) => <h2 className="text-lg font-semibold text-blue-900 mb-2">{children}</h2>,
                    h3: ({children}) => <h3 className="text-md font-medium text-blue-900 mb-2">{children}</h3>,
                    ul: ({children}) => <ul className="list-disc list-inside space-y-1 ml-2">{children}</ul>,
                    ol: ({children}) => <ol className="list-decimal list-inside space-y-1 ml-2">{children}</ol>,
                    blockquote: ({children}) => <blockquote className="border-l-4 border-blue-300 pl-4 italic text-blue-700 my-3">{children}</blockquote>,
                    table: ({children}) => <table className="w-full border-collapse border border-blue-300 my-3">{children}</table>,
                    th: ({children}) => <th className="border border-blue-300 bg-blue-100 px-3 py-2 text-left font-semibold">{children}</th>,
                    td: ({children}) => <td className="border border-blue-300 px-3 py-2">{children}</td>,
                    code: ({children}) => <code className="bg-blue-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                    pre: ({children}) => <pre className="bg-blue-100 p-3 rounded overflow-x-auto">{children}</pre>
                  }}
                >
                  {analysis.fullAnalysis}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FontAwesomeIcon icon={faLightbulb} className="text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Resumen General</h3>
              </div>
              <p className="text-blue-800 leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Aspectos Positivos */}
          {analysis.positives && analysis.positives.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">Aspectos Positivos</h3>
              </div>
              <ul className="space-y-2">
                {analysis.positives.map((positive: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-green-600 mt-1">✓</span>
                    <span className="text-green-800">{positive}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Alertas y Áreas de Mejora */}
          {analysis.alerts && analysis.alerts.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-600" />
                <h3 className="text-lg font-semibold text-amber-900">Alertas y Áreas de Mejora</h3>
              </div>
              <ul className="space-y-2">
                {analysis.alerts.map((alert: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-amber-600 mt-1">⚠</span>
                    <span className="text-amber-800">{alert}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Insights Clave */}
          {analysis.insights && analysis.insights.length > 0 && (
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <FontAwesomeIcon icon={faBrain} className="text-purple-600" />
                <h3 className="text-lg font-semibold text-purple-900">Insights Clave para Evaluación</h3>
              </div>
              <ul className="space-y-2">
                {analysis.insights.map((insight: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-purple-600 mt-1">💡</span>
                    <span className="text-purple-800">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recomendación Docente */}
          {analysis.recommendation && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border-l-4 border-green-500">
              <div className="flex items-center space-x-2 mb-3">
                <FontAwesomeIcon icon={faArrowRight} className="text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Recomendación Docente Inmediata</h3>
              </div>
              <p className="text-gray-800 leading-relaxed font-medium">{analysis.recommendation}</p>
            </div>
          )}

          {/* Información Recopilada */}
          {analysis.rawActivityData && (
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">📊 Información Recopilada</h3>
              <div className="bg-white rounded border p-3">
                <h4 className="font-medium text-slate-700 mb-2">Datos de la Actividad:</h4>
                <div className="text-sm space-y-1 text-slate-600">
                  <p><strong>Nombre:</strong> {analysis.rawActivityData.name}</p>
                  <p><strong>Tipo:</strong> {getActivityTypeLabel(analysis.activityType)}</p>
                  <p><strong>Estado:</strong> {analysis.rawActivityData.status || 'No especificado'}</p>
                  {analysis.rawActivityData.duedate && (
                    <p><strong>Fecha límite:</strong> {new Date(analysis.rawActivityData.duedate * 1000).toLocaleString()}</p>
                  )}
                  {analysis.rawActivityData.intro && (
                    <div>
                      <strong>Descripción:</strong>
                      <div className="mt-1 p-2 bg-slate-50 rounded text-xs max-h-32 overflow-y-auto">
                        {analysis.rawActivityData.intro.replace(/<[^>]*>/g, '')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {analysis.rawData && (
                <div className="bg-white rounded border p-3 mt-3">
                  <h4 className="font-medium text-slate-700 mb-2">Datos Procesados para Análisis:</h4>
                  <div className="text-sm space-y-1 text-slate-600">
                    {analysis.rawData.stats && (
                      <div>
                        <strong>Estadísticas:</strong>
                        <div className="mt-1 p-2 bg-slate-50 rounded text-xs">
                          <pre>{JSON.stringify(analysis.rawData.stats, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Prompt Enviado a OpenAI */}
          {analysis.analysisPrompt && (
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-orange-900 mb-3">🤖 Prompt Enviado a OpenAI</h3>
              <div className="bg-white rounded border p-3">
                <div className="text-sm text-orange-800 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                  {analysis.analysisPrompt}
                </div>
              </div>
              <div className="mt-2 text-xs text-orange-600">
                <p>Este es el prompt exacto que se envió al modelo de inteligencia artificial para generar el análisis.</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Análisis generado:</strong> {new Date(analysis.generatedAt).toLocaleString()}</p>
              <p><strong>Actividad:</strong> {analysis.activityName} (ID: {analysis.activityId})</p>
              <p><strong>Tipo:</strong> {getActivityTypeLabel(analysis.activityType)}</p>
              {analysis.collectedData && (
                <p><strong>Procesado:</strong> {new Date(analysis.collectedData.processingTimestamp).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-inter font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}