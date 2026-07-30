import express from "express";

const app = express();
app.use(express.json({ limit: "25mb" }));

// Very permissive CORS — Janitor AI (or any browser-based client) may call
// this proxy directly, so we don't want CORS to be the thing that breaks it.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const ZEN_BASE = "https://opencode.ai/zen/v1";

// Get this once, for free, at https://opencode.ai/auth (no card required)
// and set it as an env var. Janitor AI users never see or need this key —
// they just point Janitor AI at this proxy with any placeholder key.
const ZEN_KEY = process.env.OPENCODE_ZEN_KEY;

if (!ZEN_KEY) {
  console.warn(
    "[warn] OPENCODE_ZEN_KEY is not set. Get a free key at https://opencode.ai/auth " +
      "and set it as an environment variable before starting the proxy."
  );
}

// Current free models on OpenCode Zen (per https://opencode.ai/docs/zen/,
// last checked 2026-07-26). These are explicitly "free for a limited time" —
// the team can add/remove/paywall any of them without notice, so treat this
// as a snapshot, not a guarantee. GET /free-models on this proxy re-derives
// this list from Zen's live /v1/models response where possible.
const KNOWN_FREE_MODELS = [
  { id: "big-pickle", name: "Big Pickle", note: "Stealth model" },
  { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free" },
  { id: "mimo-v2.5-free", name: "MiMo-V2.5 Free" },
  { id: "laguna-s-2.1-free", name: "Laguna S 2.1 Free" },
  { id: "ling-3.0-flash-free", name: "Ling-3.0-flash Free" },
  { id: "north-mini-code-free", name: "North Mini Code Free" },
  { id: "nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free" },
];

const FREE_MODEL_IDS = KNOWN_FREE_MODELS.map((m) => m.id);
const DEFAULT_MODEL = FREE_MODEL_IDS[0];

// Janitor AI will send whatever model string the user typed in its UI.
// The "opencode/<model-id>" format is only used inside OpenCode's own CLI
// config — the raw HTTP endpoint (what this proxy calls) wants the bare
// model id, e.g. "mimo-v2.5-free", not "opencode/mimo-v2.5-free". Strip
// the prefix if someone included it out of habit.
function toZenModel(requested) {
  const id = (requested || DEFAULT_MODEL).replace(/^opencode\//, "").trim();
  return id || DEFAULT_MODEL;
}

function isKnownFreeModel(id) {
  return FREE_MODEL_IDS.includes((id || "").replace(/^opencode\//, "").trim());
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Janitor AI <-> OpenCode Zen proxy is running" });
});

// OpenAI-compatible model listing. Janitor AI sometimes calls this to
// validate the endpoint / populate a model dropdown. Defaults to free
// models only; pass ?all=1 to see every model Zen offers (paid included).
app.get("/v1/models", async (req, res) => {
  try {
    const upstream = await fetch(`${ZEN_BASE}/models`, {
      headers: { Authorization: `Bearer ${ZEN_KEY}` },
    });
    const data = await upstream.json();

    if (req.query.all || !Array.isArray(data?.data)) {
      return res.status(upstream.status).json(data);
    }

    const freeOnly = {
      ...data,
      data: data.data.filter((m) => isKnownFreeModel(m.id)),
    };
    res.status(upstream.status).json(freeOnly);
  } catch (err) {
    res.status(502).json({ error: { message: `Failed to reach OpenCode Zen: ${err.message}` } });
  }
});

// Plain, non-OpenAI-shaped list of the free models this proxy knows about —
// handy for humans configuring Janitor AI by hand.
app.get("/free-models", (req, res) => {
  res.json({ models: KNOWN_FREE_MODELS });
});

// Core chat endpoint Janitor AI actually talks to.
app.post("/v1/chat/completions", async (req, res) => {
  if (!ZEN_KEY) {
    return res.status(500).json({
      error: { message: "Proxy misconfigured: OPENCODE_ZEN_KEY env var is not set." },
    });
  }

  const body = { ...(req.body || {}), model: toZenModel(req.body?.model) };

  try {
    const upstream = await fetch(`${ZEN_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZEN_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (body.stream) {
      res.status(upstream.status);
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } else {
      const data = await upstream.json();
      res.status(upstream.status).json(data);
    }
  } catch (err) {
    res.status(502).json({ error: { message: `Failed to reach OpenCode Zen: ${err.message}` } });
  }
});

// Safety net: any error that reaches here (malformed JSON body, an
// unexpected throw, etc.) gets a proper JSON response instead of falling
// through to Express's default HTML error page — which is what was
// producing the generic "Internal server error" you saw, since Janitor AI
// couldn't parse that HTML and substituted its own generic message.
app.use((err, req, res, next) => {
  console.error("[proxy error]", err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: { message: `Proxy error: ${err.message || "unknown error"}` },
  });
});

// Vercel's Node runtime invokes the default export directly as a request
// handler — Express apps are callable as (req, res), so this works without
// needing app.listen() at all.
export default app;

// Local development only (never runs on Vercel — Vercel always sets the
// VERCEL env var). Run with: node --env-file=.env api/index.js
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Proxy listening on http://localhost:${PORT}`);
    console.log(`Point Janitor AI's custom proxy at: http://<your-public-url>:${PORT}/v1`);
  });
}
