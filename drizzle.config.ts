import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit auto-loads only .env, but this project uses .env.local
// (Next.js convention). Load it explicitly so DIRECT_URL resolves.
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  // Use DIRECT_URL (not pooler) for migrations
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
