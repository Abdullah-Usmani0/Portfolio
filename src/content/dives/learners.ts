/**
 * The Simulated Learners dive: the proving grounds, step by step. A cohort reads each stage
 * cold, asks the manager, hands real work in, stumbles where the content is wrong, and the
 * fix is previewed, applied and measured on the next cohort.
 */
import type { Dive } from './types.ts';

export const learners: Dive = {
  scene: 'learners',
  kicker: 'Simulated learners',
  pins: [
    { anchor: 'cohort', label: 'Cohort', step: 'personas' },
    { anchor: 'managerHead', label: 'Manager', step: 'ask' },
    { anchor: 'grader', label: 'Grader', step: 'handin' },
    { anchor: 'owl', label: 'Owl', step: 'stumble' },
    { anchor: 'mend', label: 'The fix', step: 'fix' },
    { anchor: 'farside', label: 'Re-run', step: 'rerun' },
  ],
  steps: [
    {
      id: 'cohort',
      title: 'A cohort plays it first',
      line: 'Before a real learner meets a scenario, a cohort of simulated learners plays it end to end, through the same platform a person would use.',
      focus: 'grounds',
      fill: 0.92,
      points: [
        'Each one enrols, opens every stage, talks to the manager, hands in real files and is graded by the real evaluator.',
        'Nothing is mocked. If a step is broken for them, it would have been broken for a person.',
        'Where they stumble becomes a fix before anyone else arrives.',
      ],
      stack: ['Python', 'RQ workers', 'WebSockets', 'Claude', 'Postgres'],
    },
    {
      id: 'personas',
      title: 'Five learners, five habits',
      line: 'Each simulated learner is a persona: how much it knows, how it reads, when it asks for help, and how it reworks when the work is sent back.',
      focus: 'cohort',
      fill: 0.55,
      frame: 'low',
      diagram: 'personas',
      points: [
        'From a nervous first-timer to a domain expert, so one scenario is tested by very different people.',
        'A learner keeps who it is between runs, even when its progress is reset, so a result traces back to the same person.',
        'An operator can choose the personas for a run; anything left unchosen comes from the learner’s own profile.',
      ],
      labels: [
        { anchor: 'persona0', text: 'Nervous first-timer', short: 'First-timer', side: 'left', dot: '#7fb2e8' },
        { anchor: 'persona4', text: 'Domain expert', short: 'Expert', side: 'top', alt: 'right', dot: '#e8c95a' },
        { anchor: 'cohort', text: 'Five personas, one scenario', side: 'top', tone: 'lime', wide: true },
      ],
    },
    {
      id: 'cold',
      title: 'The cold read',
      line: 'Before any work, each learner reads the stage cold and says what it thinks the stage is asking. It sees what a person sees: no rubric and no worked answer.',
      focus: 'cohort',
      fill: 0.55,
      frame: 'low',
      diagram: 'coldread',
      points: [
        'The checks the work must meet stay visible; how it is graded does not. Otherwise the read is an open-book exam and finds nothing.',
        'Each paraphrase is compared with what the stage meant, so an unclear line is caught before anyone builds the wrong thing.',
        'A phrase two learners read two ways is the clearest sign a stage needs rewriting.',
      ],
      labels: [
        { anchor: 'cohort', text: 'What is this stage asking?', short: 'What is it asking?', side: 'top', tone: 'cream' },
        { anchor: 'cohort', text: 'One phrase, two readings', side: 'left', tone: 'amber', wide: true },
      ],
    },
    {
      id: 'ask',
      title: 'Asking the manager',
      line: 'When a stage is unclear, a learner does what a person would: it asks the manager in chat, and the manager answers in character.',
      focus: 'manager',
      fill: 0.6,
      frame: 'low',
      diagram: 'askchat',
      points: [
        'The manager is the same character a real learner talks to, with the same voice and the same knowledge of the work.',
        'Questions run both ways: the manager also checks what the learner understood, and both sides are kept as evidence.',
        'A stage that sends many learners to ask is a stage that needs a clearer line.',
        'If the chat itself fails, that is recorded as a platform problem, never as a bad answer from the manager.',
      ],
      labels: [
        { anchor: 'managerHead', text: 'The manager, in character', short: 'The manager', side: 'right', tone: 'lime' },
        { anchor: 'manager', text: 'Asked in chat, as a person would', side: 'top', wide: true },
      ],
    },
    {
      id: 'handin',
      title: 'Real work, really graded',
      line: 'Each learner builds the deliverable as a real file, hands it in, and is graded by the same evaluator a person gets. Sent back, it reworks and tries again.',
      focus: 'grader',
      fill: 0.6,
      frame: 'low',
      diagram: 'attempts',
      points: [
        'Documents, sheets, decks and web pages: real files, made the way the stage asks for them.',
        'A learner reworks until it passes, up to a cap set for each cohort. At the cap the miss is recorded and it moves on.',
        'A dropped connection is not a verdict. A submission nobody graded is not counted as an attempt, so an outage never reads as a hard stage.',
        'It also receives the feedback a person would see, so the feedback is tested too.',
      ],
      labels: [
        { anchor: 'graderDesk', text: 'The real evaluator', short: 'Evaluator', side: 'right', tone: 'lime' },
        { anchor: 'grader', text: 'Rework until it passes', side: 'top' },
        { anchor: 'grader', text: 'Real files, really graded', side: 'bottom', wide: true },
      ],
    },
    {
      id: 'stumble',
      title: 'Where they stumble',
      line: 'Every signal from the run is read once: what each learner understood, what it asked, every verdict, what it learned, and every call to the platform. Then each stumble is blamed on its cause.',
      focus: 'gap',
      fill: 0.62,
      frame: 'low',
      diagram: 'triage',
      points: [
        'Content, harness or learner. Only a stumble the content caused becomes a fix; the rest are counted, never reported as defects.',
        'When most of a cohort trips on the same step, the content is wrong, not the learners.',
        'One judge reads the whole cohort at once. The model labels; plain code does the counting.',
        'Every finding carries its sample: one learner in three is weighed differently from all of them.',
      ],
      labels: [
        { anchor: 'gapEdge', text: 'The broken step', side: 'top', tone: 'amber' },
        { anchor: 'owl', text: 'Blamed on its cause', short: 'Blamed on its cause', side: 'left', alt: 'top' },
      ],
    },
    {
      id: 'fix',
      title: 'A fix, previewed',
      line: 'A stumble the content caused becomes a fix. It is previewed first, applied exactly as previewed, and can be undone.',
      focus: 'mend',
      fill: 0.62,
      frame: 'low',
      diagram: 'fixdiff',
      points: [
        'Each kind of stumble maps to the parts of a stage it can honestly change: an unclear line rewrites the instruction, an unclear bar rewrites the checks.',
        'Apply writes what the preview showed, with no second generation, and every change is saved as a revision that can be reverted.',
        'An autonomy dial can apply fixes on its own, under a daily budget. It ships set to propose, so a person approves until they choose otherwise.',
      ],
      labels: [
        { anchor: 'planks', text: 'Preview: nothing written yet', short: 'Preview first', side: 'bottom', tone: 'cream', id: 'learners-preview' },
        { anchor: 'planks', text: 'Applied, and revertible', short: 'Applied, revertible', side: 'bottom', tone: 'lime', id: 'learners-applied' },
      ],
    },
    {
      id: 'rerun',
      title: 'Run it again',
      line: 'After a fix, the next cohort plays the same scenario, and the two runs are compared stage by stage.',
      focus: 'grounds',
      fill: 0.92,
      frame: 'low',
      diagram: 'beforeafter',
      points: [
        'Each finding is shown beside the run before it, so a fix that worked reads as “instruction reads two ways: 9 → 2”.',
        'A fix that does not move the number is visible as one.',
        'Cohorts also run on their own after new content is built, under a daily cap, so it is played before anyone meets it.',
      ],
      labels: [{ anchor: 'farside', text: 'Crossed clean', side: 'top', tone: 'lime' }],
    },
  ],
};
