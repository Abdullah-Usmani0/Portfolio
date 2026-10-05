/**
 * The Scenario Generation dive: the farm, part by part. Fields are the focus map, the barn
 * assembles scenarios, the dock checks every crate, the silo keeps what was made and the
 * windmill runs the work. Conceptual by design: no internal names, URLs, IDs or costs.
 */
import type { Dive, Label } from './types.ts';

/**
 * One label per row of the field: the focus map's categories, ranked by impact. The ends come
 * first, so on a small screen, where the middle rows' labels would collide, they are the ones kept.
 */
const rowLabels: Label[] = [0, 6, 1, 2, 3, 4, 5].map((k) => ({
  anchor: `row${k}`,
  text: k === 0 ? '1 · most impact' : k === 6 ? '7 · least impact' : String(k + 1),
  side: 'left',
  tone: k === 0 ? 'lime' : 'cream',
}));

export const scenarios: Dive = {
  scene: 'scenarios',
  kicker: 'Scenario generation',
  pins: [
    { anchor: 'fields', label: 'Fields', step: 'fields' },
    { anchor: 'barn', label: 'Barn', step: 'barn' },
    { anchor: 'silo', label: 'Silo', step: 'silo' },
    { anchor: 'windmill', label: 'Windmill', step: 'machinery' },
    { anchor: 'dock', label: 'Dock', step: 'review' },
  ],
  steps: [
    {
      id: 'farm',
      title: 'From a job role to a world of work',
      line: 'Every part of the farm is one part of the system that turns a job role into scenarios a learner can work through.',
      focus: 'farm',
      fill: 0.94,
      points: [
        'The fields are the focus map, the barn builds scenarios, the silo keeps what was already made, the dock checks everything and the windmill runs the work.',
        'One focus becomes dozens of scenarios, each with objectives, stages, files, voices and films: generated, checked and repaired without a person in the loop.',
        'Every step leaves a tracked run, so the dashboard shows what is being made, what it cost and, when something fails, why.',
      ],
      stack: ['FastAPI', 'Redis + RQ', 'Temporal', 'Claude on Bedrock', 'Gemini', 'Playwright', 'ffmpeg', 'Postgres'],
    },
    {
      id: 'fields',
      title: 'The focus map, planted in rows',
      line: 'A job role becomes a map: categories of work in rows, the most valuable to the company first.',
      focus: 'fields',
      fill: 0.9,
      points: [
        'Categories and projects are ranked by their impact on the company, not by how easy they are to start, so learners meet the work that matters first.',
        'A critic reviews every map. The shape an operator asks for is guaranteed in code after the model answers: trimmed or topped up, never just requested.',
        'Concepts, tools and projects refer to each other by name, and every read and write checks for a broken link.',
        'A map can be re-ranked without being regenerated: the model only proposes an order, and code checks that nothing was added, dropped or renamed.',
      ],
      labels: [...rowLabels, { anchor: 'critic', text: 'The critic', short: 'Critic', side: 'top', tone: 'violet' }],
    },
    {
      id: 'barn',
      title: 'Card in, scenario out',
      line: 'Each card on the map is assembled on a line: a scenario, then its objectives, then typed stages and everything they need.',
      focus: 'barn',
      fill: 0.86,
      points: [
        'Scenario, objectives, stages of a given type, and exactly one final evaluation per objective, enforced in code after generation rather than hoped for in a prompt.',
        'Generation is verified: each step reads back what it stored and retries only what is missing, so a retry never pays for work that already exists.',
        'Every background job is safe to run twice, and a deploy can stop at any step and pick up later without a duplicate.',
        'A failed step records why on its own run, instead of a scenario quietly shipping with a hole in it.',
      ],
      labels: [
        { anchor: 'station1', text: 'Scenario', side: 'top', tone: 'cream' },
        { anchor: 'station2', text: 'Objectives', side: 'bottom', tone: 'amber' },
        { anchor: 'station3', text: 'Typed stages', short: 'Stages', side: 'top', tone: 'lime' },
        { anchor: 'verify', text: 'Read back', side: 'top', tone: 'cyan' },
      ],
    },
    {
      id: 'crate',
      title: 'What one scenario carries',
      line: 'A crate is everything a learner needs to do one piece of real work, made to fit together.',
      focus: 'dock',
      fill: 0.7,
      diagram: 'crate',
      frame: 'low',
      points: [
        'A project brief with a real company, a problem and a team, and one line on why the work matters.',
        'Stages with their files and data, the checks the work must pass, and a short voice note for each deliverable.',
        'A learn mode for every stage: a branching chat with the manager that opens on a walkthrough video of that stage.',
        'A kickoff film, a face and a voice for every character, training videos, a warm-up before the first project, and an exemplar of what good looks like.',
      ],
    },
    {
      id: 'wgll',
      title: 'What Good Looks Like',
      line: 'Before they start, a learner can see the bar: a finished example of the work, made the way a strong colleague would make it.',
      focus: 'barn',
      fill: 0.86,
      diagram: 'wgll',
      frame: 'low',
      points: [
        'Planned part by part against the stage’s own checks. Code rejects a plan that misses one.',
        'Built as data (document blocks, slides, spreadsheet cells) and laid out by code, so charts come from stated numbers and every formula is computed.',
        'Judged by a different model, check by check, each verdict backed by a quote that is verified to exist. A web page is judged on what a real browser reaches, every button pressed.',
        'Repaired once, when that is better and affordable. And it is the product only: never notes, instructions or a deployment guide.',
      ],
      labels: [{ anchor: 'exemplar', text: 'The exemplar', short: 'Exemplar', side: 'top', tone: 'lime' }],
    },
    {
      id: 'review',
      title: 'Reviewers in the loop',
      line: 'Nothing ships on a model’s word alone. Free checks in code go first, then a judge, and doubt always costs money rather than quality.',
      focus: 'dock',
      fill: 0.7,
      diagram: 'review',
      frame: 'low',
      points: [
        'Validators in code run before any model judges: lengths, counts, banned words, broken links, a formula that does not compute.',
        'Judges are graded asymmetrically. An error, a junk answer or a refusal all mean generate: a wrong reuse would ship the wrong video to a learner, a wrong refusal only costs a duplicate.',
        'A generated line is stored only if it passes its own rules. One re-ask carries the reason; a second failure stores nothing.',
        'Every scenario is then audited twice: for what exists, and for whether it is any good.',
      ],
      labels: [{ anchor: 'inspector', text: 'Inspector', side: 'top', tone: 'lime' }],
    },
    {
      id: 'plain',
      title: 'Written for a smart ten-year-old',
      line: 'Every sentence a learner reads in a warm-up is held to rules that make it plain, and the hard limits are checked in code.',
      focus: 'fields',
      fill: 0.9,
      diagram: 'plain',
      frame: 'low',
      points: [
        'One idea a sentence, aiming for under 15 words. Anything over 22 is rejected outright.',
        'At most five new terms in a whole warm-up.',
        'No file paths, extensions or line numbers, and code shown as the smallest illustration, with a blank where the learner’s answer goes.',
        'Every checkpoint says what its answer is for before it asks. A critic judges the rest.',
      ],
    },
    {
      id: 'silo',
      title: 'Reuse before generate',
      line: 'Before anything new is made, the silo is asked, level by level, whether it already has it.',
      focus: 'silo',
      fill: 0.82,
      points: [
        'Exact match first: a ready training on the same subject costs nothing.',
        'Then join a run already being made, judged by its progress: one that has stopped writing is treated as dead, not waited on.',
        'Then a near match, which a judge must confirm will equip the learner on its own. Only then generate, so everyone after can reuse it.',
        'A timeout never pays twice, and a read that fails is never mistaken for “nothing found”.',
      ],
      labels: [
        { anchor: 'level1', text: '1 · Exact match', short: '1 · Exact', side: 'right', tone: 'lime' },
        { anchor: 'level2', text: '2 · Join a run in progress', short: '2 · Join', side: 'right', tone: 'amber' },
        { anchor: 'level3', text: '3 · Judged near match', short: '3 · Near match', side: 'right', tone: 'violet' },
        { anchor: 'level4', text: '4 · Generate', short: '4 · Generate', side: 'right', tone: 'cream' },
      ],
    },
    {
      id: 'loops',
      title: 'The loops',
      line: 'Making is only half of it. Everything that ships comes back as evidence, and the evidence changes what gets made next.',
      focus: 'farm',
      fill: 0.94,
      diagram: 'farmloops',
      points: [
        'Generate, audit, repair, audit again: what can be fixed automatically is, and the rest is flagged with a reason.',
        'Simulated learners play every scenario downstream; where they stumble becomes a fix, previewed, applied and undoable.',
        'Recurring problems become playbook rules, so the next map and the next scenario start better.',
      ],
    },
    {
      id: 'machinery',
      title: 'The machinery',
      line: 'The windmill never stops: queues, durable workflows and model ladders keep the farm running through failures.',
      focus: 'windmill',
      fill: 0.78,
      diagram: 'machinery',
      frame: 'low',
      points: [
        'Three work queues (language models, media and assets), every job safe to retry, and a dead-letter bin for what cannot be.',
        'Long flows run as durable workflows that survive a redeploy and pick up where they stopped.',
        'Every model call walks a ladder of models across providers, so one outage never stops a run; prompt caching makes repeated prefixes cheap.',
        'Every call is metered to the run that made it, and can be traced end to end.',
      ],
      labels: [
        { anchor: 'gears', text: 'Workflows', side: 'right', tone: 'cream' },
        { anchor: 'queues', text: 'Three queues', side: 'right', tone: 'lime' },
        { anchor: 'deadletter', text: 'Dead letters', side: 'left', tone: 'red' },
      ],
    },
  ],
};
