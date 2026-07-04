import express from "express";
import {
  buildSystemPrompt,
  trimHistory,
  getPersonaMeta,
} from "./personaService.js";
import { streamReply } from "./openaiService.js";

const router = express.Router();

const PERSONA_IDS = ["hitesh", "piyush"];


router.get("/personas", (req, res) => {
  const personas = PERSONA_IDS.map((id) => getPersonaMeta(id)).filter(Boolean);
  res.json(personas);
});


router.post("/chat", async (req, res) => {
  const { persona, messages } = req.body;


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


  const trimmedMessages = trimHistory(messages);


  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  try {
    await streamReply(systemPrompt, trimmedMessages, (chunk) => {
      res.write(chunk);
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
