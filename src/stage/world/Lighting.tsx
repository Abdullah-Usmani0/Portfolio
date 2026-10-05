import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Fog, type DirectionalLight, type HemisphereLight } from 'three';
import { fillColor, lightAt, sunDirection } from '@/sim/world/timeOfDay.ts';
import { installHaze } from '../haze.ts';
import { updateBakedLight } from '../lightBake.ts';
import { stage } from '../store.ts';

/** Sun/moon, sky bounce and haze — all driven by the time-of-day dial. */
// Patch the fog chunk at import time, before any material can compile against the old one.
installHaze();

export function Lighting() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    // Fog.near = hazeMax, Fog.far = hazeDist (see haze.ts).
    scene.fog = new Fog(0xaabbcc, 0.4, 2000);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame(() => {
    const tod = stage.getState().tod;
    updateBakedLight(tod);
    const l = lightAt(tod);
    const [x, y, z] = sunDirection(l);
    if (sun.current) {
      sun.current.position.set(x * 2000, y * 2000, z * 2000);
      sun.current.color.setRGB(...l.sunColor);
      sun.current.intensity = l.sunIntensity;
    }
    if (hemi.current) {
      hemi.current.color.setRGB(...fillColor(l));
      hemi.current.groundColor.setRGB(...l.ground);
      hemi.current.intensity = l.hemiIntensity;
    }
    const fog = scene.fog as Fog | null;
    if (fog) {
      fog.color.setRGB(...l.hazeColor);
      fog.near = l.hazeMax;
      fog.far = l.hazeDist;
    }
  });

  return (
    <>
      <directionalLight ref={sun} />
      <hemisphereLight ref={hemi} />
    </>
  );
}
