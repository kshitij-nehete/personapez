// chatRoute.js
// POST /api/chat  — streams persona reply chunk by chunk
// GET  /api/personas — returns persona metadata + starter questions

import express from "express";
import {
  buildSystemPrompt,
  trimHistory,
  getPersonaMeta,
} from "./personaService.js";
import { streamReply } from "./openaiService.js";

const router = express.Router();

// Known persona IDs — single source of truth lives in the JSON files
const PERSONA_IDS = ["hitesh", "piyush"];

// ─── GET /api/personas ────────────────────────────────────────────────────────
router.get("/personas", (req, res) => {
  const personas = PERSONA_IDS.map((id) => getPersonaMeta(id)).filter(Boolean);
  res.json(personas);
});

// ─── POST /api/chat ───────────────────────────────────────────────────────────
// Body: { persona: string, messages: [{role, content}] }
// Streams the LLM reply as plain text chunks — no JSON envelope mid-stream.
router.post("/chat", async (req, res) => {
  const { persona, messages } = req.body;

  // Input validation (Implementation Plan §9)
  if (!persona || !PERSONA_IDS.includes(persona)) {
    return res.status(400).json({ error: "Unknown or missing persona" });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res
      .status(400)
      .json({ error: "messages must be a non-empty array" });
  }

  let systemPrompt;
  try {
    systemPrompt = buildSystemPrompt(persona);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Trim history to keep token cost bounded (Implementation Plan §8)
  const trimmedMessages = trimHistory(messages);

  // Headers for chunked streaming
  // X-Accel-Buffering: no — tells Render's nginx proxy to stop buffering
  // and forward each chunk to the client immediately as it arrives
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no"); // ← fixes Render proxy buffering
  res.flushHeaders();

  try {
    await streamReply(systemPrompt, trimmedMessages, (chunk) => {
      res.write(chunk);
      // Explicitly flush after each chunk — prevents Node's internal
      // buffering from batching chunks before forwarding to the proxy
      if (typeof res.flush === "function") res.flush(); // ← fixes Node buffering
    });
    res.end();
  } catch (err) {
    console.error("Stream error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Stream failed. Check server logs." });
    } else {
      res.end();
    }
  }
});

export default router;
