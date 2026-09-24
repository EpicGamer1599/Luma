import { describe, expect, it } from 'vitest';
import { allowedExternal, isTrustedSender, validateRequest } from '../electron/security';
import { demoVideos } from '../src/shared/demo';
describe('IPC validation and Electron security', () => {
  it('accepts valid operations and rejects arbitrary channels and malformed input', () => {
    expect(validateRequest({ op: 'history', video: demoVideos[0], position: 12 }).op).toBe(
      'history',
    );
    for (const request of [
      { op: 'exec', command: 'calc' },
      { op: 'settings', patch: { volume: NaN } },
      { op: 'settings', patch: { apiKey: 'secret' } },
      { op: 'video', id: '../etc/passwd' },
      { op: 'history', video: demoVideos[0], position: -1 },
      { op: 'playlistCreate', name: ' ' },
      { op: 'remove', list: 'playlist', id: demoVideos[0].id },
    ])
      expect(() => validateRequest(request)).toThrow();
  });
  it('rejects renderer-provided remote or executable thumbnail URLs', () => {
    expect(() =>
      validateRequest({
        op: 'watchLater',
        video: { ...demoVideos[0], thumbnail: 'javascript:alert(1)' },
      }),
    ).toThrow();
  });
  it('requires the app origin and the main frame', () => {
    expect(isTrustedSender('http://127.0.0.1:456/index.html', 'http://127.0.0.1:456', true)).toBe(
      true,
    );
    expect(isTrustedSender('http://127.0.0.1:457', 'http://127.0.0.1:456', true)).toBe(false);
    expect(isTrustedSender('http://127.0.0.1:456', 'http://127.0.0.1:456', false)).toBe(false);
    expect(isTrustedSender('https://youtube.com', 'http://127.0.0.1:456', true)).toBe(false);
  });
  it('limits external URLs to trusted HTTPS destinations', () => {
    expect(allowedExternal('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe(true);
    for (const url of [
      'file:///C:/Windows',
      'javascript:alert(1)',
      'https://github.com.evil.test',
      'https://user:pass@github.com',
      'https://github.com:999/x',
      'http://youtube.com',
    ])
      expect(allowedExternal(url)).toBe(false);
  });
});
