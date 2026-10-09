import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/** Prisma CLI connection: migrations run through Supabase's session pooler. */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env --import tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
