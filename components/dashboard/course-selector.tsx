'use client'

import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'

interface Course {
  id: string
  name: string
  shortName?: string
  groups: Group[]
}

interface Group {
  id: string
  name: string
}

interface CourseSelectorProps {
  courses: Course[]
  onSelectionChange?: (courseId: string, groupId: string) => void
}

export default function CourseSelector({ courses, onSelectionChange }: CourseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelect = (courseId: string, groupId: string) => {
    setSelectedCourse(courseId)
    setSelectedGroup(groupId)
    setIsOpen(false)
    
    if (onSelectionChange) {
      onSelectionChange(courseId, groupId)
    }
  }

  const getSelectedText = () => {
    if (!selectedCourse || !selectedGroup) {
      return 'Selecciona una materia y grupo'
    }

    const course = courses.find(c => c.id === selectedCourse)
    const group = course?.groups.find(g => g.id === selectedGroup)

    if (course && group) {
      return `${course.name} | ${group.name}`
    }

    return 'Selecciona una materia y grupo'
  }

  return (
    <div className="relative w-full sm:w-auto" ref={dropdownRef}>
      <label htmlFor="group-selector" className="sr-only">
        Seleccionar materia y grupo
      </label>
      <button
        id="group-selector"
        type="button"
        className="w-full min-w-[280px] max-w-[540px] sm:min-w-[320px] md:min-w-[400px] lg:w-[540px] bg-white border border-primary rounded-lg px-4 py-3 text-left text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 ease-in-out flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={!selectedCourse ? 'text-gray-400' : 'text-gray-700'}>
          {getSelectedText()}
        </span>
        <FontAwesomeIcon 
          icon={faChevronDown} 
          className={`w-5 h-5 text-primary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown options */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-primary rounded-lg shadow-lg">
          <ul className="py-1" role="listbox">
            {courses.map((course) => (
              course.groups.map((group) => {
                const isSelected = selectedCourse === course.id && selectedGroup === group.id
                return (
                  <li
                    key={`${course.id}-${group.id}`}
                    className={`px-4 py-3 cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-green-100 text-green-800 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(course.id, group.id)}
                  >
                    {course.name} | {group.name}
                  </li>
                )
              })
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
