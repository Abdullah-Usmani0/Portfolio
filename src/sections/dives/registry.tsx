import type { ReactNode } from 'react';
import type { Diagram } from '@/content/dives.ts';
import { Kernel, Loops, SkillOps } from './councils.tsx';
import { AttentionBars, AttentionCurve, FaqMeter, Failures, FirstWord } from './context.tsx';
import { AdLab, Honours, Kit, Logs, NlSql, Research, ZeroBoard } from './career.tsx';
import { AskChat, Attempts, BeforeAfter, ColdRead, FixDiff, Personas, Triage } from './learners.tsx';
import { Disposition, Everywhere, FacePipe, FourVoices, NudgeGate, OneManager } from './npcs.tsx';
import { Crate, FarmLoops, Machinery, Plain, Review, Wgll } from './scenarios.tsx';
import { FrameGate, SentenceGate, Teach, TwoCalls, Verdict, VoiceStack } from './voice.tsx';

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
  honours: { wide: 'panel', render: () => <Honours />, inline: () => <Honours /> },
  research: { wide: 'panel', render: () => <Research />, inline: () => <Research /> },
  nlsql: { wide: 'panel', render: () => <NlSql />, inline: () => <NlSql /> },
  logs: { wide: 'panel', render: () => <Logs />, inline: () => <Logs /> },
  adlab: { wide: 'panel', render: () => <AdLab />, inline: () => <AdLab /> },
  zero: { wide: 'panel', render: () => <ZeroBoard />, inline: () => <ZeroBoard /> },
  kit: { wide: 'panel', render: () => <Kit />, inline: () => <Kit /> },
  personas: { wide: 'panel', render: () => <Personas />, inline: () => <Personas /> },
  coldread: { wide: 'panel', render: () => <ColdRead />, inline: () => <ColdRead /> },
  askchat: { wide: 'panel', render: () => <AskChat />, inline: () => <AskChat /> },
  attempts: { wide: 'panel', render: () => <Attempts />, inline: () => <Attempts /> },
  triage: { wide: 'panel', render: () => <Triage />, inline: () => <Triage /> },
  fixdiff: { wide: 'panel', render: () => <FixDiff />, inline: () => <FixDiff /> },
  beforeafter: { wide: 'panel', render: () => <BeforeAfter />, inline: () => <BeforeAfter /> },
  everywhere: { wide: 'panel', render: () => <Everywhere />, inline: () => <Everywhere /> },
  fourvoices: { wide: 'panel', render: () => <FourVoices />, inline: () => <FourVoices /> },
  disposition: { wide: 'panel', render: () => <Disposition />, inline: () => <Disposition /> },
  onemanager: { wide: 'panel', render: () => <OneManager />, inline: () => <OneManager /> },
  nudgegate: { wide: 'panel', render: () => <NudgeGate />, inline: () => <NudgeGate /> },
  facepipe: { wide: 'panel', render: () => <FacePipe />, inline: () => <FacePipe /> },
  twocalls: { wide: 'panel', render: () => <TwoCalls />, inline: () => <TwoCalls /> },
  verdict: { wide: 'panel', render: () => <Verdict />, inline: () => <Verdict /> },
  sentencegate: { wide: 'panel', render: () => <SentenceGate />, inline: () => <SentenceGate /> },
  framegate: { wide: 'panel', render: () => <FrameGate />, inline: () => <FrameGate /> },
  teach: { wide: 'panel', render: () => <Teach />, inline: () => <Teach /> },
  voicestack: { wide: 'panel', render: () => <VoiceStack />, inline: () => <VoiceStack /> },
};
