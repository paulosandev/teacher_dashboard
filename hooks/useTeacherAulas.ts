/**
 * Hook para gestionar las aulas del profesor
 * Obtiene y maneja la lista de aulas donde el profesor está enrolado
 */

import { useState, useEffect, useCallback } from 'react'

export interface AulaInfo {
  aulaId: string
  aulaUrl: string
  coursesCount: number
}

export interface EnrolmentInfo {
  aulaId: string
  aulaUrl: string
  courses: {
    courseId: string
    courseName: string
    courseShortName: string
    groupId: string
    groupName: string
  }[]
}

interface UseTeacherAulasResult {
  aulas: AulaInfo[]
  selectedAula: AulaInfo | null
  enrolmentsByAula: EnrolmentInfo[]
  isLoading: boolean
  error: string | null
  isTeacher: boolean
  selectAula: (aulaId: string) => void
  refreshAulas: () => Promise<void>
  getCoursesForAula: (aulaId: string) => any[]
}

export function useTeacherAulas(): UseTeacherAulasResult {
  const [aulas, setAulas] = useState<AulaInfo[]>([])
  const [selectedAula, setSelectedAula] = useState<AulaInfo | null>(null)
  const [enrolmentsByAula, setEnrolmentsByAula] = useState<EnrolmentInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTeacher, setIsTeacher] = useState(false)

  // Cargar aulas del profesor
  const loadAulas = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 Cargando aulas del profesor...')
      
      // Primero verificar si es profesor
      const checkResponse = await fetch('/api/enrolments/check-teacher')
      const checkData = await checkResponse.json()
      
      if (!checkData.success) {
        throw new Error('No se pudo verificar el rol del usuario')
      }
      
      setIsTeacher(checkData.isTeacher)
      
      if (!checkData.isTeacher) {
        console.log('⚠️ El usuario no es profesor')
        setAulas([])
        setEnrolmentsByAula([])
        return
      }
      
      // Obtener enrolments del profesor
      const response = await fetch('/api/enrolments/my-enrolments')
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error obteniendo aulas')
      }
      
      console.log(`✅ Encontradas ${data.aulasCount} aulas para el profesor`)
      
      setAulas(data.aulas || [])
      setEnrolmentsByAula(data.enrolmentsByAula || [])
      
      // Seleccionar automáticamente la primera aula si hay alguna
      if (data.aulas && data.aulas.length > 0 && !selectedAula) {
        const defaultAula = data.aulas.find((a: AulaInfo) => a.aulaId === 'av141') || data.aulas[0]
        setSelectedAula(defaultAula)
        
        // Guardar en localStorage la última aula seleccionada
        localStorage.setItem('lastSelectedAula', defaultAula.aulaId)
      }
      
    } catch (error) {
      console.error('❌ Error cargando aulas:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [selectedAula])

  // Seleccionar una aula específica
  const selectAula = useCallback((aulaId: string) => {
    const aula = aulas.find(a => a.aulaId === aulaId)
    
    if (aula) {
      console.log(`📍 Seleccionando aula: ${aulaId} (${aula.aulaUrl})`)
      setSelectedAula(aula)
      
      // Guardar en localStorage
      localStorage.setItem('lastSelectedAula', aulaId)
    }
  }, [aulas])

  // Obtener cursos para una aula específica
  const getCoursesForAula = useCallback((aulaId: string) => {
    const aulaData = enrolmentsByAula.find(e => e.aulaId === aulaId)
    return aulaData?.courses || []
  }, [enrolmentsByAula])

  // Cargar aulas al montar el componente
  useEffect(() => {
    loadAulas()
  }, []) // Solo cargar una vez al montar

  // Restaurar última aula seleccionada
  useEffect(() => {
    if (aulas.length > 0 && !selectedAula) {
      const lastAulaId = localStorage.getItem('lastSelectedAula')
      
      if (lastAulaId) {
        const aula = aulas.find(a => a.aulaId === lastAulaId)
        if (aula) {
          setSelectedAula(aula)
        } else {
          // Si no existe la última aula guardada, seleccionar la primera
          setSelectedAula(aulas[0])
        }
      } else {
        // Preferir av141 si existe, sino la primera
        const defaultAula = aulas.find(a => a.aulaId === 'av141') || aulas[0]
        setSelectedAula(defaultAula)
      }
    }
  }, [aulas, selectedAula])

  return {
    aulas,
    selectedAula,
    enrolmentsByAula,
    isLoading,
    error,
    isTeacher,
    selectAula,
    refreshAulas: loadAulas,
    getCoursesForAula
  }
}

/**
 * Hook para obtener cursos de Moodle considerando el aula seleccionada
 */
export function useAulaCourses(aulaUrl: string | null) {
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCourses = useCallback(async () => {
    if (!aulaUrl) {
      setCourses([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log(`📚 Cargando cursos desde: ${aulaUrl}`)
      
      // Extraer el dominio del aula (ej: av141, aula101)
      const match = aulaUrl.match(/https:\/\/([^.]+)\.utel\.edu\.mx/)
      const aulaDomain = match ? match[1] : null
      
      if (!aulaDomain) {
        throw new Error('URL de aula inválida')
      }
      
      // Actualizar la variable de entorno de Moodle temporalmente
      // Nota: Esto requiere modificar el cliente de Moodle para aceptar URL dinámica
      const response = await fetch('/api/moodle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wsfunction: 'core_course_get_courses_by_field',
          moodlewsrestformat: 'json',
          aulaUrl: aulaUrl // Pasar la URL del aula
        })
      })
      
      if (!response.ok) {
        throw new Error('Error obteniendo cursos')
      }
      
      const data = await response.json()
      
      if (data.courses) {
        console.log(`✅ Encontrados ${data.courses.length} cursos en ${aulaDomain}`)
        setCourses(data.courses)
      } else {
        setCourses([])
      }
      
    } catch (error) {
      console.error('❌ Error cargando cursos:', error)
      setError(error instanceof Error ? error.message : 'Error desconocido')
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [aulaUrl])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  return {
    courses,
    loading,
    error,
    refresh: loadCourses
  }
}