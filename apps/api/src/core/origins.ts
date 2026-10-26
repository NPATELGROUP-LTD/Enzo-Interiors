/** The browser origins the API answers: CORS, and the check on browser error reports. */
export const corsOrigins = (): string[] =>
  (process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:5175,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
