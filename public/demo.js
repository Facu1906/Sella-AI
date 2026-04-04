/**
 * demo.js
 * Frontend state machine for the guided sales demo.
 *
 * TWO modes:
 *  - Action buttons → processed locally (instant, no server needed for demo)
 *  - Free-text input → sent to /chat endpoint (real server flow)
 *
 * Product data is loaded from the server at startup via /api/products
 * so the demo always reflects the live catalog.
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

// Products loaded from server (fallback to hardcoded if server unreachable)
let PRODUCTS = {
  primary: null,
  alt: null,
};

const HARDCODED_FALLBACK = {
  primary: {
    id: "campera-andes",
    name: "Campera Andes",
    price: "$3990",
    url: "#checkout",
    image: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=900&q=80",
    why: [
      "Abriga muy bien para frío intenso",
      "Es la opción más sólida para invierno",
      "Buena para uso diario sin complicarte"
    ]
  },
  alt: {
    id: "campera-urban",
    name: "Campera Urban",
    price: "$2990",
    url: "#checkout-economica",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    why: [
      "Más económica",
      "Más liviana",
      "Buena si priorizás precio sobre abrigo máximo"
    ]
  }
};

// ─── Load catalog from server ─────────────────────────────────────────────────
async function loadCatalog() {
  try {
    const res = await fetch("/api/products");
    if (!res.ok) throw new Error("no catalog endpoint");
    const products = await res.json();

    // Map: first campera → primary, second campera or cheaper → alt
    const camperas = products.filter(p => p.category === "campera");
    if (camperas.length >= 1) {
      const sorted = camperas.sort((a, b) => b.price - a.price);
      PRODUCTS.primary = serializeForUI(sorted[0]);
      PRODUCTS.alt = sorted[1] ? serializeForUI(sorted[1]) : null;
    } else {
      PRODUCTS = HARDCODED_FALLBACK;
    }
  } catch {
    PRODUCTS = HARDCODED_FALLBACK;
  }
}

function serializeForUI(p) {
  return {
    id: p.id,
    name: p.name,
    price: `$${p.price}`,
    url: p.url || "#checkout",
    image: p.image || "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=900&q=80",
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
  el.scrollTop = el.scrollHeight;
}

function clearEmptyState() {
  const el = document.getElementById("emptyState");
  if (el) el.remove();
}

function disableAllActionButtons() {
  document.querySelectorAll(".action-btn").forEach(btn => { btn.disabled = true; });
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
  if (!actions.length) return;
  const messages = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "message-row bot-row";

  const wrap = document.createElement("div");
  wrap.className = "actions-row";

  actions.forEach(action => {
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
  img.src = product.image;
  img.alt = product.name;

  const body = document.createElement("div");
  body.className = "product-body";

  const title = document.createElement("div");
  title.className = "product-title";
  title.textContent = product.name;

  const price = document.createElement("div");
  price.className = "product-price";
  price.textContent = typeof product.price === "number" ? `$${product.price}` : product.price;

  const meta = document.createElement("div");
  meta.className = "product-meta";
  meta.innerHTML = (product.why || []).map(item => `• ${item}`).join("<br>");

  const cta = document.createElement("a");
  cta.className = "product-cta";
  cta.href = product.url || "#";
  cta.target = "_blank";
  cta.textContent = ctaText;

  body.appendChild(title);
  body.appendChild(price);
  body.appendChild(meta);
  body.appendChild(cta);
  card.appendChild(img);
  card.appendChild(body);
  row.appendChild(card);
  messages.appendChild(row);
  scrollToBottom();
}

function appendCompareCards(products = []) {
  if (!products.length) return;
  const messages = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "message-row bot-row";

  const grid = document.createElement("div");
  grid.className = "compare-grid";

  products.forEach(product => {
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

    const price = document.createElement("div");
    price.className = "product-price";
    price.textContent = typeof product.price === "number" ? `$${product.price}` : product.price;

    const meta = document.createElement("div");
    meta.className = "product-meta";
    meta.innerHTML = (product.why || []).map(item => `• ${item}`).join("<br>");

    const cta = document.createElement("a");
    cta.className = "product-cta";
    cta.href = product.url || "#";
    cta.target = "_blank";
    cta.textContent = "Ver opción";

    body.appendChild(title);
    body.appendChild(price);
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
// Accepts the same shape as the /chat API response:
// { reply, product?, products?, actions?, productCtaText? }
function botReply(payload) {
  const typingRow = appendMessage("Escribiendo...", "bot", "typing");

  setTimeout(() => {
    typingRow.remove();
    if (payload.reply) appendMessage(payload.reply, "bot");
    if (payload.product) appendProductCard(payload.product, payload.productCtaText || "Ir a checkout");
    if (payload.products) appendCompareCards(payload.products);
    if (payload.actions) appendActions(payload.actions);
  }, 300);
}

// ─── Local state machine (for action buttons — instant, no server) ────────────
function resetState() {
  state.category = null;
  state.gender = null;
  state.weatherNeed = null;
  state.shownProduct = null;
  state.shownAltProduct = null;
  state.stage = "start";
}

function startDemo() {
  resetState();
  appendMessage("Quiero una campera para invierno", "user");
  state.category = "campera";
  state.weatherNeed = "frio";
  state.stage = "asking_gender";

  botReply({
    reply: `Perfecto 👌\n\nTe ayudo a encontrar la mejor opción.\n\n¿La buscás para hombre o mujer?`,
    actions: [
      { label: "Hombre", value: "gender_hombre" },
      { label: "Mujer", value: "gender_mujer" },
    ],
  });
}

function showRecommendedProduct() {
  const product = PRODUCTS.primary;
  if (!product) return;
  state.shownProduct = product;
  state.shownAltProduct = PRODUCTS.alt;
  state.stage = "product_shown";

  botReply({
    reply: `Esta es la opción que mejor encaja con lo que buscás 👇\n\nTe recomiendo ir por esta.`,
    product,
    actions: [
      { label: "Comprar ahora", value: "comprar_recomendada" },
      ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
      { label: "Tengo una duda", value: "faq" },
    ],
  });
}

function showLightOption() {
  const product = PRODUCTS.alt || PRODUCTS.primary;
  state.shownProduct = product;
  state.shownAltProduct = PRODUCTS.primary;
  state.stage = "product_shown";

  botReply({
    reply: `Si querés algo más liviano, esta es una mejor opción 👇`,
    product,
    actions: [
      { label: "Comprar ahora", value: "comprar_alt" },
      { label: "Ver opción recomendada", value: "comprar_recomendada_view" },
      { label: "Tengo una duda", value: "faq" },
    ],
  });
}

function processAction(value) {
  switch (value) {
    case "start_demo":
      startDemo();
      break;

    case "gender_hombre":
      state.gender = "hombre";
      showRecommendedProduct();
      break;

    case "gender_mujer":
      state.gender = "mujer";
      showRecommendedProduct();
      break;

    case "comprar_recomendada":
      state.stage = "closing";
      botReply({
        reply: `Perfecto 👌\n\nEsta es la opción con la que te recomiendo avanzar.`,
        product: { ...PRODUCTS.primary },
        productCtaText: "Comprar ahora",
        actions: [{ label: "Hablar con asesor", value: "asesor" }],
      });
      break;

    case "comprar_alt":
      state.stage = "closing";
      botReply({
        reply: `Perfecto 👌\n\nSi querés priorizar precio, esta es la mejor opción.`,
        product: { ...(PRODUCTS.alt || PRODUCTS.primary) },
        productCtaText: "Comprar ahora",
        actions: [{ label: "Hablar con asesor", value: "asesor" }],
      });
      break;

    case "comprar_recomendada_view":
      botReply({
        reply: `Si querés más abrigo y mejor rendimiento, sigo recomendando esta 👇`,
        product: PRODUCTS.primary,
        actions: [
          { label: "Comprar recomendada", value: "comprar_recomendada" },
          ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
        ],
      });
      break;

    case "ver_mas_barata":
      state.stage = "alt_shown";
      botReply({
        reply: `Sí, acá hay una opción más económica 👇\n\nSi priorizás precio, esta te conviene más.\nSi querés más abrigo, sigo recomendando ${PRODUCTS.primary?.name}.\n\n¿Con cuál querés avanzar?`,
        products: [PRODUCTS.alt, PRODUCTS.primary].filter(Boolean),
        actions: [
          { label: "Comprar opción económica", value: "comprar_alt" },
          { label: "Comprar recomendada", value: "comprar_recomendada" },
          { label: "Ver otra opción", value: "otra_opcion" },
        ],
      });
      break;

    case "otra_opcion":
      state.stage = "choosing_weight";
      botReply({
        reply: `Perfecto, lo ajustamos 👌\n\n¿Querés algo para frío intenso o una opción más liviana?`,
        actions: [
          { label: "Frío intenso", value: "frio_intenso" },
          { label: "Más liviana", value: "liviana" },
        ],
      });
      break;

    case "frio_intenso":
      state.weatherNeed = "frio";
      showRecommendedProduct();
      break;

    case "liviana":
      state.weatherNeed = "liviano";
      showLightOption();
      break;

    case "faq":
      botReply({
        reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\nSi querés, seguimos con la opción que mejor te conviene.`,
        actions: [
          { label: "Comprar ahora", value: state.shownProduct === PRODUCTS.alt ? "comprar_alt" : "comprar_recomendada" },
          ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
        ],
      });
      break;

    case "asesor":
    case "hablar_con_asesor":
      botReply({ reply: `Perfecto 👌\n\nTe paso con un asesor para finalizar la compra y confirmar stock.\n\nEn un momento te contactan 👍` });
      break;

    case "volver_recomendacion":
      if (state.shownProduct) {
        botReply({
          reply: `Volvemos a la opción que te recomendé 👇`,
          product: state.shownProduct,
          actions: [
            { label: "Comprar ahora", value: "comprar_recomendada" },
            ...(PRODUCTS.alt ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
          ],
        });
      }
      break;

    default:
      botReply({ reply: `Contame qué necesitás y te ayudo 👌` });
  }
}

// ─── Free-text → server ───────────────────────────────────────────────────────
async function sendToServer(userText) {
  const typingRow = appendMessage("Escribiendo...", "bot", "typing");
  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText }),
    });
    const data = await response.json();
    typingRow.remove();

    // Small delay for natural feel
    setTimeout(() => {
      if (data.reply) appendMessage(data.reply, "bot");
      if (data.product) appendProductCard(data.product, "Ir a checkout");
      if (data.products) appendCompareCards(data.products);
      if (data.actions) appendActions(data.actions);

      // Sync local state from server response so action buttons stay correct
      if (data.product) state.shownProduct = data.product;
      if (data.products && data.products[0]) state.shownAltProduct = data.products[0];
    }, 250);
  } catch {
    typingRow.remove();
    appendMessage("Error conectando con el servidor.", "bot");
  }
}

// ─── Input handling ───────────────────────────────────────────────────────────
function processLocalMessage(text) {
  const msg = normalize(text);
  if (!msg) return;

  // Reset
  if (["reset", "reiniciar", "hola", "menu", "inicio"].includes(msg)) {
    resetState();
    botReply({
      reply: `Hola 👋\n\nSoy el sistema de ventas.\n\nTe ayudo a encontrar la mejor opción y llevarte a compra.\n\n¿Qué estás buscando hoy?`,
      actions: [{ label: "Quiero una campera para invierno", value: "start_demo" }],
    });
    return;
  }

  // Quick keyword routing for natural typing — mirrors chatbot.mjs intent detection
  if (msg.includes("campera") || msg.includes("invierno") || msg.includes("jacket")) {
    state.category = "campera";
    state.stage = "asking_gender";
    botReply({
      reply: `Perfecto 👌\n\n¿La buscás para hombre o mujer?`,
      actions: [
        { label: "Hombre", value: "gender_hombre" },
        { label: "Mujer", value: "gender_mujer" },
      ],
    });
    return;
  }
  if (msg.includes("envio") || msg.includes("envíos") || msg.includes("despacho")) {
    botReply({ reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\n¿Qué producto estás buscando?` });
    return;
  }
  if (msg.includes("hombre")) { processAction("gender_hombre"); return; }
  if (msg.includes("mujer")) { processAction("gender_mujer"); return; }
  if (msg.includes("caro") || msg.includes("barato") || msg.includes("economico")) { processAction("ver_mas_barata"); return; }
  if (msg.includes("comprar") || msg.includes("lo quiero") || msg.includes("me lo llevo")) {
    processAction(state.shownProduct === PRODUCTS.alt ? "comprar_alt" : "comprar_recomendada");
    return;
  }
  if (msg.includes("no me gusta") || msg.includes("otra opcion")) { processAction("otra_opcion"); return; }
  if (msg.includes("frio intenso")) { processAction("frio_intenso"); return; }
  if (msg.includes("liviana") || msg.includes("liviano")) { processAction("liviana"); return; }
  if (msg.includes("asesor") || msg.includes("humano") || msg.includes("persona")) { processAction("asesor"); return; }
  if (msg.includes("no se") || msg.includes("no sé")) {
    botReply({
      reply: `No hay problema 👌\n\nTe ayudo a elegir.\n\n¿La necesitás para frío intenso o algo más liviano?`,
      actions: [
        { label: "Frío intenso", value: "frio_intenso" },
        { label: "Más liviana", value: "liviana" },
      ],
    });
    return;
  }

  // Fallback: send to server for full NLP handling
  sendToServer(text);
}

function sendPreset(text) {
  const input = document.getElementById("input");
  input.value = text;
  send();
}

function send() {
  const input = document.getElementById("input");
  const userText = input.value.trim();
  if (!userText) return;

  disableAllActionButtons();
  appendMessage(userText, "user");
  input.value = "";
  processLocalMessage(userText);
}

document.getElementById("input").addEventListener("keypress", function(e) {
  if (e.key === "Enter") send();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await loadCatalog();
  setTimeout(() => startDemo(), 500);
})();