/**
 * Selector de aulas para el dashboard
 * Permite al profesor cambiar entre las diferentes aulas donde está enrolado
 */

'use client'

import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faChevronDown, 
  faUniversity,
  faSpinner,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons'
import { useTeacherAulas, AulaInfo } from '@/hooks/useTeacherAulas'

interface AulaSelectorProps {
  className?: string
  onAulaChange?: (aula: AulaInfo | null) => void
}

export default function AulaSelector({ className = "", onAulaChange }: AulaSelectorProps) {
  const { 
    aulas, 
    selectedAula, 
    isLoading, 
    error, 
    isTeacher, 
    selectAula,
    refreshAulas 
  } = useTeacherAulas()
  
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (aula: AulaInfo) => {
    selectAula(aula.aulaId)
    setIsOpen(false)
    onAulaChange?.(aula)
  }

  const handleRefresh = async () => {
    setIsOpen(false)
    await refreshAulas()
  }

  // Si está cargando
  if (isLoading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-500" />
          <span className="text-sm text-gray-600">Cargando aulas...</span>
        </div>
      </div>
    )
  }

  // Si hay error
  if (error) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg border border-red-200">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
          <span className="text-sm text-red-600">Error cargando aulas</span>
          <button 
            onClick={handleRefresh}
            className="text-xs text-red-700 hover:text-red-800 underline ml-2"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Si no es profesor
  if (!isTeacher) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-yellow-500" />
          <span className="text-sm text-yellow-700">Sin acceso como profesor</span>
        </div>
      </div>
    )
  }

  // Si no hay aulas
  if (aulas.length === 0) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
          <FontAwesomeIcon icon={faUniversity} className="text-gray-400" />
          <span className="text-sm text-gray-600">No hay aulas asignadas</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selector principal */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-primary-darker transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
      >
        <div className="flex items-center gap-3">
          <FontAwesomeIcon icon={faUniversity} className="text-primary-darker" />
          <div className="text-left">
            <div className="font-medium text-gray-900">
              {selectedAula ? selectedAula.aulaId.toUpperCase() : 'Seleccionar Aula'}
            </div>
            <div className="text-xs text-gray-500">
              {selectedAula 
                ? `${selectedAula.coursesCount} curso${selectedAula.coursesCount !== 1 ? 's' : ''}`
                : 'Ninguna aula seleccionada'
              }
            </div>
          </div>
        </div>
        <FontAwesomeIcon 
          icon={faChevronDown} 
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">
                Aulas Disponibles ({aulas.length})
              </div>
              <button 
                onClick={handleRefresh}
                className="text-xs text-primary-darker hover:text-primary underline"
              >
                Actualizar
              </button>
            </div>
          </div>

          {/* Lista de aulas */}
          <div className="py-1">
            {aulas.map((aula) => (
              <button
                key={aula.aulaId}
                onClick={() => handleSelect(aula)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  selectedAula?.aulaId === aula.aulaId 
                    ? 'bg-primary-light text-primary-darker' 
                    : 'text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {aula.aulaId.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {aula.aulaUrl}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {aula.coursesCount}
                    </div>
                    <div className="text-xs text-gray-500">
                      curso{aula.coursesCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <div className="text-xs text-gray-500">
              💡 Los cursos se actualizarán automáticamente al cambiar de aula
            </div>
          </div>
        </div>
      )}

      {/* Overlay para cerrar */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Componente compacto para mostrar el aula actual
 */
export function CurrentAulaDisplay({ className = "" }: { className?: string }) {
  const { selectedAula, isLoading } = useTeacherAulas()

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-gray-400 text-sm" />
        <span className="text-sm text-gray-500">Cargando...</span>
      </div>
    )
  }

  if (!selectedAula) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <FontAwesomeIcon icon={faUniversity} className="text-gray-400 text-sm" />
        <span className="text-sm text-gray-500">Sin aula</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <FontAwesomeIcon icon={faUniversity} className="text-primary-darker text-sm" />
      <div className="text-sm">
        <span className="font-medium text-gray-900">{selectedAula.aulaId.toUpperCase()}</span>
        <span className="text-gray-500 ml-2">({selectedAula.coursesCount} cursos)</span>
      </div>
    </div>
  )
}