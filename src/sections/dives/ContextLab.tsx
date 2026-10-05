import { LAB, LAB_LOSSES, labReply } from '@/content/dives/contextLab.ts';
import { resetLab, toggleLab, useLab } from '@/motion/store.ts';
import { CONTEXT_LAYERS, LAYER_COLORS } from '@/sim/particles/bust.ts';

/** The mini-lab: ten switches, one per block, and the manager's reply as the window changes. */
export function ContextLab() {
  const on = useLab((s) => s.on);
  const off = on.flatMap((v, k) => (v ? [] : [k]));
  return (
    <div className="lab">
      <ul className="lab-switches" aria-label="Blocks in the manager’s window">
        {CONTEXT_LAYERS.map((name, k) => (
          <li key={name}>
            <button type="button" aria-pressed={on[k]} onClick={() => toggleLab(k)} style={{ '--dot': LAYER_COLORS[k] } as React.CSSProperties}>
              {name}
            </button>
          </li>
        ))}
      </ul>
      <div className="lab-chat">
        <p className="lab-msg is-learner">
          <span className="lab-who">Learner</span>
          {LAB.learner}
        </p>
        <p className="lab-msg is-npc" aria-live="polite">
          <span className="lab-who">{on[0] ? LAB.manager : 'Assistant'}</span>
          {labReply(on)}
        </p>
      </div>
      {off.length ? (
        <ul className="lab-losses">
          {off.slice(0, 3).map((k) => (
            <li key={k} style={{ '--dot': LAYER_COLORS[k] } as React.CSSProperties}>
              {LAB_LOSSES[k]}
            </li>
          ))}
          {off.length > 3 ? <li className="lab-more">and {off.length - 3} more</li> : null}
        </ul>
      ) : (
        <p className="lab-hint">Every block is in. Switch one off.</p>
      )}
      {off.length ? (
        <button type="button" className="lab-reset" onClick={resetLab}>
          Put every block back
        </button>
      ) : null}
    </div>
  );
}
