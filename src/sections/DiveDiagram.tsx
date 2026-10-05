import type { Diagram } from '@/content/dives.ts';
import { cn } from '@/ui/cn.ts';
import { DIAGRAMS } from './dives/registry.tsx';

/** Whether a diagram is drawn over the world (not in a panel or the sheet) at this size. */
export function onWorld(kind: Diagram, sheet: boolean): boolean {
  const spec = DIAGRAMS[kind];
  return sheet ? !spec.inline : spec.wide === 'world';
}

/** An animated diagram for a dive step: over the world, in a panel over the sky, or inside the sheet on a phone. */
export function DiveDiagram({ kind, scene, inline = false }: { kind: Diagram; scene: string; inline?: boolean }) {
  const spec = DIAGRAMS[kind];
  if (inline && spec.inline) return <div className="dive-diagram is-inline">{spec.inline(scene)}</div>;
  if (spec.wide === 'world' || !spec.inline) return <>{spec.render(scene)}</>;
  return <div className={cn('dive-diagram')}>{spec.render(scene)}</div>;
}
