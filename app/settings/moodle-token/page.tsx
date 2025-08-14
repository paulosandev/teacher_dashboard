'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { AlertCircle, CheckCircle, Info, Key, Shield, Lock, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function MoodleTokenSettings() {
  const { data: session } = useSession()
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [message, setMessage] = useState('')
  
  // Campos para generación automática
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [autoGenLoading, setAutoGenLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('manual')

  useEffect(() => {
    // Verificar si ya existe un token
    checkExistingToken()
  }, [])

  const checkExistingToken = async () => {
    try {
      const response = await fetch('/api/user/moodle-token', {
        method: 'GET'
      })
      
      if (response.ok) {
        const data = await response.json()
        setHasToken(data.hasToken)
      }
    } catch (error) {
      console.error('Error verificando token:', error)
    }
  }

  const generateAutoToken = async () => {
    if (!username || !password) {
      setMessage('Por favor ingresa usuario y contraseña')
      return
    }

    setAutoGenLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/user/moodle-token/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setHasToken(true)
          setMessage('Token generado y guardado exitosamente')
          setUsername('')
          setPassword('')
          setActiveTab('manual')
          
          // Probar el token inmediatamente
          await testToken()
        } else {
          setMessage(data.error || 'Error al generar token')
        }
      } else {
        const error = await response.json()
        setMessage(error.error || 'Error al generar token')
      }
    } catch (error) {
      setMessage('Error al generar token')
    } finally {
      setAutoGenLoading(false)
    }
  }

  const saveToken = async () => {
    if (!token) {
      setMessage('Por favor ingresa un token')
      return
    }

    setLoading(true)
    setMessage('')
    
    try {
      const response = await fetch('/api/user/moodle-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })

      if (response.ok) {
        const data = await response.json()
        setHasToken(true)
        setMessage('Token guardado exitosamente')
        setToken('')
        
        // Probar el token inmediatamente
        await testToken()
      } else {
        const error = await response.json()
        setMessage(error.error || 'Error al guardar el token')
      }
    } catch (error) {
      setMessage('Error al guardar el token')
    } finally {
      setLoading(false)
    }
  }

  const testToken = async () => {
    setLoading(true)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/user/moodle-token/test', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        setTestResult(data)
      } else {
        const error = await response.json()
        setTestResult({ success: false, error: error.error })
      }
    } catch (error) {
      setTestResult({ success: false, error: 'Error al probar el token' })
    } finally {
      setLoading(false)
    }
  }

  const deleteToken = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar tu token de Moodle?')) {
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch('/api/user/moodle-token', {
        method: 'DELETE'
      })

      if (response.ok) {
        setHasToken(false)
        setMessage('Token eliminado exitosamente')
        setTestResult(null)
      } else {
        setMessage('Error al eliminar el token')
      }
    } catch (error) {
      setMessage('Error al eliminar el token')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">Configuración de Token Moodle</h1>
      
      <Card className="p-6 mb-6">
        <div className="flex items-start space-x-3 mb-4">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <h3 className="font-semibold">¿Por qué necesito un token personal?</h3>
            <p className="text-sm text-gray-600 mt-1">
              Tu token personal de Moodle permite al sistema acceder a la información completa 
              de tus cursos, incluyendo entregas de estudiantes, calificaciones y participación. 
              Sin él, algunas funciones pueden estar limitadas.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Key className="w-5 h-5 mr-2" />
              Token de API de Moodle
            </h2>
            
            {hasToken ? (
              <div className="space-y-4">
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-800 ml-2">
                    Token configurado correctamente
                  </span>
                </Alert>
                
                <div className="flex space-x-2">
                  <Button onClick={testToken} disabled={loading}>
                    Probar Token
                  </Button>
                  <Button onClick={deleteToken} variant="destructive" disabled={loading}>
                    Eliminar Token
                  </Button>
                </div>
              </div>
            ) : (
              <Tabs defaultValue={activeTab} className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Token Manual
                  </TabsTrigger>
                  <TabsTrigger value="auto" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Generar Automático
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="token">Token de API</Label>
                      <Input
                        id="token"
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Ingresa tu token de Moodle"
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        El token se encriptará antes de guardarse
                      </p>
                    </div>
                    
                    <Button onClick={saveToken} disabled={loading}>
                      {loading ? 'Guardando...' : 'Guardar Token'}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="auto" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Usuario o Matrícula</Label>
                      <Input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Tu usuario de Moodle"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Tu contraseña de Moodle"
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Tus credenciales se usarán solo para generar el token
                      </p>
                    </div>

                    <Button 
                      onClick={generateAutoToken} 
                      disabled={autoGenLoading}
                      className="w-full"
                    >
                      {autoGenLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generando...
                        </>
                      ) : (
                        <>Generar Token</>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>

          {message && (
            <Alert className={message.includes('exitosamente') ? 'bg-green-50' : 'bg-red-50'}>
              <AlertCircle className="h-4 w-4" />
              <span className="ml-2">{message}</span>
            </Alert>
          )}

          {testResult && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Resultado de la prueba:</h3>
              {testResult.success ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="ml-2">
                    <p className="text-green-800 font-semibold">Conexión exitosa</p>
                    {testResult.userInfo && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p>Usuario: {testResult.userInfo.fullname}</p>
                        <p>Email: {testResult.userInfo.email}</p>
                        <p>ID: {testResult.userInfo.id}</p>
                      </div>
                    )}
                    {testResult.coursesCount !== undefined && (
                      <p className="text-sm text-gray-600 mt-1">
                        Cursos como profesor: {testResult.coursesCount}
                      </p>
                    )}
                  </div>
                </Alert>
              ) : (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <div className="ml-2">
                    <p className="text-red-800 font-semibold">Error en la conexión</p>
                    <p className="text-sm text-gray-600 mt-1">{testResult.error}</p>
                  </div>
                </Alert>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Cómo obtener tu token de Moodle
            </h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Inicia sesión en Moodle</li>
              <li>Ve a tu perfil → Preferencias → Seguridad</li>
              <li>Busca "Tokens de servicio web" o "Web service tokens"</li>
              <li>Crea un nuevo token o copia uno existente</li>
              <li>Asegúrate de que tenga los permisos necesarios</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  )
}
