// Shared helpers for E2E tests.
// Usage: TEST_ENV=local|dev|prod vitest run tests/e2e/
import dotenv from 'dotenv';
dotenv.config({ quiet: true } as Parameters<typeof dotenv.config>[0]);

export function getBaseUrl(): string {
  const env = process.env.TEST_ENV || 'local';
  switch (env) {
    case 'prod':
      return 'https://dhugs.com';
    case 'dev':
      return 'https://dev.dhugs.com';
    case 'local':
    default:
      return 'http://localhost:3000';
  }
}

export function getAdminToken(): string | undefined {
  return process.env.ADMIN_API_TOKEN;
}

export function isHeadless(): boolean {
  return process.env.HEADED !== '1' && process.env.HEADED !== 'true';
}
