/**
 * The Context Engineering dive. The field's own vocabulary (write, select, compress,
 * isolate; working, episodic, semantic and procedural memory; the ways long contexts fail),
 * each step paired with what was built on it. Field findings are attributed in general
 * terms; the numbers are measurements from the work itself.
 */
import { CONTEXT_LAYERS, LAYER_COLORS } from '@/sim/particles/bust.ts';
import type { Dive, Label } from './types.ts';

/**
 * The loops the world plays for some steps, in seconds from the step opening. The diagrams
 * read the same numbers, so a card lights as its moment happens in the world.
 */
export const LOOPS = {
  omit: { period: 8, settle: 0, dissolve: 3, reopen: 7 },
  scratch: { period: 8, settle: 2.2, write: 0.6, writeFor: 1.6, speak: 2.4, sentence: 1.3, travel: 1.6, sentences: 3, clear: 7.2 },
  short: { period: 11, settle: 1.6, arrive: 0.3, arriveFor: 5, elide: 5.6, fold: 7.4, fade: 9.2 },
  select: { period: 10, settle: 2, miss: 0.2, missAt: 0.880, retrieve: 2, hit: 5, hitAt: 0.967, swap: 6.6, restore: 9.4, threshold: 0.95 },
  isolate: { period: 9, settle: 2.2, send: 0.3, work: 1.3, stagger: 0.6, workFor: 1.6, travel: 1 },
  failures: { period: 12, settle: 1.6, phase: 3 },
} as const;

/** The four ways a long context fails, in the order the world shows them. */
export const FAILURES = [
  { name: 'Poisoning', what: 'A wrong fact gets in and gets repeated.', fix: 'Quotes must appear word for word in their source.' },
  { name: 'Distraction', what: 'The window grows until it drowns out the task.', fix: 'Summaries, and a hard cap on what a judge sees.' },
  { name: 'Confusion', what: 'Irrelevant tools and blocks pull the answer off course.', fix: 'One tool per agent; only blocks with real data.' },
  { name: 'Clash', what: 'Two parts of the window disagree.', fix: 'One source of truth, like one shared voice per character.' },
] as const;

/** Time into a step's loop: -1 while the world is still settling into the step's shape. */
export function loopTime(loop: { period: number; settle: number }, t: number): number {
  return t < loop.settle ? -1 : (t - loop.settle) % loop.period;
}

/** Which failure the world is showing at time t into the step, or -1 while it settles. */
export function failurePhase(t: number): number {
  const lt = loopTime(LOOPS.failures, t);
  return lt < 0 ? -1 : Math.floor(lt / LOOPS.failures.phase);
}

const pad = (k: number) => String(k + 1).padStart(2, '0');

/** A label on each block of the stack, in its own colour. */
const blockLabels: Label[] = CONTEXT_LAYERS.map((name, k) => ({ anchor: `block${k}`, text: `${pad(k)} ${name}`, side: 'right', dot: LAYER_COLORS[k], id: `block${k}` }));

export const context: Dive = {
  scene: 'mind',
  kicker: 'Context engineering',
  steps: [
    {
      id: 'mind',
      title: 'A mind, rebuilt every turn',
      line: 'A model only knows what is in its window. Context engineering decides what goes in, turn by turn.',
      focus: 'bust',
      fill: 0.7,
      points: [
        'The goal is the smallest set of high-signal tokens that gets the next step right. More context is not better context.',
        'Four moves do the work: write things down outside the window, select what is needed back in, compress what runs long, and isolate work in windows of its own.',
        'Every character turn, grading call and planning step on Zero is assembled this way, from parts that each have one job.',
      ],
      labels: [
        { anchor: 'moveWrite', text: 'Write · notes kept outside', short: 'Write', side: 'left', tone: 'amber' },
        { anchor: 'moveSelect', text: 'Select · pull in what’s needed', short: 'Select', side: 'right', tone: 'cyan' },
        { anchor: 'moveCompress', text: 'Compress · summarise, trim', short: 'Compress', side: 'left', tone: 'lime' },
        { anchor: 'moveIsolate', text: 'Isolate · split the work', short: 'Isolate', side: 'right', tone: 'violet' },
      ],
      stack: ['LangGraph', 'Claude on Bedrock', 'Gemini', 'Redis', 'Embeddings'],
    },
    {
      id: 'blocks',
      title: 'Ten blocks, in order',
      line: 'Every turn the window is poured in the same order: who this person is first, how they talk last.',
      focus: 'stack',
      points: [
        'Identity, framework, task, requirements, resources, memory, feedback, retrieval, learner state, voice.',
        'Each block registers itself with a priority, so the order belongs to the system rather than to whoever last edited a prompt.',
        'Stable first, live last: what never changes for this character goes on top, where it can be cached.',
      ],
      labels: blockLabels,
    },
    {
      id: 'cache',
      title: 'The cache line',
      line: 'Everything above the line is the same, byte for byte, every turn, so the provider reuses it instead of reading it again.',
      focus: 'stack',
      points: [
        'The number that matters is the cache hit rate: a reused prefix costs a fraction of fresh input and comes back faster.',
        'So nothing that changes per turn (a timestamp, a counter, the learner’s latest words) may sit above the line.',
        'Cache markers sit beside the prompt, never inside it, so caching can never change what the model reads.',
        'Writing to the cache costs extra, so one-off calls that will never repeat skip the marker.',
      ],
      labels: [
        { anchor: 'prefix', text: 'Prefix · the same every turn', short: 'Prefix', side: 'right', tone: 'cream' },
        { anchor: 'cacheLine', text: 'Cache line', side: 'right', tone: 'lime' },
        { anchor: 'tail', text: 'Live tail · new every turn', short: 'Live tail', side: 'right', tone: 'amber' },
      ],
    },
    {
      id: 'omit',
      title: 'Leave it out',
      line: 'An empty block is not neutral. “Feedback: none” reads to a model as a fact, and it acts on it.',
      focus: 'stack',
      points: [
        'A block with no data is left out entirely, never filled with a placeholder. The rest close up.',
        'A read that failed is not the same as nothing found: it is flagged, never written down as zero.',
        'Fewer, truer blocks also leave more attention for the ones that matter.',
      ],
      labels: [
        { anchor: 'block6', text: 'Feedback: none', side: 'right', tone: 'red', id: 'none6' },
        { anchor: 'block7', text: 'Retrieval: none', side: 'right', tone: 'red', id: 'none7' },
        { anchor: 'block6', text: 'Left out · the rest close up', side: 'right', tone: 'lime', id: 'gone' },
      ],
    },
    {
      id: 'placement',
      title: 'Placement is an experiment',
      line: 'Where a rule sits in the window changes what the model does with it, so placement gets measured, not guessed.',
      focus: 'stack',
      diagram: 'attention',
      points: [
        'Models read the start and the end of a long context best and the middle worst, a well-known effect called lost in the middle.',
        'Moving a grading rubric to the very front made the grader harsher: defects found per submission went from 1.45 to 2.66.',
        'The same teaching rule worked on 13 to 15 of 40 stuck turns as a standing instruction, and on 28 of 40 placed inside the turn.',
        'Voice goes last, written as a disposition (“your humour is dry”), never as a checklist the model performs line by line.',
      ],
    },
    {
      id: 'scratch',
      title: 'Scratchpad, then speak',
      line: 'The model writes a private verdict first, then talks. The verdict is never spoken; the reply streams as it is written.',
      focus: 'scratch',
      fill: 0.86,
      diagram: 'firstword',
      frame: 'low',
      points: [
        'One call grades the learner’s answer and writes the reply. The verdict comes first, in tags that are never voiced.',
        'Each sentence goes to speech the moment it is complete, so the first is heard while the rest is still being written.',
        'Time to the first spoken sentence: 5.4 s with two calls, 2.1 s with one.',
        'Teach, then check: when a learner is stuck, teach the point plainly, then ask one question that makes them use it. Full explanations rose from 6 to 28 of 40 stuck turns, and re-asks fell from 21 to 7.',
      ],
      labels: [
        { anchor: 'pad', text: 'Verdict · written first, never spoken', short: 'Verdict, unspoken', side: 'bottom', tone: 'cream', id: 'pad' },
        { anchor: 'reply', text: 'Reply · sentence by sentence', short: 'Reply, streamed', side: 'top', tone: 'lime', id: 'reply' },
      ],
    },
    {
      id: 'short',
      title: 'Short-term memory',
      line: 'A conversation outgrows any window. Older turns fold into a running summary; the latest stay word for word.',
      focus: 'ribbon',
      points: [
        'Every 10 turns the summary is refreshed in the background, never on the reply’s critical path.',
        'The summary and the latest turns go in together, so nothing new is lost to compression. Until a summary exists, the full history goes in.',
        'An oversized turn (a pasted file, a long log) keeps its opening and its end: 60% from the head, 40% from the tail, because the ask is usually at the end.',
      ],
      labels: [
        { anchor: 'knot', text: 'Summary · every 10 turns', short: 'Summary', side: 'top', tone: 'amber' },
        { anchor: 'turns', text: 'Latest turns · word for word', short: 'Latest turns', side: 'top', tone: 'cream' },
        { anchor: 'long', text: 'Head 60% · tail 40%', side: 'bottom', tone: 'cream', id: 'long' },
      ],
    },
    {
      id: 'long',
      title: 'Long-term memory, four kinds',
      line: 'Borrowed from cognitive science: what is in mind now, what happened, what is true, and how to act.',
      focus: 'memory',
      points: [
        'Working: the window itself, rebuilt every turn.',
        'Episodic, what happened: every agent keeps a journal, one entry per run, and never loses an entry.',
        'Semantic, what is true: facts distilled from the work and a researched knowledge library, never kept once stale.',
        'Procedural, how to act: playbooks of rules, and each character’s voice.',
        'Episodes only become rules through a pattern gate: the same lesson in at least 3 scenarios across 2 focuses.',
      ],
      labels: [
        { anchor: 'working', text: 'Working · this turn', short: 'Working', side: 'top', tone: 'lime' },
        { anchor: 'episodic', text: 'Episodic · what happened', short: 'Episodic', side: 'top', tone: 'amber' },
        { anchor: 'semantic', text: 'Semantic · what is true', short: 'Semantic', side: 'top', tone: 'cyan' },
        { anchor: 'procedural', text: 'Procedural · how to act', short: 'Procedural', side: 'top', tone: 'violet' },
        { anchor: 'gate', text: 'Pattern gate · 3 scenarios, 2 focuses', short: 'Pattern gate', side: 'bottom', tone: 'cream' },
      ],
    },
    {
      id: 'select',
      title: 'Select, just in time',
      line: 'Don’t preload everything. Fetch the one thing a turn needs, at the moment it needs it.',
      focus: 'select',
      diagram: 'faq',
      frame: 'low',
      points: [
        'Each stage keeps a small FAQ built from the stage itself. When a learner’s question means the same as one of them, one fact replaces the large stage and resource blocks.',
        'The bar is measured, not guessed: a real paraphrase scores 0.967 and an unrelated question 0.880, so a threshold of 0.95 admits one and refuses the other.',
        'Nothing a learner wrote ever enters it, so sharing it across learners is safe by construction.',
        'Anything else is retrieved from a researched library only when a step calls for it, and each agent carries one tool, not a crowded toolbox.',
      ],
      labels: [
        { anchor: 'faq', text: 'Stage FAQ', side: 'top', tone: 'amber' },
        { anchor: 'library', text: 'Library · fetched when needed', short: 'Library', side: 'bottom', tone: 'cyan' },
        { anchor: 'block7', text: 'Retrieval', side: 'right', dot: LAYER_COLORS[7] },
      ],
    },
    {
      id: 'isolate',
      title: 'Isolate',
      line: 'Split the work into separate windows. Each worker sees only its own job and hands back a short result.',
      focus: 'agents',
      points: [
        'Sub-agents work in clean windows and return a summary, not their whole transcript.',
        'Every agent in the councils is bound to exactly one tool, with its own journal and memory, so no window carries another’s clutter.',
        'Untrusted text (a scraped page, a learner’s file, a quote from an audit) is fenced off as data and never followed as an instruction.',
      ],
      labels: [
        { anchor: 'lead', text: 'Lead · holds the plan', short: 'Lead', side: 'top', tone: 'lime' },
        { anchor: 'sub0', text: 'One tool · one clean window', short: 'One tool each', side: 'top', tone: 'cream' },
        { anchor: 'fence', text: 'Untrusted text · read as data', short: 'Untrusted: data only', side: 'bottom', tone: 'red' },
      ],
    },
    {
      id: 'failures',
      title: 'When context fails',
      line: 'Long contexts fail in four known ways. Each one has a defence built in.',
      focus: 'stack',
      diagram: 'failures',
      frame: 'low',
      points: FAILURES.map((f) => `${f.name}: ${f.what.toLowerCase()} Defence: ${f.fix.charAt(0).toLowerCase()}${f.fix.slice(1)}`),
      labels: [
        { anchor: 'block5', text: 'A wrong fact', side: 'right', tone: 'red', id: 'fail0' },
        { anchor: 'block9', text: 'Too much to read', side: 'right', tone: 'red', id: 'fail1' },
        { anchor: 'block4', text: 'Off-topic tools', side: 'right', tone: 'red', id: 'fail2' },
        { anchor: 'block0', text: 'Two voices', side: 'right', tone: 'red', id: 'fail3' },
      ],
    },
    {
      id: 'lab',
      title: 'Try it: switch a block off',
      line: 'A learner asks their manager if their work is ready. Turn blocks off and see what the reply loses.',
      focus: 'stack',
      widget: 'context-lab',
      points: [],
      labels: blockLabels,
    },
  ],
};
