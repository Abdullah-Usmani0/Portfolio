import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { intro } from './store.ts';

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Motion tokens: one entrance curve and one rhythm, shared by every reveal. */
export const EASE = 'expo.out';
export const DUR = 1.2;
export const STAGGER = 0.08;

/**
 * The first screen: the night lifts, the camera rises out of the valley as the sun comes
 * up, and the name rises line by line. Reduced motion skips straight to the end state.
 */
export function playIntro(scope: Element): void {
  const tl = gsap.timeline({ defaults: { ease: EASE } });
  tl.to(intro, { rise: 1, duration: 3.2, ease: 'power2.out' }, 0);
  tl.from(scope.querySelectorAll('[data-intro="veil"]'), { autoAlpha: 1, duration: 2, ease: 'power2.inOut' }, 0);
  const name = scope.querySelector('[data-intro="name"]');
  if (name) {
    SplitText.create(name, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, { yPercent: 115, duration: 1.6, ease: EASE, stagger: 0.12, delay: 0.9 }),
    });
  }
  tl.from(scope.querySelectorAll('[data-intro="fade"]'), { y: 16, autoAlpha: 0, duration: 1.4, stagger: 0.1 }, 1.5);
  tl.from(scope.querySelectorAll('[data-intro="nav"]'), { autoAlpha: 0, duration: 1.6 }, 1.4);
}

/**
 * Each scene's card fades up as its scene settles and drifts away as the next one comes,
 * scrubbed by the scroll so it moves with the camera rather than on a timer.
 */
export function sceneCards(scope: Element): void {
  const scenes = [...scope.querySelectorAll<HTMLElement>('[data-scene]')];
  scenes.forEach((section, i) => {
    const card = section.querySelector('[data-card]');
    if (!card) return;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
    });
    if (i > 0) tl.fromTo(card, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.14, ease: 'none' }, 0.24);
    if (i < scenes.length - 1) tl.to(card, { autoAlpha: 0, y: -28, duration: 0.14, ease: 'none' }, 0.66);
    tl.set({}, {}, 1);
  });
}
