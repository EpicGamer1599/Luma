import type { Request } from '../shared/types';
export async function api<T = unknown>(request: Request): Promise<T> {
  if (!window.luma) throw new Error('Open Luma as a desktop app using npm run dev.');
  const reply = await window.luma.request<T>(request);
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}
export const compact = (n: number) =>
  Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export function duration(seconds: number) {
  const n = Math.floor(seconds);
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
export function dateLabel(date: string) {
  if (!date || Number.isNaN(Date.parse(date))) return 'Date unavailable';
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
