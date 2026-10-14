import dotenv from 'dotenv';

// Mesmo servidor do .env, mas no banco sara_test (ou TEST_DATABASE_URL)
export function urlBancoDeTeste() {
  dotenv.config({ quiet: true });
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const url = new URL(process.env.DATABASE_URL ?? '');
  url.pathname = '/sara_test';
  return url.toString();
}
