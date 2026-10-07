/**
 * Every word on the page, in one place, so the page and the printable CV say the same
 * thing. Conceptual by design: no internal names, URLs, IDs or costs; numbers are the
 * public-safe ones from the résumé and the write-ups.
 *
 * `*text*` marks the words set in the serif italic.
 */
export interface Proof {
  stat: string;
  label: string;
  text: string;
}

export interface Chapter {
  id: string;
  kicker: string;
  title: string;
  /** One sentence for the scene card; the rest lives in the details panel. */
  line: string;
  lead: string;
  proofs: readonly Proof[];
  stack: readonly string[];
}

export const person = {
  name: 'Muhammad Abdullah Usmani',
  role: 'Founding AI Engineer',
  where: 'Dubai',
  email: 'abdullahusmani74@gmail.com',
  linkedin: 'https://www.linkedin.com/in/muhammadabdullahusmani/',
  github: 'https://github.com/Abdullah-Usmani0',
} as const;

export const hero = {
  line: 'Founding AI Engineer. I build agentic AI systems: self-improving multi-agent platforms and real-time voice AI.',
  lead: 'I build *agentic AI systems*: self-improving multi-agent platforms and real-time voice AI.',
} as const;

/** The headline numbers. The printable CV shows them; the front page leads with the work instead. */
export const metrics = [
  { stat: '1M+', label: 'learner interactions a day' },
  { stat: '99.8%', label: 'uptime in production' },
  { stat: '<200 ms', label: 'response latency' },
  { stat: '+340%', label: 'student engagement' },
] as const;

export const chapters: readonly Chapter[] = [
  {
    id: 'npcs',
    line: 'AI coworkers with a voice, a memory and a personality of their own.',
    kicker: 'AI coworkers',
    title: 'AI characters people actually *talk to*.',
    lead: 'Every character on Zero is a person, not a prompt. Each has about ninety traits, a voice of its own, a memory of you, and a context window rebuilt for every turn. A manager stays the same person across chat, planning, grading and nudges.',
    proofs: [
      { stat: '~90', label: 'traits per character', text: 'Personality, communication style, voice and look, generated once and kept consistent.' },
      { stat: '1', label: 'person, everywhere', text: 'The same manager in chat, plan mode, feedback and live calls.' },
      { stat: 'Last', label: 'the voice block', text: 'Voice is written as a disposition and placed at the end of the context, so style never outranks the task.' },
    ],
    stack: ['LangGraph', 'Claude', 'Gemini', 'ElevenLabs', 'Supabase'],
  },
  {
    id: 'councils',
    line: '127 tool-bound agents build a curriculum, and learn from every run.',
    kicker: 'Curriculum Council',
    title: 'Six councils of agents that *improve themselves*.',
    lead: '127 tool-bound agents research, design, build, audit, train and film a curriculum. A SkillOps loop turns their recurring failures into better prompts, but only once the evidence spans enough scenarios to be a real pattern.',
    proofs: [
      { stat: '127', label: 'tool-bound agents', text: 'One agent per tool, organised into six councils with their own memory and playbooks.' },
      { stat: '9', label: 'autopilot steps', text: 'From a job role to a researched, generated, deployed and audited focus.' },
      { stat: 'Fail-closed', label: 'autonomy', text: 'Every automatic action passes one kernel with dials, daily caps, undo and a brake.' },
    ],
    stack: ['LangGraph', 'Temporal', 'Redis + RQ', 'AWS Bedrock', 'Postgres'],
  },
  {
    id: 'scenarios',
    line: 'Focus maps, scenarios and stages, with an exemplar that shows what good looks like.',
    kicker: 'Scenario generation',
    title: 'One job role in, *a world of work* out.',
    lead: 'A role becomes a focus map, the map becomes scenarios, and each scenario becomes objectives and typed stages, with the resources, voice notes, checks and the What Good Looks Like exemplar a learner needs to do real work.',
    proofs: [
      { stat: 'WGLL', label: 'what good looks like', text: 'An exemplar planned against the grading checks, built as data and rendered by code, so learners see the bar before they build.' },
      { stat: 'Reuse', label: 'before generate', text: 'Existing trainings are matched and reused before anything new is generated.' },
      { stat: 'Resume', label: 'any deploy', text: 'A deploy can stop at any step and pick up again without duplicates.' },
    ],
    stack: ['FastAPI', 'RQ workers', 'AWS Bedrock', 'Playwright', 'ffmpeg'],
  },
  {
    id: 'learners',
    line: 'Simulated cohorts play every scenario before a real person does.',
    kicker: 'Simulated learners',
    title: 'Learners that *fail first*, so real ones don’t.',
    lead: 'Before a scenario ships, a cohort of simulated learners plays it through the real platform. They read each stage cold, ask the manager, hand in real files and retry until they pass. Where they stumble becomes a fix.',
    proofs: [
      { stat: '5', label: 'learner personas', text: 'From a nervous first-timer to a domain expert, each with its own habits.' },
      { stat: '≥60%', label: 'means systemic', text: 'When most of a cohort trips on the same step, the content is wrong, not the learner.' },
      { stat: 'Re-run', label: 'every fix', text: 'Fixes are previewed, applied, revertible and measured on the next cohort.' },
    ],
    stack: ['Python', 'RQ', 'Claude', 'WebSockets', 'Postgres'],
  },
  {
    id: 'voice',
    line: 'Live tutoring on LiveKit, with 2.1 seconds to the first spoken sentence.',
    kicker: 'Real-time voice',
    title: 'Voice agents that *feel like a call*.',
    lead: 'LiveKit meeting agents tutor learners live, with avatar video from Tavus and HeyGen. Grading and replying in one streamed call cut the wait for the first spoken sentence from 5.4 to 2.1 seconds.',
    proofs: [
      { stat: '2.1 s', label: 'to first sentence', text: 'Down from 5.4 s: the verdict streams first and the reply follows in the same call.' },
      { stat: '+340%', label: 'student engagement', text: 'With live AI meeting agents for adaptive tutoring.' },
      { stat: 'Per sentence', label: 'speech', text: 'Audio starts while the model is still writing the rest.' },
    ],
    stack: ['LiveKit', 'WebRTC', 'Deepgram', 'ElevenLabs', 'Tavus', 'HeyGen'],
  },
];

export const mind = {
  id: 'mind',
  line: 'How every character’s mind is assembled, one block at a time.',
  kicker: 'Context engineering',
  title: 'Context, *poured in order*.',
  lead: 'Every turn, a character’s context is assembled block by block, identity first and voice last. Everything above the cache line is a stable prefix the model has already read. Below it is the live turn.',
  blocks: [
    ['Identity', 'Who this person is'],
    ['Framework', 'How a session runs'],
    ['Task', 'The stage in front of the learner'],
    ['Requirements', 'What the work has to satisfy'],
    ['Resources', 'Files and data in play'],
    ['Memory', 'A rolling summary of the story so far'],
    ['Feedback', 'What was flagged, offered and changed'],
    ['Retrieval', 'Facts fetched just in time'],
    ['Learner state', 'What they understand so far'],
    ['Voice', 'How this person talks'],
  ] as const,
  /** The cache line sits before this block index. */
  cacheLine: 4,
  techniques: [
    { name: 'Memory', text: 'A rolling summary every ten turns, and long histories trimmed to their opening and their latest exchanges.' },
    { name: 'Perception', text: 'A frame gate drops identical screen frames with no added latency.' },
    { name: 'Retrieval', text: 'A semantic answer cache at 0.95 similarity: a paraphrase scores 0.967, a near miss 0.880.' },
    { name: 'Evaluation', text: 'Teach, then check: full explanations rose from 6 to 28 of 40 stuck turns.' },
  ],
} as const;

export const ascent = {
  id: 'ascent',
  line: 'From base camp at university to founding engineer at Zero.',
  kicker: 'Career',
  title: 'Camp by camp, *up the mountain*.',
  lead: 'Every role was a camp on the way up. The mountain is K2, 8,611 metres, and the summit is what comes next.',
  camps: [
    {
      altitude: '5,150 m',
      camp: 'Base camp',
      org: 'American University of Sharjah',
      role: 'BS Computer Science, minor in Data Science',
      dates: '2020 – 2024',
      note: 'Magna Cum Laude, 3.73 GPA. Undergraduate Research Award and 2nd place in the CS senior design competition.',
    },
    {
      altitude: '6,050 m',
      camp: 'Camp I',
      org: 'SnowHeap',
      role: 'Generative AI Intern',
      dates: 'May – Jul 2023',
      note: 'A full-stack app that turns plain questions into SQL, with vector search, and fine-tuned models 30% more accurate.',
    },
    {
      altitude: '6,700 m',
      camp: 'Camp II',
      org: 'VaporVM',
      role: 'Data Science Intern',
      dates: 'Aug – Oct 2024',
      note: 'Log-insight retrieval with local LLMs, and a support chatbot that halved response times.',
    },
    {
      altitude: '7,200 m',
      camp: 'Camp III',
      org: 'Freelance',
      role: 'Independent ML Engineer',
      dates: 'Jan – May 2025',
      note: 'A multimodal ad-analysis platform (speech, vision and language models) and a multi-agent content workflow.',
    },
    {
      altitude: '7,600 m',
      camp: 'Camp IV',
      org: 'Zero',
      role: 'Founding AI Engineer',
      dates: 'May 2025 – now',
      note: 'Agentic AI systems: AI coworkers, a self-improving multi-agent curriculum platform and real-time voice AI.',
    },
  ],
} as const;

export const index = {
  id: 'index',
  projects: [
    { name: 'UAE traffic signs', year: '2024', text: 'Hierarchical detection and real-time text recognition. 0.92 mAP, 0.89 word accuracy.' },
    { name: 'Jet blade inspection', year: '2023', text: 'Reading etchings on metal blades with scene-text recognition. Sponsored by Lufthansa Technik.' },
    { name: 'Arabic handwriting', year: '2023', text: 'Bimodal gender detection from 2,000+ handwriting samples.' },
    { name: 'Apartment prices', year: '2024', text: 'Regression with Box-Cox transforms and stepwise selection, 8% more accurate.' },
  ],
  recognition: [
    { name: '2nd place, CS senior design competition', year: '2024' },
    { name: 'Undergraduate Research Award', year: '2023' },
    { name: 'IEEE-HKN Honor Society', year: '2023' },
    { name: 'AUS Engineering Honor Society, top 12%', year: '2022' },
    { name: 'Chancellor’s List', year: '2022' },
    { name: 'Dean’s List, six times', year: '2021–24' },
  ],
  certifications: [
    { name: 'Multi AI agents with crewAI', year: '2024' },
    { name: 'Multimodal RAG: chat with videos', year: '2024' },
    { name: 'Agentic RAG with LlamaIndex', year: '2024' },
    { name: 'SAP Professional Fundamentals', year: '2024' },
    { name: 'Supervised machine learning', year: '2023' },
    { name: 'Transformers and BERT', year: '2023' },
    { name: 'LangChain for LLM applications', year: '2023' },
    { name: 'Enterprise Design Thinking', year: '2022' },
  ],
} as const;

/** What was built and won at Zero, in the résumé's words: the Career dive and the CV both use them. */
export const zeroHighlights = [
  'Led the design of a large autonomous multi-agent system in LangGraph that generates real work scenarios: researcher, reviewer and multimodal agents that critique and refine each other until quality thresholds are met.',
  'In production: 1M+ learner interactions a day, at 99.8% uptime and under 200 ms.',
  'Live voice agents on LiveKit for adaptive tutoring lifted student engagement 340%; the multimodal content pipeline improved learning outcomes 85%.',
] as const;

/** What the work is built with, grouped the way the printable CV lists it. */
export const skills = [
  { group: 'Languages', items: ['Python', 'C++', 'JavaScript', 'Java', 'SQL'] },
  { group: 'Agents and LLMs', items: ['LangGraph', 'LangChain', 'CrewAI', 'LlamaIndex', 'AutoGen', 'Claude', 'Gemini', 'AWS Bedrock'] },
  { group: 'Models', items: ['PyTorch', 'TensorFlow', 'Transformers', 'YOLOv8', 'Whisper'] },
  { group: 'Real time', items: ['LiveKit', 'WebRTC', 'Deepgram', 'ElevenLabs', 'Tavus', 'HeyGen'] },
  { group: 'Platform', items: ['FastAPI', 'Temporal', 'Redis', 'Supabase', 'Postgres', 'Docker', 'Kubernetes', 'AWS ECS'] },
] as const;

export const summit = {
  id: 'summit',
  kicker: 'What comes next',
  title: 'The summit is *the future*.',
  vision:
    'I think the next interface is a colleague. AI people with their own voice, memory and judgement, who work beside us and get better every week from the work itself. That is what I am building toward, one scenario and one turn of context at a time.',
} as const;

/** The How it works page's own header. */
export const howItWorks = {
  kicker: 'How it works',
  title: 'The systems behind the valley, *in plain words*.',
  intro:
    'Each scene in the valley is a system I built at Zero, a platform where people learn a job by doing its real work alongside AI coworkers. Here is what each one is, why it exists, and how it works, step by step.',
} as const;

/**
 * How it works (`#systems`): each system said plainly, for a reader who has never heard of
 * it. What it is, then why it exists. The page adds the dive's steps and boards after these.
 */
export const explained: Readonly<Record<string, { intro: string; what: string; why: string }>> = {
  councils: {
    intro: 'The AI team that builds the courses.',
    what: 'Zero teaches a job by having people do its real work. The Curriculum Council is the team of AI agents that builds that work: 127 agents, each in charge of exactly one tool, grouped into six councils the way a company has departments. Research, design, implementation, audit, training and media. A job role goes in; a researched, designed, generated and audited course comes out.',
    why: 'Built by hand, a course is slow to make and goes stale. The council builds it as a chain of recorded runs that anyone can inspect, and it learns from its own mistakes: when the same problem shows up across enough scenarios to be a real pattern, it rewrites the instructions that caused it. Anything it does on its own passes one safety layer, with limits, an undo and an off switch.',
  },
  scenarios: {
    intro: 'How a job role becomes practice work.',
    what: 'A role is broken into a focus map: the skills it needs and the projects that use them. Each project becomes a scenario set in a believable company, with objectives, stages, files, voice notes and a manager who briefs the learner, just like a first week at a new job.',
    why: 'People learn a job by doing it, not by watching it. Every scenario comes with an example of what good looks like, is checked by reviewer agents before it ships, and is written so plainly that a smart ten-year-old could follow the instructions. Anything that was already made is reused before anything new is generated.',
  },
  learners: {
    intro: 'Simulated students who try every scenario first.',
    what: 'Before a real person meets a scenario, a cohort of AI learners plays it from start to finish through the real platform. Each has its own habits, from a nervous first-timer to a domain expert. They read each stage cold, ask the manager questions, hand in real files and are graded by the real evaluator.',
    why: 'If something is confusing or broken, it should trip a simulated learner, not a real one. When most of a cohort stumbles on the same step, the content is at fault, not the learner, so a fix is drafted, previewed, applied, and proven by running the cohort again.',
  },
  npcs: {
    intro: 'The AI managers and teammates learners work with.',
    what: 'Each AI coworker is a whole person, not a prompt: about ninety traits, a voice, a face, and a memory of what you said last time. The same manager briefs you on a project, chats with you while you work, plans with you, reviews what you hand in and checks in when you go quiet.',
    why: 'Learning a job is also learning to work with people. A colleague who stays the same person everywhere, and remembers you, keeps learners coming back, and feedback means more from someone you know than from a form.',
  },
  mind: {
    intro: 'How each AI coworker decides what to think about.',
    what: 'A language model only knows what is in front of it. So on every turn a coworker’s context is rebuilt from ten blocks in a fixed order: who they are, how the session runs, the task, what the work must meet, the files in play, the story so far, what was flagged, facts fetched just in time, what the learner understands, and last of all how they talk.',
    why: 'More context is not better context. The right few facts in the right order make replies faster, cheaper and more accurate, and keeping the opening blocks identical lets the model reuse what it has already read instead of reading it again.',
  },
  voice: {
    intro: 'Live spoken calls with an AI manager.',
    what: 'Learners can talk to their manager out loud, on a video call. The manager listens, thinks and answers in a spoken voice, with a face whose lips move to the words, and can see the learner’s screen when they share it.',
    why: 'A call only feels human if the answer comes quickly. Grading the learner and writing the reply in one stream, and speaking each sentence as soon as it is written, cut the wait for the first word from 5.4 to 2.1 seconds.',
  },
};
