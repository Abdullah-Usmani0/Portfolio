import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, SMAA, TiltShift2, ToneMapping, Vignette } from '@react-three/postprocessing';
import { Effect, ToneMappingMode, type BloomEffect } from 'postprocessing';
import { HalfFloatType, Uniform } from 'three';
import { lightAt } from '@/sim/world/timeOfDay.ts';
import type { TierBudget } from '@/sim/device/tier.ts';
import { stage } from './store.ts';

/** Scene-referred exposure, applied before tone mapping (the look's `exposure`). */
class ExposureEffect extends Effect {
  constructor() {
    super(
      'Exposure',
      /* glsl */ `
        uniform float exposure;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
        }`,
      { uniforms: new Map([['exposure', new Uniform(1)]]) },
    );
  }
}

/**
 * One composer: HDR bloom picks out only emissives (threshold 1), a soft tilt-shift band
 * sells the miniature, AgX tone-maps (Blender's view transform), a touch of saturation and
 * contrast stands in for its "Punchy" look, then vignette and SMAA.
 */
export function Effects({ budget }: { budget: TierBudget }) {
  const bloom = useRef<BloomEffect>(null);
  const exposure = useMemo(() => new ExposureEffect(), []);

  useFrame(() => {
    const l = lightAt(stage.getState().tod);
    if (bloom.current) bloom.current.intensity = 0.35 + l.bloom * 1.1;
    const u = exposure.uniforms.get('exposure');
    if (u) u.value = l.exposure;
  });

  return (
    <EffectComposer multisampling={0} frameBufferType={HalfFloatType} enableNormalPass={false}>
      <primitive object={exposure} dispose={null} />
      {budget.bloom ? <Bloom ref={bloom} mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.6} radius={0.75} /> : null}
      {budget.tiltShift ? <TiltShift2 blur={0.06} taper={0.7} start={[0, 0.6]} end={[1, 0.6]} samples={8} /> : null}
      <ToneMapping mode={ToneMappingMode.AGX} />
      <HueSaturation saturation={0.05} />
      <BrightnessContrast contrast={0.06} />
      <Vignette offset={0.3} darkness={0.3} />
      <SMAA />
    </EffectComposer>
  );
}
