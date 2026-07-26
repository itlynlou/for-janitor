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

// Known free model ids as of writing. OpenCode Zen's free lineup changes
// over time — GET /v1/models on this proxy always reflects the live list.
const KNOWN_FREE_MODELS = [
  "big-pickle",
  "mimo-v2-pro-free",
  "mimo-v2-omni-free",
  "minimax-m2.5-free",
  "nemotron-3-super-free",
  "nemotron-3-ultra-free",
  "north-mini-code-free",
  "deepseek-v4-flash-free",
];

const DEFAULT_MODEL = KNOWN_FREE_MODELS[0];

// Janitor AI will send whatever model string the user typed in its UI.
// Strip an "opencode/" prefix if present, fall back to a sane default
// otherwise, and always re-add the "opencode/" prefix Zen expects.
function toZenModel(requested) {
  const id = (requested || DEFAULT_MODEL).replace(/^opencode\//, "").trim();
  return `opencode/${id || DEFAULT_MODEL}`;
}

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Janitor AI <-> OpenCode Zen proxy is running" });
});

// OpenAI-compatible model listing. Janitor AI sometimes calls this to
// validate the endpoint before letting you save it.
app.get("/v1/models", async (req, res) => {
  try {
    const upstream = await fetch(`${ZEN_BASE}/models`, {
      headers: { Authorization: `Bearer ${ZEN_KEY}` },
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: `Failed to reach OpenCode Zen: ${err.message}` } });
  }
});

// Core chat endpoint Janitor AI actually talks to.
app.post("/v1/chat/completions", async (req, res) => {
  if (!ZEN_KEY) {
    return res.status(500).json({
      error: { message: "Proxy misconfigured: OPENCODE_ZEN_KEY env var is not set." },
    });
  }

  const body = { ...req.body, model: toZenModel(req.body.model) };

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
  console.log(`Point Janitor AI's custom proxy at: http://<your-public-url>:${PORT}/v1`);
});
