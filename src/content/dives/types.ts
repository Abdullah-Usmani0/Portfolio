/** The shape of a deep dive: what "How it works" opens for a scene. */

/** An animated diagram drawn for a step: over the world, in the sky, or inside the card. */
export type Diagram =
  | 'skillops'
  | 'kernel'
  | 'loops'
  | 'attention'
  | 'firstword'
  | 'faq'
  | 'failures'
  | 'crate'
  | 'wgll'
  | 'review'
  | 'plain'
  | 'farmloops'
  | 'machinery'
  | 'honours'
  | 'research'
  | 'nlsql'
  | 'logs'
  | 'adlab'
  | 'zero'
  | 'kit'
  | 'personas'
  | 'coldread'
  | 'askchat'
  | 'attempts'
  | 'triage'
  | 'fixdiff'
  | 'beforeafter'
  | 'everywhere'
  | 'fourvoices'
  | 'disposition'
  | 'onemanager'
  | 'nudgegate'
  | 'facepipe';

/** An interactive panel inside the step card. */
export type Widget = 'context-lab';

/** Colours a label can take; they match the world's palette. */
export type Tone = 'cream' | 'lime' | 'amber' | 'cyan' | 'violet' | 'red';

/** A label that rides on the world, next to an anchor, while its step is open. */
export type Side = 'right' | 'left' | 'top' | 'bottom';

export interface Label {
  anchor: string;
  text: string;
  /** Fewer words, for a phone. */
  short?: string;
  /** Which side of the anchor it sits on (default: right). */
  side?: Side;
  /** Where it goes instead when another label already holds that spot (a phone, mostly). */
  alt?: Side;
  tone?: Tone;
  /** A colour for its dot, when it names something with its own colour. */
  dot?: string;
  /** The world shows and hides a label with this id in time with its animation. */
  id?: string;
  /** Only on a wide screen: on a phone there is no room for it beside the pins. */
  wide?: boolean;
}

export interface DiveStep {
  id: string;
  title: string;
  line: string;
  points: readonly string[];
  /** The anchor the camera flies to. None keeps the scene's wide view. */
  focus?: string;
  /** How much of the free view the anchor fills (0–1). */
  fill?: number;
  diagram?: Diagram;
  widget?: Widget;
  /** Keep the target low on a wide screen, to leave the sky for the diagram. */
  frame?: 'low';
  labels?: readonly Label[];
  /** Built with, shown as chips. */
  stack?: readonly string[];
}

export interface Pin {
  /** The anchor the label sits on. */
  anchor: string;
  label: string;
  /** The step a click opens. */
  step: string;
}

export interface Dive {
  scene: string;
  kicker: string;
  steps: readonly DiveStep[];
  /** Labels pinned to the world while the dive is open; a click opens their step. */
  pins?: readonly Pin[];
}
