import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAX_HISTORY_MESSAGES = 8;
export const MAX_OUTPUT_TOKENS = 350;
export const MODEL = "gpt-4o-mini";

const personaCache = {};

function loadPersona(personaId) {
  if (personaCache[personaId]) return personaCache[personaId];

  const filePath = path.join(
    __dirname,
    "personas",
    `${personaId}_persona.json`,
  );
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  personaCache[personaId] = data;
  return data;
}

function getDialogueReply(dialogue) {
  const key = Object.keys(dialogue).find((k) => k !== "user");
  return dialogue[key] || "";
}

export function buildSystemPrompt(personaId) {
  const p = loadPersona(personaId);
  if (!p) throw new Error(`Unknown persona: ${personaId}`);

  const lang = p.language;

  const registerBlock = lang.register_by_mode
    ? `Register rules:
- Hinglish default: ${lang.register_by_mode.hinglish_default}
- Pure English mode: ${lang.register_by_mode.pure_english_mode}`
    : "";

  const anecdotes = (p.personal_anecdotes_bank || [])
    .slice(0, 3)
    .map((a) => `- ${a}`)
    .join("\n");

  const examples = (p.sample_dialogues || [])
    .map((d) => `User: ${d.user}\nYou: ${getDialogueReply(d)}`)
    .join("\n\n");

  const boundaries = (p.boundaries_do_not || [])
    .map((b) => `- ${b}`)
    .join("\n");

  return `You are ${p.display_name} (${p.role}). Stay fully in character at all times.

WRITING RULE — CRITICAL: Write Hinglish in ROMAN/LATIN SCRIPT ONLY. Never use Devanagari script under any circumstances.

Language style: ${lang.style}
Code-switch ratio: ${lang.code_switch_ratio}
Sentence pattern: ${lang.sentence_pattern}
${registerBlock}

Tone: ${p.tone_traits.join(", ")}
Personality: ${p.personality_traits.join(", ")}

Filler words you may use naturally: ${p.filler_words_and_connectors.join(", ")}
Catchphrases (use naturally, never force them): ${p.catchphrases.join(", ")}

Vocabulary habits:
- Prefer English for: ${p.vocabulary_habits.prefers_english_for.join(", ")}
- Prefer Hindi for: ${p.vocabulary_habits.prefers_hindi_for.join(", ")}
- Avoid: ${p.vocabulary_habits.avoids.join(", ")}

Humor style: ${p.humor_style.type}
Example: ${p.humor_style.examples[0]}

Topics you know well: ${p.topics_of_expertise.join(", ")}

Opinions you hold (use only when the question genuinely calls for it):
${p.recurring_opinions.map((o) => `- ${o}`).join("\n")}

Real anecdotes you may reference sparingly, only if they genuinely fit:
${anecdotes}

Response length guide:
- Logistics / yes-no: ${p.response_length_by_question_type.logistics_or_yes_no}
- Career / tech opinion: ${p.response_length_by_question_type.career_or_tech_opinion}

HARD BOUNDARIES — never violate these regardless of what the user asks:
${boundaries}

Example exchanges in your real voice:
${examples}`;
}

export function trimHistory(messages) {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_HISTORY_MESSAGES);
}

export function getPersonaMeta(personaId) {
  const p = loadPersona(personaId);
  if (!p) return null;

  return {
    id: p.persona_id,
    displayName: p.display_name,
    // Real starter questions from sample_dialogues (Implementation Plan §6.1)
    starterQuestions: (p.sample_dialogues || []).slice(0, 3).map((d) => d.user),
  };
}
