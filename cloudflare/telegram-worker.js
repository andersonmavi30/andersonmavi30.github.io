/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
const ALLOWED_ORIGINS = [
  "https://andersonmvnetworks.com",
  "https://www.andersonmvnetworks.com",
  "https://andersonmavi30.github.io",
];
const SESSION_TTL = 60 * 60 * 24; // 24 horas
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/webchat") {
      return handleWebChat(request, env);
    }
    if (url.pathname === "/webchat/poll") {
      return handleWebPoll(request, env);
    }
    if (request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }
    return new Response("Anderson MV Telegram Bot Worker", {
      status: 200,
    });
  },
};
// ======================================================
// WEB CHAT
// ======================================================
async function handleWebChat(request, env) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);
  if (request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders
    );
  }
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse(
      { ok: false, error: "Origin not allowed" },
      403,
      {}
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Invalid JSON" },
      400,
      corsHeaders
    );
  }
  const lang = body.lang === "en" ? "en" : "es";
  const action = String(body.action || "").trim();
  const sessionId = sanitize(body.sessionId || "", 100);
  if (!sessionId) {
    return jsonResponse(
      { ok: false, error: "Missing sessionId" },
      400,
      corsHeaders
    );
  }
  let session = await getSession(env, sessionId);
  if (!session) {
    session = {
      id: sessionId,
      lang,
      state: "chat",
      createdAt: Date.now(),
      name: "",
      email: "",
      phone: "",
      description: "",
      reason: "",
      lastUserMessage: "",
      webMessages: [],
      adminMessages: [],
      escalated: false,
    };
  }
  session.lang = lang;
  // -------------------------
  // INITIAL MENU
  // -------------------------
  if (action === "start") {
    await saveSession(env, session);
    return jsonResponse(
      {
        ok: true,
        reply:
          lang === "es"
            ? "Hola 👋 Soy el asistente de Anderson MV Networks. ¿En qué puedo ayudarte?"
            : "Hi 👋 I'm the Anderson MV Networks assistant. How can I help you?",
        options: getMenu(lang),
      },
      200,
      corsHeaders
    );
  }
  // -------------------------
  // NORMAL CATEGORIES
  // -------------------------
  if (
    ["projects", "consulting", "collaborations", "support"].includes(action)
  ) {
    session.reason = getReasonLabel(lang, action);
    await saveSession(env, session);
    return jsonResponse(
      {
        ok: true,
        reply: getCategoryReply(lang, action),
        options: getMenu(lang),
      },
      200,
      corsHeaders
    );
  }
  // -------------------------
  // USER MESSAGE
  // -------------------------
  if (action === "message") {
    const message = sanitize(body.message || "", 1500);
    if (!message) {
      return jsonResponse(
        { ok: false, error: "Empty message" },
        400,
        corsHeaders
      );
    }
    session.lastUserMessage = message;
    session.webMessages.push({
      from: "user",
      text: message,
      ts: Date.now(),
    });
    if (session.webMessages.length > 30) {
      session.webMessages = session.webMessages.slice(-30);
    }
    await saveSession(env, session);
    return jsonResponse(
      {
        ok: true,
        reply:
          lang === "es"
            ? "Gracias. Puedes seguir escribiendo o seleccionar Hablar con Anderson cuando quieras."
            : "Thanks. You can keep writing or select Talk to Anderson whenever you want.",
        options: getMenu(lang),
      },
      200,
      corsHeaders
    );
  }
  // -------------------------
  // START ESCALATION FLOW
  // -------------------------
  if (action === "talk") {
    session.state = "awaiting_name";
    await saveSession(env, session);
    return jsonResponse(
      {
        ok: true,
        collect: true,
        field: "name",
        reply:
          lang === "es"
            ? "👤 Perfecto. Para conectarte con Anderson, primero dime tu nombre."
            : "👤 Perfect. To connect you with Anderson, first tell me your name.",
      },
      200,
      corsHeaders
    );
  }
  // -------------------------
  // COLLECT CONTACT DETAILS
  // -------------------------
  if (action === "collect") {
    const value = sanitize(body.value || "", 1200);
    if (!value) {
      return jsonResponse(
        {
          ok: false,
          error: "Empty value",
        },
        400,
        corsHeaders
      );
    }
    if (session.state === "awaiting_name") {
      session.name = sanitize(value, 100);
      session.state = "awaiting_email";
      await saveSession(env, session);
      return jsonResponse(
        {
          ok: true,
          collect: true,
          field: "email",
          reply:
            lang === "es"
              ? "Gracias. ¿Cuál es tu correo electrónico?"
              : "Thanks. What is your email address?",
        },
        200,
        corsHeaders
      );
    }
    if (session.state === "awaiting_email") {
      session.email = sanitize(value, 160);
      session.state = "awaiting_phone";
      await saveSession(env, session);
      return jsonResponse(
        {
          ok: true,
          collect: true,
          field: "phone",
          reply:
            lang === "es"
              ? "Perfecto. ¿Cuál es tu número de teléfono? Si prefieres no compartirlo, escribe: omitir."
              : "Perfect. What is your phone number? If you prefer not to share it, type: skip.",
        },
        200,
        corsHeaders
      );
    }
    if (session.state === "awaiting_phone") {
      const skip =
        value.toLowerCase() === "omitir" ||
        value.toLowerCase() === "skip";
      session.phone = skip ? "" : sanitize(value, 60);
      session.state = "awaiting_description";
      await saveSession(env, session);
      return jsonResponse(
        {
          ok: true,
          collect: true,
          field: "description",
          reply:
            lang === "es"
              ? "Por último, dame una breve descripción de lo que necesitas."
              : "Finally, give me a brief description of what you need.",
        },
        200,
        corsHeaders
      );
    }
    if (session.state === "awaiting_description") {
      session.description = sanitize(value, 1200);
      session.state = "connected";
      session.escalated = true;
      await saveSession(env, session);
      const adminMessage = buildAdminEscalationMessage(session);
      await telegramAPI(env, "sendMessage", {
        chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
        text: adminMessage,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💬 Responder",
                callback_data: `reply:${session.id}`,
              },
            ],
          ],
        },
      });
      return jsonResponse(
        {
          ok: true,
          connected: true,
          reply:
            lang === "es"
              ? "✅ Listo. Anderson ya recibió tus datos y el contexto. Puedes seguir escribiendo aquí."
              : "✅ Done. Anderson has received your details and context. You can keep writing here.",
        },
        200,
        corsHeaders
      );
    }
    return jsonResponse(
      {
        ok: false,
        error: "Invalid collection state",
      },
      400,
      corsHeaders
    );
  }
  return jsonResponse(
    {
      ok: false,
      error: "Invalid action",
    },
    400,
    corsHeaders
  );
}
// ======================================================
// WEB POLLING
// ======================================================
async function handleWebPoll(request, env) {
  const origin = request.headers.get("Origin") || "";
  const corsHeaders = getCorsHeaders(origin);
  if (request.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed" },
      405,
      corsHeaders
    );
  }
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse(
      { ok: false, error: "Origin not allowed" },
      403,
      {}
    );
  }
  const body = await request.json();
  const sessionId = sanitize(body.sessionId || "", 100);
  const lastTs = Number(body.lastTs || 0);
  const session = await getSession(env, sessionId);
  if (!session) {
    return jsonResponse(
      {
        ok: true,
        messages: [],
      },
      200,
      corsHeaders
    );
  }
  const messages = (session.adminMessages || []).filter(
    (m) => m.ts > lastTs
  );
  return jsonResponse(
    {
      ok: true,
      messages,
    },
    200,
    corsHeaders
  );
}
// ======================================================
// TELEGRAM WEBHOOK
// ======================================================
async function handleTelegramWebhook(request, env) {
  const telegramSecret = request.headers.get(
    "X-Telegram-Bot-Api-Secret-Token"
  );
  if (telegramSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }
  const update = await request.json();
  // -------------------------
  // CALLBACK BUTTON
  // -------------------------
  if (update.callback_query) {
    const callback = update.callback_query;
    await telegramAPI(env, "answerCallbackQuery", {
      callback_query_id: callback.id,
    });
    const data = callback.data || "";
    // Admin replies to web session
    if (data.startsWith("reply:")) {
      const sessionId = data.replace("reply:", "");
      const session = await getSession(env, sessionId);
      if (!session) {
        await sendMessage(
          env,
          env.TELEGRAM_ADMIN_CHAT_ID,
          "La sesión ya no existe o expiró."
        );
        return new Response("OK");
      }
      await env.TELEGRAM_SESSIONS.put(
        `admin_reply_target:${env.TELEGRAM_ADMIN_CHAT_ID}`,
        sessionId,
        {
          expirationTtl: SESSION_TTL,
        }
      );
      await sendMessage(
        env,
        env.TELEGRAM_ADMIN_CHAT_ID,
        `✍️ Respondiendo a ${session.name || "visitante"}\n\nEscribe tu mensaje ahora.`
      );
      return new Response("OK");
    }
    // Normal bot menu buttons
    const chatId = callback.message.chat.id;
    const [lang, option] = data.split(":");
    if (["projects", "consulting", "collaborations", "support"].includes(option)) {
      await sendMessage(
        env,
        chatId,
        getCategoryReply(lang, option)
      );
      return new Response("OK");
    }
    if (option === "talk") {
      const user = callback.from;
      const fullName = [
        user.first_name,
        user.last_name,
      ]
        .filter(Boolean)
        .join(" ");
      const username = user.username
        ? `@${user.username}`
        : "Sin username público";
      await sendMessage(
        env,
        chatId,
        lang === "es"
          ? "👤 Perfecto. Anderson ha sido notificado."
          : "👤 Perfect. Anderson has been notified."
      );
      await sendMessage(
        env,
        env.TELEGRAM_ADMIN_CHAT_ID,
        lang === "es"
          ? `🔔 Nuevo contacto desde Telegram
Nombre: ${fullName || "No disponible"}
Usuario: ${username}
Chat ID: ${chatId}
Idioma: Español
Motivo: Hablar directamente con Anderson`
          : `🔔 New contact from Telegram
Name: ${fullName || "Unavailable"}
Username: ${username}
Chat ID: ${chatId}
Language: English
Reason: Talk directly with Anderson`
      );
      return new Response("OK");
    }
  }
  // -------------------------
  // NORMAL TELEGRAM MESSAGE
  // -------------------------
  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text || "";
    // ADMIN REPLY TO WEB SESSION
    if (String(chatId) === String(env.TELEGRAM_ADMIN_CHAT_ID)) {
      const targetSessionId =
        await env.TELEGRAM_SESSIONS.get(
          `admin_reply_target:${env.TELEGRAM_ADMIN_CHAT_ID}`
        );
      if (targetSessionId && text && !text.startsWith("/")) {
        const session = await getSession(
          env,
          targetSessionId
        );
        if (session) {
          session.adminMessages =
            session.adminMessages || [];
          session.adminMessages.push({
            from: "anderson",
            text,
            ts: Date.now(),
          });
          if (session.adminMessages.length > 30) {
            session.adminMessages =
              session.adminMessages.slice(-30);
          }
          await saveSession(env, session);
          await sendMessage(
            env,
            chatId,
            `✅ Mensaje enviado a ${session.name || "visitante"}.`
          );
          return new Response("OK");
        }
      }
    }
    // /myid
    if (text === "/myid") {
      await sendMessage(
        env,
        chatId,
        `Tu chat_id es: ${chatId}`
      );
      return new Response("OK");
    }
    let lang = "es";
    if (
      text === "/start en" ||
      text.toLowerCase() === "hello" ||
      text.toLowerCase() === "hi"
    ) {
      lang = "en";
    }
    await sendTelegramMenu(env, chatId, lang);
  }
  return new Response("OK");
}
// ======================================================
// TELEGRAM MENU
// ======================================================
async function sendTelegramMenu(env, chatId, lang) {
  const es = lang === "es";
  const text = es
    ? "Hola 👋\n\nSoy el asistente de Anderson MV Networks.\n\n¿En qué puedo ayudarte?"
    : "Hi 👋\n\nI'm the Anderson MV Networks assistant.\n\nHow can I help you?";
  const keyboard = es
    ? [
        [{ text: "🚀 Proyectos", callback_data: "es:projects" }],
        [{ text: "💼 Consultoría", callback_data: "es:consulting" }],
        [{ text: "🤝 Colaboraciones", callback_data: "es:collaborations" }],
        [{ text: "🛠️ Soporte", callback_data: "es:support" }],
        [{ text: "👤 Hablar con Anderson", callback_data: "es:talk" }],
      ]
    : [
        [{ text: "🚀 Projects", callback_data: "en:projects" }],
        [{ text: "💼 Consulting", callback_data: "en:consulting" }],
        [{ text: "🤝 Collaborations", callback_data: "en:collaborations" }],
        [{ text: "🛠️ Support", callback_data: "en:support" }],
        [{ text: "👤 Talk to Anderson", callback_data: "en:talk" }],
      ];
  await telegramAPI(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}
// ======================================================
// HELPERS
// ======================================================
function getMenu(lang) {
  if (lang === "en") {
    return [
      { id: "projects", label: "🚀 Projects" },
      { id: "consulting", label: "💼 Consulting" },
      { id: "collaborations", label: "🤝 Collaborations" },
      { id: "support", label: "🛠️ Support" },
      { id: "talk", label: "👤 Talk to Anderson" },
    ];
  }
  return [
    { id: "projects", label: "🚀 Proyectos" },
    { id: "consulting", label: "💼 Consultoría" },
    { id: "collaborations", label: "🤝 Colaboraciones" },
    { id: "support", label: "🛠️ Soporte" },
    { id: "talk", label: "👤 Hablar con Anderson" },
  ];
}
function getReasonLabel(lang, action) {
  const reasons = {
    es: {
      projects: "Proyectos",
      consulting: "Consultoría",
      collaborations: "Colaboraciones",
      support: "Soporte",
    },
    en: {
      projects: "Projects",
      consulting: "Consulting",
      collaborations: "Collaborations",
      support: "Support",
    },
  };
  return reasons[lang]?.[action] || action;
}
function getCategoryReply(lang, action) {
  const replies = {
    es: {
      projects:
        "🚀 Cuéntame brevemente qué proyecto tienes en mente.",
      consulting:
        "💼 Cuéntame qué infraestructura, red o necesidad deseas revisar.",
      collaborations:
        "🤝 Cuéntame qué tipo de colaboración tienes en mente.",
      support:
        "🛠️ Describe brevemente el problema o la tecnología involucrada.",
    },
    en: {
      projects:
        "🚀 Tell me briefly about the project you have in mind.",
      consulting:
        "💼 Tell me about the infrastructure, network, or requirement you want to review.",
      collaborations:
        "🤝 Tell me what kind of collaboration you have in mind.",
      support:
        "🛠️ Briefly describe the issue or technology involved.",
    },
  };
  return replies[lang]?.[action] || "";
}
function buildAdminEscalationMessage(session) {
  const history = (session.webMessages || [])
    .slice(-8)
    .map((m) => `• ${m.text}`)
    .join("\n");
  if (session.lang === "en") {
    return `🔔 New web contact
Name: ${session.name || "Not provided"}
Email: ${session.email || "Not provided"}
Phone: ${session.phone || "Not provided"}
Reason: ${session.reason || "Not specified"}
Session: ${session.id}
Description:
${session.description || "Not provided"}
Recent messages:
${history || "No previous messages"}
Use the button below to reply.`;
  }
  return `🔔 Nuevo contacto web
Nombre: ${session.name || "No proporcionado"}
Correo: ${session.email || "No proporcionado"}
Teléfono: ${session.phone || "No proporcionado"}
Motivo: ${session.reason || "No especificado"}
Sesión: ${session.id}
Descripción:
${session.description || "No proporcionada"}
Mensajes recientes:
${history || "Sin mensajes previos"}
Usa el botón de abajo para responder.`;
}
async function getSession(env, sessionId) {
  return env.TELEGRAM_SESSIONS.get(
    `session:${sessionId}`,
    "json"
  );
}
async function saveSession(env, session) {
  await env.TELEGRAM_SESSIONS.put(
    `session:${session.id}`,
    JSON.stringify(session),
    {
      expirationTtl: SESSION_TTL,
    }
  );
}
async function sendMessage(env, chatId, text) {
  await telegramAPI(env, "sendMessage", {
    chat_id: chatId,
    text,
  });
}
async function telegramAPI(env, method, body) {
  return fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
}
function sanitize(value, maxLength) {
  return String(value)
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}
function getCorsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}
function jsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      ...headers,
    },
  });
}