/* eslint-disable no-console */

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(context: string, message: string, extra?: unknown) {
    console.log(`[${timestamp()}] [${context}] ${message}`, extra ?? "");
  },
  warn(context: string, message: string, extra?: unknown) {
    console.warn(`[${timestamp()}] [${context}] ${message}`, extra ?? "");
  },
  error(context: string, message: string, err?: unknown) {
    console.error(`[${timestamp()}] [${context}] ${message}`, err ?? "");
  },
};
