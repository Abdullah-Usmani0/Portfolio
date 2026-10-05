import type { ReactNode } from 'react';
import type { Diagram } from '@/content/dives.ts';
import { Kernel, Loops, SkillOps } from './councils.tsx';
import { AttentionBars, AttentionCurve, FaqMeter, Failures, FirstWord } from './context.tsx';
import { Crate, FarmLoops, Machinery, Plain, Review, Wgll } from './scenarios.tsx';

/**
 * How each diagram is drawn. `world` diagrams ride on the world itself (drawn over the
 * scene, following its anchors); the rest are panels in the sky. In a phone's sheet a
 * diagram becomes `inline`, unless it rides on the world there too.
 */
export interface DiagramSpec {
  wide: 'world' | 'panel';
  render: (scene: string) => ReactNode;
  /** In the sheet on a phone; absent means it stays on the world. */
  inline?: (scene: string) => ReactNode;
}

export const DIAGRAMS: Readonly<Record<Diagram, DiagramSpec>> = {
  skillops: { wide: 'panel', render: () => <SkillOps />, inline: () => <SkillOps /> },
  kernel: { wide: 'panel', render: () => <Kernel />, inline: () => <Kernel /> },
  loops: { wide: 'world', render: (scene) => <Loops scene={scene} /> },
  attention: { wide: 'world', render: (scene) => <AttentionBars scene={scene} />, inline: () => <AttentionCurve /> },
  firstword: { wide: 'panel', render: () => <FirstWord />, inline: () => <FirstWord /> },
  faq: { wide: 'panel', render: () => <FaqMeter />, inline: () => <FaqMeter /> },
  failures: { wide: 'panel', render: () => <Failures />, inline: () => <Failures inline /> },
  crate: { wide: 'panel', render: () => <Crate />, inline: () => <Crate /> },
  wgll: { wide: 'panel', render: () => <Wgll />, inline: () => <Wgll /> },
  review: { wide: 'panel', render: () => <Review />, inline: () => <Review /> },
  plain: { wide: 'panel', render: () => <Plain />, inline: () => <Plain /> },
  farmloops: { wide: 'world', render: (scene) => <FarmLoops scene={scene} /> },
  machinery: { wide: 'panel', render: () => <Machinery />, inline: () => <Machinery /> },
};
