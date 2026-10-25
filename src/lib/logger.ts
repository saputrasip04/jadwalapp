/// <reference types="vite/client" />
// src/lib/logger.ts

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

const MAX_LOGS = 500;
const logBuffer: LogEntry[] = [];

function addEntry(level: LogLevel, context: string, message: string, data?: unknown) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    data,
  };

  if (logBuffer.length >= MAX_LOGS) {
    logBuffer.shift();
  }
  logBuffer.push(entry);

  if (import.meta.env.DEV) {
    const style =
      level === 'ERROR'
        ? 'color: red; font-weight: bold;'
        : level === 'WARN'
        ? 'color: orange; font-weight: bold;'
        : level === 'INFO'
        ? 'color: dodgerblue;'
        : 'color: gray;';
    // eslint-disable-next-line no-console
    console.log(`%c[${entry.timestamp}] [${level}] [${context}] ${message}`, style, data ?? '');
  }
}

export const logger = {
  debug: (context: string, message: string, data?: unknown) => addEntry('DEBUG', context, message, data),
  info: (context: string, message: string, data?: unknown) => addEntry('INFO', context, message, data),
  warn: (context: string, message: string, data?: unknown) => addEntry('WARN', context, message, data),
  error: (context: string, message: string, data?: unknown) => addEntry('ERROR', context, message, data),
  getLogs: () => [...logBuffer],
  clear: () => {
    logBuffer.length = 0;
  },
  downloadLogs: () => {
    const blob = new Blob([JSON.stringify(logBuffer, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-penjadwal-smk-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
