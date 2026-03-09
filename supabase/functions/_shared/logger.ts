/**
 * Structured JSON logger for edge functions.
 * Usage:
 *   import { logger } from '../_shared/logger.ts';
 *   logger.info('Processing request', { userId, action });
 *   logger.error('Graph API failed', { status: 500, tenantId });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  ctx?: Record<string, unknown>;
}

function fmt(level: LogLevel, msg: string, ctx?: Record<string, unknown>): string {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx && Object.keys(ctx).length > 0 ? { ctx } : {}),
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => console.debug(fmt('debug', msg, ctx)),
  info: (msg: string, ctx?: Record<string, unknown>) => console.log(fmt('info', msg, ctx)),
  warn: (msg: string, ctx?: Record<string, unknown>) => console.warn(fmt('warn', msg, ctx)),
  error: (msg: string, ctx?: Record<string, unknown>) => console.error(fmt('error', msg, ctx)),
};
