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
    category: null,       // "campera", "buzo", etc
    gender: null,         // "hombre" | "mujer" | "unisex"
    weatherNeed: null,    // "frio" | "liviano"
    priceTier: null,      // "low" | "mid" | "high"
    rawQuery: null,       // accumulated user text for matcher
    stage: "start",       // start | asking_gender | asking_weather | product_shown | alt_shown | closing
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

// ─── Utilities ────────────────────────────────────────────────────────────────
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

function includesAny(msg, terms) {
  return terms.some((t) => msg.includes(t));
}

// ─── Intent detection ─────────────────────────────────────────────────────────
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
  return includesAny(msg, ["comprar", "lo quiero", "me lo llevo", "quiero este", "quiero esa", "dale", "checkout", "finalizar"]);
}

function detectPriceObjection(msg) {
  return includesAny(msg, ["caro", "cara", "barato", "barata", "mas barato", "economico", "economica"]);
}

function detectStyleObjection(msg) {
  return includesAny(msg, ["no me gusta", "otro estilo", "otra opcion", "algo diferente", "no es lo que busco", "no era eso"]);
}

// ─── Dynamic catalog detection ────────────────────────────────────────────────
function detectCategory(msg, products) {
  const categories = [...new Set(products.map((p) => normalize(p.category)))];
  for (const cat of categories) {
    if (msg.includes(cat)) return cat;
  }
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
  if (includesAny(msg, ["frio intenso", "mucho frio", "invierno", "abrigado", "abrigada", "frio"])) return "frio";
  if (includesAny(msg, ["liviano", "liviana", "media estacion", "fresco", "no tanto frio"])) return "liviano";
  const allUseCases = [...new Set(products.flatMap((p) => (p.use_case || []).map(normalize)))];
  const found = allUseCases.find((uc) => msg.includes(uc));
  if (found) return found.includes("frio") ? "frio" : "liviano";
  return null;
}

function detectPriceSensitivity(msg) {
  if (includesAny(msg, ["barato", "economico", "mas barato", "precio bajo"])) return "low";
  if (includesAny(msg, ["premium", "mejor calidad", "lo mejor"])) return "high";
  return null;
}

// ─── CANONICAL ACTION VALUES ──────────────────────────────────────────────────
// These are the only action values this system uses. Frontend must match exactly.
// hombre | mujer | frio_intenso | liviana | comprar_recomendada | comprar_alt
// ver_mas_barata | otra_opcion | hablar_con_asesor | volver_recomendacion | tengo_una_duda

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

function buildPolicyReply(intent, policies, session) {
  const policy = policies[intent];
  if (!policy) {
    return { reply: "No tengo información sobre eso. Te paso con un asesor 👌" };
  }

  let reply = policy.summary;

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

// ─── Safety fallback ──────────────────────────────────────────────────────────
function buildFallbackReply(session) {
  // Context-aware fallback — never a dead end
  if (session.stage === "product_shown" && session.shownProduct) {
    return {
      reply: `Te ayudo 👌 ¿Qué necesitás saber sobre ${session.shownProduct.name}?`,
      actions: [
        { label: "Comprar ahora", value: "comprar_recomendada" },
        { label: "Ver opción más económica", value: "ver_mas_barata" },
        { label: "Hablar con asesor", value: "hablar_con_asesor" },
      ],
    };
  }
  if (session.category && !session.gender) {
    return {
      reply: `Te ayudo 👌 ¿Lo buscás para hombre o mujer?`,
      actions: [
        { label: "Hombre", value: "hombre" },
        { label: "Mujer", value: "mujer" },
      ],
    };
  }
  return {
    reply: `Te ayudo 👌 Decime qué estás buscando y te encuentro la mejor opción.`,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("AI Sales Assistant 🚀"));

app.get("/api/products", async (req, res) => {
  try {
    const { products } = await loadStoreData(STORE);
    res.json(products);
  } catch {
    res.status(500).json({ error: "Could not load catalog" });
  }
});

app.get("/demo-start", async (req, res) => {
  const userId = getUserId(req);
  const session = resetSession(userId);
  const { products } = await loadStoreData(STORE);

  session.category = detectCategory("campera", products) || "campera";
  session.stage = "asking_gender";

  res.json({
    reply: `Hola 👋\n\nSoy el sistema de ventas.\n\nVeo que estás buscando una ${session.category}.\n¿La buscás para hombre o mujer?`,
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

    if (!msg) {
      return res.json({ reply: "Contame qué estás buscando 👌" });
    }

    const { products, policies } = await loadStoreData(STORE);

    // ── Greeting / reset ─────────────────────────────────────────────────
    if (isGreeting(msg)) {
      resetSession(userId);
      return res.json({
        reply: `Hola 👋\n\nSoy el sistema de ventas.\n\nTe ayudo a encontrar productos, resolver dudas y avanzar a compra.\n\n¿Qué estás buscando hoy?`,
      });
    }

    const session = getSession(userId);

    // ── Canonical action shortcuts ────────────────────────────────────────
    // These match button values from frontend exactly — fast path, no NLP needed
    if (msg === "hombre")      { session.gender = "hombre"; }
    if (msg === "mujer")       { session.gender = "mujer"; }
    if (msg === "frio_intenso") { session.weatherNeed = "frio"; }
    if (msg === "liviana")     { session.weatherNeed = "liviano"; }

    // ── Extract NLP signals from free text ────────────────────────────────
    const detectedGender   = detectGender(msg);
    const detectedCategory = detectCategory(msg, products);
    const detectedWeather  = detectWeatherNeed(msg, products);
    const detectedPrice    = detectPriceSensitivity(msg);

    if (detectedGender)   session.gender = detectedGender;
    if (detectedCategory) session.category = detectedCategory;
    if (detectedWeather)  session.weatherNeed = detectedWeather;
    if (detectedPrice)    session.priceTier = detectedPrice;

    session.rawQuery = session.rawQuery ? session.rawQuery + " " + msg : msg;

    // ── Human handoff ─────────────────────────────────────────────────────
    if (detectHumanIntent(msg) || msg === "hablar_con_asesor") {
      session.stage = "closing";
      return res.json({
        reply: `Perfecto 👌\n\nTe paso con un asesor para finalizar la compra y confirmar stock.\n\nEn un momento te contactan 👍`,
        actions: [{ label: "Volver a la recomendación", value: "volver_recomendacion" }],
      });
    }

    // ── Policy / FAQ ──────────────────────────────────────────────────────
    const policyIntent = detectPolicyIntent(msg);
    if (policyIntent || msg === "tengo_una_duda") {
      const intent = policyIntent || "shipping";
      return res.json(buildPolicyReply(intent, policies, session));
    }

    // ── Buy — primary product ─────────────────────────────────────────────
    if (detectBuyIntent(msg) || msg === "comprar_recomendada") {
      const product = session.shownProduct;
      if (product) {
        session.stage = "closing";
        return res.json(buildClosingReply(product));
      }
      return res.json({
        reply: `Antes de comprar, decime qué estás buscando y te recomiendo la mejor opción 👌`,
      });
    }

    // ── Buy — alt product ─────────────────────────────────────────────────
    if (msg === "comprar_alt") {
      const product = session.shownAltProduct;
      if (product) {
        session.stage = "closing";
        return res.json(buildClosingReply(product));
      }
      // Alt not in session (e.g. user typed "comprar_alt" cold) — fallback gracefully
      return res.json({
        reply: `Antes de comprar, decime qué estás buscando y te recomiendo la mejor opción 👌`,
      });
    }

    // ── Price objection ───────────────────────────────────────────────────
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
        reply: `Entiendo 👌 Por el momento esta es nuestra mejor opción en ese rango.\n\n¿Querés que te pase con un asesor?`,
        actions: [{ label: "Hablar con asesor", value: "hablar_con_asesor" }],
      });
    }

    // ── Style objection / another option ──────────────────────────────────
    if (detectStyleObjection(msg) || msg === "otra_opcion") {
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
      return res.json({
        reply: `¿Qué estás buscando hoy? Podés decirme el tipo de prenda, para quién es, o el uso que le querés dar 👌`,
      });
    }

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

    // All signals → match
    const product = matchProduct(products, session);
    if (!product) {
      return res.json(buildFallbackReply(session));
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