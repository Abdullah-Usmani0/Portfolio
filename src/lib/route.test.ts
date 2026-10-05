import { describe, expect, it } from 'vitest';
import { isCvRoute } from './route.ts';

describe('the CV route', () => {
  it('opens on #cv or a /cv path, and nowhere else', () => {
    expect(isCvRoute({ hash: '#cv', pathname: '/' })).toBe(true);
    expect(isCvRoute({ hash: '', pathname: '/cv' })).toBe(true);
    expect(isCvRoute({ hash: '', pathname: '/portfolio/cv/' })).toBe(true);
    expect(isCvRoute({ hash: '#councils', pathname: '/' })).toBe(false);
    expect(isCvRoute({ hash: '#cvs', pathname: '/' })).toBe(false);
    expect(isCvRoute({ hash: '', pathname: '/cv/extra' })).toBe(false);
  });
});
