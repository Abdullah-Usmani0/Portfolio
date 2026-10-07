import { describe, expect, it } from 'vitest';
import { pageOf, sectionOf, valleyPath } from './route.ts';

const at = (hash: string, pathname = '/') => ({ hash, pathname });

describe('pages', () => {
  it('opens the CV on #cv or a /cv path', () => {
    expect(pageOf(at('#cv'))).toBe('cv');
    expect(pageOf(at('', '/cv'))).toBe('cv');
    expect(pageOf(at('', '/portfolio/cv/'))).toBe('cv');
  });

  it('opens How it works on #systems, at a system, or on a /systems path', () => {
    expect(pageOf(at('#systems'))).toBe('systems');
    expect(pageOf(at('#systems/councils'))).toBe('systems');
    expect(pageOf(at('', '/systems'))).toBe('systems');
    expect(pageOf(at('#systems', '/cv'))).toBe('systems');
  });

  it('shows the valley everywhere else, dive addresses included', () => {
    expect(pageOf(at(''))).toBe('valley');
    expect(pageOf(at('#councils'))).toBe('valley');
    expect(pageOf(at('#councils/skillops'))).toBe('valley');
    expect(pageOf(at('#cvs'))).toBe('valley');
    expect(pageOf(at('', '/cv/extra'))).toBe('valley');
  });

  it('leaves a /cv address for the valley once a hash names somewhere else', () => {
    // The old Back link made /cv#top, which still matched the CV, so the CV never closed.
    expect(pageOf(at('#top', '/cv'))).toBe('valley');
  });

  it('reads the system a page opens at', () => {
    expect(sectionOf({ hash: '#systems/voice' })).toBe('voice');
    expect(sectionOf({ hash: '#systems' })).toBeUndefined();
    expect(sectionOf({ hash: '#councils/town' })).toBeUndefined();
  });

  it('finds the valley from any page address', () => {
    expect(valleyPath({ pathname: '/cv', search: '' })).toBe('/');
    expect(valleyPath({ pathname: '/cv/', search: '?test=1' })).toBe('/?test=1');
    expect(valleyPath({ pathname: '/systems', search: '' })).toBe('/');
    expect(valleyPath({ pathname: '/portfolio/cv', search: '' })).toBe('/portfolio/');
    expect(valleyPath({ pathname: '/', search: '' })).toBe('/');
  });
});
