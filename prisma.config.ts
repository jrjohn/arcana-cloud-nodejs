// Prisma 7 configuration.
//
// Prisma 7 removed the `url`/`env()` datasource property from schema.prisma:
// the connection URL for Migrate (`prisma db push`, `prisma migrate`) now lives
// here, and the runtime PrismaClient is connected via a driver adapter (see
// src/di/container.ts). The URL is read from the environment rather than via
// Prisma's `env()` helper because the builder stage runs `prisma generate`
// without DATABASE_URL set, and `env()` throws on a missing variable.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
