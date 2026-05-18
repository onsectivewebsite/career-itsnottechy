import { config } from 'dotenv';
import path from 'node:path';

// Tests read .env if present, then .env.test overrides DATABASE_URL etc.
config({ path: path.resolve(process.cwd(), '.env'), override: false });
config({ path: path.resolve(process.cwd(), '.env.test'), override: true });

// Ensure tests never accidentally send real email.
process.env.EMAIL_TEST_MODE = 'true';
