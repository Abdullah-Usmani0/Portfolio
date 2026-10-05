/**
 * The mini-lab: a stuck learner, their manager, and the ten blocks of the manager's context.
 * Each block a visitor switches off takes something specific out of the reply. Canned, so it
 * is honest about being a demonstration, and pure, so every switch can be tested.
 */

export const LAB = {
  manager: 'Maya',
  learner: 'I think my churn analysis is done. Can I send it to the client?',
} as const;

/** What the reply loses without each block, in block order. */
export const LAB_LOSSES = [
  'Without identity it talks like a generic assistant, not like your manager.',
  'Without the framework it does the work for you instead of making you think.',
  'Without the task it does not know which piece of work this is.',
  'Without requirements there is no bar, so it approves the work.',
  'Without resources it cannot see your file.',
  'Without memory it forgets the mistake you found this morning.',
  'Without feedback it repeats a note you already fixed.',
  'Without retrieval it loses the brief’s exact definition.',
  'Without learner state it explains what you already know.',
  'Without voice the facts survive, but it stops sounding like Maya.',
] as const;

const [IDENTITY, FRAMEWORK, TASK, REQUIREMENTS, RESOURCES, MEMORY, FEEDBACK, RETRIEVAL, LEARNER, VOICE] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** The manager's reply with the given blocks on (index = block, identity first). */
export function labReply(on: readonly boolean[]): string {
  const has = (k: number) => on[k] !== false;
  const voiced = has(VOICE);
  const out: string[] = [];

  // Who is talking, and how.
  if (!has(IDENTITY)) out.push('As an AI assistant, I’m happy to review this.');
  else out.push(voiced ? 'Close, not yet.' : 'Thank you for sharing your analysis.');

  // The work itself: which task, the bar it has to clear, the facts and the file.
  const which = has(TASK) ? 'For the retention review' : 'I’m not sure which piece of work this is, but';
  if (!has(REQUIREMENTS)) out.push(`${which}, it looks good to me.`);
  else {
    const bar = `the brief counts paying customers only${has(RETRIEVAL) ? ', over a 90-day window' : ''}`;
    const file = has(RESOURCES) ? 'your sheet still counts trial users on the Q3 tab' : 'I can’t see your file from here';
    out.push(`${which}, ${bar}, and ${file}.`);
    if (has(MEMORY) && has(RESOURCES)) out.push('Same double count we caught in the cohort table this morning.');
  }

  // What was said before.
  if (has(FEEDBACK)) out.push(voiced ? 'Your date fix landed, nice.' : 'The date formatting issue has been resolved.');
  else out.push(voiced ? 'Also, check your dates.' : 'Please also make sure your dates are formatted consistently.');

  // What they already know, and whether the manager asks or tells.
  if (!has(LEARNER)) out.push('First, a cohort is a group of customers who started in the same month.');
  const knows = has(LEARNER) ? (voiced ? 'You know cohorts, so: ' : 'Given your understanding of cohorts, ') : '';
  if (has(FRAMEWORK)) out.push(`${knows}${voiced ? 'which filter would you change first?' : 'which filter would you adjust first?'}`);
  else out.push(voiced ? 'Change the status filter to paying only and you’re done.' : 'Please update the status filter to include paying customers only.');

  // Signed by someone, or by no one.
  if (has(IDENTITY)) out.push(voiced ? `— ${LAB.manager}` : `Best regards, ${LAB.manager}`);
  else out.push('Let me know if there’s anything else I can help with!');

  // A sentence that starts after "so: " or ", " keeps its own case.
  return out.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}
