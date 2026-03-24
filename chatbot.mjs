import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const sessions = {};

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function detectSupportIntent(msg) {
  return (
    msg.includes("envio") ||
    msg.includes("interior") ||
    msg.includes("pago") ||
    msg.includes("cambio") ||
    msg.includes("devolucion") ||
    msg.includes("devolver") ||
    msg.includes("tarda")
  );
}

function detectHumanIntent(msg) {
  return (
    msg.includes("asesor") ||
    msg.includes("persona") ||
    msg.includes("humano") ||
    msg.includes("hablar con alguien")
  );
}

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message || "";
    const msg = normalize(userMessage);
    const userId = req.ip;

    if (!sessions[userId]) {
      sessions[userId] = {
        category: null,
        gender: null,
        type: null,
        stage: null,
      };
    }

    const session = sessions[userId];

    if (!msg) {
      return res.json({
        reply: "Contame qué estás buscando 👌",
      });
    }

    // Greeting / reset
    if (
      msg === "hola" ||
      msg === "buenas" ||
      msg === "hello" ||
      msg === "hi" ||
      msg === "menu" ||
      msg === "menú" ||
      msg === "empezar" ||
      msg === "reiniciar" ||
      msg === "reset"
    ) {
      sessions[userId] = {
        category: null,
        gender: null,
        type: null,
        stage: null,
      };

      return res.json({
        reply: `Hola 👋\n\nSoy el asistente de ventas.\n\nPuedo ayudarte a encontrar productos, responder dudas de envíos o pasarte con un asesor.\n\n¿Qué estás buscando hoy?`,
      });
    }

    // ===== DETECTION =====
    if (msg.includes("campera")) {
      session.category = "campera";
    }

    if (msg.includes("hombre")) {
      session.gender = "hombre";
    }

    if (msg.includes("mujer")) {
      session.gender = "mujer";
    }

    if (msg.includes("frio") || msg.includes("intenso")) {
      session.type = "frio";
    }

    if (msg.includes("liviano")) {
      session.type = "liviano";
    }

    // ===== EXTRA INTENTS =====

    // Price sensitivity
if (msg.includes("barato") || msg.includes("mas barato")) {
  return res.json({
    reply: `Perfecto, entiendo 👌

¿Querés que te muestre opciones más económicas o priorizamos calidad para frío intenso?`,
  });
}

// Style preference
if (msg.includes("no me gusta") || msg.includes("otro estilo")) {
  session.type = null;

  return res.json({
    reply: `Perfecto, lo ajustamos 👌

¿Qué estilo estás buscando? ¿Más deportivo o algo más urbano?`,
  });
}

    // User unsure / needs help choosing
    if (msg.includes("no se") || msg.includes("no estoy seguro")) {
      return res.json({
        reply: `No hay problema 👌\n\nTe ayudo a elegir.\n\n¿Buscás algo para frío intenso o algo más liviano?`,
      });
    }

    // User says it's not what they want (correction handling)
    if (msg.includes("no es lo que busco") || msg.includes("no me gusta") || msg === "no") {
      session.type = null;
      session.stage = null;

      return res.json({
        reply: `Perfecto, lo ajustamos 👌\n\n¿Buscás algo más liviano o para frío intenso?`,
      });
    }

    // Shipping / FAQ with smarter return to flow
    if (detectSupportIntent(msg)) {
      if (session.stage === "closing") {
        return res.json({
          reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\nSi querés, te paso con un asesor para finalizar la compra.`,
        });
      }

      if (session.category === "campera" && session.type) {
        return res.json({
          reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\nVolviendo a la campera, ¿querés avanzar con la compra o necesitás algo más?`,
        });
      }

      return res.json({
        reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\n¿Qué estás buscando hoy?`,
      });
    }

    // Human handoff intent
    if (detectHumanIntent(msg) || msg.includes("comprar")) {
      session.stage = "closing";

      return res.json({
        reply: `Perfecto 👌\n\nTe paso con un asesor para finalizar la compra y confirmar stock.\n\nEn un momento te contactan 👍`,
      });
    }

    // ===== CAMPERA FLOW =====
    if (session.category === "campera") {
      if (!session.gender) {
        return res.json({
          reply: "Bien 👌\n¿La buscás para hombre o mujer?",
        });
      }

      if (!session.type) {
        return res.json({
          reply: "Perfecto 👍\n¿La querés para frío intenso o algo más liviano?",
        });
      }

      session.stage = "product_shown";

      return res.json({
        reply: `Campera Invierno Premium 👌

Te recomiendo esta opción en base a lo que me dijiste 👇

Ideal para frío intenso. Sale $3990

https://mitienda.com/campera-andes

¿La querés en algún talle?`,
      });
    }

    // ===== GPT FALLBACK =====
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Sos un asistente de ventas para e-commerce. Respondé breve, claro y orientado a ayudar al cliente a comprar. Si no sabés algo específico, redirigí de forma útil.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    return res.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      reply: "Hubo un error, ¿querés que te pase con un asesor?",
    });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});