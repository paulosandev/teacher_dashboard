'use client'

import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, User, Key, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function MoodleLoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loginMethod, setLoginMethod] = useState<'unified' | 'separate'>('unified')
  
  // Campos del formulario
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [moodlePassword, setMoodlePassword] = useState('')

  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Paso 1: Autenticar en el sistema local
      const result = await signIn('credentials', {
        email: username,
        password: password,
        redirect: false
      })

      if (!result?.ok) {
        throw new Error('Credenciales inválidas')
      }

      setSuccess('✅ Autenticación exitosa')

      // Paso 2: Intentar obtener token de Moodle automáticamente
      try {
        const tokenResponse = await fetch('/api/auth/moodle-auto-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: password // Usar la misma contraseña
          }),
        })

        const tokenData = await tokenResponse.json()
        
        if (tokenData.success) {
          setSuccess('✅ Autenticación exitosa y token de Moodle configurado automáticamente')
        } else {
          // No es crítico si falla, el usuario puede configurarlo después
          console.log('Token de Moodle no configurado automáticamente')
        }
      } catch (error) {
        // Silenciosamente fallar, no es crítico
        console.log('No se pudo auto-configurar token de Moodle')
      }

      // Redirigir al dashboard
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)

    } catch (error: any) {
      setError(error.message || 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSeparateLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Paso 1: Autenticar en el sistema local
      const result = await signIn('credentials', {
        email: username,
        password: password,
        redirect: false
      })

      if (!result?.ok) {
        throw new Error('Credenciales locales inválidas')
      }

      setSuccess('✅ Autenticación local exitosa')

      // Paso 2: Si se proporcionó contraseña de Moodle, intentar obtener token
      if (moodlePassword) {
        const tokenResponse = await fetch('/api/auth/moodle-auto-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: moodlePassword
          }),
        })

        const tokenData = await tokenResponse.json()
        
        if (tokenData.success) {
          setSuccess('✅ Token de Moodle configurado exitosamente')
        } else {
          setError('Contraseña de Moodle incorrecta, pero puedes configurarla después')
        }
      }

      // Redirigir al dashboard
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)

    } catch (error: any) {
      setError(error.message || 'Error al iniciar sesión')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Iniciar Sesión</h2>
          <p className="text-sm text-gray-600">
            Accede al Dashboard Académico UTEL
          </p>
        </div>

        {/* Selector de método de login */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setLoginMethod('unified')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              loginMethod === 'unified'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Login Unificado
          </button>
          <button
            type="button"
            onClick={() => setLoginMethod('separate')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              loginMethod === 'separate'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Login Separado
          </button>
        </div>

        {/* Formulario Unificado */}
        {loginMethod === 'unified' && (
          <form onSubmit={handleUnifiedLogin} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Login Unificado:</strong> Usa las mismas credenciales para el dashboard y Moodle
              </p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Usuario / Email / Matrícula
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="cesar.espindola"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </Button>
          </form>
        )}

        {/* Formulario Separado */}
        {loginMethod === 'separate' && (
          <form onSubmit={handleSeparateLogin} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Login Separado:</strong> Usa credenciales diferentes para el dashboard y Moodle
              </p>
            </div>

            <div>
              <label htmlFor="username2" className="block text-sm font-medium text-gray-700 mb-1">
                Usuario del Dashboard
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="username2"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="cesar.espindola"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password2" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña del Dashboard
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="password2"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="moodlePassword" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña de Moodle (Opcional)
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  id="moodlePassword"
                  type="password"
                  value={moodlePassword}
                  onChange={(e) => setMoodlePassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dejar vacío para configurar después"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Si no ingresas tu contraseña de Moodle, podrás configurarla después
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Iniciar Sesión
                </>
              )}
            </Button>
          </form>
        )}

        {/* Mensajes de error/éxito */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="text-center text-sm text-gray-600">
          <p>
            ¿Problemas para acceder?{' '}
            <a href="#" className="text-blue-600 hover:text-blue-700">
              Contacta soporte
            </a>
          </p>
        </div>
      </div>
    </Card>
  )
}
