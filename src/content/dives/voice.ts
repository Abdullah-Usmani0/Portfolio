/**
 * The Voice dive: the lake stage at night, step by step. The truss over the stage is the
 * voice pipeline; the boats race to the first spoken sentence; the lanterns light one per
 * sentence; the laptop on the shore shares its screen through a gate that drops repeats.
 */
import type { Dive } from './types.ts';

export const voice: Dive = {
  scene: 'voice',
  kicker: 'Real-time voice',
  pins: [
    { anchor: 'race', label: 'The race', step: 'race' },
    { anchor: 'ledger', label: 'Verdict', step: 'verdict' },
    { anchor: 'lamp3', label: 'Speech', step: 'sentences' },
    { anchor: 'laptop', label: 'Screen', step: 'screen' },
    { anchor: 'screen', label: 'Avatar', step: 'teach' },
    { anchor: 'lamp0', label: 'The stack', step: 'stack' },
  ],
  steps: [
    {
      id: 'call',
      title: 'A call, not a chat',
      line: 'Learners talk to their manager out loud, in real time, with a face on the screen: live tutoring agents on LiveKit.',
      focus: 'stage',
      fill: 0.92,
      points: [
        'Speech goes in, a spoken reply comes out, and an avatar moves its lips to the words.',
        'Live meeting agents for adaptive tutoring lifted student engagement by 340%.',
        'Most of this dive is about the first two seconds: what happens between a learner finishing a sentence and hearing the reply.',
      ],
      stack: ['LiveKit', 'WebRTC', 'Deepgram', 'ElevenLabs', 'Tavus', 'HeyGen'],
    },
    {
      id: 'race',
      title: 'The race to the first word',
      line: 'Grading the learner’s answer and writing the reply used to be two calls in a row. Now one streamed call does both, and the first sentence is spoken at 2.1 seconds instead of 5.4.',
      focus: 'race',
      fill: 0.86,
      frame: 'low',
      diagram: 'twocalls',
      points: [
        'The verdict comes first in the stream, so the reply starts right behind it instead of after a second call.',
        'It grades like an outside examiner: an answer heading the right way gets credit, an irrelevant one never does.',
        'On replays, three in four answers heading the right way got credit, against six in ten before, and nothing irrelevant was credited either way.',
      ],
      labels: [
        { anchor: 'finishFast', text: '2.1 s · one streamed call', short: '2.1 s', side: 'left', tone: 'lime', id: 'voice-fast' },
        { anchor: 'finishSlow', text: '5.4 s · grade, then reply', short: '5.4 s', side: 'left', id: 'voice-slow' },
      ],
    },
    {
      id: 'verdict',
      title: 'The verdict is never voiced',
      line: 'The verdict streams first, inside a tag the voice never sees. Only what comes after it can be spoken.',
      focus: 'pipeline',
      fill: 0.8,
      frame: 'low',
      diagram: 'verdict',
      points: [
        'Nothing before the closing tag ever reaches the speaker, so a grade, a reasoning step or half a tag cannot be read aloud.',
        'If the stream does not open with a well-formed verdict, the turn falls back to the two calls before a word is spoken.',
        'The old grader still runs beside it as a shadow and every disagreement is logged. It never changes the credit.',
        'If the stream dies after the verdict, the verdict stands: it grades what the learner said.',
      ],
      labels: [
        { anchor: 'ledger', text: 'Recorded, never spoken', short: 'Never spoken', side: 'top', alt: 'bottom', tone: 'lime' },
        { anchor: 'lamp3', text: 'Only the reply is voiced', short: 'Reply only', side: 'top' },
      ],
    },
    {
      id: 'sentences',
      title: 'Speaking while thinking',
      line: 'Audio starts as soon as the first sentence is written, while the model is still writing the rest. A lantern lights for every sentence spoken.',
      focus: 'stage',
      fill: 0.9,
      frame: 'low',
      diagram: 'sentencegate',
      points: [
        'A sentence gate lets text through one sentence at a time, and holds anything after a question until it knows whether the reply should stop there.',
        'Words already spoken are never rewritten. If the model fails mid-reply, what the learner heard stands as the reply.',
        'A failed sentence is not retried: the learner would hear the words twice.',
        'The whole reply is still checked when it ends, and if it changed, the clip that is kept is made from the final words.',
      ],
      labels: [
        { anchor: 'lamp3', text: 'One sentence at a time', short: 'Per sentence', side: 'top', tone: 'lime' },
        { anchor: 'lanterns', text: 'A lantern per sentence spoken', side: 'bottom', wide: true },
      ],
    },
    {
      id: 'screen',
      title: 'Seeing the screen',
      line: 'When a learner shares their screen, the model gets a fresh frame every second, and never pays to see the same one twice.',
      focus: 'screenshare',
      fill: 0.72,
      frame: 'low',
      diagram: 'framegate',
      points: [
        'Each frame is fingerprinted in full, so one changed pixel makes a new frame. There is no debounce and no delay: a change is seen as fast as before.',
        'Anything the gate cannot prove was already sent is sent.',
        'A frame counts as sent only once the push has really gone through, so a dropped connection never hides a change.',
      ],
      labels: [
        { anchor: 'gate', text: 'Seen it? Not sent again', short: 'Repeats dropped', side: 'top', tone: 'amber' },
        { anchor: 'laptop', text: 'The learner’s screen, every second', short: 'Every second', side: 'left', alt: 'bottom' },
        { anchor: 'lamp2', text: 'The model', side: 'top', wide: true },
      ],
    },
    {
      id: 'teach',
      title: 'Teach, then check',
      line: 'When a learner is stuck, the manager teaches the point plainly, then asks one question that makes them use it.',
      focus: 'screen',
      fill: 0.6,
      frame: 'low',
      diagram: 'teach',
      points: [
        'Placed in the turn’s own instruction rather than the system prompt, the same words taught on 28 of 40 stuck turns instead of about 14.',
        'After fifteen of the learner’s messages there is one offer to move on, in the manager’s own voice, and the learner decides.',
        'Moving on early keeps the progress made, and the record says why the session ended.',
      ],
      labels: [{ anchor: 'screen', text: 'The manager, live', side: 'right', tone: 'lime' }],
    },
    {
      id: 'stack',
      title: 'The stack',
      line: 'Every hop from a learner’s voice to the manager’s face, each one measured.',
      focus: 'pipeline',
      fill: 0.86,
      frame: 'low',
      diagram: 'voicestack',
      points: [
        'LiveKit and WebRTC carry the call, Deepgram transcribes, Claude and Gemini think, ElevenLabs speaks, and Tavus and HeyGen give the face.',
        'Every model call is metered to the learner it served, so the cost of a turn is known.',
        'Each turn’s timing is logged leg by leg, so a slow second has a name.',
      ],
      labels: [
        { anchor: 'lamp0', text: 'LiveKit', side: 'top' },
        { anchor: 'lamp1', text: 'Deepgram', side: 'top' },
        { anchor: 'lamp2', text: 'Claude · Gemini', side: 'top', tone: 'lime' },
        { anchor: 'lamp3', text: 'ElevenLabs', side: 'top' },
        { anchor: 'lamp4', text: 'Tavus · HeyGen', side: 'top' },
      ],
      stack: ['LiveKit', 'WebRTC', 'Deepgram', 'Claude', 'Gemini', 'ElevenLabs', 'Tavus', 'HeyGen'],
    },
  ],
};
