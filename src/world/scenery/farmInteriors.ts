import * as THREE from 'three';
import type { Anchor } from '../anchors.ts';
import { Flat, Z, crew, desk, interior, monitors, room, type Interior, type InteriorKit } from './interiors.ts';

/**
 * Inside the farm: what a dive sees when a wall falls away. The barn assembles scenarios on a
 * line; the silo stores trainings on four levels, one per way of finding one before making a
 * new one; the windmill's gears drive the work queues. Each returns the anchors its labels
 * ride on, computed from the same numbers as its geometry.
 */

export interface FarmInterior extends Interior {
  anchors: Record<string, Anchor>;
}

const box = (x0: number, y0: number, x1: number, y1: number): Anchor => ({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });

const plane = (w: number, h: number, ox = 0, oy = 0) => new THREE.PlaneGeometry(w, h).translate(ox, oy, 0);

/** The barn: cards in at the left, crates out at the right. A loft reads back what was made, and builds the exemplar. */
export function barnInterior(kit: InteriorKit, b: { x: number; y: number; w: number; h: number }): FarmInterior {
  const { x, y, w, h } = b;
  const loft = y + Math.round(h * 0.62);
  const st = { s1: x + w * 0.2, s2: x + w * 0.45, s3: x + w * 0.7, pack: x + w * 0.9 };
  const k = w / 120;
  const anchors = {
    station1: box(st.s1 - 12, y, st.s1 + 12, y + 34),
    station2: box(st.s2 - 12, y, st.s2 + 12, y + 34),
    station3: box(st.s3 - 12, y, st.s3 + 12, y + 34),
    pack: box(st.pack - 10, y, st.pack + 10, y + 34),
    verify: box(x + 10, loft, x + 46, loft + 24),
    exemplar: box(x + w * 0.6, loft, x + w * 0.84, loft + 24),
  };
  const it = interior((g, later) => {
    room(g, kit, x + 2, y, x + w - 2, y + h - 2, [loft]);
    const back = new Flat(g, Z.back);
    const front = new Flat(g, Z.front);
    // The line: a belt on legs, across the floor.
    front.rect(kit.mats.metal, x + 7, y + 11, x + w - 7, y + 14.5);
    for (let lx = x + 12; lx < x + w - 7; lx += 20) front.rect(kit.mats.metal, lx, y, lx + 2.4, y + 11);
    // A ladder to the loft.
    back.bar(kit.mats.wood, x + w - 15, y, x + w - 15, loft, 1.6);
    back.bar(kit.mats.wood, x + w - 8, y, x + w - 8, loft, 1.6);
    for (let ry = y + 6; ry < loft; ry += 7) back.rect(kit.mats.wood, x + w - 15, ry, x + w - 8, ry + 1.2);
    // Loft: the verifier's desk and its checklist.
    const screens = [desk(back, front, kit, x + 12, loft + 1, 30)];
    const board = { x0: x + 54, x1: x + 78, y0: loft + 5, y1: loft + 23 };
    back.rect(kit.mats.paper, board.x0, board.y0, board.x1, board.y1);
    for (let r = 0; r < 3; r++) back.rect(kit.mats.ink, board.x0 + 8, board.y1 - 5 - r * 5.6, board.x1 - 3, board.y1 - 4 - r * 5.6);
    // Loft: the exemplar, built as data and laid out by code: a page with a chart on it.
    const page = { x0: x + w * 0.62, x1: x + w * 0.82, y0: loft + 4, y1: loft + 24 };
    back.rect(kit.mats.paper, page.x0, page.y0, page.x1, page.y1);
    monitors(g, kit, screens);
    back.build();
    front.build();
    const ticks = [0, 1, 2].map((r) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.8, 10), kit.mats.lime);
      m.position.set(board.x0 + 4, board.y1 - 4.5 - r * 5.6, Z.mid);
      g.add(m);
      return m;
    });
    const lines = [0, 1, 2].map((r) => {
      const m = new THREE.Mesh(plane(1, 1.3, 0.5, 0), kit.mats.ink);
      m.position.set(page.x0 + 3, page.y1 - 4 - r * 3.8, Z.mid);
      g.add(m);
      return m;
    });
    const bars = [0, 1, 2, 3].map((j) => {
      const m = new THREE.Mesh(plane(2.8, 1, 0, 0.5), j === 2 ? kit.mats.lime : kit.mats.ink);
      m.position.set(page.x0 + (page.x1 - page.x0) * 0.56 + j * 3.6, page.y0 + 1.5, Z.mid);
      g.add(m);
      return m;
    });

    // Work on the belt: a card becomes a scenario, the scenario becomes objectives, each
    // objective gets its stages (the last one a final evaluation), and the lot is crated.
    const items = Array.from({ length: 5 }, (_, n) => {
      const item = new THREE.Group();
      item.position.set(0, y + 14.5, Z.top);
      item.scale.setScalar(k);
      const card = new THREE.Mesh(plane(7, 4.6, 0, 2.3), kit.mats.paper);
      const scenario = new THREE.Mesh(plane(13, 9, 0, 4.5), kit.mats.wood);
      const objectives = [kit.mats.amber, kit.spines[1]!, kit.spines[4]!].map((m, j) => {
        const o = new THREE.Mesh(plane(13, 2.5, 0, 1.25 + j * 3.1), m);
        item.add(o);
        return o;
      });
      const tiles: THREE.Mesh[] = [];
      for (let j = 0; j < 3; j++) {
        for (let s = 0; s < 4; s++) {
          const t = new THREE.Mesh(plane(1.8, 1.4, -4.5 + s * 3, 1.25 + j * 3.1), s === 3 ? kit.mats.lime : kit.mats.paper);
          t.position.z = 0.0002;
          item.add(t);
          tiles.push(t);
        }
      }
      const crate = new THREE.Mesh(plane(14, 11, 0, 5.5), kit.mats.wood);
      const lid = new THREE.Mesh(plane(15, 2, 0, 11), kit.mats.ink);
      item.add(card, scenario, crate, lid);
      g.add(item);
      return { item, card, scenario, objectives, tiles, crate, lid, offset: n / 5 };
    });

    const move = crew(g, kit, [
      { x: st.s1 - 3, y: y + 1, pose: 'stand', color: '#e2a46b', scale: 1.15 },
      { x: st.s2 - 3, y: y + 1, pose: 'stand', color: '#7fb2e8', flip: true, scale: 1.15 },
      { x: st.s3 - 3, y: y + 1, pose: 'stand', color: '#8cc77a', scale: 1.15 },
      { x: x + 20, y: loft + 2, pose: 'sit', color: '#c97b8e' },
      { x: page.x1 + 6, y: loft + 1, pose: 'stand', color: '#e8c95a', flip: true },
    ]);
    later.push((f) => {
      move(f.time);
      for (const it of items) {
        const u = (f.time / 13 + it.offset) % 1;
        const px = x + 9 + u * (w - 18);
        it.item.position.x = px;
        it.item.visible = u > 0.01 && u < 0.985;
        const zone = px < st.s1 + 4 ? 0 : px < st.s2 + 4 ? 1 : px < st.s3 + 4 ? 2 : px < st.pack ? 3 : 4;
        it.card.visible = zone === 0;
        it.scenario.visible = zone === 1;
        it.objectives.forEach((o) => (o.visible = zone === 2 || zone === 3));
        it.tiles.forEach((t) => (t.visible = zone === 3));
        it.crate.visible = it.lid.visible = zone === 4;
      }
      const t = (f.time % 6) / 6;
      ticks.forEach((m, r) => (m.visible = t > 0.15 + r * 0.22));
      const p = (f.time % 7) / 7;
      lines.forEach((m, r) => (m.scale.x = Math.max(0.01, (page.x1 - page.x0) * 0.42 * Math.min(1, Math.max(0, p * 3 - r * 0.6)))));
      bars.forEach((m, j) => (m.scale.y = Math.max(0.01, (4 + j * 3) * Math.min(1, Math.max(0, p * 2.2 - 0.6 - j * 0.12)))));
    });
  });
  return { ...it, anchors };
}

/** The silo: trainings stored on four levels, and a request dropping through them until one level can answer. */
export const SILO_LEVELS = 4;
export const SILO_LOOP = 12;

export function siloInterior(kit: InteriorKit, s: { x: number; y: number; w: number; h: number }): FarmInterior {
  const { x, y, w, h } = s;
  const floors = [0.235, 0.485, 0.735].map((r) => y + Math.round(h * r));
  // Level 1 is the top: exact match. Level 4 is the floor: generate.
  const level = (k: number): [number, number] => {
    const tops = [y + h - 2, floors[2]!, floors[1]!, floors[0]!];
    const bottoms = [floors[2]!, floors[1]!, floors[0]!, y];
    return [bottoms[k]!, tops[k]!];
  };
  const anchors: Record<string, Anchor> = {};
  for (let k = 0; k < SILO_LEVELS; k++) {
    const [b0, b1] = level(k);
    anchors[`level${k + 1}`] = box(x, b0, x + w, b1);
  }
  const shaft = x + w * 0.5;
  const it = interior((g, later) => {
    room(g, kit, x + 2, y, x + w - 2, y + h - 2, floors);
    const back = new Flat(g, Z.back);
    // Stored trainings on each level, a shelf to either side of the shaft.
    const pal = [kit.spines[0]!, kit.spines[1]!, kit.spines[2]!, kit.spines[3]!, kit.spines[4]!];
    for (let k = 0; k < 3; k++) {
      const [b0] = level(k);
      for (const side of [-1, 1]) {
        back.rect(kit.mats.wood, shaft + side * 6, b0 + 11, shaft + side * 20, b0 + 12.4);
        for (let j = 0; j < 2; j++) back.rect(pal[(k * 2 + j + (side > 0 ? 1 : 0)) % pal.length]!, shaft + side * (7 + j * 6.4), b0 + 12.4, shaft + side * (12 + j * 6.4), b0 + 18.4);
      }
    }
    // The shaft the request drops through.
    back.bar(kit.mats.metal, shaft - 4.5, y, shaft - 4.5, y + h - 2, 1);
    back.bar(kit.mats.metal, shaft + 4.5, y, shaft + 4.5, y + h - 2, 1);
    back.build();
    // A tile still being made on level 2, a judge on level 3, an empty slot on the floor.
    const tile = (mat: THREE.Material, px: number, py: number) => {
      const t = new THREE.Mesh(plane(5, 6, 0, 3), mat);
      t.position.set(px, py, Z.mid);
      return t;
    };
    const making = tile(kit.mats.amber, shaft + 16, level(1)[0] + 12.4);
    const match = tile(kit.mats.lime, shaft - 9.5, level(0)[0] + 12.4);
    const near = tile(kit.mats.lime, shaft + 9.5, level(2)[0] + 12.4);
    const fresh = tile(kit.mats.lime, shaft - 9.5, y + 12.4);
    const bucket = new THREE.Mesh(new THREE.CircleGeometry(3.2, 14), kit.mats.lime);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(7.5, 18), kit.mats.glow);
    g.add(making, match, near, fresh, bucket, halo);
    const move = crew(g, kit, [{ x: shaft + 15, y: level(2)[0] + 1, pose: 'sit', color: '#b892e0', flip: true, scale: 0.8 }]);
    const stopAt = (k: number) => (level(k)[0] + level(k)[1]) / 2;
    later.push((f) => {
      move(f.time);
      const lt = f.time % SILO_LOOP;
      const k = Math.floor(lt / 3);
      const u = (lt % 3) / 3;
      // Each request drops in at the top and stops at the first level that can answer it.
      const top = y + h + 4;
      const stop = stopAt(k);
      const fall = Math.min(1, u / 0.45);
      let by = top + (stop - top) * (1 - (1 - fall) ** 2);
      let bx = shaft;
      if (k === 3 && u > 0.6) {
        // Nothing found: it leaves for the barn to be made.
        bx = shaft - (u - 0.6) * 60;
        by = y + 6;
      }
      bucket.position.set(bx, by, Z.top);
      halo.position.set(bx, by, Z.top - 0.0001);
      bucket.visible = halo.visible = u < 0.95;
      const answered = u > 0.45 && u < 0.95;
      match.scale.setScalar(k === 0 && answered ? 1.25 : 1);
      making.visible = k !== 1 || Math.sin(f.time * 10) > -0.2;
      near.scale.setScalar(k === 2 && answered ? 1.25 : 1);
      fresh.visible = k === 3 && u > 0.7;
      kit.mats.glow.opacity = 1;
    });
  });
  return { ...it, anchors };
}

/** The windmill: gears turned by the sails, driving three work queues, and a bin for what cannot be retried. */
export function millInterior(kit: InteriorKit, m: { x: number; base: number; h: number; half: number; top: number }): FarmInterior {
  const { x, base, h, half, top } = m;
  const hw = (yy: number) => half + ((top - half) * (yy - base)) / h - 2.5;
  const lane = (k: number) => base + h * (0.09 + k * 0.115);
  const anchors = {
    gears: box(x - 14, base + h - 38, x + 14, base + h - 6),
    queues: box(x - hw(lane(1)), lane(0) - 4, x + hw(lane(1)), lane(2) + 6),
    deadletter: box(x - hw(base) + 1, base, x - hw(base) + 11, base + 9),
  };
  const it = interior((g, later) => {
    const wall = new Flat(g, Z.wall);
    wall.tri(kit.mats.room, x - hw(base), base, x + hw(base), base, x + hw(base + h), base + h);
    wall.tri(kit.mats.room, x - hw(base), base, x + hw(base + h), base + h, x - hw(base + h), base + h);
    wall.build();
    const back = new Flat(g, Z.back);
    // The shaft from the top gear down to the floor.
    back.bar(kit.mats.metal, x, lane(2) + 10, x, base + h - 20, 2.4);
    // Three queue lanes, each a short belt.
    for (let k = 0; k < 3; k++) back.rect(kit.mats.metal, x - hw(lane(k)) + 2, lane(k), x + hw(lane(k)) - 2, lane(k) + 1.8);
    // The dead-letter bin.
    back.rect(kit.mats.ink, anchors.deadletter.x - 5, base, anchors.deadletter.x + 5, base + 9);
    back.build();
    const gear = (r: number, teeth: number, mat: THREE.Material) => {
      const gg = new THREE.Group();
      gg.add(new THREE.Mesh(new THREE.CircleGeometry(r, 20), mat));
      for (let k = 0; k < teeth; k++) {
        const tooth = new THREE.Mesh(plane(r * 0.36, r * 0.42, 0, r), mat);
        tooth.rotation.z = (k / teeth) * Math.PI * 2;
        gg.add(tooth);
      }
      gg.add(new THREE.Mesh(new THREE.CircleGeometry(r * 0.3, 12), kit.mats.ink));
      g.add(gg);
      return gg;
    };
    const big = gear(11, 10, kit.mats.wood);
    big.position.set(x, base + h - 20, Z.mid);
    const small = gear(6.5, 7, kit.mats.metal);
    small.position.set(x + 11.5, base + h - 33, Z.mid);
    const lanes = [0, 1, 2].map((k) => {
      const y0 = lane(k) + 1.8;
      const span = hw(lane(k)) - 5;
      return Array.from({ length: 3 }, (_, j) => {
        const job = new THREE.Mesh(plane(4.2, 3.6, 0, 1.8), k === 0 ? kit.mats.lime : k === 1 ? kit.mats.amber : kit.spines[1]!);
        job.position.set(x, y0, Z.top);
        job.userData = { y0, span, j, speed: 0.22 + k * 0.07 };
        g.add(job);
        return job;
      });
    });
    const dropped = new THREE.Mesh(plane(3.6, 3.6, 0, 1.8), kit.mats.alert);
    g.add(dropped);
    const move = crew(g, kit, [{ x: x + 7, y: base + 1, pose: 'stand', color: '#c99a4a', flip: true, scale: 0.85 }]);
    later.push((f) => {
      move(f.time);
      big.rotation.z = f.time * 0.6;
      small.rotation.z = -f.time * 0.6 * (9 / 5.5);
      for (const lane of lanes) {
        for (const job of lane) {
          const { y0, span, j, speed } = job.userData as { y0: number; span: number; j: number; speed: number };
          const u = (f.time * speed + j / 3) % 1;
          job.position.set(x - span + u * span * 2, y0, Z.top);
          job.visible = u > 0.04 && u < 0.96;
        }
      }
      // Every so often a job that cannot be retried drops into the bin, instead of failing again.
      const d = (f.time % 9) / 9;
      dropped.visible = d < 0.25;
      dropped.position.set(anchors.deadletter.x, base + 6 + 22 * (1 - Math.min(1, d * 6)) ** 2, Z.top);
    });
  });
  return { ...it, anchors };
}
