// prisma.config.ts
import 'dotenv/config'                   // 先載入 .env
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  engine: 'classic',
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') }, // 這裡也提供，滿足 classic 的型別要求
})
