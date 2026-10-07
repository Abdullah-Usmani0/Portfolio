import { cn } from '@/ui/cn.ts';
import { toggleSound, useSound } from './sound.ts';

/**
 * The speaker in the corner: on by default, one press to turn the valley's sound off. Until
 * the visitor's first click or tap lets the browser play it, a quiet nudge says so.
 */
export function SoundButton({ className }: { className?: string }) {
  const on = useSound((s) => s.on);
  const playing = useSound((s) => s.playing);
  const supported = useSound((s) => s.supported);
  if (!supported) return null;
  const waiting = on && !playing;
  return (
    <span className={cn('sound', className, waiting && 'is-waiting', on && playing && 'is-playing')}>
      {waiting ? (
        <span className="sound-hint" aria-hidden>
          <span className="sound-hint-mouse">Click for sound</span>
          <span className="sound-hint-touch">Tap for sound</span>
        </span>
      ) : null}
      <button
        type="button"
        data-sound
        className="sound-button"
        onClick={toggleSound}
        aria-pressed={on}
        aria-label="Sound"
        title={waiting ? 'Start the sound' : on ? 'Turn the sound off' : 'Turn the sound on'}
      >
        <svg viewBox="0 0 24 24" className="sound-icon" aria-hidden>
          <path d="M3.5 9.4h3.4L11.6 5v14l-4.7-4.4H3.5z" fill="currentColor" />
          {on ? (
            <>
              <path className="sound-wave" d="M14.6 9.1a4.1 4.1 0 0 1 0 5.8" />
              <path className="sound-wave sound-wave-far" d="M17.3 6.6a7.7 7.7 0 0 1 0 10.8" />
            </>
          ) : (
            <path className="sound-off" d="M15 9.5l5 5m0-5l-5 5" />
          )}
        </svg>
      </button>
    </span>
  );
}
