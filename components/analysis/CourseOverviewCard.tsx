'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Users, FileText, Activity, Calendar } from "lucide-react"

interface CourseOverviewProps {
  courseData: {
    courseStructure?: {
      totalSections: number
      sections: Array<{
        name: string
        visible: boolean
        moduleCount: number
        modules?: Array<{
          type: string
          name: string
          visible: boolean
        }>
      }>
    }
    overallStats?: {
      totalForums: number
      totalActivities: number
      totalResources: number
    }
    enrolledStudents?: number
    assignments?: Array<{
      name: string
      type: string
      section: string
      visible: boolean
    }>
  }
}

export function CourseOverviewCard({ courseData }: CourseOverviewProps) {
  const {
    courseStructure,
    overallStats,
    enrolledStudents = 0,
    assignments = []
  } = courseData

  const getActivityTypeIcon = (type: string) => {
    switch (type) {
      case 'assign':
        return <FileText className="h-4 w-4" />
      case 'quiz':
        return <Activity className="h-4 w-4" />
      case 'forum':
        return <Users className="h-4 w-4" />
      default:
        return <BookOpen className="h-4 w-4" />
    }
  }

  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'assign':
        return 'Tarea'
      case 'quiz':
        return 'Cuestionario'
      case 'forum':
        return 'Foro'
      case 'resource':
        return 'Recurso'
      case 'url':
        return 'Enlace'
      case 'page':
        return 'Página'
      default:
        return type
    }
  }

  if (!courseStructure && !overallStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Resumen del Curso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">
            No hay datos disponibles para mostrar
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas generales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Resumen del Curso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {enrolledStudents}
              </div>
              <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Users className="h-3 w-3" />
                Estudiantes
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {courseStructure?.totalSections || 0}
              </div>
              <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3" />
                Secciones
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {overallStats?.totalActivities || 0}
              </div>
              <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <Activity className="h-3 w-3" />
                Actividades
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {overallStats?.totalResources || 0}
              </div>
              <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                <BookOpen className="h-3 w-3" />
                Recursos
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estructura del curso por secciones */}
      {courseStructure && courseStructure.sections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Estructura del Curso ({courseStructure.totalSections} secciones)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {courseStructure.sections.map((section, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">
                      {section.name || `Sección ${index + 1}`}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={section.visible ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {section.visible ? "Visible" : "Oculta"}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {section.moduleCount} módulos
                      </span>
                    </div>
                  </div>
                  
                  {section.modules && section.modules.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {section.modules.slice(0, 6).map((module, modIndex) => (
                        <div 
                          key={modIndex}
                          className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded text-xs"
                        >
                          {getActivityTypeIcon(module.type)}
                          <span className="text-gray-600">
                            {getActivityTypeLabel(module.type)}
                          </span>
                        </div>
                      ))}
                      {section.modules.length > 6 && (
                        <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs text-gray-500">
                          +{section.modules.length - 6} más
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tareas y evaluaciones */}
      {assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tareas y Evaluaciones ({assignments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.map((assignment, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getActivityTypeIcon(assignment.type)}
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {assignment.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {assignment.section}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={assignment.visible ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {getActivityTypeLabel(assignment.type)}
                    </Badge>
                    {!assignment.visible && (
                      <span className="text-xs text-gray-400">Oculta</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
