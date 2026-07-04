// openaiService.js
// Streams a reply from OpenAI and yields text chunks via onChunk callback.
// Never buffers the full reply — caller gets each piece as it arrives.

import { MODEL, MAX_OUTPUT_TOKENS } from "./personaService.js";

/**
 * Streams a reply from OpenAI.
 * @param {string} systemPrompt - The assembled persona system prompt
 * @param {Array<{role: string, content: string}>} messages - Conversation history
 * @param {function(string): void} onChunk - Called with each text piece as it arrives
 */
export async function streamReply(systemPrompt, messages, onChunk) {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiUrl = process.env.OPENAI_API_URL;

  if (!apiKey) throw new Error("OPENAI_API_KEY is not set in .env");
  if (!apiUrl) throw new Error("OPENAI_API_URL is not set in .env");

  // OpenAI chat completions expects system prompt as the first message
  // in the messages array with role "system" — not as a top-level field
  const messagesWithSystem = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      messages: messagesWithSystem,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  // Read the SSE stream line by line
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE lines are separated by \n — process complete lines only
    const lines = buffer.split("\n");

    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const payload = trimmed.slice("data: ".length);
      if (payload === "[DONE]") return;

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue; // Malformed line — skip
      }

      const chunk = parsed?.choices?.[0]?.delta?.content;
      if (chunk) onChunk(chunk);
    }
  }
}
