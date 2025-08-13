'use client'

import React, { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, Key, Loader2, X, ExternalLink, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TokenStatus {
  hasToken: boolean
  isActive?: boolean
  isValid?: boolean
  moodleUsername?: string
  moodleUserId?: number
  createdAt?: string
  updatedAt?: string
  expiresAt?: string
  hasCapabilities?: boolean
}

export function MoodleTokenConfig() {
  const [isOpen, setIsOpen] = useState(false)
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)

  // Verificar el estado del token al cargar
  useEffect(() => {
    checkTokenStatus()
  }, [])

  const checkTokenStatus = async () => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/user/moodle-token')
      const data = await response.json()
      setTokenStatus(data)
    } catch (error) {
      console.error('Error verificando token:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/user/moodle-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ moodleToken: token }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al configurar token')
      }

      setSuccess(`Token configurado exitosamente para ${data.moodleFullName}`)
      setToken('')
      setIsOpen(false)
      
      // Recargar el estado del token
      await checkTokenStatus()
      
      // Recargar la página después de 2 segundos para actualizar todo
      setTimeout(() => {
        window.location.reload()
      }, 2000)
      
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveToken = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar tu token de Moodle?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/user/moodle-token', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Error al eliminar token')
      }

      setSuccess('Token eliminado exitosamente')
      await checkTokenStatus()
      
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isChecking) {
    return (
      <div className="flex items-center space-x-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Verificando configuración de Moodle...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Estado actual del token */}
      {tokenStatus?.hasToken && tokenStatus.isActive && (
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Key className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold">Token de Moodle Configurado</h3>
                {tokenStatus.isValid ? (
                  <Badge className="bg-green-100 text-green-800">Activo</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">Inválido</Badge>
                )}
              </div>
              
              {tokenStatus.moodleUsername && (
                <p className="text-sm text-gray-600">
                  Usuario de Moodle: <strong>{tokenStatus.moodleUsername}</strong> (ID: {tokenStatus.moodleUserId})
                </p>
              )}
              
              {tokenStatus.updatedAt && (
                <p className="text-sm text-gray-500">
                  Última actualización: {new Date(tokenStatus.updatedAt).toLocaleString()}
                </p>
              )}

              {!tokenStatus.isValid && (
                <div className="flex items-center space-x-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">El token parece estar inválido o expirado. Actualízalo.</span>
                </div>
              )}
            </div>
            
            <div className="flex space-x-2">
              <Button
                onClick={() => setIsOpen(true)}
                variant="outline"
                size="sm"
              >
                Actualizar
              </Button>
              <Button
                onClick={handleRemoveToken}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                disabled={isLoading}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Botón para configurar token si no hay uno */}
      {(!tokenStatus?.hasToken || !tokenStatus?.isActive) && (
        <Card className="p-6 border-dashed border-2 border-gray-300 bg-gray-50">
          <div className="text-center space-y-3">
            <Key className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-700">
              Configura tu Token de Moodle
            </h3>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Para acceder a tus cursos y análisis de Moodle, necesitas configurar tu token personal de API.
            </p>
            <Button onClick={() => setIsOpen(true)} className="mt-4">
              <Key className="h-4 w-4 mr-2" />
              Configurar Token
            </Button>
          </div>
        </Card>
      )}

      {/* Mensajes de éxito/error */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-2">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Modal de configuración */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-semibold">Configurar Token de Moodle</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Instrucciones */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start space-x-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold text-blue-900">
                      ¿Cómo obtener tu token de Moodle?
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-blue-800">
                      <li>Accede a tu cuenta de Moodle UTEL</li>
                      <li>Ve a tu perfil → Preferencias → Seguridad</li>
                      <li>Busca &quot;Claves de seguridad&quot; o &quot;Web service tokens&quot;</li>
                      <li>Genera un nuevo token con los siguientes permisos:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li>core_enrol_get_users_courses</li>
                          <li>core_enrol_get_enrolled_users</li>
                          <li>mod_assign_get_submissions</li>
                          <li>mod_assign_get_assignments</li>
                          <li>mod_forum_get_forums_by_courses</li>
                          <li>core_course_get_contents</li>
                        </ul>
                      </li>
                      <li>Copia el token generado y pégalo aquí</li>
                    </ol>
                    <p className="text-blue-700 mt-2">
                      <strong>Nota:</strong> Tu token se encriptará antes de guardarse y solo tú podrás usarlo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
                    Token de API de Moodle
                  </label>
                  <input
                    type="password"
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Pega tu token aquí..."
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Botones */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || !token.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Guardar Token
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Link de ayuda */}
              <div className="text-center pt-4 border-t">
                <a
                  href="https://docs.moodle.org/en/Using_web_services"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Más información sobre tokens de Moodle
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
