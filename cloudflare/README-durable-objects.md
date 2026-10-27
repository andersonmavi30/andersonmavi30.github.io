# Telegram WebChat — Durable Objects deployment

## Current state (safe merge to main)

- **Website on main:** keeps loading `assets/telegram-webchat.js`, the **existing legacy chat**. It is not switched to Durable Objects by merging this PR.
- **Realtime client:** `assets/telegram-webchat-v2.js` is saved separately, **not loaded** until the production Worker is ready.
- **Staging Worker:** `andersonmv-telegram-bot-staging` has Durable Objects `CHAT_ROOMS` and `ADMIN_ROUTER`. Its standalone test page is `/chat-preview`.
- **Production Worker:** remains `andersonmv-telegram-bot`, running the old KV transport until its separate deployment is approved.
- **GitHub root `wrangler.jsonc`:** intentionally targets **staging**. Never deploy this root configuration to the production Worker.

## Production cutover — Worker first, browser second

1. Retain the current live Worker version ID, source backup, and the three existing encrypted secrets in Cloudflare.
2. Ensure the production Worker has `TELEGRAM_SESSIONS` KV and the existing encrypted `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` and `TELEGRAM_WEBHOOK_SECRET`. **Do not expose or commit their values.**
3. Use exactly the **production-specific** Wrangler config to deploy the Worker under the existing production name:

   ```bash
   npx wrangler@latest deploy --config cloudflare/wrangler.production.jsonc
   ```

   The production config retains the old KV binding and adds SQLite Durable Objects. Do **not** use the root or `cloudflare/wrangler.jsonc` (they target staging).
4. Check that the existing website chat still works through `POST /webchat` and `POST /webchat/poll`, and check Telegram's existing bot and webhook.
5. Validate `POST /webchat/v2` with `action=start`, authorized origin, and JSON content type. Then test WebSocket delivery, contact collection, notification, reply and follow-up.
6. **Only when those checks pass**, change one site reference from `assets/telegram-webchat.js` to `assets/telegram-webchat-v2.js` in a separate reviewed commit. This is the actual activation of the realtime webchat.

## Telegram

A Telegram bot has **one active webhook URL**. Testing the production bot against a separate staging webhook would redirect live traffic and must be avoided. Use a distinct BotFather test bot for full end-to-end staging tests. The existing production bot token stays with the existing production Worker.

Telegram Bot API does **not** reveal human typing keystrokes. The WebSocket status "Anderson está preparando una respuesta…" is a best-effort indicator triggered when the admin selects the Reply button; it automatically expires.

## Security and limitations

- Browser sessions use an independent opaque session token. Do not publish session tokens or raw WebSocket connection URLs.
- Durable Objects hold session history for 24 hours, with expiration alarms.
- Rate limiting and anti-spam protection should be monitored on public traffic.
- WebSocket data delivery avoids the KV propagation lag, but network conditions still affect end-to-end latency.
- The website retains all Tech Stack, AWS logo, language and theme code untouched; Telegram JavaScript remains an isolated external file.

## Rollback

- Restore the existing production Worker deployment from Cloudflare's deployment history if the Worker fails. Keep KV and secrets.
- If the realtime client was activated, restore the previous site's script reference to `assets/telegram-webchat.js` first.
- Do not delete Durable Objects, secrets or KV until all active sessions expire and the rollback is complete.
