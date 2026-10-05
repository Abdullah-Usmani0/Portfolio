/**
 * The Curriculum Council dive: six buildings, each a council of agents, then the loops that
 * make them better. Conceptual by design: no internal names, URLs, IDs or costs.
 */
import type { Dive } from './types.ts';

export const councils: Dive = {
  scene: 'councils',
  kicker: 'Curriculum Council',
  pins: [
    { anchor: 'research', label: 'Research', step: 'research' },
    { anchor: 'design', label: 'Design', step: 'design' },
    { anchor: 'implementation', label: 'Implementation', step: 'implementation' },
    { anchor: 'audit', label: 'Audit', step: 'audit' },
    { anchor: 'training', label: 'Training', step: 'training' },
    { anchor: 'media', label: 'Media', step: 'media' },
  ],
  steps: [
    {
      id: 'town',
      title: 'Six councils, one curriculum',
      line: 'Each building is a council of agents that owns one part of the work. Click a building, or step through them.',
      focus: 'town',
      fill: 0.92,
      points: [
        '127 agents, each bound to exactly one tool, so every run has an owner and every finding has a home.',
        'A job role goes in; a researched, designed, generated and audited focus comes out.',
        'Work moves between councils as tracked runs, so every step leaves a record the next one can read.',
      ],
      stack: ['LangGraph', 'Temporal', 'Redis + RQ', 'AWS Bedrock', 'Postgres'],
    },
    {
      id: 'research',
      title: 'Research, the observatory',
      line: 'Finds out what the work actually is before anything gets built.',
      focus: 'research',
      points: [
        'Reads real job postings and counts what they ask for (skills, tools, responsibilities), always with the number of postings behind each figure.',
        'Ingests and distils sources into a knowledge library, and re-reads entries as they go stale.',
        'Turns those signals into proposals of what to build next, which a person or the autonomy kernel approves.',
      ],
    },
    {
      id: 'design',
      title: 'Design, the drafting tower',
      line: 'Turns a role into a focus map: what to learn, and in what order.',
      focus: 'design',
      points: [
        'Categories and projects are ranked by their impact on the company, not by how easy they are to start.',
        'A critic reviews every map, and the shape an operator asks for is guaranteed in code, trimmed or topped up after the model answers.',
        'Concepts, tools and projects link to each other by name, and every write is checked for broken links.',
      ],
    },
    {
      id: 'implementation',
      title: 'Implementation, the workshop',
      line: 'Builds every scenario, objective, stage and asset a learner will touch.',
      focus: 'implementation',
      points: [
        'Scenario → objectives → typed stages, each with its brief, resources, submission checks, voice note, learn mode and an exemplar of what good looks like.',
        'Background jobs are safe to run twice: a repeated job finds its own work and skips it.',
        'Generation is verified: it reads back what it wrote and retries only what is missing.',
      ],
    },
    {
      id: 'audit',
      title: 'Audit, the lighthouse',
      line: 'Watches everything that ships, and repairs what it can.',
      focus: 'audit',
      fill: 0.86,
      points: [
        'Every scenario is audited twice over: does each piece exist, and is it any good.',
        'Fixable gaps go to repair levers automatically; everything else is flagged with its reason attached.',
        'Simulated learners play each scenario, so the audit sees it the way a learner would.',
      ],
    },
    {
      id: 'training',
      title: 'Training, the academy',
      line: 'Makes the short videos that teach a tool, a workflow or an idea.',
      focus: 'training',
      points: [
        'A script written to be spoken, cut into segments, narrated, and drawn as a diagram deck timed to the voice.',
        'Reuse before generating: an exact match, joining a run already in progress, or a near match a judge has checked.',
        'Real product windows are drawn once, checked by a person and reused, so what a learner sees transfers to the real tool.',
      ],
    },
    {
      id: 'media',
      title: 'Media, the studio',
      line: 'Gives every character a face and a voice.',
      focus: 'media',
      points: [
        'Portraits, voices, kickoff films and talking avatars for every character.',
        'Every render is tracked, so a failed portrait says why instead of quietly going missing.',
        'Companies and faces are spread across a focus, so a learner never meets the same one twice in a row.',
      ],
    },
    {
      id: 'skillops',
      title: 'SkillOps, the loop that learns',
      line: 'Every run teaches the councils something, but only a pattern is allowed to change a prompt.',
      focus: 'town',
      fill: 0.92,
      diagram: 'skillops',
      frame: 'low',
      points: [
        'Run, journal, reflect: each agent writes down what happened and what it learned.',
        'A pattern gate: a failure has to recur across at least 3 scenarios in 2 focuses before it counts.',
        'A curated playbook changes by small edits and is never rewritten wholesale; retired rules are kept, not deleted.',
        'A prompt rewrite is proposed, validated (placeholders intact, the change bounded), applied, then measured before and after. Worse by 10 points means undo.',
      ],
    },
    {
      id: 'kernel',
      title: 'The autonomy kernel',
      line: 'One gate that every automatic decision has to pass through.',
      focus: 'town',
      fill: 0.92,
      diagram: 'kernel',
      frame: 'low',
      points: [
        'A dial for each kind of decision: off, propose only, act above a confidence threshold, or always.',
        'Daily caps, and a brake that is read fresh before every single decision.',
        'It fails closed: anything unknown or unreadable becomes a proposal for a person.',
        'Every action records its undo before it acts.',
      ],
    },
    {
      id: 'loops',
      title: 'Loops between the councils',
      line: 'The councils feed each other, so the next build starts smarter than the last.',
      focus: 'town',
      fill: 0.92,
      diagram: 'loops',
      points: [
        'Research feeds design, design feeds the workshop, and the workshop feeds the audit.',
        'Audit findings come back as playbook rules that change the next design.',
        'A nine-step autopilot chains it all, one job role at a time, and picks up where it left off after a redeploy.',
      ],
    },
  ],
};
