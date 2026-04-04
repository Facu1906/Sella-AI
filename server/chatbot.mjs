import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "..", "Public");

app.use(cors());
app.use(express.json());
app.use(express.static(publicPath));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/**
 * In-memory sessions for demo purposes.
 * Replace with Redis / DB later if needed.
 */
const sessions = {};

/**
 * Mock catalog.
 * Keep this tight for demo quality.
 */
const PRODUCTS = {
  campera: {
    hombre: {
      frio: {
        id: "campera-andes-hombre",
        name: "Campera Andes Hombre",
        price: 3990,
        currency: "$",
        url: "https://mitienda.com/campera-andes-hombre",
        image: "https://via.placeholder.com/400x500?text=Campera+Andes+Hombre",
        why: [
          "Abriga bien para frío intenso",
          "Corte versátil para uso diario",
          "Una de las opciones más sólidas para invierno",
        ],
        alt: {
          id: "campera-urban-hombre",
          name: "Campera Urban Hombre",
          price: 2990,
          currency: "$",
          url: "https://mitienda.com/campera-urban-hombre",
          image: "https://via.placeholder.com/400x500?text=Campera+Urban+Hombre",
          why: [
            "Más económica",
            "Más liviana",
            "Mejor si priorizás precio sobre abrigo máximo",
          ],
        },
      },
      liviano: {
        id: "campera-light-hombre",
        name: "Campera Light Hombre",
        price: 2790,
        currency: "$",
        url: "https://mitienda.com/campera-light-hombre",
        image: "https://via.placeholder.com/400x500?text=Campera+Light+Hombre",
        why: [
          "Mejor para media estación",
          "Más cómoda para uso diario",
          "Buena opción si no necesitás abrigo extremo",
        ],
        alt: {
          id: "campera-urban-hombre",
          name: "Campera Urban Hombre",
          price: 2990,
          currency: "$",
          url: "https://mitienda.com/campera-urban-hombre",
          image: "https://via.placeholder.com/400x500?text=Campera+Urban+Hombre",
          why: [
            "Un poco más abrigada",
            "Más versátil",
            "Mejor balance entre precio y uso",
          ],
        },
      },
    },
    mujer: {
      frio: {
        id: "campera-andes-mujer",
        name: "Campera Andes Mujer",
        price: 3990,
        currency: "$",
        url: "https://mitienda.com/campera-andes-mujer",
        image: "https://via.placeholder.com/400x500?text=Campera+Andes+Mujer",
        why: [
          "Pensada para frío intenso",
          "Cómoda para uso diario",
          "Muy buena opción si querés ir a lo seguro",
        ],
        alt: {
          id: "campera-urban-mujer",
          name: "Campera Urban Mujer",
          price: 2990,
          currency: "$",
          url: "https://mitienda.com/campera-urban-mujer",
          image: "https://via.placeholder.com/400x500?text=Campera+Urban+Mujer",
          why: [
            "Más económica",
            "Más liviana",
            "Buena si buscás cuidar presupuesto",
          ],
        },
      },
      liviano: {
        id: "campera-light-mujer",
        name: "Campera Light Mujer",
        price: 2790,
        currency: "$",
        url: "https://mitienda.com/campera-light-mujer",
        image: "https://via.placeholder.com/400x500?text=Campera+Light+Mujer",
        why: [
          "Ideal para días frescos",
          "Más liviana y cómoda",
          "Buena opción si no necesitás mucho abrigo",
        ],
        alt: {
          id: "campera-urban-mujer",
          name: "Campera Urban Mujer",
          price: 2990,
          currency: "$",
          url: "https://mitienda.com/campera-urban-mujer",
          image: "https://via.placeholder.com/400x500?text=Campera+Urban+Mujer",
          why: [
            "Más versátil",
            "Un poco más abrigada",
            "Buena relación precio/uso",
          ],
        },
      },
    },
  },
};

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function createSession() {
  return {
    category: null,
    gender: null,
    weatherNeed: null,
    stage: "start",
    shownProduct: null,
    shownAltProduct: null,
  };
}

function getUserId(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown-user";
}

function resetSession(userId) {
  sessions[userId] = createSession();
  return sessions[userId];
}

function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = createSession();
  }
  return sessions[userId];
}

function includesAny(msg, terms) {
  return terms.some((term) => msg.includes(term));
}

function isGreeting(msg) {
  return includesAny(msg, [
    "hola",
    "buenas",
    "hello",
    "hi",
    "menu",
    "menú",
    "empezar",
    "reiniciar",
    "reset",
    "inicio",
    "start",
  ]);
}

function detectSupportIntent(msg) {
  return includesAny(msg, [
    "envio",
    "envios",
    "interior",
    "pago",
    "pagos",
    "cambio",
    "cambios",
    "devolucion",
    "devolver",
    "tarda",
    "cuotas",
    "tarjeta",
    "retiro",
    "local",
  ]);
}

function detectHumanIntent(msg) {
  return includesAny(msg, [
    "asesor",
    "persona",
    "humano",
    "hablar con alguien",
    "hablar con una persona",
    "vendedor",
    "agente",
  ]);
}

function detectBuyIntent(msg) {
  return includesAny(msg, [
    "comprar",
    "lo quiero",
    "me lo llevo",
    "quiero este",
    "quiero esa",
    "quiero esa campera",
    "quiero esa opcion",
    "quiero esta",
    "quiero esta opcion",
    "dale",
    "vamos con esa",
    "ir al checkout",
    "checkout",
    "finalizar",
  ]);
}

function detectPriceObjection(msg) {
  return includesAny(msg, [
    "caro",
    "cara",
    "barato",
    "barata",
    "mas barato",
    "mas barata",
    "economico",
    "economica",
    "precio",
  ]);
}

function detectStyleObjection(msg) {
  return includesAny(msg, [
    "no me gusta",
    "otro estilo",
    "otra opcion",
    "otra opción",
    "algo diferente",
    "otra",
  ]);
}

function detectCorrection(msg) {
  return includesAny(msg, [
    "no es lo que busco",
    "no era eso",
    "no",
    "no quiero eso",
    "no quiero esa",
    "no quiero esa opcion",
  ]);
}

function detectUnsure(msg) {
  return includesAny(msg, [
    "no se",
    "no estoy seguro",
    "no estoy segura",
    "no sé",
    "ayudame a elegir",
    "cual me conviene",
    "cual me recomendas",
    "cual me recomendás",
  ]);
}

function detectCategory(msg) {
  if (includesAny(msg, ["campera", "campera", "jacket", "abrigo"])) {
    return "campera";
  }
  return null;
}

function detectGender(msg) {
  if (includesAny(msg, ["hombre", "para hombre", "de hombre", "masculino"])) {
    return "hombre";
  }
  if (includesAny(msg, ["mujer", "para mujer", "de mujer", "femenino"])) {
    return "mujer";
  }
  return null;
}

function detectWeatherNeed(msg) {
  if (includesAny(msg, ["frio intenso", "mucho frio", "mucho frío", "frio", "invierno", "abrigada", "abrigado"])) {
    return "frio";
  }
  if (includesAny(msg, ["liviano", "liviana", "media estacion", "media estación", "algo fresco", "no tanto frio"])) {
    return "liviano";
  }
  return null;
}

function formatCurrency(value, currency = "$") {
  return `${currency}${value}`;
}

function getProduct(session) {
  const category = session.category;
  const gender = session.gender;
  const weatherNeed = session.weatherNeed;

  if (!category || !gender || !weatherNeed) return null;

  return PRODUCTS?.[category]?.[gender]?.[weatherNeed] || null;
}

function productReply(product) {
  const whyText = product.why.map((item) => `• ${item}`).join("\n");

  return {
    reply: `Esta es la mejor opción para lo que estás buscando 👇

${product.name}
${formatCurrency(product.price, product.currency)}

${whyText}

👉 Te recomiendo ir por esta.

¿Querés que te lleve a comprarla?`,
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      url: product.url,
      image: product.image,
    },
    actions: [
      { label: "Comprar ahora", value: "comprar_ahora" },
      { label: "Ver opción más económica", value: "ver_mas_barata" },
      { label: "Tengo una duda", value: "tengo_una_duda" },
    ],
  };
}

function altProductReply(altProduct, primaryProduct) {
  const whyText = altProduct.why.map((item) => `• ${item}`).join("\n");

  return {
    reply: `Sí, te puedo mostrar una opción más económica 👇

${altProduct.name}
${formatCurrency(altProduct.price, altProduct.currency)}

${whyText}

Si priorizás precio, esta te conviene más.
Si querés más abrigo y mejor rendimiento para invierno, sigo recomendando ${primaryProduct.name}.

¿Con cuál querés avanzar?`,
    products: [
      {
        id: altProduct.id,
        name: altProduct.name,
        price: altProduct.price,
        currency: altProduct.currency,
        url: altProduct.url,
        image: altProduct.image,
      },
      {
        id: primaryProduct.id,
        name: primaryProduct.name,
        price: primaryProduct.price,
        currency: primaryProduct.currency,
        url: primaryProduct.url,
        image: primaryProduct.image,
      },
    ],
    actions: [
      { label: "Comprar opción económica", value: "comprar_alt" },
      { label: "Comprar recomendada", value: "comprar_recomendada" },
      { label: "Ver otra opción", value: "otra_opcion" },
    ],
  };
}

function faqReply(session) {
  if (session.stage === "closing") {
    return {
      reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌

Si querés, te llevo directo a la compra ahora.`,
      actions: [
        { label: "Ir a comprar", value: "comprar_ahora" },
        { label: "Hablar con asesor", value: "hablar_con_asesor" },
      ],
    };
  }

  if (session.shownProduct) {
    return {
      reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌

Si querés, avanzamos con la opción recomendada ahora.`,
      actions: [
        { label: "Ir a comprar", value: "comprar_ahora" },
        { label: "Ver opción más económica", value: "ver_mas_barata" },
      ],
    };
  }

  return {
    reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌

Decime qué producto estás buscando y te ayudo a encontrar la mejor opción.`,
  };
}

function fallbackReply(session) {
  if (!session.category) {
    return {
      reply: `Te ayudo 👌

¿Qué estás buscando hoy? Por ejemplo: campera, abrigo o jacket.`,
    };
  }

  if (session.category === "campera" && !session.gender) {
    return {
      reply: `Bien 👌 ¿La buscás para hombre o mujer?`,
      actions: [
        { label: "Hombre", value: "hombre" },
        { label: "Mujer", value: "mujer" },
      ],
    };
  }

  if (session.category === "campera" && !session.weatherNeed) {
    return {
      reply: `Perfecto 👍 ¿La querés para frío intenso o algo más liviano?`,
      actions: [
        { label: "Frío intenso", value: "frio_intenso" },
        { label: "Más liviana", value: "liviana" },
      ],
    };
  }

  if (session.shownProduct) {
    return {
      reply: `Puedo ayudarte con eso.

Si querés, avanzamos con la opción recomendada o te muestro una alternativa más económica.`,
      actions: [
        { label: "Comprar ahora", value: "comprar_ahora" },
        { label: "Ver opción más económica", value: "ver_mas_barata" },
        { label: "Hablar con asesor", value: "hablar_con_asesor" },
      ],
    };
  }

  return {
    reply: `Contame qué estás buscando y te ayudo a elegir la mejor opción.`,
  };
}

/**
 * Optional endpoint to preload the demo.
 * Useful for landing-page controlled demo flows.
 */
app.get("/demo-start", (req, res) => {
  const userId = getUserId(req);
  const session = resetSession(userId);

  session.category = "campera";
  session.stage = "asking_gender";

  return res.json({
    reply: `Hola 👋

Soy el sistema de ventas.

Te ayudo a encontrar la mejor opción y llevarte a compra.

Veo que estás buscando una campera.
¿La buscás para hombre o mujer?`,
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
    const session = getSession(userId);

    if (!msg) {
      return res.json({
        reply: `Contame qué estás buscando 👌`,
      });
    }

    // Reset / greeting
    if (isGreeting(msg)) {
      resetSession(userId);
      return res.json({
        reply: `Hola 👋

Soy el sistema de ventas.

Te ayudo a encontrar productos, resolver dudas y avanzar a compra.

¿Qué estás buscando hoy?`,
      });
    }

    // Button/value mappings for controlled demo UX
    if (msg === "hombre") {
      session.gender = "hombre";
    }
    if (msg === "mujer") {
      session.gender = "mujer";
    }
    if (msg === "frio_intenso" || msg === "frio") {
      session.weatherNeed = "frio";
    }
    if (msg === "liviana" || msg === "liviano") {
      session.weatherNeed = "liviano";
    }

    // Detect product category and qualifiers
    const detectedCategory = detectCategory(msg);
    const detectedGender = detectGender(msg);
    const detectedWeatherNeed = detectWeatherNeed(msg);

    if (detectedCategory) session.category = detectedCategory;
    if (detectedGender) session.gender = detectedGender;
    if (detectedWeatherNeed) session.weatherNeed = detectedWeatherNeed;

    // Human handoff
    if (detectHumanIntent(msg) || msg === "hablar_con_asesor") {
      session.stage = "closing";
      return res.json({
        reply: `Perfecto 👌

Te paso con un asesor para finalizar la compra y confirmar stock.

En un momento te contactan 👍`,
        actions: [
          { label: "Volver a la recomendación", value: "volver_recomendacion" },
        ],
      });
    }

    // Buy intent
    if (
      detectBuyIntent(msg) ||
      msg === "comprar_ahora" ||
      msg === "comprar_recomendada"
    ) {
      const product = session.shownProduct || getProduct(session);

      if (product) {
        session.stage = "closing";
        return res.json({
          reply: `Perfecto 👌

Te llevo directo a compra:

${product.name}
${formatCurrency(product.price, product.currency)}

${product.url}`,
          product: {
            id: product.id,
            name: product.name,
            price: product.price,
            currency: product.currency,
            url: product.url,
            image: product.image,
          },
          actions: [
            { label: "Hablar con asesor", value: "hablar_con_asesor" },
          ],
        });
      }

      return res.json({
        reply: `Perfecto 👌

Antes de avanzar, decime qué producto estás buscando y te recomiendo la mejor opción.`,
      });
    }

    // Buy alt product
    if (msg === "comprar_alt") {
      const altProduct = session.shownAltProduct;

      if (altProduct) {
        session.stage = "closing";
        return res.json({
          reply: `Perfecto 👌

Te llevo directo a compra:

${altProduct.name}
${formatCurrency(altProduct.price, altProduct.currency)}

${altProduct.url}`,
          product: {
            id: altProduct.id,
            name: altProduct.name,
            price: altProduct.price,
            currency: altProduct.currency,
            url: altProduct.url,
            image: altProduct.image,
          },
          actions: [
            { label: "Hablar con asesor", value: "hablar_con_asesor" },
          ],
        });
      }
    }

    // Support / FAQ
    if (detectSupportIntent(msg) || msg === "tengo_una_duda") {
      return res.json(faqReply(session));
    }

    // Unsure
    if (detectUnsure(msg)) {
      if (session.category === "campera" && !session.weatherNeed) {
        return res.json({
          reply: `No hay problema 👌

Te ayudo a elegir.

¿La necesitás para frío intenso o algo más liviano?`,
          actions: [
            { label: "Frío intenso", value: "frio_intenso" },
            { label: "Más liviana", value: "liviana" },
          ],
        });
      }

      return res.json({
        reply: `No pasa nada 👌

Contame qué uso le querés dar y te recomiendo la mejor opción.`,
      });
    }

    // Price objection
    if (detectPriceObjection(msg) || msg === "ver_mas_barata") {
      const product = session.shownProduct || getProduct(session);

      if (product?.alt) {
        session.shownAltProduct = product.alt;
        session.stage = "alt_product_shown";
        return res.json(altProductReply(product.alt, product));
      }

      return res.json({
        reply: `Entiendo 👌

Si querés, te ayudo a encontrar la opción con mejor relación precio/uso.`,
      });
    }

    // Style objection / another option
    if (detectStyleObjection(msg) || msg === "otra_opcion") {
      session.weatherNeed = null;
      session.shownProduct = null;
      session.shownAltProduct = null;
      session.stage = "asking_weather_need";

      return res.json({
        reply: `Perfecto, lo ajustamos 👌

¿Querés algo para frío intenso o una opción más liviana?`,
        actions: [
          { label: "Frío intenso", value: "frio_intenso" },
          { label: "Más liviana", value: "liviana" },
        ],
      });
    }

    // Correction handling
    if (detectCorrection(msg)) {
      session.weatherNeed = null;
      session.shownProduct = null;
      session.shownAltProduct = null;
      session.stage = "asking_weather_need";

      return res.json({
        reply: `Perfecto, lo ajustamos 👌

¿Buscás algo para frío intenso o algo más liviano?`,
        actions: [
          { label: "Frío intenso", value: "frio_intenso" },
          { label: "Más liviana", value: "liviana" },
        ],
      });
    }

    // Guided sales flow: category
    if (!session.category) {
      const justDetectedCategory = detectCategory(msg);
      if (justDetectedCategory) {
        session.category = justDetectedCategory;
      } else {
        return res.json({
          reply: `Bien 👌

¿Qué estás buscando hoy? Por ejemplo: una campera para invierno.`,
        });
      }
    }

    // Guided sales flow: gender
    if (session.category === "campera" && !session.gender) {
      session.stage = "asking_gender";
      return res.json({
        reply: `Bien 👌 ¿La buscás para hombre o mujer?`,
        actions: [
          { label: "Hombre", value: "hombre" },
          { label: "Mujer", value: "mujer" },
        ],
      });
    }

    // Guided sales flow: weather need
    if (session.category === "campera" && !session.weatherNeed) {
      session.stage = "asking_weather_need";
      return res.json({
        reply: `Perfecto 👍 ¿La querés para frío intenso o algo más liviano?`,
        actions: [
          { label: "Frío intenso", value: "frio_intenso" },
          { label: "Más liviana", value: "liviana" },
        ],
      });
    }

    // Show main product
    const product = getProduct(session);
    if (product) {
      session.shownProduct = product;
      session.shownAltProduct = product.alt || null;
      session.stage = "product_shown";

      return res.json(productReply(product));
    }

    // Safe fallback
    return res.json(fallbackReply(session));
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({
      reply: `Hubo un error. Si querés, te paso con un asesor.`,
      actions: [
        { label: "Hablar con asesor", value: "hablar_con_asesor" },
      ],
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});