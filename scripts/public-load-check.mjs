import { performance } from "node:perf_hooks";

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "");
const expectedProjectRef = String(process.env.EXPECTED_SUPABASE_PROJECT_REF || "");
const configuredArenaId = String(process.env.LOAD_ARENA_ID || "").trim() || null;
const concurrency = Number(process.env.LOAD_CONCURRENCY || 40);
const scenarioCooldownMs = Math.max(0, Number(process.env.LOAD_SCENARIO_COOLDOWN_MS || 1500));
const diagnosticMaxP95Ms = Math.max(0, Number(process.env.LOAD_DIAGNOSTIC_MAX_P95_MS || 0));

if (!supabaseUrl || !anonKey) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para executar o teste de carga.");
}
if (expectedProjectRef && !supabaseUrl.includes(expectedProjectRef)) {
  throw new Error("O Supabase configurado não corresponde ao projeto esperado para o teste.");
}
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 200) {
  throw new Error("LOAD_CONCURRENCY deve ser um número inteiro entre 1 e 200.");
}

function waitForScenarioCooldown() {
  return scenarioCooldownMs > 0
    ? new Promise((resolve) => setTimeout(resolve, scenarioCooldownMs))
    : Promise.resolve();
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
  const settled = await Promise.allSettled(
    Array.from({ length: requests }, (_, index) => requestFactory(index))
  );
  const results = settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const errors = settled
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);
  const latencies = results.map((result) => result.elapsedMs);
  const bytes = results.map((result) => result.bytes);
  const summary = {
    name,
    requests,
    successes: results.length,
    errors: errors.length,
    errorRate: `${((errors.length / requests) * 100).toFixed(1)}%`,
    p50Ms: Math.round(percentile(latencies, 0.5)),
    p95Ms: Math.round(percentile(latencies, 0.95)),
    maxMs: latencies.length ? Math.round(Math.max(...latencies)) : 0,
    averageBytes: bytes.length
      ? Math.round(bytes.reduce((total, value) => total + value, 0) / bytes.length)
      : 0,
  };
  if (errors.length) {
    const firstError = errors[0] instanceof Error ? errors[0].message : String(errors[0]);
    throw new Error(`${name}: ${errors.length}/${requests} requisições falharam. Primeira falha: ${firstError}`);
  }
  const effectiveMaxP95Ms = diagnosticMaxP95Ms || maxP95Ms;
  if (summary.p95Ms > effectiveMaxP95Ms) {
    throw new Error(`${name}: p95 de ${summary.p95Ms} ms ultrapassou o limite de ${effectiveMaxP95Ms} ms.`);
  }
  return { summary, results };
}

await rpc("list_public_arenas_page", {
  p_search: null,
  p_limit: 18,
  p_after_sort_name: null,
  p_after_id: null,
});
const directory = await runScenario(
  "Diretório público paginado",
  concurrency,
  () => rpc("list_public_arenas_page", {
    p_search: null,
    p_limit: 18,
    p_after_sort_name: null,
    p_after_id: null,
  }),
);

const firstArenaId = configuredArenaId || directory.results
  .flatMap((result) => Array.isArray(result.data) ? result.data : [])
  .find((arena) => arena?.id)?.id || null;

const scenarios = [directory.summary];
if (firstArenaId) {
  await waitForScenarioCooldown();
  await rpc("get_public_arena_overview", {
    p_organizer_id: firstArenaId,
    p_public_id: null,
  });
  const arenaOverview = await runScenario(
    "Resumo do perfil público",
    concurrency,
    () => rpc("get_public_arena_overview", {
      p_organizer_id: firstArenaId,
      p_public_id: null,
    }),
    { maxP95Ms: 4000 },
  );
  scenarios.push(arenaOverview.summary);

  await waitForScenarioCooldown();
  await rpc("list_public_arena_events_page", {
    p_organizer_id: firstArenaId,
    p_public_id: null,
    p_kind: "tournaments",
    p_status: "active",
    p_limit: 8,
    p_offset: 0,
  });
  const arenaEventsPage = await runScenario(
    "Página pública de eventos",
    concurrency,
    () => rpc("list_public_arena_events_page", {
      p_organizer_id: firstArenaId,
      p_public_id: null,
      p_kind: "tournaments",
      p_status: "active",
      p_limit: 8,
      p_offset: 0,
    }),
    { maxP95Ms: 3000 },
  );
  scenarios.push(arenaEventsPage.summary);

  await waitForScenarioCooldown();
  await rpc("get_public_arena_initial_view", {
    p_organizer_id: firstArenaId,
    p_public_id: null,
    p_limit: 8,
  });
  const initialPublicProfile = await runScenario(
    "Acesso inicial completo ao perfil",
    concurrency,
    () => rpc("get_public_arena_initial_view", {
      p_organizer_id: firstArenaId,
      p_public_id: null,
      p_limit: 8,
    }),
    { maxP95Ms: 3000 },
  );
  scenarios.push(initialPublicProfile.summary);

  await waitForScenarioCooldown();
  const circuitPage = await rpc("list_public_arena_events_page", {
    p_organizer_id: firstArenaId,
    p_public_id: null,
    p_kind: "circuits",
    p_status: "active",
    p_limit: 1,
    p_offset: 0,
  });
  const firstCircuitId = Array.isArray(circuitPage.data?.items)
    ? circuitPage.data.items.find((circuit) => circuit?.id)?.id || null
    : null;
  if (firstCircuitId) {
    await rpc("get_public_circuit_with_tournaments", { p_circuit_id: firstCircuitId });
    const publicCircuit = await runScenario(
      "Circuito público completo",
      concurrency,
      () => rpc("get_public_circuit_with_tournaments", { p_circuit_id: firstCircuitId }),
      { maxP95Ms: 5000 },
    );
    scenarios.push(publicCircuit.summary);
  }
}

await waitForScenarioCooldown();
await rpc("get_public_tournament_if_changed", {
  p_public_id: "__performance_missing__",
  p_known_updated_at: null,
});
const unchangedTournament = await runScenario(
  "Checagem condicional de torneio",
  concurrency,
  () => rpc("get_public_tournament_if_changed", {
    p_public_id: "__performance_missing__",
    p_known_updated_at: null,
  }),
);
scenarios.push(unchangedTournament.summary);

console.table(scenarios);
