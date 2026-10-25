// src/domain/time.ts

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const current = parseTimeToMinutes(timeStr);
  return formatMinutesToTime(current + minutesToAdd);
}

export function calculateDurationMinutes(startStr: string, endStr: string): number {
  return parseTimeToMinutes(endStr) - parseTimeToMinutes(startStr);
}
