import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { intro } from './store.ts';

gsap.registerPlugin(ScrollTrigger, SplitText);

/** Motion tokens: one entrance curve and one rhythm, shared by every reveal. */
export const EASE = 'expo.out';
export const DUR = 1.2;
export const STAGGER = 0.08;

const lines = (el: Element, vars: gsap.TweenVars) =>
  SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    onSplit: (self) => gsap.from(self.lines, { yPercent: 115, duration: DUR, ease: EASE, stagger: STAGGER, ...vars }),
  });

/**
 * The first screen: the night lifts, the name rises line by line, then the rest settles.
 * Runs once, before any scroll; reduced motion skips straight to the end state.
 */
export function playIntro(scope: Element): void {
  const tl = gsap.timeline({ defaults: { ease: EASE } });
  tl.to(intro, { rise: 1, duration: 2.6, ease: 'power2.out' }, 0);
  tl.from('[data-intro="veil"]', { autoAlpha: 1, duration: 1.8, ease: 'power2.inOut' }, 0);
  const name = scope.querySelector('[data-intro="name"]');
  if (name) lines(name, { delay: 0.45, duration: 1.5, stagger: 0.12 });
  tl.from(scope.querySelectorAll('[data-intro="fade"]'), { y: 18, autoAlpha: 0, duration: 1.4, stagger: 0.1 }, 1.0);
  tl.from(scope.querySelectorAll('[data-intro="metric"]'), { y: 22, autoAlpha: 0, duration: 1.3, stagger: 0.08 }, 1.2);
  tl.from(scope.querySelectorAll('[data-intro="nav"]'), { autoAlpha: 0, duration: 1.6 }, 1.1);
}

/** Everything below the first screen enters as it reaches the bottom fifth of the viewport. */
export function revealOnScroll(scope: Element): void {
  const enter = (trigger: Element) => ({ trigger, start: 'top 88%', once: true });
  scope.querySelectorAll('[data-split]').forEach((el) => lines(el, { scrollTrigger: enter(el) }));
  scope.querySelectorAll('[data-rise]').forEach((el) =>
    gsap.from(el, { y: 28, autoAlpha: 0, duration: DUR, ease: EASE, scrollTrigger: enter(el) }),
  );
  scope.querySelectorAll('[data-rise-group]').forEach((el) =>
    gsap.from(el.children, { y: 28, autoAlpha: 0, duration: DUR, ease: EASE, stagger: STAGGER, scrollTrigger: enter(el) }),
  );
  scope.querySelectorAll('[data-rule]').forEach((el) =>
    gsap.from(el, { scaleX: 0, transformOrigin: 'left center', duration: 1.6, ease: 'expo.inOut', scrollTrigger: enter(el) }),
  );
}
