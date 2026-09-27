// Runs before every test file (see jest.config.js's setupFilesAfterEnv).
// Several modules read required env vars at import time (e.g. lib/tokens.ts
// throws immediately if JWT_ACCESS_SECRET is missing) - this has to set
// them before any test file's own imports run, which setupFilesAfterEnv
// guarantees. Real values (DATABASE_URL, REDIS_URL) come from CI's service
// containers when set; these are just fallbacks for values that don't need
// to point at anything real for the pure unit tests.
process.env.JWT_ACCESS_SECRET ||= 'test-only-secret-do-not-use-in-production';
process.env.ACCESS_TOKEN_TTL_MINUTES ||= '15';
process.env.REFRESH_TOKEN_TTL_DAYS ||= '7';
process.env.DATABASE_URL ||= 'postgresql://postgres:postgres@localhost:5432/workmgmt_test?schema=public';
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.FRONTEND_URL ||= 'http://localhost:5173';
