/**
 * Supabase Configuration
 * Creates and exports Supabase client for database operations
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, "../.env") });

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  console.error("❌ SUPABASE_URL is not set in environment variables");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is not set in environment variables");
  process.exit(1);
}

// Create Supabase client with service role key (for backend operations)
// Service role key bypasses RLS - we validate ownership in our code
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

console.log("✅ Supabase client initialized");

export default supabase;
