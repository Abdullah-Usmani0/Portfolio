/**
 * The deep dives: what "How it works" opens. The camera flies into the scene and steps
 * through it, one idea at a time, with the technical detail written out. Conceptual by
 * design, like the rest of the copy: no internal names, URLs, IDs or costs. Each full dive
 * lives in its own file under ./dives; scenes still waiting for theirs step through their proofs.
 */
import { ascent, chapters, index } from './site.ts';
import { context } from './dives/context.ts';
import { councils } from './dives/councils.ts';
import { scenarios } from './dives/scenarios.ts';
import type { Dive } from './dives/types.ts';

export type { Diagram, Dive, DiveStep, Label, Pin, Tone, Widget } from './dives/types.ts';

/** Until each scene has its own dive, it opens on its set piece and steps through its proofs. */
function proofDive(chapterId: string, focus: string): Dive {
  const c = chapters.find((ch) => ch.id === chapterId)!;
  return {
    scene: c.id,
    kicker: c.kicker,
    steps: [
      { id: 'overview', title: c.title.replace(/\*/g, ''), line: c.lead, focus, points: [], stack: c.stack },
      ...c.proofs.map((p) => ({ id: p.label.replace(/\W+/g, '-').toLowerCase(), title: `${p.stat} ${p.label}`, line: p.text, focus, fill: 0.9, points: [] })),
    ],
  };
}

const careerDive: Dive = {
  scene: ascent.id,
  kicker: ascent.kicker,
  steps: [
    ...ascent.camps.map((c) => ({
      id: c.org.toLowerCase().replace(/\W+/g, '-'),
      title: `${c.camp}: ${c.org}`,
      line: `${c.role} · ${c.dates}`,
      points: [c.note],
    })),
    { id: 'projects', title: 'Projects', line: 'Things built along the way.', points: index.projects.map((p) => `${p.name} (${p.year}): ${p.text}`) },
    {
      id: 'recognition',
      title: 'Recognition and certifications',
      line: 'Awards, honours and courses.',
      points: [...index.recognition, ...index.certifications].map((r) => `${r.name} (${r.year})`),
    },
  ],
};

export const DIVES: Readonly<Record<string, Dive>> = {
  npcs: proofDive('npcs', 'village'),
  councils,
  scenarios,
  learners: proofDive('learners', 'bridge'),
  voice: proofDive('voice', 'stage'),
  mind: context,
  ascent: careerDive,
};

/** The step index for a step id, or 0. */
export const stepIndex = (dive: Dive, id: string) => Math.max(0, dive.steps.findIndex((s) => s.id === id));
