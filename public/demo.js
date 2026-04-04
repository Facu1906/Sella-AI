/**
 * demo.js — AI Sales Assistant frontend
 *
 * Architecture:
 *   - Button clicks  → processAction() handles locally (instant UX, no server round-trip)
 *   - Free-text input → sendToServer() — server is the source of truth for NLP
 *   - Server responses use the same botReply() renderer as local actions
 *
 * CANONICAL ACTION VALUES (must match backend exactly):
 *   hombre | mujer | frio_intenso | liviana | comprar_recomendada | comprar_alt
 *   ver_mas_barata | otra_opcion | hablar_con_asesor | volver_recomendacion
 *   tengo_una_duda | start_demo
 */

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  category: null,
  gender: null,
  weatherNeed: null,
  shownProduct: null,
  shownAltProduct: null,
  stage: "start",
};

// Products loaded from /api/products at init — fallback if server unreachable
let PRODUCTS = { primary: null, alt: null };

const HARDCODED_FALLBACK = {
  primary: {
    id: "campera-andes",
    name: "Campera Andes",
    price: "$3990",
    url: "#checkout",
    image: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=900&q=80",
    why: ["Abriga muy bien para frío intenso", "La opción más sólida para invierno", "Buena para uso diario"],
  },
  alt: {
    id: "campera-urban",
    name: "Campera Urban",
    price: "$2990",
    url: "#checkout-economica",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    why: ["Más económica", "Más liviana", "Buena si priorizás precio sobre abrigo máximo"],
  },
};

// ─── Catalog loader ───────────────────────────────────────────────────────────
async function loadCatalog() {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) throw new Error("no endpoint");
    const products = await res.json();
    const camperas = products
      .filter((p) => p.category === "campera")
      .sort((a, b) => b.price - a.price);
    if (camperas.length >= 1) {
      PRODUCTS.primary = serializeForUI(camperas[0]);
      PRODUCTS.alt = camperas[1] ? serializeForUI(camperas[1]) : null;
    } else {
      PRODUCTS = { ...HARDCODED_FALLBACK };
    }
  } catch {
    PRODUCTS = { ...HARDCODED_FALLBACK };
  }
}

function serializeForUI(p) {
  return {
    id: p.id,
    name: p.name,
    price: typeof p.price === "number" ? `$${p.price}` : p.price,
    url: p.url || "#checkout",
    image: p.image || HARDCODED_FALLBACK.primary.image,
    why: p.why || [],
  };
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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
      processAction(action.value);
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
  img.src = product.image || HARDCODED_FALLBACK.primary.image;
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

// ─── Bot reply renderer ───────────────────────────────────────────────────────
// Accepts same shape as /chat API: { reply, product?, products?, actions?, productCtaText? }
function botReply(payload) {
  if (!payload) return;
  const typingRow = appendMessage("Escribiendo...", "bot", "typing");

  setTimeout(() => {
    typingRow.remove();
    if (payload.reply) appendMessage(payload.reply, "bot");
    if (payload.product) appendProductCard(payload.product, payload.productCtaText || "Ir a checkout");
    if (payload.products) appendCompareCards(payload.products);
    if (payload.actions) appendActions(payload.actions);
  }, 300);
}

// ─── State helpers ────────────────────────────────────────────────────────────
function resetState() {
  state.category = null;
  state.gender = null;
  state.weatherNeed = null;
  state.shownProduct = null;
  state.shownAltProduct = null;
  state.stage = "start";
}

function syncStateFromServerResponse(data) {
  // Keep local state in sync so local action handlers use correct products
  if (data.product) {
    state.shownProduct = data.product;
    state.stage = "product_shown";
  }
  if (data.products && data.products.length >= 1) {
    // Server alt-comparison response: first product is alt, second is primary
    state.shownAltProduct = data.products[0];
    state.shownProduct = data.products[1] || state.shownProduct;
    state.stage = "alt_shown";
  }
}

// ─── Local demo flows (instant — no server round-trip needed) ─────────────────
function startDemo() {
  resetState();
  appendMessage("Quiero una campera para invierno", "user");
  state.category = "campera";
  state.weatherNeed = "frio";
  state.stage = "asking_gender";

  botReply({
    reply: `Perfecto 👌\n\nTe ayudo a encontrar la mejor opción.\n\n¿La buscás para hombre o mujer?`,
    // CANONICAL: hombre / mujer — matches backend exactly
    actions: [
      { label: "Hombre", value: "hombre" },
      { label: "Mujer", value: "mujer" },
    ],
  });
}

function showRecommendedProduct() {
  const product = PRODUCTS.primary;
  if (!product) {
    botReply({ reply: `Cargando productos... intentá de nuevo en un momento 👌` });
    return;
  }
  state.shownProduct = product;
  state.shownAltProduct = PRODUCTS.alt;
  state.stage = "product_shown";

  botReply({
    reply: `Esta es la opción que mejor encaja con lo que buscás 👇\n\nTe recomiendo ir por esta.`,
    product,
    actions: [
      { label: "Comprar ahora", value: "comprar_recomendada" },
      ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
      { label: "Tengo una duda", value: "tengo_una_duda" },
    ],
  });
}

function showAltProduct() {
  const product = PRODUCTS.alt || PRODUCTS.primary;
  if (!product) {
    botReply({ reply: `Cargando productos... intentá de nuevo en un momento 👌` });
    return;
  }
  state.shownProduct = product;
  state.shownAltProduct = PRODUCTS.primary;
  state.stage = "product_shown";

  botReply({
    reply: `Si querés algo más liviano, esta es una mejor opción 👇`,
    product,
    actions: [
      { label: "Comprar ahora", value: "comprar_alt" },
      { label: "Ver opción recomendada", value: "ver_recomendada" },
      { label: "Tengo una duda", value: "tengo_una_duda" },
    ],
  });
}

// ─── processAction — handles ALL action values ────────────────────────────────
// Single source of truth for button click behavior.
// Every value emitted anywhere in the system must have a case here.
function processAction(value) {
  switch (value) {

    // ── Demo entry ──────────────────────────────────────────────────────
    case "start_demo":
      startDemo();
      break;

    // ── Gender selection ────────────────────────────────────────────────
    // CANONICAL: "hombre" / "mujer" — used by both frontend and backend
    case "hombre":
      state.gender = "hombre";
      showRecommendedProduct();
      break;

    case "mujer":
      state.gender = "mujer";
      showRecommendedProduct();
      break;

    // ── Use/warmth selection ────────────────────────────────────────────
    case "frio_intenso":
      state.weatherNeed = "frio";
      showRecommendedProduct();
      break;

    case "liviana":
      state.weatherNeed = "liviano";
      showAltProduct();
      break;

    // ── Buy — primary product ───────────────────────────────────────────
    case "comprar_recomendada": {
      const product = state.shownProduct || PRODUCTS.primary;
      if (!product) { botReply({ reply: `Decime qué producto querés y te ayudo a comprarlo 👌` }); break; }
      state.stage = "closing";
      botReply({
        reply: `Perfecto 👌\n\nEsta es la opción con la que te recomiendo avanzar.`,
        product,
        productCtaText: "Comprar ahora",
        actions: [{ label: "Hablar con asesor", value: "hablar_con_asesor" }],
      });
      break;
    }

    // ── Buy — alt product ───────────────────────────────────────────────
    case "comprar_alt": {
      const product = state.shownAltProduct || PRODUCTS.alt || PRODUCTS.primary;
      if (!product) { botReply({ reply: `Decime qué producto querés y te ayudo a comprarlo 👌` }); break; }
      state.stage = "closing";
      botReply({
        reply: `Perfecto 👌\n\nSi querés priorizar precio, esta es la mejor opción.`,
        product,
        productCtaText: "Comprar ahora",
        actions: [{ label: "Hablar con asesor", value: "hablar_con_asesor" }],
      });
      break;
    }

    // ── Price objection ─────────────────────────────────────────────────
    case "ver_mas_barata": {
      state.stage = "alt_shown";
      const primary = state.shownProduct || PRODUCTS.primary;
      const alt = state.shownAltProduct || PRODUCTS.alt;
      const compareProducts = [alt, primary].filter(Boolean);
      botReply({
        reply: `Sí, acá hay una opción más económica 👇\n\nSi priorizás precio, esta te conviene más.\nSi querés más abrigo, sigo recomendando ${primary?.name || "la opción anterior"}.\n\n¿Con cuál querés avanzar?`,
        products: compareProducts.length ? compareProducts : undefined,
        actions: [
          { label: "Comprar opción económica", value: "comprar_alt" },
          { label: "Comprar recomendada", value: "comprar_recomendada" },
          { label: "Ver otra opción", value: "otra_opcion" },
        ],
      });
      break;
    }

    // ── Show primary again (from alt view) ──────────────────────────────
    case "ver_recomendada": {
      const product = state.shownAltProduct || PRODUCTS.primary;
      botReply({
        reply: `Si querés más abrigo y mejor rendimiento, sigo recomendando esta 👇`,
        product: product || undefined,
        actions: [
          { label: "Comprar recomendada", value: "comprar_recomendada" },
          ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
        ],
      });
      break;
    }

    // ── Another option / reset weather need ─────────────────────────────
    case "otra_opcion":
      state.weatherNeed = null;
      state.shownProduct = null;
      state.shownAltProduct = null;
      state.stage = "asking_weather";
      botReply({
        reply: `Perfecto, lo ajustamos 👌\n\n¿Querés algo para frío intenso o una opción más liviana?`,
        actions: [
          { label: "Frío intenso", value: "frio_intenso" },
          { label: "Más liviana", value: "liviana" },
        ],
      });
      break;

    // ── FAQ / doubt ─────────────────────────────────────────────────────
    // CANONICAL: "tengo_una_duda" — matches backend exactly
    case "tengo_una_duda":
      botReply({
        reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\nSi querés, seguimos con la opción que mejor te conviene.`,
        actions: [
          {
            label: "Comprar ahora",
            value: (state.shownProduct && state.shownAltProduct && state.shownProduct === state.shownAltProduct)
              ? "comprar_alt"
              : "comprar_recomendada",
          },
          ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
        ],
      });
      break;

    // ── Advisor handoff ─────────────────────────────────────────────────
    // CANONICAL: "hablar_con_asesor" — matches backend exactly
    case "hablar_con_asesor":
      state.stage = "closing";
      botReply({
        reply: `Perfecto 👌\n\nTe paso con un asesor para finalizar la compra y confirmar stock.\n\nEn un momento te contactan 👍`,
      });
      break;

    // ── Return to recommendation ────────────────────────────────────────
    case "volver_recomendacion": {
      const product = state.shownProduct || PRODUCTS.primary;
      if (product) {
        botReply({
          reply: `Volvemos a la opción que te recomendé 👇`,
          product,
          actions: [
            { label: "Comprar ahora", value: "comprar_recomendada" },
            ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
          ],
        });
      } else {
        botReply({ reply: `¿Qué estás buscando? Te ayudo a encontrar la mejor opción 👌` });
      }
      break;
    }

    // ── Safety fallback — never silently fail ───────────────────────────
    default:
      console.warn("[demo] Unknown action:", value);
      botReply({
        reply: `Te ayudo 👌 Decime mejor qué estás buscando.`,
        actions: [{ label: "Empezar de nuevo", value: "start_demo" }],
      });
  }
}

// ─── Free-text → server ───────────────────────────────────────────────────────
// Server is the source of truth for NLP. All free-text goes here.
// Local processAction handles button clicks only.
async function sendToServer(userText) {
  const typingRow = appendMessage("Escribiendo...", "bot", "typing");
  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    typingRow.remove();

    setTimeout(() => {
      if (data.reply) appendMessage(data.reply, "bot");
      if (data.product) appendProductCard(data.product, "Ir a checkout");
      if (data.products) appendCompareCards(data.products);
      if (data.actions) appendActions(data.actions);
      syncStateFromServerResponse(data);
    }, 250);
  } catch (err) {
    console.error("[demo] Server error:", err);
    typingRow.remove();
    appendMessage("Error conectando con el servidor. Intentá de nuevo 👌", "bot");
  }
}

// ─── Input routing ────────────────────────────────────────────────────────────
// Simple keyword pre-filter for instant UX on obvious inputs.
// Everything else goes to server — no duplicated NLP logic here.
function processLocalMessage(text) {
  const msg = normalize(text);
  if (!msg) return;

  // Greetings / reset — handle locally, no server needed
  if (["reset", "reiniciar", "hola", "menu", "inicio"].includes(msg)) {
    resetState();
    botReply({
      reply: `Hola 👋\n\nSoy el sistema de ventas.\n\nTe ayudo a encontrar la mejor opción y llevarte a compra.\n\n¿Qué estás buscando hoy?`,
      actions: [{ label: "Quiero una campera para invierno", value: "start_demo" }],
    });
    return;
  }

  // All other free text → server (server handles NLP, returns canonical actions)
  sendToServer(text);
}

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
  processLocalMessage(userText);
}

document.getElementById("input").addEventListener("keypress", function (e) {
  if (e.key === "Enter") send();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await loadCatalog();
  setTimeout(() => startDemo(), 500);
})();