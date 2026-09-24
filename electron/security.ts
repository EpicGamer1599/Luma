import { requestSchema, type Request } from '../src/shared/types';
export function validateRequest(input: unknown): Request {
  const result = requestSchema.safeParse(input);
  if (!result.success)
    throw new Error('That request is invalid. Please check your input and try again.');
  const r = result.data;
  if ((r.op === 'remove' || r.op === 'reorder') && r.list === 'playlist' && !r.playlistId)
    throw new Error('Choose a playlist.');
  return r;
}
export function isTrustedSender(url: string, origin: string, isMainFrame: boolean): boolean {
  try {
    return isMainFrame && new URL(url).origin === origin;
  } catch {
    return false;
  }
}
export function allowedExternal(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      [
        'www.youtube.com',
        'youtube.com',
        'youtu.be',
        'github.com',
        'console.cloud.google.com',
        'developers.google.com',
        'policies.google.com',
      ].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
