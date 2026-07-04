// personaService.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config constants (Implementation Plan §8) ───────────────────────────────
export const MAX_HISTORY_MESSAGES = 8;
export const MAX_OUTPUT_TOKENS = 350;
export const MODEL = "gpt-4o-mini";

// ─── Persona cache ────────────────────────────────────────────────────────────
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

// ─── Generic reply-key extractor ─────────────────────────────────────────────
// Handles hitesh_style_reply vs piyush_style_reply (Implementation Plan §3)
function getDialogueReply(dialogue) {
  const key = Object.keys(dialogue).find((k) => k !== "user");
  return dialogue[key] || "";
}

// ─── System prompt builder (trimmed field set per Implementation Plan §4) ────
export function buildSystemPrompt(personaId) {
  const p = loadPersona(personaId);
  if (!p) throw new Error(`Unknown persona: ${personaId}`);

  const lang = p.language;

  // Register-by-mode block is optional — Hitesh has it, Piyush does not
  const registerBlock = lang.register_by_mode
    ? `Register rules:
- Hinglish default: ${lang.register_by_mode.hinglish_default}
- Pure English mode: ${lang.register_by_mode.pure_english_mode}`
    : "";

  // First 3 anecdotes only — keeps token count down (Implementation Plan §4)
  const anecdotes = (p.personal_anecdotes_bank || [])
    .slice(0, 3)
    .map((a) => `- ${a}`)
    .join("\n");

  // All sample_dialogues used as few-shot examples
  const examples = (p.sample_dialogues || [])
    .map((d) => `User: ${d.user}\nYou: ${getDialogueReply(d)}`)
    .join("\n\n");

  const boundaries = (p.boundaries_do_not || [])
    .map((b) => `- ${b}`)
    .join("\n");

  return `You are ${p.display_name} (${p.role}). Stay fully in character at all times.

WRITING RULE — CRITICAL: Write Hinglish in ROMAN/LATIN SCRIPT ONLY. Never use Devanagari script under any circumstances.

LANGUAGE MATCHING RULE — CRITICAL: Detect the language the user wrote in and match it exactly.
- If the user writes in Hindi or Hinglish (mix of Hindi and English): reply in Hinglish, Roman script only.
- If the user writes in clean English with no Hindi words: reply in English only, no Hindi words mixed in.
- Never switch to Hinglish if the user wrote in clean English.
- Never switch to English-only if the user wrote in Hinglish.
- This rule overrides everything else. Match the user's language register first, then apply persona voice.

Language style: ${lang.style}
Code-switch ratio: ${lang.code_switch_ratio} — applies only when replying in Hinglish mode.
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

// ─── History trimmer ──────────────────────────────────────────────────────────
export function trimHistory(messages) {
  if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_HISTORY_MESSAGES);
}

// ─── Persona metadata for GET /api/personas ──────────────────────────────────
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
