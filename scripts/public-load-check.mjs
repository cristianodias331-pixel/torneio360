import { performance } from "node:perf_hooks";

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "");
const expectedProjectRef = String(process.env.EXPECTED_SUPABASE_PROJECT_REF || "");

if (!supabaseUrl || !anonKey) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para executar o teste de carga.");
}
if (expectedProjectRef && !supabaseUrl.includes(expectedProjectRef)) {
  throw new Error("O Supabase configurado não corresponde ao projeto esperado para o teste.");
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
};

function percentile(values, percentage) {
  if (!values.length) return 0;
  const ordered = [...values].sort((first, second) => first - second);
  const index = Math.min(ordered.length - 1, Math.ceil(ordered.length * percentage) - 1);
  return ordered[index];
}

async function rpc(functionName, body) {
  const startedAt = performance.now();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const elapsedMs = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`${functionName} respondeu ${response.status}: ${text.slice(0, 180)}`);
  }
  return {
    data: text ? JSON.parse(text) : null,
    elapsedMs,
    bytes: Buffer.byteLength(text),
  };
}

async function runScenario(name, requests, requestFactory, { maxP95Ms = 3000 } = {}) {
  const results = await Promise.all(Array.from({ length: requests }, (_, index) => requestFactory(index)));
  const latencies = results.map((result) => result.elapsedMs);
  const bytes = results.map((result) => result.bytes);
  const summary = {
    name,
    requests,
    p50Ms: Math.round(percentile(latencies, 0.5)),
    p95Ms: Math.round(percentile(latencies, 0.95)),
    maxMs: Math.round(Math.max(...latencies)),
    averageBytes: Math.round(bytes.reduce((total, value) => total + value, 0) / bytes.length),
  };
  if (summary.p95Ms > maxP95Ms) {
    throw new Error(`${name}: p95 de ${summary.p95Ms} ms ultrapassou o limite de ${maxP95Ms} ms.`);
  }
  return { summary, results };
}

const directory = await runScenario(
  "Diretório público paginado",
  40,
  () => rpc("list_public_arenas_page", {
    p_search: null,
    p_limit: 18,
    p_after_sort_name: null,
    p_after_id: null,
  }),
);

const firstArenaId = directory.results
  .flatMap((result) => Array.isArray(result.data) ? result.data : [])
  .find((arena) => arena?.id)?.id || null;

const scenarios = [directory.summary];
if (firstArenaId) {
  const arenaBundle = await runScenario(
    "Perfil público com resumos",
    25,
    () => rpc("get_public_arena_bundle", {
      p_organizer_id: firstArenaId,
      p_public_id: null,
    }),
    { maxP95Ms: 4000 },
  );
  scenarios.push(arenaBundle.summary);
}

const unchangedTournament = await runScenario(
  "Checagem condicional de torneio",
  40,
  () => rpc("get_public_tournament_if_changed", {
    p_public_id: "__performance_missing__",
    p_known_updated_at: null,
  }),
);
scenarios.push(unchangedTournament.summary);

console.table(scenarios);
