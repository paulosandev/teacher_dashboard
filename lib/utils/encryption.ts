/**
 * Utilidades para encriptar y desencriptar datos sensibles
 */

import crypto from 'crypto'

// Usa una clave de encriptación desde las variables de entorno
// Si no existe, genera una por defecto (en producción debe venir del env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  crypto.createHash('sha256').update('default-key-change-in-production').digest()

const IV_LENGTH = 16 // Para AES, esto es siempre 16

/**
 * Encripta un texto usando AES-256-CBC
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv
  )
  
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  
  // Retorna iv:encrypted en base64
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

/**
 * Desencripta un texto encriptado con la función encrypt
 */
export function decrypt(text: string): string {
  const textParts = text.split(':')
  const iv = Buffer.from(textParts.shift()!, 'hex')
  const encryptedText = Buffer.from(textParts.join(':'), 'hex')
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv
  )
  
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  
  return decrypted.toString()
}

/**
 * Hashea una contraseña usando bcrypt (para comparación)
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.hash(password, 10)
}

/**
 * Compara una contraseña con su hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.compare(password, hash)
}
