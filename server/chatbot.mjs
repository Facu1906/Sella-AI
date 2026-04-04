import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { loadStoreData } from "./storeData.mjs";
import { matchProduct, matchAltProduct, serializeProduct } from "./matcher.mjs";
// ─── Setup ────────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE = process.env.STORE || "demo-store";
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── Sessions ─────────────────────────────────────────────────────────────────
const sessions = {};

function freshSession() {
  return {
    category: null,    // "campera", "buzo", etc
    gender: null,      // "hombre" | "mujer" | "unisex"
    weatherNeed: null, // "frio" | "liviano"
    priceTier: null,   // "low" | "mid" | "high"
    rawQuery: null,    // accumulated user text for matching
    stage: "start",    // start | asking_gender | asking_weather | product_shown | alt_shown | closing
    shownProduct: null,
    shownAltProduct: null,
  };
}

function getSession(userId) {
  if (!sessions[userId]) sessions[userId] = freshSession();
  return sessions[userId];
}

function resetSession(userId) {
  sessions[userId] = freshSession();
  return sessions[userId];
}

// ─── Normalize ────────────────────────────────────────────────────────────────
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getUserId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

// ─── Intent helpers ───────────────────────────────────────────────────────────
function includesAny(msg, terms) {
  return terms.some((t) => msg.includes(t));
}

function isGreeting(msg) {
  return includesAny(msg, ["hola", "buenas", "hello", "hi", "menu", "empezar", "reiniciar", "reset", "inicio", "start"]);
}

function detectPolicyIntent(msg) {
  if (includesAny(msg, ["envio", "envios", "entrega", "despacho", "shipping", "tarda", "interior"])) return "shipping";
  if (includesAny(msg, ["cambio", "cambios", "devolucion", "devolver", "reembolso", "return"])) return "returns";
  if (includesAny(msg, ["pago", "pagos", "cuotas", "tarjeta", "efectivo", "transferencia"])) return "payment";
  if (includesAny(msg, ["garantia", "warranty"])) return "warranty";
  if (includesAny(msg, ["retiro", "retirar", "local", "sucursal", "pickup"])) return "pickup";
  return null;
}

function detectHumanIntent(msg) {
  return includesAny(msg, ["asesor", "persona", "humano", "hablar con alguien", "vendedor", "agente"]);
}

function detectBuyIntent(msg) {
  return includesAny(msg, ["comprar", "lo quiero", "me lo llevo", "quiero este", "quiero esa", "dale", "vamos", "checkout", "finalizar", "comprar_ahora", "comprar_recomendada"]);
}

function detectPriceObjection(msg) {
  return includesAny(msg, ["caro", "cara", "barato", "barata", "mas barato", "economico", "economica", "ver_mas_barata"]);
}

function detectStyleObjection(msg) {
  return includesAny(msg, ["no me gusta", "otro estilo", "otra opcion", "otra opción", "algo diferente", "otra_opcion"]);
}

function detectCorrection(msg) {
  return includesAny(msg, ["no es lo que busco", "no era eso", "no quiero eso", "no quiero esa"]);
}

// ─── Dynamic detection from catalog ──────────────────────────────────────────
function detectCategory(msg, products) {
  // First: check category names directly
  const categories = [...new Set(products.map((p) => normalize(p.category)))];
  for (const cat of categories) {
    if (msg.includes(cat)) return cat;
  }
  // Second: check tags and name fragments
  for (const product of products) {
    const terms = [...(product.tags || []).map(normalize), normalize(product.name)];
    if (terms.some((t) => t.length > 3 && msg.includes(t))) return normalize(product.category);
  }
  return null;
}

function detectGender(msg) {
  if (includesAny(msg, ["mujer", "dama", "femenino", "para mujer", "de mujer"])) return "mujer";
  if (includesAny(msg, ["hombre", "caballero", "masculino", "para hombre", "de hombre"])) return "hombre";
  if (msg === "unisex") return "unisex";
  return null;
}

function detectWeatherNeed(msg, products) {
  const allUseCases = [...new Set(products.flatMap((p) => (p.use_case || []).map(normalize)))];
  // "frio" signals
  if (includesAny(msg, ["frio intenso", "mucho frio", "invierno", "abrigado", "abrigada", "frio"])) return "frio";
  // "liviano" signals
  if (includesAny(msg, ["liviano", "liviana", "media estacion", "fresco", "no tanto frio"])) return "liviano";
  // Check against catalog use cases
  const found = allUseCases.find((uc) => msg.includes(uc));
  if (found) return found.includes("frio") ? "frio" : "liviano";
  return null;
}

function detectPriceSensitivity(msg) {
  if (includesAny(msg, ["barato", "economico", "mas barato", "precio bajo"])) return "low";
  if (includesAny(msg, ["premium", "mejor calidad", "lo mejor"])) return "high";
  return null;
}

// ─── Policy reply ─────────────────────────────────────────────────────────────
function buildPolicyReply(intent, policies, session) {
  const policy = policies[intent];
  if (!policy) return { reply: "No tengo información sobre eso. Te paso con un asesor 👌" };

  let reply = policy.summary;

  // Re-anchor to flow if mid-conversation
  if (session.stage === "product_shown" && session.shownProduct) {
    reply += `\n\n¿Seguimos con la ${session.shownProduct.name}?`;
    return {
      reply,
      actions: [
        { label: "Sí, comprar ahora", value: "comprar_recomendada" },
        { label: "Ver opción más económica", value: "ver_mas_barata" },
      ],
    };
  }
  if (session.category) {
    reply += `\n\n¿Seguimos buscando lo que necesitás?`;
  }
  return { reply };
}

// ─── Response builders ────────────────────────────────────────────────────────
function buildProductReply(product, altProduct) {
  return {
    reply: `Esta es la mejor opción para lo que buscás 👇\n\nTe recomiendo ir por esta.`,
    product: serializeProduct(product),
    actions: [
      { label: "Comprar ahora", value: "comprar_recomendada" },
      ...(altProduct ? [{ label: "Ver opción más económica", value: "ver_mas_barata" }] : []),
      { label: "Tengo una duda", value: "tengo_una_duda" },
    ],
  };
}

function buildAltProductReply(altProduct, primaryProduct) {
  return {
    reply: `Sí, acá hay una opción más accesible 👇\n\nSi priorizás precio, esta te conviene más.\nSi querés más abrigo, sigo recomendando ${primaryProduct.name}.`,
    products: [serializeProduct(altProduct), serializeProduct(primaryProduct)],
    actions: [
      { label: "Comprar opción económica", value: "comprar_alt" },
      { label: "Comprar recomendada", value: "comprar_recomendada" },
      { label: "Ver otra opción", value: "otra_opcion" },
    ],
  };
}

function buildClosingReply(product) {
  return {
    reply: `Perfecto 👌\n\nTe llevo directo a compra:\n\n${product.name} — $${product.price}\n\n${product.url}`,
    product: serializeProduct(product),
    actions: [{ label: "Hablar con asesor", value: "hablar_con_asesor" }],
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("AI Sales Assistant 🚀"));

// Expose catalog to frontend (used by demo.js to load real products)
app.get("/api/products", async (req, res) => {
  try {
    const { products } = await loadStoreData(STORE);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Could not load catalog" });
  }
});

// Demo start — preloads category so landing page can trigger it
app.get("/demo-start", async (req, res) => {
  const userId = getUserId(req);
  const session = resetSession(userId);
  const { products } = await loadStoreData(STORE);

  session.category = detectCategory("campera", products) || "campera";
  session.stage = "asking_gender";

  res.json({
    reply: `Hola 👋\n\nSoy el sistema de ventas.\n\nTe ayudo a encontrar la mejor opción y llevarte a compra.\n\nVeo que estás buscando una ${session.category}.\n¿La buscás para hombre o mujer?`,
    actions: [
      { label: "Hombre", value: "hombre" },
      { label: "Mujer", value: "mujer" },
    ],
  });
});

app.post("/chat", async (req, res) => {
  try {
    const rawMessage = req.body.message || "";
    const message = String(rawMessage).trim();
    const msg = normalize(message);
    const userId = getUserId(req);

    if (!msg) return res.json({ reply: "Contame qué estás buscando 👌" });

    // Load store data (cached)
    const { products, policies } = await loadStoreData(STORE);

    // ── Reset / greeting ─────────────────────────────────────────────────
    if (isGreeting(msg)) {
      resetSession(userId);
      return res.json({
        reply: `Hola 👋\n\nSoy el sistema de ventas.\n\nTe ayudo a encontrar productos, resolver dudas y avanzar a compra.\n\n¿Qué estás buscando hoy?`,
      });
    }

    const session = getSession(userId);

    // ── Extract signals from message ─────────────────────────────────────
    const detectedGender = detectGender(msg);
    const detectedCategory = detectCategory(msg, products);
    const detectedWeather = detectWeatherNeed(msg, products);
    const detectedPrice = detectPriceSensitivity(msg);

    if (detectedGender) session.gender = detectedGender;
    if (detectedCategory) session.category = detectedCategory;
    if (detectedWeather) session.weatherNeed = detectedWeather;
    if (detectedPrice) session.priceTier = detectedPrice;

    // Accumulate raw context for matcher
    session.rawQuery = session.rawQuery ? session.rawQuery + " " + msg : msg;

    // ── Button value shortcuts (from frontend action buttons) ────────────
    if (msg === "hombre") { session.gender = "hombre"; }
    if (msg === "mujer") { session.gender = "mujer"; }
    if (msg === "frio_intenso") { session.weatherNeed = "frio"; }
    if (msg === "liviana" || msg === "liviano") { session.weatherNeed = "liviano"; }

    // ── Human handoff ────────────────────────────────────────────────────
    if (detectHumanIntent(msg) || msg === "hablar_con_asesor") {
      session.stage = "closing";
      return res.json({
        reply: `Perfecto 👌\n\nTe paso con un asesor para finalizar la compra y confirmar stock.\n\nEn un momento te contactan 👍`,
        actions: [{ label: "Volver a la recomendación", value: "volver_recomendacion" }],
      });
    }

    // ── Policy / FAQ ─────────────────────────────────────────────────────
    const policyIntent = detectPolicyIntent(msg);
    if (policyIntent || msg === "tengo_una_duda") {
      const intent = policyIntent || "shipping";
      return res.json(buildPolicyReply(intent, policies, session));
    }

    // ── Buy intent ───────────────────────────────────────────────────────
    if (detectBuyIntent(msg) || msg === "comprar_recomendada") {
      const product = session.shownProduct;
      if (product) {
        session.stage = "closing";
        return res.json(buildClosingReply(product));
      }
      return res.json({ reply: `Antes de comprar, decime qué estás buscando y te recomiendo la mejor opción 👌` });
    }

    if (msg === "comprar_alt") {
      const product = session.shownAltProduct;
      if (product) {
        session.stage = "closing";
        return res.json(buildClosingReply(product));
      }
    }

    // ── Price objection ──────────────────────────────────────────────────
    if (detectPriceObjection(msg) || msg === "ver_mas_barata") {
      session.priceTier = "low";
      const primary = session.shownProduct;
      if (primary) {
        const alt = matchAltProduct(products, session, primary);
        if (alt) {
          session.shownAltProduct = alt;
          session.stage = "alt_shown";
          return res.json(buildAltProductReply(alt, primary));
        }
      }
      return res.json({
        reply: `Entiendo 👌 Por el momento esta es nuestra mejor opción en ese rango.\n\n¿Querés que te pase con un asesor para ver si hay algo más?`,
        actions: [{ label: "Hablar con asesor", value: "hablar_con_asesor" }],
      });
    }

    // ── Style objection / another option ─────────────────────────────────
    if (detectStyleObjection(msg) || detectCorrection(msg) || msg === "otra_opcion") {
      session.weatherNeed = null;
      session.shownProduct = null;
      session.shownAltProduct = null;
      session.stage = "asking_weather";
      return res.json({
        reply: `Perfecto, lo ajustamos 👌\n\n¿Querés algo para frío intenso o una opción más liviana?`,
        actions: [
          { label: "Frío intenso", value: "frio_intenso" },
          { label: "Más liviana", value: "liviana" },
        ],
      });
    }

    // ── Guided flow ───────────────────────────────────────────────────────

    // No category → try to detect or ask
    if (!session.category) {
      const earlyMatch = matchProduct(products, session);
      if (earlyMatch) {
        session.category = normalize(earlyMatch.category);
        const alt = matchAltProduct(products, session, earlyMatch);
        session.shownProduct = earlyMatch;
        session.shownAltProduct = alt || null;
        session.stage = "product_shown";
        return res.json(buildProductReply(earlyMatch, alt));
      }
      return res.json({ reply: `¿Qué estás buscando hoy? Podés decirme el tipo de prenda, para quién es, o el uso que le querés dar 👌` });
    }

    // Category known, no gender → ask
    if (!session.gender) {
      session.stage = "asking_gender";
      return res.json({
        reply: `Bien 👌 ¿Lo buscás para hombre o mujer?`,
        actions: [
          { label: "Hombre", value: "hombre" },
          { label: "Mujer", value: "mujer" },
        ],
      });
    }

    // Gender known, no weather need → ask
    if (!session.weatherNeed) {
      session.stage = "asking_weather";
      return res.json({
        reply: `Perfecto 👍 ¿Lo querés para frío intenso o algo más liviano?`,
        actions: [
          { label: "Frío intenso", value: "frio_intenso" },
          { label: "Más liviana", value: "liviana" },
        ],
      });
    }

    // All signals → match and recommend
    const product = matchProduct(products, session);

    if (!product) {
      return res.json({
        reply: `No encontré una opción que encaje exactamente. ¿Querés que te pase con un asesor?`,
        actions: [{ label: "Hablar con asesor", value: "hablar_con_asesor" }],
      });
    }

    const alt = matchAltProduct(products, session, product);
    session.shownProduct = product;
    session.shownAltProduct = alt || null;
    session.stage = "product_shown";

    return res.json(buildProductReply(product, alt));

  } catch (error) {
    console.error("[chatbot] Error:", error.message);
    return res.status(500).json({
      reply: `Hubo un error. ¿Querés que te pase con un asesor?`,
      actions: [{ label: "Hablar con asesor", value: "hablar_con_asesor" }],
    });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Running → http://localhost:${PORT}`);
  console.log(`[server] Store: ${STORE}`);
});