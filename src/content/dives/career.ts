/**
 * The Career dive: the climb, camp by camp. Each camp is a role, and each opens a board of
 * what was built and won there. Numbers are the résumé's own; no phone number, anywhere.
 */
import type { Dive, Label } from './types.ts';

/** How high each camp stands on K2's Abruzzi route, beside it on the overview (wide screens). */
const altitudes: Label[] = [
  { anchor: 'base', text: '5,150 m', side: 'right', tone: 'cream', wide: true },
  { anchor: 'camp1', text: '6,050 m', side: 'right', tone: 'cream', wide: true },
  { anchor: 'camp2', text: '6,700 m', side: 'right', tone: 'cream', wide: true },
  { anchor: 'camp3', text: '7,200 m', side: 'right', tone: 'cream', wide: true },
  { anchor: 'camp4', text: '7,600 m', side: 'right', tone: 'cream', wide: true },
  { anchor: 'summit', text: '8,611 m', side: 'left', tone: 'lime', wide: true },
];

export const career: Dive = {
  scene: 'ascent',
  kicker: 'Career',
  pins: [
    { anchor: 'base', label: 'AUS', step: 'aus' },
    { anchor: 'camp1', label: 'SnowHeap', step: 'snowheap' },
    { anchor: 'camp2', label: 'VaporVM', step: 'vaporvm' },
    { anchor: 'camp3', label: 'Freelance', step: 'freelance' },
    { anchor: 'camp4', label: 'Zero', step: 'zero' },
    { anchor: 'summit', label: 'Summit', step: 'summit' },
  ],
  steps: [
    {
      id: 'route',
      title: 'Camp by camp',
      line: 'Every role was a camp on the way up K2: base camp at university, four camps of real work, and the summit still ahead.',
      focus: 'route',
      fill: 0.9,
      points: [
        'Base camp: a Computer Science degree with a minor in Data Science, Magna Cum Laude, and four research projects in computer vision and machine learning.',
        'Camps I to III: generative AI, retrieval and multi-agent systems, for a startup, a cloud company and freelance clients.',
        'Camp IV: founding AI engineer at Zero, where everything in the valley below was built.',
      ],
      labels: altitudes,
    },
    {
      id: 'aus',
      title: 'Base camp: American University of Sharjah',
      line: 'BS in Computer Science with a minor in Data Science, 2020 to 2024. Graduated Magna Cum Laude.',
      focus: 'base',
      diagram: 'honours',
      frame: 'low',
      points: [
        'Magna Cum Laude with a 3.73 GPA, on the Dean’s List six times and the Chancellor’s List.',
        'Inducted into IEEE-HKN, and chosen for the Engineering Honor Society, the top 12% of the class, in the first Tau Beta Pi chapter outside the United States.',
        'The senior design project won an Undergraduate Research Award and 2nd place across the whole Computer Science department.',
        'Off the books: the squash team, two club boards, and a mixed-reality app built in Unity at the Khalifa University × Microsoft hackathon.',
      ],
    },
    {
      id: 'research',
      title: 'Built at base camp',
      line: 'Four projects, from reading road signs at speed to reading serials etched into jet-engine blades.',
      focus: 'base',
      diagram: 'research',
      frame: 'low',
      points: [
        'UAE traffic signs: a three-stage pipeline, YOLOv8 to find the sign and its text, then a PARSeq transformer to read it. 0.92 mAP and 0.89 word accuracy.',
        'Jet blade inspection, sponsored by Lufthansa Technik: scene-text recognition that reads the etchings on metal blades.',
        'Arabic handwriting: hand-built features and a CNN that tell a writer’s gender from 2,000+ samples.',
        'Apartment prices: regression with Box-Cox transforms and stepwise feature selection, 8% more accurate.',
      ],
      stack: ['PyTorch', 'YOLOv8', 'PARSeq', 'OpenCV', 'TensorFlow'],
    },
    {
      id: 'snowheap',
      title: 'Camp I: SnowHeap',
      line: 'Generative AI intern, summer 2023. Plain questions in, SQL out.',
      focus: 'camp1',
      diagram: 'nlsql',
      frame: 'low',
      points: [
        'Led a full-stack Next.js app that writes SQL from a plain-English question, with the schema indexed in Pinecone so the model queries real tables. Data exploration up 95%.',
        'Fine-tuned OpenAI’s DaVinci models and reworked the prompts: generation accuracy up 30%.',
      ],
      stack: ['Next.js', 'OpenAI', 'Pinecone', 'SQL'],
    },
    {
      id: 'vaporvm',
      title: 'Camp II: VaporVM',
      line: 'Data science intern, autumn 2024. Local models that read the logs, and a support bot for Dell.',
      focus: 'camp2',
      diagram: 'logs',
      frame: 'low',
      points: [
        'An information-retrieval system on local models, Ollama running Mistral over ChromaDB, that reads Azure logs and explains them. Troubleshooting became 200% more efficient.',
        'A WhatsApp support bot for Dell on Redis and Twilio that streamlines support tickets. Response times halved.',
      ],
      stack: ['Ollama', 'Mistral', 'ChromaDB', 'Azure', 'Redis', 'Twilio'],
    },
    {
      id: 'freelance',
      title: 'Camp III: Freelance',
      line: 'Independent machine learning engineer, early 2025. An ad critic with eyes and ears, and a crew of writing agents.',
      focus: 'camp3',
      diagram: 'adlab',
      frame: 'low',
      points: [
        'An ad-analysis platform in Gradio: Whisper transcribes the audio, SmolVLM2 reads the frames, and GPT-4 critiques the whole ad. Campaign insights improved 70%.',
        'A multi-agent CrewAI workflow that scrapes, writes and edits social posts. Throughput up 80%.',
      ],
      stack: ['Gradio', 'Whisper', 'SmolVLM2', 'GPT-4', 'CrewAI'],
    },
    {
      id: 'zero',
      title: 'Camp IV: Zero',
      line: 'Founding AI engineer, since May 2025. Humanoid AI coworkers, self-improving agent systems and real-time voice.',
      focus: 'camp4',
      diagram: 'zero',
      frame: 'low',
      points: [
        'Led the design of a large autonomous multi-agent system in LangGraph that generates real work scenarios: researcher, reviewer and multimodal agents that critique and refine each other until quality thresholds are met.',
        'In production: 1M+ learner interactions a day, at 99.8% uptime and under 200 ms.',
        'Live voice agents on LiveKit for adaptive tutoring lifted student engagement 340%; the multimodal content pipeline improved learning outcomes 85%.',
        'Everything in the valley below is this camp’s work.',
      ],
      stack: ['LangGraph', 'LiveKit', 'AWS ECS', 'Supabase', 'Postgres'],
    },
    {
      id: 'summit',
      title: 'The summit: what comes next',
      line: 'The next interface is a colleague: AI people with their own voice, memory and judgement, who get better every week from the work itself.',
      focus: 'summit',
      diagram: 'kit',
      frame: 'low',
      points: [
        'Eight certifications on the way, from multi-agent crewAI and agentic RAG to transformers and design thinking.',
        'Python, C++, JavaScript, Java and SQL.',
        'LangGraph, LangChain, CrewAI, LlamaIndex and AutoGen for agents; PyTorch, TensorFlow and Transformers for models; LiveKit and WebRTC in real time; Docker, Kubernetes and AWS ECS underneath.',
      ],
    },
  ],
};
