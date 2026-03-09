/**
 * Structured JSON logger for debuggability.
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User signed in', { userId, method: 'email' });
 *   logger.error('Failed to fetch tenant data', { tenantId, error });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  ctx?: Record<string, unknown>;
}

function formatEntry(level: LogLevel, msg: string, ctx?: Record<string, unknown>): LogEntry {
  return {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx && Object.keys(ctx).length > 0 ? { ctx } : {}),
  };
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      ...(err.stack ? { stack: err.stack.split('\n').slice(0, 4).join('\n') } : {}),
    };
  }
  return { value: String(err) };
}

export const logger = {
  debug(msg: string, ctx?: Record<string, unknown>) {
    if (import.meta.env.DEV) {
      console.debug(JSON.stringify(formatEntry('debug', msg, ctx)));
    }
  },

  info(msg: string, ctx?: Record<string, unknown>) {
    console.log(JSON.stringify(formatEntry('info', msg, ctx)));
  },

  warn(msg: string, ctx?: Record<string, unknown>) {
    console.warn(JSON.stringify(formatEntry('warn', msg, ctx)));
  },

  error(msg: string, error?: unknown, ctx?: Record<string, unknown>) {
    const errorCtx = error ? { ...ctx, error: serializeError(error) } : ctx;
    console.error(JSON.stringify(formatEntry('error', msg, errorCtx)));
  },
};
