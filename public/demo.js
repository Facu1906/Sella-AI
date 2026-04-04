const state = {
      category: null,
      gender: null,
      weatherNeed: null,
      shownProduct: null,
      shownAltProduct: null,
      stage: "start"
    };

    const PRODUCTS = {
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

    function normalize(text) {
      return (text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    function getTime() {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function scrollToBottom() {
      const messages = document.getElementById("messages");
      messages.scrollTop = messages.scrollHeight;
    }

    function clearEmptyState() {
      const emptyState = document.getElementById("emptyState");
      if (emptyState) emptyState.remove();
    }

    function disableAllActionButtons() {
      document.querySelectorAll(".action-btn").forEach(btn => {
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
      price.textContent = product.price;

      const meta = document.createElement("div");
      meta.className = "product-meta";
      meta.innerHTML = product.why.map(item => `• ${item}`).join("<br>");

      const cta = document.createElement("a");
      cta.className = "product-cta";
      cta.href = product.url;
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
        img.src = product.image;
        img.alt = product.name;

        const body = document.createElement("div");
        body.className = "product-body";

        const title = document.createElement("div");
        title.className = "product-title";
        title.textContent = product.name;

        const price = document.createElement("div");
        price.className = "product-price";
        price.textContent = product.price;

        const meta = document.createElement("div");
        meta.className = "product-meta";
        meta.innerHTML = product.why.map(item => `• ${item}`).join("<br>");

        const cta = document.createElement("a");
        cta.className = "product-cta";
        cta.href = product.url;
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
          { label: "Mujer", value: "gender_mujer" }
        ]
      });
    }

    function showRecommendedProduct() {
      state.shownProduct = PRODUCTS.primary;
      state.shownAltProduct = PRODUCTS.alt;
      state.stage = "product_shown";

      botReply({
        reply: `Esta es la opción que mejor encaja con lo que buscás 👇\n\nTe recomiendo ir por esta.`,
        product: PRODUCTS.primary,
        actions: [
          { label: "Comprar ahora", value: "comprar_recomendada" },
          { label: "Ver opción más económica", value: "ver_mas_barata" },
          { label: "Tengo una duda", value: "faq" }
        ]
      });
    }

    function showLightOption() {
      state.shownProduct = PRODUCTS.alt;
      state.shownAltProduct = PRODUCTS.primary;
      state.stage = "product_shown";

      botReply({
        reply: `Si querés algo más liviano, esta es una mejor opción 👇`,
        product: PRODUCTS.alt,
        actions: [
          { label: "Comprar ahora", value: "comprar_alt" },
          { label: "Ver opción recomendada", value: "comprar_recomendada_view" },
          { label: "Tengo una duda", value: "faq" }
        ]
      });
    }

    function processAction(value) {
      switch (value) {
        case "start_demo":
          startDemo();
          return;

        case "gender_hombre":
          state.gender = "hombre";
          showRecommendedProduct();
          return;

        case "gender_mujer":
          state.gender = "mujer";
          showRecommendedProduct();
          return;

        case "comprar_recomendada":
          state.stage = "closing";
          botReply({
            reply: `Perfecto 👌\n\nEsta es la opción con la que te recomiendo avanzar.`,
            product: PRODUCTS.primary,
            productCtaText: "Comprar ahora",
            actions: [
              { label: "Hablar con asesor", value: "asesor" }
            ]
          });
          return;

        case "comprar_alt":
          state.stage = "closing";
          botReply({
            reply: `Perfecto 👌\n\nSi querés priorizar precio, esta es la mejor opción para avanzar.`,
            product: PRODUCTS.alt,
            productCtaText: "Comprar ahora",
            actions: [
              { label: "Hablar con asesor", value: "asesor" }
            ]
          });
          return;

        case "comprar_recomendada_view":
          botReply({
            reply: `Si querés más abrigo y mejor rendimiento para invierno, sigo recomendando esta 👇`,
            product: PRODUCTS.primary,
            actions: [
              { label: "Comprar recomendada", value: "comprar_recomendada" },
              { label: "Ver opción más económica", value: "ver_mas_barata" }
            ]
          });
          return;

        case "ver_mas_barata":
          state.stage = "alt_product_shown";
          botReply({
            reply: `Sí, te puedo mostrar una opción más económica 👇\n\nSi priorizás precio, esta te conviene más.\nSi querés más abrigo, sigo recomendando Campera Andes.\n\n¿Con cuál querés avanzar?`,
            products: [PRODUCTS.alt, PRODUCTS.primary],
            actions: [
              { label: "Comprar opción económica", value: "comprar_alt" },
              { label: "Comprar recomendada", value: "comprar_recomendada" },
              { label: "Ver otra opción", value: "otra_opcion" }
            ]
          });
          return;

        case "otra_opcion":
          state.stage = "choosing_weight";
          botReply({
            reply: `Perfecto, lo ajustamos 👌\n\n¿Querés algo para frío intenso o una opción más liviana?`,
            actions: [
              { label: "Frío intenso", value: "frio_intenso" },
              { label: "Más liviana", value: "liviana" }
            ]
          });
          return;

        case "frio_intenso":
          state.weatherNeed = "frio";
          showRecommendedProduct();
          return;

        case "liviana":
          state.weatherNeed = "liviano";
          showLightOption();
          return;

        case "faq":
          botReply({
            reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\nSi querés, seguimos con la opción que mejor te conviene.`,
            actions: [
              { label: "Comprar ahora", value: state.shownProduct === PRODUCTS.alt ? "comprar_alt" : "comprar_recomendada" },
              { label: "Ver opción más económica", value: "ver_mas_barata" }
            ]
          });
          return;

        case "asesor":
          botReply({
            reply: `Perfecto 👌\n\nTe paso con un asesor para finalizar la compra y confirmar stock.\n\nEn un momento te contactan 👍`
          });
          return;
      }
    }

    function processLocalMessage(text) {
      const msg = normalize(text);
      if (!msg) return;

      if (msg === "reset" || msg === "reiniciar" || msg === "hola" || msg === "menu") {
        resetState();
        botReply({
          reply: `Hola 👋\n\nSoy el sistema de ventas.\n\nTe ayudo a encontrar la mejor opción y llevarte a compra.\n\n¿Qué estás buscando hoy?`,
          actions: [
            { label: "Quiero una campera para invierno", value: "start_demo" }
          ]
        });
        return;
      }

      if (msg.includes("campera") || msg.includes("invierno") || msg.includes("jacket")) {
        state.category = "campera";
        state.weatherNeed = "frio";
        state.stage = "asking_gender";

        botReply({
          reply: `Perfecto 👌\n\n¿La buscás para hombre o mujer?`,
          actions: [
            { label: "Hombre", value: "gender_hombre" },
            { label: "Mujer", value: "gender_mujer" }
          ]
        });
        return;
      }

      if (msg.includes("envio") || msg.includes("envios") || msg.includes("envíos")) {
        botReply({
          reply: `Sí, hacemos envíos a todo Uruguay en 24–72 hs 👌\n\n¿Qué producto estás buscando?`
        });
        return;
      }

      if (msg.includes("hombre")) {
        processAction("gender_hombre");
        return;
      }

      if (msg.includes("mujer")) {
        processAction("gender_mujer");
        return;
      }

      if (msg.includes("caro") || msg.includes("cara") || msg.includes("barato") || msg.includes("economica") || msg.includes("económica")) {
        processAction("ver_mas_barata");
        return;
      }

      if (msg.includes("comprar") || msg.includes("lo quiero") || msg.includes("me lo llevo")) {
        processAction(state.shownProduct === PRODUCTS.alt ? "comprar_alt" : "comprar_recomendada");
        return;
      }

      if (msg.includes("no me gusta") || msg.includes("otra opcion") || msg.includes("otra opción")) {
        processAction("otra_opcion");
        return;
      }

      if (msg.includes("frio intenso") || msg.includes("frío intenso")) {
        processAction("frio_intenso");
        return;
      }

      if (msg.includes("liviana") || msg.includes("liviano")) {
        processAction("liviana");
        return;
      }

      if (msg.includes("asesor") || msg.includes("humano") || msg.includes("persona")) {
        processAction("asesor");
        return;
      }

      if (msg.includes("no se") || msg.includes("no sé")) {
        botReply({
          reply: `No hay problema 👌\n\nTe ayudo a elegir.\n\n¿La necesitás para frío intenso o algo más liviano?`,
          actions: [
            { label: "Frío intenso", value: "frio_intenso" },
            { label: "Más liviana", value: "liviana" }
          ]
        });
        return;
      }

      botReply({
        reply: `Te ayudo 👌\n\nProbá con algo como:\n• "Quiero una campera para invierno"\n• "Está cara"\n• "Quiero comprar"\n• "Hacen envíos?"`
      });
    }

    function sendPreset(text) {
      const input = document.getElementById("input");
      input.value = text;
      send();
    }

    function send() {
      const input = document.getElementById("input");
      const userText = input.value;
      if (!userText.trim()) return;

      disableAllActionButtons();
      appendMessage(userText, "user");
      input.value = "";
      processLocalMessage(userText);
    }

    document.getElementById("input").addEventListener("keypress", function(event) {
      if (event.key === "Enter") send();
    });

    setTimeout(() => {
      startDemo();
    }, 500);