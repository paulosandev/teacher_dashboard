'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faComments, 
  faClipboardCheck,
  faPencilAlt, 
  faUsers, 
  faExclamationTriangle,
  faFileAlt,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons'
import { AnalysisCardData } from '@/types'

interface AnalysisCardProps {
  data: AnalysisCardData
  onViewMore?: () => void
}

export default function AnalysisCard({ data, onViewMore }: AnalysisCardProps) {
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
        return 'Foro'
      case 'activity':
        return 'Actividad'
      default:
        return 'Recurso'
    }
  }

  return (
    <article className="bg-white border-gray-200 rounded-lg shadow-sm border p-6">
      <header className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-primary-darker">
          {data.title}
        </h3>
        <span className="bg-white text-primary-dark px-3 py-1 rounded-full text-sm font-medium flex items-center border border-primary-dark">
          <FontAwesomeIcon 
            icon={getTypeIcon()} 
            className="w-4 h-4 mr-1"
          />
          {getTypeLabel()}
        </span>
      </header>

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
                {data.strengths.map(s => s.description).join(', ')}
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
                {data.alerts.map(a => a.description).join('; ')}
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
              {data.nextStep.action}
            </span>
          </div>
        </div>
      </div>

      <footer className="mt-6 flex justify-end">
        <button
          onClick={onViewMore}
          className="text-primary-dark hover:text-green-700 font-medium flex items-center transition-colors"
          aria-label={`Ver más detalles de ${data.title}`}
        >
          Ver más
          <FontAwesomeIcon 
            icon={faChevronRight} 
            className="w-4 h-4 ml-1"
          />
        </button>
      </footer>
    </article>
  )
}
