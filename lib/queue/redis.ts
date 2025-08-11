import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// Crear conexión singleton de Redis
let redis: Redis | null = null

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
    
    redis.on('error', (error) => {
      console.error('Redis connection error:', error)
    })
    
    redis.on('connect', () => {
      console.log('Connected to Redis')
    })
  }
  
  return redis
}

export default getRedisClient()
