/**
 * matcher.mjs
 * Scores products against session signals. No ML, no embeddings.
 * Simple, fast, debuggable — correct for V1.
 */

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// These words are handled by gender detection — exclude from tag matching
const GENDER_STOP_WORDS = new Set(["hombre", "mujer", "dama", "caballero", "masculino", "femenino", "unisex"]);

/**
 * Score a product against the current session signals.
 */
function scoreProduct(product, signals) {
  let score = 0;

  // Category match — strongest signal
  if (signals.category && normalize(product.category) === normalize(signals.category)) {
    score += 10;
  }

  // Gender match — strong signal, penalize wrong gender
  if (signals.gender) {
    const genders = (product.gender || []).map(normalize);
    if (genders.includes(normalize(signals.gender))) {
      score += 8;
    } else if (!genders.includes("unisex")) {
      score -= 6;
    }
  }

  // Filter terms — remove gender words and very short tokens
  const cleanTerms = signals.terms.filter(
    (t) => t.length > 2 && !GENDER_STOP_WORDS.has(t)
  );

  // Use-case match
  const useCases = (product.use_case || []).map(normalize);
  for (const term of cleanTerms) {
    if (useCases.some((uc) => uc.includes(term) || term.includes(uc))) {
      score += 4;
    }
  }

  // Tag match — exclude gender words
  const tags = (product.tags || []).map(normalize).filter((t) => !GENDER_STOP_WORDS.has(t));
  for (const term of cleanTerms) {
    if (tags.some((tag) => tag.includes(term) || term.includes(tag))) {
      score += 2;
    }
  }

  // Price tier — reward match, penalize mismatch
  if (signals.priceTier && product.price_tier === signals.priceTier) {
    score += 3;
  }
  if (signals.priceTier === "low" && product.price_tier === "high") score -= 6;
  if (signals.priceTier === "high" && product.price_tier === "low") score -= 3;

  return score;
}

function buildSignals(session) {
  const terms = [];
  if (session.weatherNeed) terms.push(...normalize(session.weatherNeed).split(" "));
  if (session.rawQuery) terms.push(...normalize(session.rawQuery).split(" "));

  return {
    gender: session.gender || null,
    category: session.category || null,
    priceTier: session.priceTier || null,
    terms,
  };
}

/**
 * Find the best product match for the current session.
 * Returns null if no product scores above the minimum threshold.
 */
export function matchProduct(products, session) {
  if (!products?.length) return null;

  const signals = buildSignals(session);
  const scored = products
    .map((p) => ({ product: p, score: scoreProduct(p, signals) }))
    .sort((a, b) => b.score - a.score);

  const MIN_SCORE = 4;
  if (scored[0].score < MIN_SCORE) return null;

  return scored[0].product;
}

/**
 * Find best alternative — different product, biased toward lower price.
 */
export function matchAltProduct(products, session, primary) {
  const others = products.filter((p) => p.id !== primary.id);
  if (!others.length) return null;

  const altSession = { ...session, priceTier: "low" };
  const signals = buildSignals(altSession);

  const scored = others
    .map((p) => ({ product: p, score: scoreProduct(p, signals) }))
    .sort((a, b) => b.score - a.score);

  return scored[0].score >= 2 ? scored[0].product : null;
}

/**
 * Serialize a product into the response shape the frontend expects.
 */
export function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    currency: "$",
    url: product.url,
    image: product.image || "",
    why: product.why || [],
  };
}