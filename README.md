# Janitor AI ↔ OpenCode Zen proxy

Lets Janitor AI use OpenCode Zen's free models through an OpenAI-compatible
endpoint, without Janitor AI (or anyone using your proxy) ever seeing your
real API key.

This guide assumes **no command line at all** — everything happens by
clicking through GitHub's and Vercel's websites.

## 1. Get a free OpenCode Zen key

Go to https://opencode.ai/auth and sign up (no card required). Copy the
API key it shows you — you'll paste it into Vercel in step 4.

## 2. Put these files on GitHub

1. Go to https://github.com/new and create a new repository (any name,
   Public or Private, don't add a README — just create it empty).
2. On the empty repo's page, click **"uploading an existing file"**.
3. Drag in every file from this project — **including the `api` folder**
   — and drop them onto the upload area. GitHub preserves folder
   structure, so `api/index.js` will land in the right place.
4. Scroll down and click **Commit changes**.

You should end up with this structure in your repo:

```
api/index.js
package.json
vercel.json
.env.example
README.md
```

## 3. Import the repo into Vercel

1. Go to https://vercel.com/new and sign in (the "Continue with GitHub"
   button is easiest).
2. Find the repo you just created and click **Import**.
3. **Before clicking Deploy**, expand **Environment Variables** and add:
   - Key: `OPENCODE_ZEN_KEY`
   - Value: (paste the key from step 1)
4. Click **Deploy**.

This first deployment automatically becomes your **Production**
deployment — no separate "push to production" step needed.

## 4. Confirm it's live

Wait for the build to finish (about a minute), then Vercel shows you a
URL like `https://your-project-name.vercel.app`. Open it in a browser —
you should see:

```json
{"status":"ok","message":"Janitor AI <-> OpenCode Zen proxy is running"}
```

If you see that, it's live. If you see a Vercel error page instead, check
the **Deployments** tab for a red ✗ and click it to see the build log —
that will show an actual error message rather than a generic 500.

## 5. Configure Janitor AI

In Janitor AI's custom/proxy connection settings:

- **Endpoint:** `https://your-project-name.vercel.app/v1`
- **API Key:** anything at all — e.g. `not-needed` (the proxy ignores it;
  your real key lives in Vercel's environment variables)
- **Model:** one of the free model ids below

| Model | ID |
|---|---|
| Big Pickle | `big-pickle` |
| DeepSeek V4 Flash Free | `deepseek-v4-flash-free` |
| MiMo-V2.5 Free | `mimo-v2.5-free` |
| Laguna S 2.1 Free | `laguna-s-2.1-free` |
| Ling-3.0-flash Free | `ling-3.0-flash-free` |
| North Mini Code Free | `north-mini-code-free` |
| Nemotron 3 Ultra Free | `nemotron-3-ultra-free` |

Open `https://your-project-name.vercel.app/free-models` any time to see
this same list live from the proxy, or `/v1/models` for the OpenAI-shaped
version.

## Making changes later

You don't need the CLI for updates either — edit files directly on
GitHub's website (click the pencil icon on any file, edit, commit to
`main`), and Vercel automatically redeploys production within about a
minute of every commit to `main`.

## If something still goes wrong

1. **Test the endpoint directly first**, before touching Janitor AI —
   open `https://your-project-name.vercel.app/v1/models` in a browser.
   A real JSON response (even an error one) means the function is
   running; a Vercel-branded error page means it isn't.
2. **Check the Deployments tab** in your Vercel project for a red ✗ on
   the latest deployment — click it for the actual build/runtime error.
3. **Double-check the environment variable** — Vercel → your project →
   Settings → Environment Variables → confirm `OPENCODE_ZEN_KEY` is set
   for the **Production** environment specifically (not just Preview).
4. If you change the environment variable, you need a new deployment for
   it to take effect — go to Deployments, click the "..." menu on the
   latest one, and choose **Redeploy**.

## Notes

- OpenCode Zen's free models are explicitly offered "for a limited time"
  — the lineup in `api/index.js` (`KNOWN_FREE_MODELS`) is a snapshot, not
  a guarantee. Re-check https://opencode.ai/docs/zen/ if a model id stops
  working.
- This proxy adds no rate limiting or auth of its own — anyone who finds
  your `.vercel.app` URL can spend your free OpenCode Zen quota. Fine for
  personal use; if that becomes a problem, ask and I can add a shared-
  secret check.
