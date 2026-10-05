/**
 * The deep dives: what "How it works" opens. The camera flies into the scene and steps
 * through it, one idea at a time, with the technical detail written out. Conceptual by
 * design, like the rest of the copy: no internal names, URLs, IDs or costs. Each dive lives
 * in its own file under ./dives.
 */
import { career } from './dives/career.ts';
import { context } from './dives/context.ts';
import { councils } from './dives/councils.ts';
import { learners } from './dives/learners.ts';
import { npcs } from './dives/npcs.ts';
import { scenarios } from './dives/scenarios.ts';
import { voice } from './dives/voice.ts';
import type { Dive } from './dives/types.ts';

export type { Diagram, Dive, DiveStep, Label, Pin, Tone, Widget } from './dives/types.ts';

export const DIVES: Readonly<Record<string, Dive>> = {
  npcs,
  councils,
  scenarios,
  learners,
  voice,
  mind: context,
  ascent: career,
};

/** The step index for a step id, or 0. */
export const stepIndex = (dive: Dive, id: string) => Math.max(0, dive.steps.findIndex((s) => s.id === id));
