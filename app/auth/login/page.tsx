'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faLock, faIdCard, faSpinner, faExclamationCircle, faPencilAlt } from '@fortawesome/free-solid-svg-icons'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    matricula: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        matricula: formData.matricula,
        redirect: false,
      })

      if (result?.error) {
        setError('Credenciales inválidas. Por favor verifique sus datos.')
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError('Ocurrió un error inesperado. Por favor intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-[0px_4px_10px_rgba(0,0,0,0.2)] p-8">
          {/* Logo y título */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full flex items-center justify-center">
                <svg width="88" height="80" viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M3.26005 34.0251C4.78217 36.5589 8.34627 37.444 12.8283 37.8094C17.2917 38.0904 22.6636 37.8562 27.3705 36.2779L33.9648 33.9923C38.6529 32.414 42.0484 28.9436 42.9944 24.0681C43.9639 19.2816 42.484 13.0995 38.0159 8.11628C33.6416 3.06284 27.4267 0.412006 22.3732 0.112265C17.2167 -0.215577 13.2311 1.81704 10.8847 5.48418C9.76068 7.19832 8.63665 8.91247 7.50794 10.6266C5.15216 14.3125 3.86889 19.0428 2.94626 23.3375C2.12197 27.6556 1.66299 31.5382 3.26005 34.0204"
                    fill="#C3EA1B"
                  />
                  <path
                    d="M18.6923 1.89203C13.5311 4.20565 8.74463 7.26394 4.478 10.9732C1.00757 14.1065 -0.795562 16.6496 0.337833 19.38C0.824912 20.6492 1.37756 21.97 1.99578 23.3375C3.32119 26.2272 6.74479 29.3464 9.79372 32.3532C12.9691 35.3084 15.7792 38.1466 18.6876 39.3877C21.5867 40.6195 24.8089 40.0247 28.4339 37.313C31.9418 34.6574 35.8478 29.8944 37.3043 24.0213C37.9881 21.3283 38.5407 18.5932 38.9623 15.8066C39.9598 9.78364 37.6743 4.43514 33.7543 1.91076C29.8342 -0.726023 24.2843 -0.538685 18.6876 1.88734"
                    fill="#45AB0F"
                  />
                  <path
                    d="M25.3989 20.0029V21.5672C25.3989 21.6936 25.3942 21.8248 25.3802 21.9512C25.3099 22.7287 25.0242 23.4687 24.5559 24.0962C24.4294 24.2695 24.2889 24.4335 24.1391 24.5833C23.3429 25.3889 22.2563 25.8432 21.1276 25.8432C19.9942 25.8432 18.9123 25.3889 18.1161 24.5833C17.9663 24.4288 17.8258 24.2695 17.6993 24.0962C17.231 23.4733 16.9453 22.7287 16.875 21.9512C16.8657 21.8248 16.8563 21.6983 16.8563 21.5672V10.2754H12.9643V21.5625C12.9643 21.689 12.9643 21.8201 12.9737 21.9465C13.0393 23.3235 13.4561 24.6629 14.182 25.8385C14.8565 26.9204 15.7744 27.8336 16.8563 28.5127C19.4743 30.1379 22.7855 30.1379 25.3989 28.5127C26.4808 27.8383 27.3941 26.9204 28.0732 25.8385C28.7991 24.6676 29.2159 23.3282 29.2815 21.9465C29.2862 21.8201 29.2908 21.689 29.2908 21.5625V10.2754H25.3989V20.0029Z"
                    fill="white"
                  />
                </svg>
              </div>
            </div>
            
            <div className="inline-flex items-center gap-2 bg-primary-light text-green-800 px-4 py-2 rounded-md text-sm font-medium mb-4">
              <FontAwesomeIcon icon={faPencilAlt} className="w-4 h-4 text-icon-dark" />
              Portal docente
            </div>
            
            <h2 className="text-2xl font-bold text-primary-darker">
              Sistema de Análisis Académico
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Ingrese sus credenciales para acceder al portal
            </p>
          </div>
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
                <FontAwesomeIcon icon={faExclamationCircle} className="mr-2" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FontAwesomeIcon icon={faUser} className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:z-10 sm:text-sm transition-colors duration-200"
                    placeholder="profesor@ejemplo.com"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FontAwesomeIcon icon={faLock} className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:z-10 sm:text-sm transition-colors duration-200"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="matricula" className="block text-sm font-medium text-gray-700 mb-1">
                  Matrícula
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FontAwesomeIcon icon={faIdCard} className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="matricula"
                    name="matricula"
                    type="text"
                    autoComplete="off"
                    required
                    value={formData.matricula}
                    onChange={handleChange}
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary focus:z-10 sm:text-sm transition-colors duration-200"
                    placeholder="Matrícula de Moodle"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </div>
          </form>
          
          {/* Credenciales de prueba para desarrollo */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 p-4 bg-primary-selected rounded-lg border border-primary-light">
              <p className="text-xs text-primary-darker font-semibold mb-2">Credenciales de prueba:</p>
              <div className="text-xs text-primary-dark space-y-1">
                <p>📧 Email: mail.paulo@gmail.com</p>
                <p>🔐 Password: admin1234</p>
                <p>🆔 Matrícula: paulo.cesar</p>
                <hr className="my-2 border-primary-light" />
                <p>📧 Email: cesar.espindola@utel.edu.mx</p>
                <p>🔐 Password: admin1234</p>
                <p>🆔 Matrícula: cesar.espindola</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          © 2024 Sistema de Análisis Académico. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}
