import { mind } from '@/content/site.ts';
import { Rich } from '@/ui/Rich.tsx';
import { Frame } from './Chapter.tsx';

export function Mind() {
  return (
    <Frame id={mind.id} look={mind.look}>
      <p className="eyebrow" data-rise>
        {mind.kicker}
      </p>
      <h2 className="display-l chapter-title" data-split>
        <Rich text={mind.title} />
      </h2>
      <p className="lead chapter-lead" data-rise>
        {mind.lead}
      </p>
      <ol className="blocks" aria-label="Context blocks, in the order they are assembled" data-rise-group>
        {mind.blocks.map(([name, text], i) => (
          <li key={name} className="block-row" data-cache={i === mind.cacheLine ? '' : undefined}>
            <span className="block-index tabular">{String(i + 1).padStart(2, '0')}</span>
            <span className="block-name">{name}</span>
            <span className="block-text">{text}</span>
          </li>
        ))}
      </ol>
      <p className="cache-note">The cache line sits between blocks 04 and 05: everything above it is re-used, turn after turn.</p>
      <ul className="techniques" data-rise-group>
        {mind.techniques.map((t) => (
          <li key={t.name} className="technique">
            <p className="proof-label">{t.name}</p>
            <p className="proof-text">{t.text}</p>
          </li>
        ))}
      </ul>
    </Frame>
  );
}
