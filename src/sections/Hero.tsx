import { hero, person } from '@/content/site.ts';
import { Scene } from './Scene.tsx';

export function Hero() {
  return (
    <Scene id="top" className="scene-hero">
      <p className="eyebrow card-eyebrow" data-intro="fade">
        {person.where}
      </p>
      <h1 className="display-xl" data-intro="name">
        <span className="block sm:whitespace-nowrap">Muhammad Abdullah</span>{' '}
        <span className="block">
          <em>Usmani</em>
        </span>
      </h1>
      <p className="card-line" data-intro="fade">
        {hero.line}
      </p>
    </Scene>
  );
}
