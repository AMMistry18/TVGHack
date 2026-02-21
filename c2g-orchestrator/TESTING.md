# C2G Orchestrator – Final local testing

## 1. Run pytest

From the `c2g-orchestrator` directory:

```bash
cd c2g-orchestrator
pip install -r requirements.txt
python -m pytest tests/test_savings.py tests/test_api.py -v
```

All tests must pass:
- `calculate_avoided_cost(5000, 2, 100) == 992000.0`
- `calculate_avoided_cost(40, 1, 100) == 0.0`
- `calculate_avoided_cost(9000, 2, 100) == 1792000.0`
- `classify_price(30) == "NORMAL"`, `classify_price(150) == "WARNING"`, etc.
- `GET /health` returns 200
- `GET /api/grid/current` returns `price_mwh` and `status`
- `POST /admin/simulate-spike` with `price_mwh: 500` returns 422
- `POST /admin/simulate-spike` with `price_mwh: 5000` returns 200

---

## 2. Start the backend

**Required:** Install dependencies in the same environment you use for uvicorn. Otherwise you'll get `ModuleNotFoundError: No module named 'supabase'`.

```bash
cd c2g-orchestrator
# Create venv if needed, then:
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
# source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Ensure `.env` has `SUPABASE_URL` and `SUPABASE_KEY` (and optional `BASE_CONTRACT_PRICE`, `FACILITY_MW`).

---

## 3. Start the frontend

From the **repo root** (where `frontend/` lives):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. To use the real backend, set:

```bash
# Windows PowerShell
$env:NEXT_PUBLIC_API_URL="http://localhost:8000"
npm run dev

# Or in frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 4. Verify Supabase connection

- Open https://supabase.com/dashboard/project/gkyhvikuizoceekuduwe
- In **Table Editor**, confirm `grid_events` and `action_logs` exist and that new rows appear when the backend runs (ERCOT polling and/or inject-storm).
- Or call the backend:  
  `GET http://localhost:8000/api/grid/events` and `GET http://localhost:8000/api/metrics/summary` and confirm data or empty arrays (no 5xx).

---

## 5. Full demo flow in one terminal session

**Terminal 1 – Backend:**

```bash
cd c2g-orchestrator
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 – Frontend:**

```bash
cd frontend
npm run dev
```

**Terminal 3 – Trigger full demo (magic button):**

```bash
# Inject storm: 24 grid_events, 2 action_logs, $5000 spike, recharts payload
curl -s http://localhost:8000/api/demo/inject-storm | jq .
```

Then open http://localhost:3000. With `NEXT_PUBLIC_API_URL=http://localhost:8000`, the StatusBar shows **WS CONNECTED** or **POLLING** and the dashboard can use real data. Call `GET /api/demo/inject-storm` anytime to make the dashboard look fully operational (panic button).

---

## Optional: run backend and test in one go

```bash
cd c2g-orchestrator
python -m pytest tests/ -v
uvicorn main:app --host 127.0.0.1 --port 8000 &
sleep 3
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/demo/inject-storm | head -c 500
```

Stop the server with `jobs` and `kill %1` (or close the terminal).

---

## 6. Run tests and verify full flow (Supabase + UI)

1. **Run pytest** (backend unit and API tests):

   ```bash
   cd c2g-orchestrator
   pip install -r requirements.txt
   python -m pytest tests/ -v
   ```

2. **Start backend** and confirm Supabase writes:

   ```bash
   cd c2g-orchestrator
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   In another terminal:

   - `curl -s http://localhost:8000/health` → 200
   - `curl -s http://localhost:8000/api/demo/inject-storm` → recharts JSON
   - In Supabase (https://supabase.com/dashboard/project/gkyhvikuizoceekuduwe): Table Editor → `grid_events` and `action_logs` should have new rows.

3. **Start frontend (UI)** and test in browser:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open http://localhost:3000. Set `NEXT_PUBLIC_API_URL=http://localhost:8000` (e.g. in `frontend/.env.local`) so the StatusBar and dashboard use the backend. Trigger `GET /api/demo/inject-storm` (magic button or curl) and confirm the UI updates and Supabase tables keep growing.
