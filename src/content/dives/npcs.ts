/**
 * The NPCs dive: the village, step by step. Every house is a place the same manager works;
 * the square shows the four ways a character can talk; the post office sends check-ins only
 * when they help; the studio gives every character a face and a voice.
 */
import type { Dive } from './types.ts';

export const npcs: Dive = {
  scene: 'npcs',
  kicker: 'Humanoid NPCs',
  pins: [
    { anchor: 'chat', label: 'Chat', step: 'everywhere' },
    { anchor: 'plan', label: 'Plan', step: 'everywhere' },
    { anchor: 'review', label: 'Feedback', step: 'disposition' },
    { anchor: 'square', label: 'Voices', step: 'styles' },
    { anchor: 'kickoff', label: 'Kickoff', step: 'onemanager' },
    { anchor: 'post', label: 'Check-ins', step: 'checkins' },
    { anchor: 'studio', label: 'Studio', step: 'faces' },
  ],
  steps: [
    {
      id: 'person',
      title: 'A person, not a prompt',
      line: 'Every character on Zero is a person: about ninety traits, a voice, a face and a memory, with a context rebuilt for every turn.',
      focus: 'village',
      fill: 0.92,
      points: [
        'The traits cover personality, how they talk and how they look. They are made once and kept the same wherever the character appears.',
        'What a learner said and did comes back in later conversations, so the next one starts where the last one ended.',
        'Every house in the village is a place the same manager works.',
      ],
      stack: ['LangGraph', 'Claude', 'Gemini', 'ElevenLabs', 'Supabase'],
    },
    {
      id: 'everywhere',
      title: 'One person, everywhere',
      line: 'A learner meets the same manager in chat, in plan mode, at the kickoff, in feedback on their work, in check-ins and on live calls. One voice block is shared by all of them.',
      focus: 'village',
      fill: 0.9,
      frame: 'low',
      diagram: 'everywhere',
      points: [
        'The voice is written once and read by every surface, instead of restated, a little differently, in each one’s prompt.',
        'A trait nobody wrote is left out, never filled with a guess: an empty line reads to a model as an instruction.',
        'So the person who reviews the work sounds like the one who welcomed the learner at the kickoff.',
      ],
      labels: [
        { anchor: 'manager', text: 'The same manager', side: 'bottom', tone: 'lime' },
        { anchor: 'chat', text: 'Chat', side: 'top' },
        { anchor: 'plan', text: 'Plan mode', side: 'bottom', wide: true },
        { anchor: 'review', text: 'Feedback', side: 'top' },
        { anchor: 'kickoff', text: 'Kickoff', side: 'top' },
        { anchor: 'post', text: 'Check-ins', side: 'top' },
      ],
    },
    {
      id: 'styles',
      title: 'Four ways to talk',
      line: 'Every character talks in one of four styles, each with its own humour and a few phrases of its own.',
      focus: 'square',
      fill: 0.62,
      frame: 'low',
      diagram: 'fourvoices',
      points: [
        'Dry and clipped, warm and hypey, chill and thinking aloud, or proper but human.',
        'The style is picked once for each person and never re-rolled, so someone met again in another scenario talks the same way.',
        'Only a missing or default style is filled in. One somebody wrote by hand is never overwritten.',
      ],
      labels: [
        { anchor: 'talker0', text: 'Dry and clipped', short: 'Dry', side: 'bottom', dot: '#e2a46b' },
        { anchor: 'talker1', text: 'Warm and hypey', short: 'Hypey', side: 'bottom', dot: '#7fa9d6' },
        { anchor: 'talker2', text: 'Chill, thinks aloud', short: 'Chill', side: 'bottom', dot: '#c97b8e' },
        { anchor: 'talker3', text: 'Proper but human', short: 'Proper', side: 'bottom', dot: '#8fbf7a' },
      ],
    },
    {
      id: 'disposition',
      title: 'Voice as a disposition',
      line: 'A voice is written as who someone is, not as a list of settings, and placed where it can never outrank the task.',
      focus: 'chat',
      fill: 0.5,
      frame: 'low',
      diagram: 'disposition',
      points: [
        'A list of fields (“Humour: sarcastic. Pace: fast.”) gets performed one field at a time. A disposition (“Your humour is dry.”) gets lived.',
        'Second person, positive statements only, one short section. A trait that would fight a house rule is translated rather than dropped: “sarcastic” is written as “dry”.',
        'Placement is measured, not guessed. One block moved to the front of a prompt took the defects found per submission from 1.45 to 2.66, so the voice sits inside “how you talk”, never first.',
      ],
      labels: [
        { anchor: 'chat', text: 'Every chat turn', side: 'top' },
        { anchor: 'manager', text: 'Style never outranks the task', short: 'Task first', side: 'bottom', tone: 'lime' },
      ],
    },
    {
      id: 'onemanager',
      title: 'One scenario, one manager',
      line: 'Inside a scenario, the same person leads the brief, the team, every objective and every stage, and stays that person when anything is regenerated.',
      focus: 'kickoff',
      fill: 0.55,
      frame: 'low',
      diagram: 'onemanager',
      points: [
        'The manager is read from the role, the way a kickoff picks who runs it, and an existing lead always wins, so shipped content never changes face.',
        'A stage about to be saved without a face gets one first, and after every publish, regeneration or swap anyone missing is added to the team.',
        'Companies are spread across a focus, so a learner never meets the same one twice in a row.',
      ],
      labels: [
        { anchor: 'manager', text: 'The one manager', side: 'bottom', tone: 'lime' },
        { anchor: 'kickoff', text: 'Where the team meets them', short: 'The kickoff', side: 'top' },
      ],
    },
    {
      id: 'checkins',
      title: 'Check-ins that respect you',
      line: 'The manager reaches out only when a learner is genuinely stuck in a stage, and when in doubt, holds back.',
      focus: 'post',
      fill: 0.5,
      frame: 'low',
      diagram: 'nudgegate',
      points: [
        'Never during the kickoff: a call placed then could not be answered.',
        'Never just after a learner arrives. A stage has to have been open a while, and quiet a while, before anyone is stuck in it.',
        'A cooldown stops a second ring, and any check that cannot be read counts as a no.',
      ],
      labels: [
        { anchor: 'bell', text: 'Rings only when it should', short: 'Rings when it should', side: 'top', tone: 'amber' },
      ],
    },
    {
      id: 'faces',
      title: 'Faces and voices',
      line: 'Every character gets a portrait, a voice, a character sheet and moving shots, made in the studio as soon as their scenario is.',
      focus: 'studio',
      fill: 0.5,
      frame: 'low',
      diagram: 'facepipe',
      points: [
        'Portraits come first, for every character in a new scenario, not only for the one in the opening video.',
        'Then the voice, the character sheet, keyframes, video shots and lip-sync. Every stage is tracked, so a failed render says why.',
        'A slow render is waited out for a set time; one that never finishes is reported, not left spinning.',
      ],
      labels: [
        { anchor: 'easel', text: 'The portrait', side: 'right', tone: 'lime' },
        { anchor: 'studio', text: 'The studio', side: 'top' },
      ],
      stack: ['ElevenLabs', 'HeyGen', 'Kling', 'Python', 'RQ workers'],
    },
  ],
};
