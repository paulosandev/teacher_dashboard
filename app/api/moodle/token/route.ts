import { NextRequest, NextResponse } from 'next/server'

interface TokenRequest {
  username: string
  password: string
  aulaUrl: string
}

interface TokenResponse {
  success: boolean
  token?: string
  expiry?: Date
  error?: string
  userInfo?: {
    id: number
    username: string
    fullname: string
    email: string
  }
}

/**
 * Normalizar la URL base de Moodle
 * Quita /webservice/rest/server.php y asegura que no haya dobles /
 */
function normalizeBaseUrl(url: string): string {
  let normalized = url.replace(/\/webservice\/rest\/server\.php$/, '')
  normalized = normalized.replace(/\/+$/, '') // Quitar barras finales
  return normalized
}

/**
 * Procesar respuesta de Moodle que puede venir en JSON o urlencoded
 */
function processMoodleResponse(responseText: string): { token?: string; error?: string; errorcode?: string } {
  try {
    // Intentar parsear como JSON primero
    const jsonResponse = JSON.parse(responseText)
    return jsonResponse
  } catch {
    // Si no es JSON, intentar parsear como urlencoded
    if (responseText.includes('token=')) {
      const tokenMatch = responseText.match(/token=([^&\s]+)/)
      if (tokenMatch) {
        return { token: tokenMatch[1] }
      }
    }

    // Si contiene error en formato urlencoded
    if (responseText.includes('error=')) {
      const errorMatch = responseText.match(/error=([^&\s]+)/)
      return { error: errorMatch ? decodeURIComponent(errorMatch[1]) : 'Error desconocido' }
    }

    return { error: 'Respuesta inválida de Moodle' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenRequest = await request.json()
    const { username, password, aulaUrl } = body

    if (!username || !password || !aulaUrl) {
      return NextResponse.json(
        { success: false, error: 'Username, password y aulaUrl son requeridos' },
        { status: 400 }
      )
    }

    // Normalizar la URL base
    const baseUrl = normalizeBaseUrl(aulaUrl)
    const tokenUrl = `${baseUrl}/login/token.php`

    console.log(`[API] Obteniendo token de: ${tokenUrl} para usuario: ${username}`)
    console.log(`[API] Esta petición se hace desde el SERVIDOR Next.js, no desde el navegador`)
    console.log(`[API] IP del servidor Next.js: ${request.ip || 'localhost'}`)

    // Hacer la petición a Moodle desde el servidor
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PostmanRuntime/7.46.1',
        'Cookie': '__cf_bm=5FTYQcbvZ5go8QQ.16enDOUuxfzZN17025Wa5a9Ps1w-1758231052-1.0.1.1-7J5kmdZg2_ABMV8c7C7b4XZirvBGOL2N_YgkGcngdlydZ5651Xy.r9AudJQ2S1tcffMa.orhHQvAezoqNsM1vb2eVj4y9FXt7FXZlqGr.8M'
      },
      body: new URLSearchParams({
        username: username,
        password: password,
        service: 'moodle_mobile_app'
      }),
      cache: 'no-store' // No guardar credenciales en cache
    })

    if (!response.ok) {
      console.log(`[API] Error HTTP ${response.status}: ${response.statusText}`)
      return NextResponse.json({
        success: false,
        error: `Error HTTP ${response.status}: ${response.statusText}`
      } as TokenResponse)
    }

    const responseText = await response.text()
    console.log(`[API] Respuesta de Moodle: ${responseText.substring(0, 200)}...`)

    // Procesar la respuesta (JSON o urlencoded)
    const moodleData = processMoodleResponse(responseText)

    // Verificar si hay error en la respuesta
    if (moodleData.error || moodleData.errorcode) {
      const errorMessage = moodleData.error || `Error código: ${moodleData.errorcode}`
      console.log(`[API] Error de Moodle: ${errorMessage}`)
      return NextResponse.json({
        success: false,
        error: errorMessage
      } as TokenResponse)
    }

    // Verificar si tenemos token
    if (!moodleData.token) {
      console.log(`[API] No se recibió token en la respuesta`)
      return NextResponse.json({
        success: false,
        error: 'No se recibió token válido de Moodle'
      } as TokenResponse)
    }

    console.log(`[API] Token obtenido exitosamente`)

    // Obtener información del usuario con el token
    try {
      const userInfoUrl = `${baseUrl}/webservice/rest/server.php`
      const userInfoResponse = await fetch(userInfoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          wstoken: moodleData.token,
          wsfunction: 'core_webservice_get_site_info',
          moodlewsrestformat: 'json'
        }),
        cache: 'no-store'
      })

      let userInfo = undefined
      if (userInfoResponse.ok) {
        const userInfoData = await userInfoResponse.json()
        if (userInfoData.userid) {
          userInfo = {
            id: userInfoData.userid,
            username: userInfoData.username,
            fullname: userInfoData.fullname,
            email: userInfoData.useremail || ''
          }
          console.log(`[API] Info de usuario obtenida: ${userInfo.fullname}`)
        }
      }

      return NextResponse.json({
        success: true,
        token: moodleData.token,
        expiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
        userInfo
      } as TokenResponse)

    } catch (userInfoError) {
      console.warn(`[API] No se pudo obtener info del usuario:`, userInfoError)
      // Retornar el token aunque no tengamos info del usuario
      return NextResponse.json({
        success: true,
        token: moodleData.token,
        expiry: new Date(Date.now() + 60 * 60 * 1000)
      } as TokenResponse)
    }

  } catch (error) {
    console.error('[API] Error en endpoint /api/moodle/token:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}