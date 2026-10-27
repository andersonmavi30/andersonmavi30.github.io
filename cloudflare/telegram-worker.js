// Cloudflare Worker — Anderson MV Networks Telegram bridge
// Required secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ADMIN_CHAT_ID
// Required KV binding: TELEGRAM_SESSIONS
const ORIGINS = new Set([
  "https://andersonmvnetworks.com",
  "https://www.andersonmvnetworks.com",
  "https://andersonmavi30.github.io",
]);
const TTL = 86400;
const MAX_MESSAGES = 20;
const WEB_ACTIONS = new Set(["projects", "consulting", "collaborations", "support"]);
const FIELDS = ["name", "email", "phone", "description"];
const NEXT = ["email", "phone", "description", null];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/webchat" || url.pathname === "/webchat/poll") {
      return webRequest(request, env, url.pathname.endsWith("/poll"));
    }
    if (url.pathname === "/" && request.method === "POST") {
      return telegramWebhook(request, env);
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Anderson MV Telegram Bot Worker", { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  },
};

function clean(value, limit) {
  return String(value == null ? "" : value).replace(/[<>]/g, "").trim().slice(0, limit);
}

function langOf(value) {
  return value === "en" ? "en" : "es";
}

function t(lang, es, en) {
  return lang === "en" ? en : es;
}

function headersFor(origin) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(value, status, origin) {
  return new Response(JSON.stringify(value), { status: status || 200, headers: headersFor(origin) });
}

function sessionKey(id) {
  return "session:" + id;
}

async function getSession(env, id) {
  return env.TELEGRAM_SESSIONS.get(sessionKey(id), "json");
}

async function saveSession(env, session) {
  await env.TELEGRAM_SESSIONS.put(sessionKey(session.id), JSON.stringify(session), { expirationTtl: TTL });
}

function menu(lang) {
  return lang === "en"
    ? [
        { id: "projects", label: "🚀 Projects" },
        { id: "consulting", label: "💼 Consulting" },
        { id: "collaborations", label: "🤝 Collaborations" },
        { id: "support", label: "🛠️ Support" },
        { id: "talk", label: "👤 Talk to Anderson" },
      ]
    : [
        { id: "projects", label: "🚀 Proyectos" },
        { id: "consulting", label: "💼 Consultoría" },
        { id: "collaborations", label: "🤝 Colaboraciones" },
        { id: "support", label: "🛠️ Soporte" },
        { id: "talk", label: "👤 Hablar con Anderson" },
      ];
}

function categoryReply(lang, action) {
  const copy = {
    projects: ["🚀 Cuéntame qué proyecto tienes en mente.", "🚀 Tell me about your project."],
    consulting: ["💼 Cuéntame qué infraestructura deseas revisar.", "💼 Tell me about the infrastructure you want reviewed."],
    collaborations: ["🤝 Cuéntame qué colaboración propones.", "🤝 Tell me what collaboration you propose."],
    support: ["🛠️ Describe el problema o la tecnología involucrada.", "🛠️ Describe the issue or technology involved."],
  };
  const value = copy[action] || ["Opción no disponible.", "Option not available."];
  return lang === "en" ? value[1] : value[0];
}

function collectPrompt(lang, field) {
  const prompts = {
    name: ["👤 Para hablar con Anderson, ¿cuál es tu nombre?", "👤 To talk to Anderson, what is your name?"],
    email: ["Gracias. ¿Cuál es tu correo electrónico?", "Thanks. What is your email address?"],
    phone: ["¿Tu teléfono? Es opcional; escribe «omitir» si prefieres.", "Your phone number? Optional; type «skip» if you prefer."],
    description: ["Por último, describe brevemente lo que necesitas.", "Finally, briefly describe what you need."],
  };
  const pair = prompts[field];
  return pair ? (lang === "en" ? pair[1] : pair[0]) : "";
}

function alertText(session) {
  const en = session.lang === "en";
  return (en ? "🔔 New website contact" : "🔔 Nuevo contacto web") + "\n\n" +
    (en ? "Name: " : "Nombre: ") + session.name + "\n" +
    (en ? "Email: " : "Correo: ") + session.email + "\n" +
    (en ? "Phone: " : "Teléfono: ") + (session.phone || (en ? "Not supplied" : "No proporcionado")) + "\n" +
    (en ? "Session: " : "Sesión: ") + session.id + "\n\n" +
    (en ? "Description:\n" : "Descripción:\n") + session.description;
}

function replyKeyboard(id) {
  return { inline_keyboard: [[{ text: "💬 Responder", callback_data: "reply:" + id }]] };
}

async function tg(env, method, body) {
  const response = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Telegram HTTP " + response.status);
  const data = await response.json();
  if (!data.ok) throw new Error("Telegram API rejected " + method);
  return data.result;
}

async function send(env, chatId, text, markup) {
  const payload = { chat_id: chatId, text };
  if (markup) payload.reply_markup = markup;
  return tg(env, "sendMessage", payload);
}

async function webRequest(request, env, isPoll) {
  const origin = request.headers.get("Origin") || "";
  if (!ORIGINS.has(origin)) return new Response("Forbidden", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(origin) });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405, origin);
  if (!env.TELEGRAM_SESSIONS) return json({ ok: false, error: "KV binding unavailable" }, 503, origin);

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400, origin); }
  const id = clean(body.sessionId, 100);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return json({ ok: false, error: "Invalid session" }, 400, origin);

  let session = await getSession(env, id);
  if (isPoll) {
    if (!session || !session.escalated) return json({ ok: true, messages: [], typing: false, connected: false }, 200, origin);
    const since = Number(body.lastTs) || 0;
    const messages = (session.adminMessages || []).filter(m => m.ts > since);
    const typingStarted = Number(await env.TELEGRAM_SESSIONS.get("typing:" + id)) || 0;
    const latestReply = Math.max(0, ...(session.adminMessages || []).map(m => m.ts || 0));
    const typing = typingStarted > latestReply && Date.now() - typingStarted < 30000 && typingStarted <= Date.now();
    return json({ ok: true, messages, typing, connected: true }, 200, origin);
  }

  const lang = langOf(body.lang);
  const action = clean(body.action, 32);
  if (!session) {
    if (action !== "start") return json({ ok: false, error: "Session not found. Restart chat." }, 404, origin);
    session = {
      id, lang, state: "chat", escalated: false, name: "", email: "", phone: "",
      description: "", reason: "", webMessages: [], adminMessages: [], createdAt: Date.now(),
    };
    await saveSession(env, session);
  }
  session.lang = lang;

  if (action === "start") {
    if (session.escalated) {
      return json({ ok: true, connected: true, reply: t(lang,
        "Bienvenido de nuevo. Puedes continuar hablando con Anderson aquí.",
        "Welcome back. You can continue talking with Anderson here.") }, 200, origin);
    }
    if (session.state.startsWith("awaiting_")) {
      const field = session.state.slice(9);
      return json({ ok: true, collect: true, field, reply: collectPrompt(lang, field) }, 200, origin);
    }
    return json({ ok: true, options: menu(lang), reply: t(lang,
      "Hola 👋 Soy el asistente de Anderson MV Networks. ¿En qué puedo ayudarte?",
      "Hi 👋 I'm the Anderson MV Networks assistant. How can I help you?") }, 200, origin);
  }

  if (WEB_ACTIONS.has(action)) {
    if (session.escalated) return json({ ok: true, connected: true, reply: t(lang, "Ya estás conversando con Anderson.", "You are already talking to Anderson.") }, 200, origin);
    const label = menu(lang).find(x => x.id === action);
    session.reason = label ? label.label : action;
    await saveSession(env, session);
    return json({ ok: true, reply: categoryReply(lang, action), options: menu(lang) }, 200, origin);
  }

  if (action === "talk") {
    if (session.escalated) return json({ ok: true, connected: true, reply: t(lang, "Ya estás conectado con Anderson.", "You are already connected to Anderson.") }, 200, origin);
    session.state = "awaiting_name";
    await saveSession(env, session);
    return json({ ok: true, collect: true, field: "name", reply: collectPrompt(lang, "name") }, 200, origin);
  }

  if (action === "collect") {
    const field = session.state.startsWith("awaiting_") ? session.state.slice(9) : "";
    const index = FIELDS.indexOf(field);
    if (index < 0) return json({ ok: false, error: "No contact field pending" }, 409, origin);
    const limit = field === "description" ? 1200 : (field === "email" ? 160 : (field === "phone" ? 60 : 100));
    let value = clean(body.value, limit);
    if (field === "phone" && ["omitir", "skip"].includes(value.toLowerCase())) value = "";
    if (!value && field !== "phone") return json({ ok: true, collect: true, field, reply: t(lang, "Este dato es obligatorio.", "This field is required.") }, 200, origin);
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return json({ ok: true, collect: true, field, reply: t(lang, "Introduce un correo electrónico válido.", "Please enter a valid email address.") }, 200, origin);
    }
    session[field] = value;
    const nextField = NEXT[index];
    if (nextField) {
      session.state = "awaiting_" + nextField;
      await saveSession(env, session);
      return json({ ok: true, collect: true, field: nextField, reply: collectPrompt(lang, nextField) }, 200, origin);
    }
    // Notify first, then mark connected: avoid false success if Telegram rejects the message.
    await send(env, env.TELEGRAM_ADMIN_CHAT_ID, alertText(session), replyKeyboard(session.id));
    session.state = "connected";
    session.escalated = true;
    await saveSession(env, session);
    return json({ ok: true, connected: true, reply: t(lang,
      "✅ Anderson recibió tus datos. Puedes seguir escribiendo aquí.",
      "✅ Anderson received your details. You can keep writing here.") }, 200, origin);
  }

  if (action === "message") {
    const message = clean(body.message, 1500);
    if (!message) return json({ ok: false, error: "Empty message" }, 400, origin);
    if (session.state.startsWith("awaiting_")) return json({ ok: false, error: "Complete contact details first" }, 409, origin);
    if (session.escalated) {
      // Every follow-up from the visitor reaches the administrator, including after handoff.
      await send(env, env.TELEGRAM_ADMIN_CHAT_ID,
        "💬 " + (session.name || "Visitante") + " (Web)\n\n" + message,
        replyKeyboard(session.id));
    }
    session.webMessages = (session.webMessages || []).concat([{ from: "user", text: message, ts: Date.now() }]).slice(-MAX_MESSAGES);
    await saveSession(env, session);
    return json({
      ok: true,
      connected: session.escalated,
      reply: session.escalated
        ? t(lang, "✓ Mensaje enviado a Anderson.", "✓ Message delivered to Anderson.")
        : t(lang, "Gracias. Selecciona una opción o solicita hablar con Anderson.", "Thanks. Select an option or ask to talk to Anderson."),
      options: session.escalated ? [] : menu(lang),
    }, 200, origin);
  }
  return json({ ok: false, error: "Invalid action" }, 400, origin);
}

async function telegramWebhook(request, env) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.TELEGRAM_SESSIONS) return new Response("KV binding unavailable", { status: 503 });

  let update;
  try { update = await request.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  if (update.callback_query) {
    const cb = update.callback_query;
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    const data = String(cb.data || "");
    const chatId = String(cb.message && cb.message.chat && cb.message.chat.id || "");

    if (data.startsWith("reply:")) {
      // Only the registered administrator can bind a web session as reply target.
      if (chatId !== String(env.TELEGRAM_ADMIN_CHAT_ID) || String(cb.from.id) !== String(env.TELEGRAM_ADMIN_CHAT_ID)) {
        return new Response("OK");
      }
      const id = data.slice(6);
      const session = await getSession(env, id);
      if (!session || !session.escalated) {
        await send(env, chatId, "Esta sesión ya no existe o expiró.");
        return new Response("OK");
      }
      await env.TELEGRAM_SESSIONS.put("admin_reply_target:" + chatId, id, { expirationTtl: TTL });
      // This is an estimated status, not actual Telegram typing telemetry.
      await env.TELEGRAM_SESSIONS.put("typing:" + id, String(Date.now()), { expirationTtl: 60 });
      await send(env, chatId, "✍️ Respondiendo a " + session.name + ". Escribe tu mensaje ahora.");
      return new Response("OK");
    }

    const parts = data.split(":");
    const lang = langOf(parts[0]);
    const action = parts[1];
    if (WEB_ACTIONS.has(action)) await send(env, chatId, categoryReply(lang, action));
    else if (action === "talk") {
      const from = cb.from;
      const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
      await send(env, chatId, t(lang, "👤 Anderson ha sido notificado.", "👤 Anderson has been notified."));
      await send(env, env.TELEGRAM_ADMIN_CHAT_ID,
        "🔔 " + t(lang, "Nuevo contacto desde Telegram", "New Telegram contact") + "\n" +
        "Nombre: " + name + "\n" +
        "Usuario: " + (from.username ? "@" + from.username : "No disponible") + "\n" +
        "Chat ID: " + chatId);
    }
    return new Response("OK");
  }

  if (update.message && update.message.chat) {
    const chatId = String(update.message.chat.id);
    const text = String(update.message.text || "");
    if (text === "/myid") {
      await send(env, chatId, "Tu chat_id es: " + chatId);
      return new Response("OK");
    }
    if (chatId === String(env.TELEGRAM_ADMIN_CHAT_ID)) {
      if (text === "/cancelar" || text === "/cancel") {
        await env.TELEGRAM_SESSIONS.delete("admin_reply_target:" + chatId);
        await send(env, chatId, "Respuesta web cancelada.");
        return new Response("OK");
      }
      if (!text.startsWith("/")) {
        const target = await env.TELEGRAM_SESSIONS.get("admin_reply_target:" + chatId);
        if (target) {
          const session = await getSession(env, target);
          if (session && session.escalated) {
            session.adminMessages = (session.adminMessages || []).concat([
              { from: "anderson", text: clean(text, 3500), ts: Date.now() },
            ]).slice(-MAX_MESSAGES);
            await saveSession(env, session);
            await send(env, chatId, "✅ Mensaje enviado a " + session.name + ".");
            return new Response("OK");
          }
        }
      }
    }
    const lang = text === "/start en" || /^(hello|hi)$/i.test(text) ? "en" : "es";
    await send(env, chatId, t(lang,
      "Hola 👋\n\nSoy el asistente de Anderson MV Networks.\n\n¿En qué puedo ayudarte?",
      "Hi 👋\n\nI'm the Anderson MV Networks assistant.\n\nHow can I help you?"),
      { inline_keyboard: menu(lang).map(item => [{ text: item.label, callback_data: lang + ":" + item.id }]) });
  }
  return new Response("OK");
}
