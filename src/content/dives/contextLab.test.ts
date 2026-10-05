import { describe, expect, it } from 'vitest';
import { CONTEXT_LAYERS } from '@/sim/particles/bust.ts';
import { LAB, LAB_LOSSES, labReply } from './contextLab.ts';

const ALL = CONTEXT_LAYERS.map(() => true);
const without = (...off: number[]) => ALL.map((_, k) => !off.includes(k));

describe('labReply', () => {
  it('with every block on, holds the learner to the bar in the manager’s own voice', () => {
    const reply = labReply(ALL);
    expect(reply).toContain('Close, not yet.');
    expect(reply).toContain('paying customers only');
    expect(reply).toContain('which filter would you change first?');
    expect(reply).toContain(`— ${LAB.manager}`);
  });

  it('changes when any single block is switched off, each in its own way', () => {
    const replies = new Set<string>([labReply(ALL)]);
    for (let k = 0; k < CONTEXT_LAYERS.length; k++) replies.add(labReply(without(k)));
    expect(replies.size).toBe(CONTEXT_LAYERS.length + 1);
  });

  it('approves the work once there is no bar to hold it to', () => {
    expect(labReply(without(3))).toContain('looks good to me');
    expect(labReply(ALL)).not.toContain('looks good to me');
  });

  it('does the work for the learner without the framework, and over-explains without learner state', () => {
    expect(labReply(without(1))).toContain('Change the status filter');
    expect(labReply(without(1))).not.toContain('?');
    expect(labReply(without(8))).toContain('a cohort is a group of customers');
  });

  it('keeps the facts but loses the person without voice', () => {
    const plain = labReply(without(9));
    expect(plain).toContain('paying customers only');
    expect(plain).not.toContain('Close, not yet.');
    expect(plain).toContain(`Best regards, ${LAB.manager}`);
  });

  it('sounds like a generic assistant with no identity', () => {
    const generic = labReply(without(0));
    expect(generic).toContain('AI assistant');
    expect(generic).not.toContain(LAB.manager);
  });

  it('is a pure function of the switches', () => {
    expect(labReply(without(2, 5))).toBe(labReply(without(2, 5)));
  });

  it('explains every block’s loss', () => {
    expect(LAB_LOSSES.length).toBe(CONTEXT_LAYERS.length);
  });
});
