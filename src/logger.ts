import type { AuditLogEntry } from './types.js';

const logs: AuditLogEntry[] = [];

export function auditLog(entry: Omit<AuditLogEntry, 'ts'>): void {
  const full = { ...entry, ts: new Date().toISOString() } as AuditLogEntry;
  logs.push(full);
  console.log('[AUDIT]', JSON.stringify(full));
}

export function getAuditLogs(): readonly AuditLogEntry[] {
  return logs;
}

export function clearAuditLogs(): void {
  logs.length = 0;
}
