import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  // Comma-separated list so one env var can cover a production frontend domain
  // plus localhost during local testing against a deployed backend.
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  databaseUrl: required("DATABASE_URL"),
  youtubeApiKey: process.env.YOUTUBE_API_KEY || null,
};
