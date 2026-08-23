# PawTalk AI V3

AI pet behavior observation app built with Next.js 16.

## Run

```bash
npm install
cp .env.example .env.local
# put your server-side OPENAI_API_KEY in .env.local
npm run dev
```

## Deploy to Vercel

Import the project, add `OPENAI_API_KEY` in Project Settings → Environment Variables, then deploy.

The API key is used only by `/api/analyze`; it is never exposed to browser code.

V3 includes real image analysis and audio transcription-assisted analysis, plus a local free-use limit and a PRO UI placeholder. It does not claim to literally translate animal language.
