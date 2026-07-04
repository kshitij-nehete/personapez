// public/app.js
// Sprint 8: persona state, send, fetch, tab switching
// Sprint 9: starter chips, timestamps, streaming via ReadableStream

// ─── State ────────────────────────────────────────────────────────────────────
// Per-persona message history kept in memory for the session.
// Matches the structure POST /api/chat expects: [{role, content}]
const state = {
  persona: "hitesh",
  history: {
    hitesh: [],
    piyush: [],
  },
};

// Persona display config — accent color and placeholder per persona
const PERSONA_CONFIG = {
  hitesh: {
    color: "#38bdf8",
    label: "Hitesh Choudhary",
    file: "hitesh_persona.json",
    placeholder: "Message Hitesh...",
  },
  piyush: {
    color: "#818cf8",
    label: "Piyush Garg",
    file: "piyush_persona.json",
    placeholder: "Message Piyush...",
  },
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const logEl = document.getElementById("log");
const emptyState = document.getElementById("emptyState");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const loadedLabel = document.getElementById("loadedLabel");
const startersEl = document.getElementById("starters");
const composerEl = document.getElementById("composer");
const tabs = document.querySelectorAll(".tab");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function currentConfig() {
  return PERSONA_CONFIG[state.persona];
}

// Remove the empty state placeholder once first message is added
function removeEmptyState() {
  if (emptyState.parentNode) emptyState.remove();
}

// ─── Persona color variable ───────────────────────────────────────────────────
// Sets --persona-color on .app so all CSS var() references update at once
function applyPersonaColor(color) {
  document.querySelector(".app").style.setProperty("--persona-color", color);
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchPersona(personaId) {
  if (personaId === state.persona) return;

  state.persona = personaId;
  const config = currentConfig();

  // Update tab active states
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.persona === personaId);
  });

  // Update header log line and input placeholder
  loadedLabel.textContent = config.file;
  inputEl.placeholder = config.placeholder;

  // Apply accent color
  applyPersonaColor(config.color);

  // Re-render this persona's chat history
  renderHistory();

  // Show or hide starter chips based on whether this persona has history
  renderStarters();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchPersona(tab.dataset.persona));
});

// ─── History renderer ─────────────────────────────────────────────────────────
// Clears the log and re-renders all messages for the current persona.
// Called on tab switch — avoids keeping multiple persona DOMs in memory.
function renderHistory() {
  logEl.innerHTML = "";
  const messages = state.history[state.persona];

  if (messages.length === 0) {
    logEl.appendChild(emptyState);
    return;
  }

  messages.forEach((msg) => appendBubble(msg.role, msg.content, msg.time));
  logEl.scrollTop = logEl.scrollHeight;
}

// ─── Bubble builder ───────────────────────────────────────────────────────────
// Creates and appends a message row. Returns { bubbleEl, timestampEl }
// so the streaming path can update content and timestamp after creation.
function appendBubble(role, content, time, scroll = true) {
  removeEmptyState();

  const config = currentConfig();
  const row = document.createElement("div");
  row.className = `row ${role}`;

  // Static initial avatar — assistant side only
  if (role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    // First letter of the persona's display name
    avatar.textContent = config.label.charAt(0);
    row.appendChild(avatar);
  }

  const col = document.createElement("div");
  col.className = "bubble-col";

  const sender = document.createElement("div");
  sender.className = "sender";
  sender.textContent = role === "user" ? "you" : config.label;

  const bubbleEl = document.createElement("div");
  bubbleEl.className = "bubble";
  bubbleEl.textContent = content;

  const timestampEl = document.createElement("div");
  timestampEl.className = "timestamp";
  timestampEl.textContent = time || "";

  col.appendChild(sender);
  col.appendChild(bubbleEl);
  col.appendChild(timestampEl);
  row.appendChild(col);
  logEl.appendChild(row);

  if (scroll) logEl.scrollTop = logEl.scrollHeight;

  return { bubbleEl, timestampEl };
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function showTyping() {
  const config = currentConfig();
  const row = document.createElement("div");
  row.className = "row assistant typing";
  row.id = "typingRow";
  row.innerHTML = `
  <div class="avatar" style="--persona-color: ${config.color}">${config.label.charAt(0)}</div>
  <div class="bubble-col">
    <div class="sender">${config.label}</div>
    <div class="bubble">
      <span class="dot2"></span>
      <span class="dot2"></span>
      <span class="dot2"></span>
    </div>
  </div>
  `;
  logEl.appendChild(row);
  logEl.scrollTop = logEl.scrollHeight;
}

function removeTyping() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

// ─── Starter chips ────────────────────────────────────────────────────────────
// Populated from GET /api/personas on load (Sprint 9).
// Hidden once the current persona has any history.
let personaMeta = {};

async function loadPersonaMeta() {
  try {
    const res = await fetch("/api/personas");
    const data = await res.json();
    // Index by persona id for quick lookup
    data.forEach((p) => {
      personaMeta[p.id] = p;
    });
    renderStarters();
  } catch (err) {
    console.error("Failed to load persona metadata:", err);
  }
}

function renderStarters() {
  startersEl.innerHTML = "";

  // Hide chips once this persona has any conversation history
  const hasHistory = state.history[state.persona].length > 0;
  if (hasHistory) return;

  const meta = personaMeta[state.persona];
  if (!meta) return;

  const config = currentConfig();

  meta.starterQuestions.forEach((question) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = question;
    chip.style.setProperty("--persona-color", config.color);
    chip.addEventListener("click", () => sendMessage(question));
    startersEl.appendChild(chip);
  });
}

// ─── Send message ─────────────────────────────────────────────────────────────
async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || sendBtn.disabled) return;

  sendBtn.disabled = true;
  startersEl.innerHTML = "";

  // Add user message to history and render it
  const userTime = nowLabel();
  state.history[state.persona].push({
    role: "user",
    content: trimmed,
    time: userTime,
  });
  appendBubble("user", trimmed, userTime);

  // Show typing indicator while waiting for first chunk
  showTyping();

  // Build messages array for the API — role + content only, no time field
  const messages = state.history[state.persona].map(({ role, content }) => ({
    role,
    content,
  }));

  try {
    await streamReply(messages);
  } catch (err) {
    removeTyping();
    appendBubble("assistant", `Error: ${err.message}`, nowLabel());
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ─── Streaming reply ──────────────────────────────────────────────────────────
// Reads POST /api/chat response as a ReadableStream.
// Appends each chunk to the assistant bubble as it arrives.
// Implementation Plan §6.3
async function streamReply(messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      persona: state.persona,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  // Remove typing indicator and create the assistant bubble
  removeTyping();
  const replyTime = nowLabel();
  const { bubbleEl, timestampEl } = appendBubble("assistant", "", replyTime);

  // Add streaming cursor
  const cursor = document.createElement("span");
  cursor.className = "cursor";
  bubbleEl.appendChild(cursor);

  // Read the stream chunk by chunk
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;

    // Update bubble text and keep cursor at the end
    bubbleEl.textContent = fullText;
    bubbleEl.appendChild(cursor);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // Stream finished — remove cursor, set final timestamp
  cursor.remove();
  bubbleEl.textContent = fullText;
  timestampEl.textContent = nowLabel();

  // Save completed reply to history
  state.history[state.persona].push({
    role: "assistant",
    content: fullText,
    time: replyTime,
  });
}

// ─── Composer events ──────────────────────────────────────────────────────────
composerEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value;
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendMessage(text);
});

// Auto-grow textarea as user types
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
});

// Send on Enter, new line on Shift+Enter
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composerEl.requestSubmit();
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
applyPersonaColor(currentConfig().color);
loadPersonaMeta();
