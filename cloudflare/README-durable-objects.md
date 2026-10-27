# Durable Objects + Telegram WebChat v2

Status: **implementation on \`feature/telegram-durable-objects\` — NOT deployed to Cloudflare**.

## Why the migration

Cloudflare Workers KV is eventually consistent, so Telegram replies can take several seconds to appear in the browser even when the website polls frequently. This version uses **SQLite-backed Durable Objects with hibernatable WebSockets** to push replies to browsers instead of polling KV.

This is a replacement for the **webchat message transport**, not a replacement for the Telegram Bot API.

## Files

- \`cloudflare/durable-worker.js\` — new Cloudflare Worker entry point.
- \`cloudflare/wrangler.jsonc\` — DO classes, SQLite storage, legacy KV binding.
- \`cloudflare/telegram-worker.js\` — previous Worker version imported by the new Worker for backwards compatibility.
- \`assets/telegram-webchat.js\` — browser WebSocket client.
- \`index.html\` — improved chat dimensions and five always-visible action buttons.

## Flow

1. Website opens \`POST /webchat/v2\` with \`action=start\`.
2. Worker creates a random **session ID + independent bearer token**. Browser stores them in local storage for chat reconnection.
3. Website connects to \`wss://.../webchat/v2/ws\`.
4. **Hablar con Anderson** collects name, email, optional phone, and description in the chat.
5. Worker notifies Anderson in Telegram with **Responder**.
6. Clicking **Responder** selects this session in the AdminRouter Durable Object and pushes a temporary **“Anderson está preparando una respuesta…”** state to the web.
7. Anderson writes a message to the bot. The Worker stores the reply in the session DO and broadcasts it to connected visitor WebSockets.
8. Visitor replies in the web box. The Worker sends the message to Telegram with a reply button that selects the same web session.
9. Browser reconnects automatically when WebSocket disconnects; recent conversation history is stored for 24 hours.

**Telegram does not provide an API for knowing whether Anderson is literally typing in his personal Telegram app.** The displayed preparing-a-reply state is triggered by pressing **Responder** and expires after about 25 seconds, or when the message is sent. Don't label it as real typing telemetry.

## Free plan

SQLite-backed Durable Objects are supported on Workers Free. Service remains subject to Cloudflare free-tier quotas and storage/compute limits. There is no VM, n8n installation, or paid Telegram plan required.

## Safe migration — do not merge the website PR first

**This order matters:**

1. Back up the current deployed Cloudflare Worker code and its configuration. Keep existing secret names and webhook verification. Never copy token values into GitHub.
2. From a local checkout of this repo, deploy only the new Worker (Worker name is the existing \`andersonmv-telegram-bot\`):

   \`\`\`bash
   npx wrangler@latest deploy --config cloudflare/wrangler.production.jsonc
   \`\`\`

   The configuration declares \`CHAT_ROOMS\` and \`ADMIN_ROUTER\` as **SQLite-backed** Durable Objects. It also retains the existing \`TELEGRAM_SESSIONS\` KV binding to keep \`/webchat\` and \`/webchat/poll\` working during the cutover. Existing secrets are expected to remain on the Worker in Cloudflare. **Check the preview of the configuration before deployment.**

3. Test the **legacy** production site: the Telegram button, web contact collection, notification, sending replies and the Tech Stack carousel.
4. Smoke-test the new Worker API without creating Telegram contacts. Example:

   \`\`\`bash
   curl -i -X POST \
     'https://andersonmv-telegram-bot.andersonmavi30.workers.dev/webchat/v2' \
     -H 'Origin: https://andersonmvnetworks.com' \
     -H 'Content-Type: application/json' \
     --data '{"action":"start","lang":"es"}'
   \`\`\`

   Expect \`ok:true\` and distinct \`sessionId\` and \`token\`. Do **not** paste either into a public issue or chat.

5. After Worker validation, merge the **website branch**; the new frontend uses only \`/webchat/v2\` and the WebSocket route.
6. Confirm both desktop/mobile languages, full five-button menu, light/dark themes, chat collection and two-way messaging.
7. Check Worker logs for errors, DO quotas, and any abuse.

## Rollback

- **Frontend:** revert the website PR or restore the previous \`index.html\` and \`assets/telegram-webchat.js\` from \`main\` before merge. The previous site uses legacy \`/webchat\` endpoints, which remain exposed by the new Worker.
- **Worker:** after the frontend rollback, redeploy the previously backed-up Worker source if necessary. Do not remove the new Durable Objects until all sessions have expired and rollback is complete.
- The \`/webchat/v2\` endpoint and DO classes are independent of the old KV chat sessions. Existing KV conversations do not automatically migrate into DO.

## Operational/privacy considerations

- Bearer token authorizes the browser session. Avoid logging full WebSocket URLs containing tokens or pasting them into support discussions. No API credentials are embedded in the website.
- Sessions, messages and contact details are stored in the DO for up to 24 hours and are deleted by its alarm.
- Web app only allows the listed site origins; session token authorization remains necessary. Cross-origin restrictions alone are not authentication.
- The Worker checks that the Telegram webhook secret matches and that the sender equals the configured Telegram administrator before accepting a web-session Reply action.
- Basic per-session message rate limits are included. For public traffic growth, add Cloudflare Turnstile or WAF protection against bulk session creation and spam.
- Deployed Durable Object code updates disconnect existing WebSockets; browser reconnects automatically.
- The existing Workers KV binding is retained for backwards compatibility. Remove it only in a later, tested migration.
