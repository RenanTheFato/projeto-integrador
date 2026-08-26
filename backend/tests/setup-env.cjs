// Loaded by Jest before every test file. `src/config/env.ts` validates
// process.env with zod as soon as it is imported, so anything that pulls it
// in transitively (directly, or through the real AiClient) needs these set
// even though the tests never touch a real database or JWT secret.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test"
process.env.JWT_SECRET ??= "test-jwt-secret-at-least-32-characters-long"
