// server/db.js
import { PrismaClient } from '@prisma/client'

// 單例：避免 dev 熱重載產生多個連線
const globalForPrisma = globalThis

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'], // 需要可加 'query'
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// 優雅關閉（可選）
const shutdown = async () => {
  try { await prisma.$disconnect() } finally { process.exit(0) }
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

export default prisma
