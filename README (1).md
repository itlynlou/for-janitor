# Janitor AI ↔ OpenCode Zen proxy

A tiny OpenAI-compatible server that lets you use [OpenCode Zen](https://opencode.ai/docs/zen/)'s
free models from Janitor AI's "custom proxy" connection, without Janitor AI
(or anyone using your proxy) ever seeing a real API key.

How it works: OpenCode Zen's `/v1/chat/completions` endpoint is already
OpenAI-compatible, so this proxy mostly just relays your request — it swaps
in your free Zen key server-side and forwards the response (including
streaming) back to Janitor AI.

## 1. Get a free OpenCode Zen key (one-time, no card required)

Go to https://opencode.ai/auth and sign up. Copy the API key it gives you.

## 2. Configure the proxy

```bash
cp .env.example .env
# edit .env and paste your key into OPENCODE_ZEN_KEY
```

## 3. Install and run

```bash
npm install
npm start
```

The proxy listens on `http://localhost:3000` by default (`PORT` env var to
change it).

## 4. Make it reachable from Janitor AI

Janitor AI is a website — it needs to reach your proxy over the public
internet, not `localhost`. Pick one:

- **Quick test:** run `npx ngrok http 3000` (or Cloudflare Tunnel) and use
  the `https://...ngrok...` URL it gives you.
- **Always-on:** deploy this folder to a free/low-cost host that keeps a
  process running (e.g. Render, Fly.io, Railway). Set `OPENCODE_ZEN_KEY` as
  an environment variable there instead of a local `.env` file.

## 5. Configure Janitor AI

In Janitor AI, choose the custom/proxy OpenAI-compatible connection option
and set:

- **Reverse Proxy URL / Endpoint:** `https://<your-public-url>/v1`
- **API Key:** anything at all — e.g. `not-needed` (the proxy ignores it;
  your real key lives server-side)
- **Model:** one of the free model ids currently baked into `server.js`
  (as of 2026-07-26, per https://opencode.ai/docs/zen/):

  | Model | ID |
  |---|---|
  | Big Pickle | `big-pickle` |
  | DeepSeek V4 Flash Free | `deepseek-v4-flash-free` |
  | MiMo-V2.5 Free | `mimo-v2.5-free` |
  | Laguna S 2.1 Free | `laguna-s-2.1-free` |
  | Ling-3.0-flash Free | `ling-3.0-flash-free` |
  | North Mini Code Free | `north-mini-code-free` |
  | Nemotron 3 Ultra Free | `nemotron-3-ultra-free` |

  Hit `GET /free-models` on your running proxy for this same list, or
  `GET /v1/models` for the OpenAI-shaped version (add `?all=1` to include
  paid models too). These are explicitly "free for a limited time" on
  Zen's end, so the lineup can change — re-check the docs link above if a
  model id stops working.

## Quick manual test

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash-free",
    "messages": [{"role": "user", "content": "Say hi in five words."}]
  }'
```

## Notes

- OpenCode Zen's free models are explicitly offered "for a limited time" —
  treat the list in `server.js` (`KNOWN_FREE_MODELS`) as a starting point,
  not a guarantee. `GET /v1/models` on this proxy always reflects Zen's live
  catalog.
- This proxy does not add its own rate limiting or auth — anyone who
  discovers your public URL can spend your free quota. If you deploy it
  publicly long-term, consider adding a shared-secret check on the
  `Authorization` header before forwarding.
