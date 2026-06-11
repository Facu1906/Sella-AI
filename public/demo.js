/**
 * demo.js — AI Sales Assistant frontend
 *
 * Responsibilities (ONLY):
 *   - Render messages, product cards, action buttons
 *   - Send free-text to /chat
 *   - Send button action values to /chat
 *
 * All conversation logic lives in chatbot.mjs (server).
 * This file has zero sales logic, zero state machine, zero product data.
 */

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollToBottom() {
  const el = document.getElementById("messages");
  if (el) el.scrollTop = el.scrollHeight;
}

function clearEmptyState() {
  const el = document.getElementById("emptyState");
  if (el) el.remove();
}

function disableAllActionButtons() {
  document.querySelectorAll(".action-btn").forEach((btn) => {
    btn.disabled = true;
  });
}

function appendMessage(text, type, extraClass = "") {
  clearEmptyState();
  const messages = document.getElementById("messages");

  const row = document.createElement("div");
  row.className = `message-row ${type === "user" ? "user-row" : "bot-row"}`;

  const bubble = document.createElement("div");
  bubble.className = `msg ${type} ${extraClass}`.trim();
  bubble.textContent = text;

  const time = document.createElement("div");
  time.className = "time";
  time.textContent = getTime();

  row.appendChild(bubble);
  row.appendChild(time);
  messages.appendChild(row);
  scrollToBottom();
  return row;
}

function appendActions(actions = []) {
  if (!actions || !actions.length) return;
  const messages = document.getElementById("messages");

  const row = document.createElement("div");
  row.className = "message-row bot-row";

  const wrap = document.createElement("div");
  wrap.className = "actions-row";

  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.className = "action-btn";
    btn.textContent = action.label;
    btn.onclick = () => {
      disableAllActionButtons();
      appendMessage(action.label, "user");
      sendToServer(action.value);
    };
    wrap.appendChild(btn);
  });

  row.appendChild(wrap);
  messages.appendChild(row);
  scrollToBottom();
}

function appendProductCard(product, ctaText = "Ir a checkout") {
  if (!product) return;
  const messages = document.getElementById("messages");

  const row = document.createElement("div");
  row.className = "message-row bot-row";

  const card = document.createElement("div");
  card.className = "product-card";

  const img = document.createElement("img");
  img.className = "product-image";
  img.src = product.image || "";
  img.alt = product.name;

  const body = document.createElement("div");
  body.className = "product-body";

  const title = document.createElement("div");
  title.className = "product-title";
  title.textContent = product.name;

  const priceEl = document.createElement("div");
  priceEl.className = "product-price";
  priceEl.textContent = typeof product.price === "number" ? `$${product.price}` : product.price;

  const meta = document.createElement("div");
  meta.className = "product-meta";
  meta.innerHTML = (product.why || []).map((item) => `• ${item}`).join("<br>");

  const cta = document.createElement("a");
  cta.className = "product-cta";
  cta.href = product.url || "#";
  cta.target = "_blank";
  cta.textContent = ctaText;

  body.appendChild(title);
  body.appendChild(priceEl);
  body.appendChild(meta);
  body.appendChild(cta);
  card.appendChild(img);
  card.appendChild(body);
  row.appendChild(card);
  messages.appendChild(row);
  scrollToBottom();
}

function appendCompareCards(products = []) {
  if (!products || !products.length) return;
  const messages = document.getElementById("messages");

  const row = document.createElement("div");
  row.className = "message-row bot-row";

  const grid = document.createElement("div");
  grid.className = "compare-grid";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    const img = document.createElement("img");
    img.className = "product-image";
    img.src = product.image || "";
    img.alt = product.name;

    const body = document.createElement("div");
    body.className = "product-body";

    const title = document.createElement("div");
    title.className = "product-title";
    title.textContent = product.name;

    const priceEl = document.createElement("div");
    priceEl.className = "product-price";
    priceEl.textContent = typeof product.price === "number" ? `$${product.price}` : product.price;

    const meta = document.createElement("div");
    meta.className = "product-meta";
    meta.innerHTML = (product.why || []).map((item) => `• ${item}`).join("<br>");

    const cta = document.createElement("a");
    cta.className = "product-cta";
    cta.href = product.url || "#";
    cta.target = "_blank";
    cta.textContent = "Ver opción";

    body.appendChild(title);
    body.appendChild(priceEl);
    body.appendChild(meta);
    body.appendChild(cta);
    card.appendChild(img);
    card.appendChild(body);
    grid.appendChild(card);
  });

  row.appendChild(grid);
  messages.appendChild(row);
  scrollToBottom();
}

// ─── Server communication ─────────────────────────────────────────────────────
const AGENT_URL = "https://sella-agent.onrender.com/chat";

// Full conversation history sent with every request so the agent keeps context
// across turns (it was previously stateless — only the latest message was sent,
// which made it re-greet and re-ask). Roles: "user" | "assistant".
const chatHistory = [];

// Animated "typing" bubble (three pulsing dots) shown until the first token.
function appendTyping() {
  clearEmptyState();
  const messages = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "message-row bot-row";
  const bubble = document.createElement("div");
  bubble.className = "msg bot typing";
  bubble.innerHTML =
    '<span class="typing-dots" aria-label="…"><span></span><span></span><span></span></span>';
  row.appendChild(bubble);
  messages.appendChild(row);
  scrollToBottom();
  return row;
}

// Empty bot bubble we stream tokens into.
function startBotBubble() {
  const row = appendMessage("", "bot");
  return row.querySelector(".msg");
}

function linkify(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" class="chat-link">$1</a>');
}

function errorText() {
  return demoLang === "es"
    ? "Error conectando con el servidor. Intentá de nuevo 👌"
    : "Couldn't reach the server. Please try again 👌";
}

// Streams the reply token by token so the first words appear almost immediately.
async function sendToServer(message) {
  const typingRow = appendTyping();

  // Send the whole conversation (history + this new user turn) so the agent has
  // full context. Only commit the turns to history once the reply succeeds, so a
  // failed request doesn't leave a dangling user turn.
  const outgoing = chatHistory.concat([{ role: "user", content: message }]);

  try {
    const response = await fetch(AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: outgoing, lang: demoLang }),
    });

    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let bubble = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      full += chunk;
      if (!bubble) {
        typingRow.remove();          // swap the dots for the real bubble on first token
        bubble = startBotBubble();
      }
      bubble.textContent = full;
      scrollToBottom();
    }
    full += decoder.decode();        // flush any trailing bytes

    if (!bubble) {
      // Server replied without a streamed body (e.g. a JSON error) — handle gracefully.
      typingRow.remove();
      let msg = full;
      try { const j = JSON.parse(full); if (j && j.reply) msg = j.reply; } catch (e) {}
      appendMessage(msg || errorText(), "bot");
    } else {
      bubble.innerHTML = linkify(full);
      scrollToBottom();
      // Record both turns now that we have a real reply.
      chatHistory.push({ role: "user", content: message });
      chatHistory.push({ role: "assistant", content: full });
    }
  } catch (err) {
    console.error("[demo] Server error:", err);
    typingRow.remove();
    appendMessage(errorText(), "bot");
  }
}

// ─── Input handling ───────────────────────────────────────────────────────────
function sendPreset(text) {
  const input = document.getElementById("input");
  if (input) input.value = text;
  send();
}

function send() {
  const input = document.getElementById("input");
  if (!input) return;
  const userText = input.value.trim();
  if (!userText) return;

  disableAllActionButtons();
  appendMessage(userText, "user");
  input.value = "";
  sendToServer(userText);
}

document.getElementById("input").addEventListener("keypress", function (e) {
  if (e.key === "Enter") send();
});

// ─── Demo start ───────────────────────────────────────────────────────────────
// Appends the opening user message and lets the server drive from there.
function startDemo() {
  const opening = "Quiero una campera para invierno";
  appendMessage(opening, "user");
  sendToServer(opening);
}

// ─── Language (follows the landing page EN/ES toggle) ──────────────────────────
// Only static UI strings + starter buttons are translated here. The conversation
// logic and the agent's replies are untouched (those come from the server).
// Rioplatense Spanish (voseo), matching the rest of the site.
const DEMO_I18N = {
  en: {
    subtitle: "Guided e-commerce demo",
    emptyTitle: "How can I help?",
    emptyText:
      "This demo shows how a store turns a buying-intent question into a concrete recommendation and guides the customer to checkout.",
    chip1: { label: "I want a winter jacket", value: "I want a winter jacket" },
    chip2: { label: "Do you ship?", value: "Do you ship?" },
    placeholder: "Type as a customer...",
    send: "Send",
  },
  es: {
    subtitle: "Demo guiada de e-commerce",
    emptyTitle: "¿En qué te ayudo?",
    emptyText:
      "Esta demo muestra cómo una tienda convierte una consulta con intención de compra en una recomendación concreta y guía al cliente hasta el checkout.",
    chip1: { label: "Quiero una campera de invierno", value: "Quiero una campera de invierno" },
    chip2: { label: "¿Hacés envíos?", value: "¿Hacés envíos?" },
    placeholder: "Escribí como cliente...",
    send: "Enviar",
  },
};

let demoLang = "en";

// Precedence: ?lang query param → shared localStorage choice → default English.
function getInitialDemoLang() {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "es") return q;
  } catch (e) {}
  try {
    const saved = localStorage.getItem("sella_lang"); // same key as the landing page
    if (saved === "en" || saved === "es") return saved;
  } catch (e) {}
  return "en";
}

function applyDemoLang(lang) {
  if (lang !== "en" && lang !== "es") lang = "en";
  demoLang = lang;
  const t = DEMO_I18N[lang];
  document.documentElement.lang = lang;

  // Header subtitle (preserve the live-dot)
  const subtitle = document.querySelector(".header-subtitle");
  if (subtitle) subtitle.innerHTML = '<span class="dot"></span>\n          ' + t.subtitle;

  // Empty state (only present before the conversation starts)
  const h2 = document.querySelector("#emptyState h2");
  if (h2) h2.textContent = t.emptyTitle;
  const p = document.querySelector("#emptyState p");
  if (p) p.textContent = t.emptyText;

  // Starter buttons — translate the label AND what they send
  const chips = document.querySelectorAll("#emptyState .chip");
  if (chips[0]) {
    chips[0].textContent = t.chip1.label;
    chips[0].onclick = function () { sendPreset(t.chip1.value); };
  }
  if (chips[1]) {
    chips[1].textContent = t.chip2.label;
    chips[1].onclick = function () { sendPreset(t.chip2.value); };
  }

  // Input placeholder + send button
  const input = document.getElementById("input");
  if (input) input.placeholder = t.placeholder;
  const sendBtn = document.querySelector(".send-btn");
  if (sendBtn) sendBtn.textContent = t.send;

  // Reflect the current language on the standalone toggle (if shown)
  const opts = document.querySelectorAll("#langToggle .lang-opt");
  opts.forEach(function (b) {
    const active = b.getAttribute("data-lang") === lang;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

// Respond to the landing page toggle (separate document → postMessage)
window.addEventListener("message", function (e) {
  const data = e.data;
  if (data && data.type === "sella-lang" && (data.lang === "en" || data.lang === "es")) {
    applyDemoLang(data.lang);
  }
});

// Standalone page only: show the EN | ES toggle and let the visitor switch.
// When embedded in the landing iframe, the landing page owns the language, so
// the toggle stays hidden and behavior is unchanged.
const isEmbedded = window.self !== window.top;

function setupStandaloneToggle() {
  const toggle = document.getElementById("langToggle");
  if (!toggle || isEmbedded) return;
  toggle.classList.add("standalone");
  toggle.querySelectorAll(".lang-opt").forEach(function (b) {
    b.addEventListener("click", function () {
      const lang = b.getAttribute("data-lang");
      applyDemoLang(lang);
      // Persist to the same key the landing page uses, so the choice stays in sync.
      try { localStorage.setItem("sella_lang", lang); } catch (e) {}
    });
  });
}

setupStandaloneToggle();

// Read the language on load: ?lang → localStorage sella_lang → English
applyDemoLang(getInitialDemoLang());

// ─── Init ─────────────────────────────────────────────────────────────────────
// setTimeout(() => startDemo(), 500);