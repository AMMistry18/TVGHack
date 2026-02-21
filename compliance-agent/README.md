# Compliance Agent — SB 6 / GRID Act Audit Reports

Standalone service that generates PUC-compliant audit reports from event logs and ERCOT/grid data using an LLM (Gemini).

## Setup

1. Copy `.env.example` to `.env`.
2. Add your Google AI API key for the compliance report: [Get a key](https://aistudio.google.com/apikey).
3. Install and run:

```bash
npm install
npm run dev
```

Server listens on port 4000 by default. Use `POST /report` with a JSON body containing `eventLogs`, `ercot`, `compute`, and `financial` (see plan / API contract).

## Scripts

- `npm run dev` — Run with tsx watch (development).
- `npm run build` — Compile TypeScript to `dist/`.
- `npm start` — Run compiled `dist/index.js`.
