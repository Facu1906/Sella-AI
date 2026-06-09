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
// Single function for all server calls — free text AND button values.
async function sendToServer(message) {
  const typingRow = appendMessage("Escribiendo...", "bot", "typing");

  try {
    const response = await fetch("https://sella-agent.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    typingRow.remove();

    setTimeout(() => {
      if (data.reply)    appendMessage(data.reply, "bot");
      if (data.product)  appendProductCard(data.product, data.productCtaText || "Ir a checkout");
      if (data.products) appendCompareCards(data.products);
      if (data.actions)  appendActions(data.actions);
    }, 250);

  } catch (err) {
    console.error("[demo] Server error:", err);
    typingRow.remove();
    appendMessage("Error conectando con el servidor. Intentá de nuevo 👌", "bot");
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

// ─── Init ─────────────────────────────────────────────────────────────────────
setTimeout(() => startDemo(), 500);