/**
 * Hook personalizado para obtener datos de Moodle
 */

import { useState, useEffect } from 'react'

interface MoodleCourse {
  id: string
  name: string
  shortName: string
  groups: Array<{
    id: string
    name: string
  }>
}

interface UseMoodleDataResult {
  courses: MoodleCourse[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useMoodleData(enabled = false): UseMoodleDataResult {
  const [courses, setCourses] = useState<MoodleCourse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMoodleData = async () => {
    if (!enabled) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Primero verificar la conexión
      const testResponse = await fetch('/api/moodle?action=test')
      const testData = await testResponse.json()

      if (!testData.success) {
        throw new Error('No se pudo conectar con Moodle. Verifica la configuración.')
      }

      // Obtener cursos con grupos
      // Por ahora usamos userId=2, pero esto debería venir del usuario actual
      const coursesResponse = await fetch('/api/moodle?action=courses&userId=2')
      const coursesData = await coursesResponse.json()

      if (coursesData.success && coursesData.data) {
        setCourses(coursesData.data)
        console.log(`✅ Cargados ${coursesData.count} cursos desde Moodle`)
      } else {
        throw new Error('No se pudieron obtener los cursos')
      }
    } catch (err) {
      console.error('Error obteniendo datos de Moodle:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
      
      // En caso de error, usar datos mock como fallback
      setCourses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (enabled) {
      fetchMoodleData()
    }
  }, [enabled])

  return {
    courses,
    loading,
    error,
    refetch: fetchMoodleData,
  }
}
