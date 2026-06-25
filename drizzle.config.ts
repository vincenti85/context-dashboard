import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  // Use DIRECT_URL (not pooler) for migrations
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
});
