# Telegram webchat — safe deployment notes

This branch is **not** deployed to the public site. The production site is served from `main` and remains unchanged.

## Architecture

- GitHub Pages: `index.html` + isolated `assets/telegram-webchat.js`
- Cloudflare Worker: `cloudflare/telegram-worker.js` (deploy manually using Cloudflare's **Edit code** → **Deploy** only after approval)
- Cloudflare KV: existing binding `TELEGRAM_SESSIONS`
- Existing encrypted Worker secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`
- Webchat paths: `POST /webchat` and `POST /webchat/poll`; Telegram webhook: `POST /`.

**Never commit Telegram tokens, webhook secrets, or personal contact information.** The code uses binding names only.

## Interaction

1. The visitor opens the chat and can browse the four categories.
2. On **Hablar con Anderson / Talk to Anderson**, collect name, email, optional phone, and description in chat.
3. The Worker sends the contact card to Anderson with the **Responder** button. No "Motivo" or "Mensajes recientes" fields in this dedicated contact alert.
4. Anderson presses **Responder**, selects the active web session, and types a message into the bot. The Worker stores the reply in KV; the website checks `/webchat/poll`.
5. New visitor messages after handoff are relayed to Anderson with a session-specific reply button.
6. Anderson may send `/cancelar` or `/cancel` to clear the selected conversation.

## Important limitations

- **KV is eventually consistent**, so neither polling every 1.5 seconds nor the absence of errors guarantees delivery in 1.5 seconds. For low-latency chat, use Durable Objects or a purpose-built real-time channel.
- Telegram does **not** expose actual keystrokes from Anderson's personal Telegram client to the bot. The status shown after selecting **Responder** means *preparing a response*, not verifiable real-time typing. It expires automatically.
- Free-tier Worker/KV quotas must be considered before production. Continuous polling by many clients can exhaust read limits. Rate limiting and abuse controls should be added before broad use.
- KV session data expires after 24 hours. Browser refresh resumes an existing session where possible but does not restore the full visible transcript.

## Before merging

- [ ] Deploy the proposed Worker during an approved maintenance/test window, retaining the previous Worker source for rollback.
- [ ] Confirm Telegram `/start`, callbacks, and webhook secret validation work.
- [ ] Test one full web ↔ Telegram conversation in both ES and EN.
- [ ] Test Chrome mobile and desktop, dark/light themes, and the close/open button.
- [ ] Confirm carousel animation and both Tech Stack arrows still work.
- [ ] Check Cloudflare Worker logs for errors and KV usage.
- [ ] Merge the draft PR only after these checks; `main` must be left intact until then.
