/**
 * Página de prueba para el sistema multi-aula
 */

'use client'

import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faUniversity,
  faBook,
  faUsers,
  faChartBar,
  faRefresh
} from '@fortawesome/free-solid-svg-icons'
import AulaSelector, { CurrentAulaDisplay } from '@/components/dashboard/aula-selector'
import { useTeacherAulas, AulaInfo } from '@/hooks/useTeacherAulas'

export default function TestMultiAulaPage() {
  const { 
    aulas, 
    selectedAula, 
    enrolmentsByAula, 
    isLoading, 
    error, 
    isTeacher,
    refreshAulas,
    getCoursesForAula
  } = useTeacherAulas()

  const [selectedAulaForDetails, setSelectedAulaForDetails] = useState<AulaInfo | null>(null)

  const handleAulaChange = (aula: AulaInfo | null) => {
    setSelectedAulaForDetails(aula)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
            <FontAwesomeIcon icon={faUniversity} className="text-primary-darker" />
            Prueba: Sistema Multi-Aula
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Selector de aula */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selector de Aula
              </label>
              <AulaSelector 
                className="w-full"
                onAulaChange={handleAulaChange}
              />
            </div>
            
            {/* Display actual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aula Actual (Compacto)
              </label>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <CurrentAulaDisplay />
              </div>
            </div>
          </div>
        </div>

        {/* Estados de carga y error */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faRefresh} className="animate-spin text-primary-darker" />
              <span className="text-gray-700">Cargando información de aulas...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 text-red-700">
              <FontAwesomeIcon icon={faChartBar} />
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {isTeacher ? 'Sí' : 'No'}
                  </div>
                  <div className="text-sm text-gray-600">Es Profesor</div>
                </div>
                <FontAwesomeIcon 
                  icon={faUsers} 
                  className={`text-2xl ${isTeacher ? 'text-green-500' : 'text-red-500'}`} 
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{aulas.length}</div>
                  <div className="text-sm text-gray-600">Aulas Disponibles</div>
                </div>
                <FontAwesomeIcon icon={faUniversity} className="text-2xl text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {enrolmentsByAula.reduce((total, aula) => total + aula.courses.length, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Cursos</div>
                </div>
                <FontAwesomeIcon icon={faBook} className="text-2xl text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Lista de aulas */}
        {aulas.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Aulas del Profesor ({aulas.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {aulas.map((aula) => (
                <div 
                  key={aula.aulaId} 
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedAula?.aulaId === aula.aulaId 
                      ? 'border-primary-darker bg-primary-light' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleAulaChange(aula)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">
                      {aula.aulaId.toUpperCase()}
                    </h3>
                    {selectedAula?.aulaId === aula.aulaId && (
                      <span className="bg-primary text-white text-xs px-2 py-1 rounded-full">
                        Actual
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {aula.aulaUrl}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Cursos:</span>
                    <span className="font-medium">{aula.coursesCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detalle del aula seleccionada */}
        {(selectedAulaForDetails || selectedAula) && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Cursos en {(selectedAulaForDetails || selectedAula)?.aulaId.toUpperCase()}
              </h2>
              <button 
                onClick={refreshAulas}
                className="flex items-center gap-2 px-3 py-1 text-sm text-primary-darker hover:text-primary"
              >
                <FontAwesomeIcon icon={faRefresh} />
                Actualizar
              </button>
            </div>
            
            {(() => {
              const aulaToShow = selectedAulaForDetails || selectedAula
              if (!aulaToShow) return null
              
              const courses = getCoursesForAula(aulaToShow.aulaId)
              
              if (courses.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    No hay cursos disponibles en esta aula
                  </div>
                )
              }
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {courses.map((course) => (
                    <div key={course.courseId} className="p-4 border rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">
                        {course.courseName}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Código:</span> {course.courseShortName}
                        </div>
                        <div>
                          <span className="font-medium">Grupo:</span> {course.groupName}
                        </div>
                        <div>
                          <span className="font-medium">ID:</span> {course.courseId}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Debug info */}
        <div className="bg-gray-100 rounded-lg p-4 mt-6">
          <h3 className="font-medium text-gray-700 mb-2">Debug Info</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Estado: {isLoading ? 'Cargando' : 'Listo'}</div>
            <div>Es profesor: {isTeacher ? 'Sí' : 'No'}</div>
            <div>Aulas cargadas: {aulas.length}</div>
            <div>Aula seleccionada: {selectedAula?.aulaId || 'Ninguna'}</div>
            <div>Error: {error || 'Ninguno'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}