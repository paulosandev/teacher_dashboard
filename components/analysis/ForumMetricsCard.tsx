'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { MessageSquare, Users, TrendingUp, AlertTriangle } from "lucide-react"

interface ForumMetric {
  forumName: string
  forumId: number
  type: string
  stats: {
    totalDiscussions: number
    totalPosts: number
    uniqueParticipants: number
    participationRate: number
    avgPostsPerDiscussion: number
  }
  hasActivity: boolean
  topDiscussions: Array<{
    name: string
    posts: number
    created: number
    lastPost?: number
  }>
}

interface ForumMetricsCardProps {
  forums: ForumMetric[]
  enrolledStudents: number
}

export function ForumMetricsCard({ forums, enrolledStudents }: ForumMetricsCardProps) {
  const getParticipationColor = (rate: number) => {
    if (rate >= 70) return 'text-green-600 bg-green-50 border-green-200'
    if (rate >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getParticipationIcon = (rate: number) => {
    if (rate >= 70) return <TrendingUp className="h-4 w-4" />
    if (rate >= 50) return <Users className="h-4 w-4" />
    return <AlertTriangle className="h-4 w-4" />
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('es-ES')
  }

  if (!forums || forums.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Análisis de Foros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">
            No se encontraron foros para analizar
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Análisis de Foros ({forums.length} foros)
        </CardTitle>
        <p className="text-sm text-gray-600">
          Participación de {enrolledStudents} estudiantes inscritos
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {forums.map((forum, index) => (
          <div key={forum.forumId} className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  {forum.forumName}
                </h4>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span>{forum.stats.totalDiscussions} discusiones</span>
                  <span>•</span>
                  <span>{forum.stats.totalPosts} mensajes</span>
                  <span>•</span>
                  <span>{forum.stats.uniqueParticipants} participantes</span>
                </div>
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${
                getParticipationColor(forum.stats.participationRate)
              }`}>
                {getParticipationIcon(forum.stats.participationRate)}
                {forum.stats.participationRate}%
              </div>
            </div>

            {/* Barra de progreso de participación */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Tasa de Participación</span>
                <span>{forum.stats.uniqueParticipants}/{enrolledStudents} estudiantes</span>
              </div>
              <Progress 
                value={forum.stats.participationRate} 
                className="h-2"
              />
            </div>

            {/* Actividad reciente */}
            {forum.hasActivity && forum.topDiscussions.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <h5 className="text-xs font-medium text-gray-700 mb-2">
                  Discusiones más activas:
                </h5>
                <div className="space-y-1">
                  {forum.topDiscussions.slice(0, 3).map((discussion, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 truncate flex-1">
                        {discussion.name}
                      </span>
                      <div className="flex items-center gap-2 text-gray-500">
                        <span>{discussion.posts} posts</span>
                        {discussion.lastPost && (
                          <span>• {formatDate(discussion.lastPost)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!forum.hasActivity && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Sin actividad</span>
                </div>
                <p className="text-red-500 text-xs mt-1">
                  Este foro no tiene discusiones activas
                </p>
              </div>
            )}

            {index < forums.length - 1 && (
              <hr className="border-gray-200" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
