import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Prisma CLI connection: migrations run through Supabase's session pooler. */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env --import tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` runs during npm install and does not connect to a database.
    // Keep installs/builds working when Vercel has not injected DIRECT_URL yet;
    // migrations still need the real DIRECT_URL at runtime.
    url: process.env.DIRECT_URL ?? "postgresql://generate:generate@localhost:5432/generate",
  },
});
