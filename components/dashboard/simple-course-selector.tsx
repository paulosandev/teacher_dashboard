'use client'

import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'

interface Course {
  id: string
  name: string
  shortname?: string
  fullname?: string
}

interface SimpleCourseSelectorProps {
  courses: Course[]
  onSelectionChange?: (courseId: string) => void
  selectedCourseId?: string | null
}

export default function SimpleCourseSelector({ 
  courses, 
  onSelectionChange, 
  selectedCourseId 
}: SimpleCourseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(selectedCourseId || null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Efecto para manejar cambios en selectedCourseId desde props
  useEffect(() => {
    if (selectedCourseId !== null) {
      setSelectedCourse(selectedCourseId)
    }
  }, [selectedCourseId])

  // Auto-seleccionar el primer curso al cargar si no hay uno seleccionado
  useEffect(() => {
    if (!hasAutoSelected && courses && courses.length > 0 && !selectedCourse) {
      const firstCourseId = courses[0].id
      console.log('🎯 Auto-seleccionando primer curso:', courses[0].name || courses[0].fullname)
      setSelectedCourse(firstCourseId)
      setHasAutoSelected(true)
      if (onSelectionChange) {
        onSelectionChange(firstCourseId)
      }
    }
  }, [courses, selectedCourse, onSelectionChange, hasAutoSelected])

  const handleCourseSelect = (courseId: string) => {
    setSelectedCourse(courseId)
    setIsOpen(false)
    
    if (onSelectionChange) {
      onSelectionChange(courseId)
    }
  }

  const getSelectedCourseName = () => {
    if (!selectedCourse) return 'Seleccionar curso'
    
    const course = courses.find(c => c.id === selectedCourse)
    return course ? (course.name || course.fullname || `Curso ${course.id}`) : 'Curso no encontrado'
  }

  if (!courses || courses.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No hay cursos disponibles
      </div>
    )
  }

  return (
    <div className="relative w-full min-w-[350px] max-w-[350px]" ref={dropdownRef}>
      <button
        type="button"
        className="relative w-full min-w-[350px] max-w-[350px] bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-3 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm"
        aria-haspopup="listbox"
        aria-expanded="true"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="block text-gray-900 whitespace-normal leading-tight">
          {getSelectedCourseName()}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <FontAwesomeIcon 
            icon={faChevronDown} 
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[350px] max-w-[350px] bg-white shadow-lg max-h-80 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
          {courses.map((course) => (
            <div
              key={course.id}
              className={`cursor-pointer select-none relative py-3 pl-3 pr-9 hover:bg-primary-selected transition-colors ${
                selectedCourse === course.id ? 'bg-primary-selected text-primary-darker' : 'text-gray-900'
              }`}
              onClick={() => handleCourseSelect(course.id)}
            >
              <div className="pr-8">
                <div className="font-medium text-sm whitespace-normal leading-tight">
                  {course.name || course.fullname}
                </div>
                {course.shortname && (
                  <div className="text-xs text-gray-500 mt-1 whitespace-normal">
                    {course.shortname}
                  </div>
                )}
              </div>
              
              {selectedCourse === course.id && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}