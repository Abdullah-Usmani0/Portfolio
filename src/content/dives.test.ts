import { describe, expect, it } from 'vitest';
import { ANCHOR_IDS } from '@/world/anchorIds.ts';
import { DIVES } from './dives.ts';
import * as site from './site.ts';

/** Every string in a value, however deeply nested. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('dives', () => {
  it('fly only to anchors their scene registers', () => {
    for (const dive of Object.values(DIVES)) {
      const known: readonly string[] = ANCHOR_IDS[dive.scene as keyof typeof ANCHOR_IDS] ?? [];
      for (const step of dive.steps) if (step.focus) expect(known, `${dive.scene}/${step.id}`).toContain(step.focus);
      for (const pin of dive.pins ?? []) expect(known, `${dive.scene} pin`).toContain(pin.anchor);
      for (const step of dive.steps) for (const label of step.labels ?? []) expect(known, `${dive.scene}/${step.id} label`).toContain(label.anchor);
    }
  });

  it('pin labels open steps that exist, and step ids are unique', () => {
    for (const dive of Object.values(DIVES)) {
      const ids = dive.steps.map((s) => s.id);
      expect(new Set(ids).size, dive.scene).toBe(ids.length);
      for (const pin of dive.pins ?? []) expect(ids).toContain(pin.step);
    }
  });

  it('give every step a title and a line', () => {
    for (const dive of Object.values(DIVES)) {
      for (const step of dive.steps) {
        expect(step.title.trim().length, `${dive.scene}/${step.id}`).toBeGreaterThan(2);
        expect(step.line.trim().length, `${dive.scene}/${step.id}`).toBeGreaterThan(10);
      }
    }
  });
});

describe('the copy stays conceptual', () => {
  const all = [...strings(site), ...strings(DIVES)];
  const allowedUrls = [site.person.linkedin, site.person.github];

  it('names no internal identifiers, hosts or secrets', () => {
    const banned = [
      /localhost|127\.0\.0\.1/i,
      /\b[a-z]+_[a-z]+_[a-z_]+\b/, // snake_case names with two or more underscores (tables, env vars)
      /\b(sk-|AKIA|eyJ)[A-Za-z0-9]/,
      /\bzero_[a-z]/i,
      /\b(dev1|staging|prod)\b/i,
    ];
    for (const text of all) for (const re of banned) expect(text, `"${text}" matches ${re}`).not.toMatch(re);
  });

  it('links only to the public profiles', () => {
    for (const text of all) for (const url of text.match(/https?:\/\/\S+/g) ?? []) expect(allowedUrls).toContain(url);
  });
});
