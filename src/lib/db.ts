import { neon } from '@neondatabase/serverless';

// Check for database URL in different environments
const databaseUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  console.error('No database URL found. Please set NETLIFY_DATABASE_URL, DATABASE_URL, or NEON_DATABASE_URL environment variable');
}

const sql = databaseUrl ? neon(databaseUrl) : null;

export default sql; 