/**
 * Gestor de túnel SSH para conectar a base de datos RDS externa
 * Permite establecer conexión a través de servidor SSH intermedio
 */

import { createTunnel } from 'tunnel-ssh'
import { createConnection, Connection } from 'mysql2/promise'
import fs from 'fs'

interface SSHTunnelConfig {
  ssh: {
    host: string
    port: number
    username: string
    privateKeyPath?: string
    password?: string
  }
  database: {
    host: string
    port: number
    user: string
    password: string
    database: string
  }
  localPort?: number
}

class SSHTunnelManager {
  private tunnel: any | null = null
  private dbConnection: Connection | null = null
  private localPort: number = 33061 // Puerto local por defecto
  private isConnected: boolean = false

  constructor(private config: SSHTunnelConfig) {
    this.localPort = config.localPort || 33061
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('🔗 Túnel SSH ya está conectado')
      return
    }

    try {
      // Leer la clave privada si existe
      let privateKey: Buffer | undefined
      if (this.config.ssh.privateKeyPath) {
        privateKey = fs.readFileSync(this.config.ssh.privateKeyPath)
      }

      // Configuración del túnel
      const tunnelOptions = {
        autoClose: true,
        
        tunnelOptions: {
          autoClose: true
        },
        
        serverOptions: {
          host: '127.0.0.1',
          port: this.localPort
        },
        
        sshOptions: {
          host: this.config.ssh.host,
          port: this.config.ssh.port,
          username: this.config.ssh.username,
          privateKey: privateKey,
          password: this.config.ssh.password
        },
        
        forwardOptions: {
          srcAddr: '127.0.0.1',
          srcPort: this.localPort,
          dstAddr: this.config.database.host,
          dstPort: this.config.database.port
        }
      }

      console.log(`🔐 Conectando SSH a ${this.config.ssh.host}:${this.config.ssh.port}`)
      
      // Crear el túnel
      const [server, conn] = await createTunnel(
        tunnelOptions.tunnelOptions,
        tunnelOptions.serverOptions,
        tunnelOptions.sshOptions,
        tunnelOptions.forwardOptions
      )
      
      this.tunnel = { server, conn }
      
      console.log(`🌉 Túnel SSH creado: localhost:${this.localPort} -> ${this.config.database.host}:${this.config.database.port}`)
      
      // Crear conexión a la base de datos a través del túnel
      this.dbConnection = await createConnection({
        host: '127.0.0.1',
        port: this.localPort,
        user: this.config.database.user,
        password: this.config.database.password,
        database: this.config.database.database
      })

      console.log('💾 Conexión a base de datos establecida')
      this.isConnected = true
      
    } catch (error) {
      console.error('❌ Error estableciendo conexión:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.dbConnection) {
      await this.dbConnection.end()
      this.dbConnection = null
      console.log('💾 Conexión de base de datos cerrada')
    }

    if (this.tunnel) {
      if (this.tunnel.server) {
        this.tunnel.server.close()
      }
      if (this.tunnel.conn) {
        this.tunnel.conn.end()
      }
      this.tunnel = null
      console.log('🔑 Conexión SSH cerrada')
    }

    this.isConnected = false
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    if (!this.isConnected || !this.dbConnection) {
      await this.connect()
    }

    try {
      const [results] = await this.dbConnection!.execute(sql, params)
      return results as any[]
    } catch (error) {
      console.error('❌ Error ejecutando consulta:', error)
      throw error
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }
}

// Singleton para gestionar la conexión
let tunnelManager: SSHTunnelManager | null = null

export async function getSSHTunnelManager(): Promise<SSHTunnelManager> {
  if (!tunnelManager) {
    const config: SSHTunnelConfig = {
      ssh: {
        host: '44.233.107.237',
        port: 22,
        username: 'ec2-user',
        privateKeyPath: '/Users/paulocesarsanchezespindola/Downloads/status-services-v2 3 1.pem',
      },
      database: {
        host: 'wsdata.ce9oduyxts26.us-west-1.rds.amazonaws.com',
        port: 3306,
        user: 'datos',
        password: 'PP7Su9e433aNZP956',
        database: 'heroku_e6e033d354ff64c',
      },
      localPort: 33061,
    }

    tunnelManager = new SSHTunnelManager(config)
  }

  if (!tunnelManager.getConnectionStatus()) {
    await tunnelManager.connect()
  }

  return tunnelManager
}

export { SSHTunnelManager }
export type { SSHTunnelConfig }