const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || "");
const expectedProjectRef = String(process.env.EXPECTED_SUPABASE_PROJECT_REF || "");
const configuredArenaId = String(process.env.LOAD_ARENA_ID || "").trim() || null;

if (!supabaseUrl || !anonKey) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para verificar a paginação.");
}
if (expectedProjectRef && !supabaseUrl.includes(expectedProjectRef)) {
  throw new Error("O Supabase configurado não corresponde ao projeto esperado para a verificação.");
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
};

async function rpc(functionName, body) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${functionName} respondeu ${response.status}: ${text.slice(0, 180)}`);
  }
  return {
    data: text ? JSON.parse(text) : null,
    bytes: Buffer.byteLength(text),
  };
}

let arenaId = configuredArenaId;
if (!arenaId) {
  const directory = await rpc("list_public_arenas_page", {
    p_search: null,
    p_limit: 18,
    p_after_sort_name: null,
    p_after_id: null,
  });
  arenaId = Array.isArray(directory.data)
    ? directory.data.find((arena) => arena?.id)?.id || null
    : null;
}
if (!arenaId) throw new Error("Nenhuma arena pública encontrada para a verificação.");

const circuitPage = await rpc("list_public_arena_events_page", {
  p_organizer_id: arenaId,
  p_public_id: null,
  p_kind: "circuits",
  p_status: "active",
  p_limit: 1,
  p_offset: 0,
});
const circuitId = Array.isArray(circuitPage.data?.items)
  ? circuitPage.data.items.find((circuit) => circuit?.id)?.id || null
  : null;
if (!circuitId) throw new Error("Nenhum circuito público ativo encontrado para a verificação.");

const circuitDetail = await rpc("get_public_circuit_with_tournaments", { p_circuit_id: circuitId });
if (circuitDetail.data?.ranking_pagination?.enabled !== true) {
  throw new Error("A paginação do ranking não está ativa no circuito público.");
}

const groups = Array.isArray(circuitDetail.data?.ranking_groups)
  ? circuitDetail.data.ranking_groups
  : [];
if (!groups.length) throw new Error("O circuito público não possui grupos de ranking para verificar.");

const summaries = [];
for (const group of groups) {
  const groupKey = String(group?.key || "geral");
  const initialRows = Array.isArray(group?.rows) ? group.rows : [];
  if (initialRows.length > 30) {
    throw new Error(`${groupKey}: o carregamento inicial ultrapassou 30 nomes.`);
  }

  const expectedTotal = Number(group?.all_total || 0);
  const allRows = [];
  let offset = 0;
  let hasMore = true;
  let pages = 0;
  while (hasMore && pages < 100) {
    const page = await rpc("list_public_circuit_ranking_page", {
      p_circuit_id: circuitId,
      p_group_key: groupKey,
      p_limit: 250,
      p_offset: offset,
      p_search: null,
    });
    const items = Array.isArray(page.data?.items) ? page.data.items : [];
    items.forEach((row, index) => {
      const expectedPosition = offset + index + 1;
      if (Number(row?.rankPosition) !== expectedPosition) {
        throw new Error(`${groupKey}: posição global esperada ${expectedPosition}, recebida ${row?.rankPosition}.`);
      }
    });
    allRows.push(...items);
    hasMore = page.data?.has_more === true;
    offset = Number(page.data?.next_offset) || (offset + items.length);
    pages += 1;
    if (hasMore && items.length === 0) throw new Error(`${groupKey}: página vazia com continuação ativa.`);
  }
  if (hasMore) throw new Error(`${groupKey}: o ranking excedeu o limite seguro de 100 páginas.`);
  if (allRows.length !== expectedTotal) {
    throw new Error(`${groupKey}: esperado ${expectedTotal} nomes, recebidos ${allRows.length}.`);
  }

  const ids = allRows.map((row) => String(row?.id || "")).filter(Boolean);
  if (ids.length === allRows.length && new Set(ids).size !== ids.length) {
    throw new Error(`${groupKey}: há identificadores repetidos entre as páginas.`);
  }

  const searchCandidate = allRows[Math.floor(allRows.length * 0.65)] || null;
  if (searchCandidate?.name) {
    const searchPage = await rpc("list_public_circuit_ranking_page", {
      p_circuit_id: circuitId,
      p_group_key: groupKey,
      p_limit: 30,
      p_offset: 0,
      p_search: searchCandidate.name,
    });
    const found = (Array.isArray(searchPage.data?.items) ? searchPage.data.items : [])
      .find((row) => String(row?.id || row?.name) === String(searchCandidate.id || searchCandidate.name));
    if (!found || Number(found.rankPosition) !== Number(searchCandidate.rankPosition)) {
      throw new Error(`${groupKey}: a busca no servidor perdeu o nome ou sua posição global.`);
    }
  }

  summaries.push({
    grupo: groupKey,
    inicial: initialRows.length,
    total: allRows.length,
    paginas: pages,
    buscaTeste: searchCandidate?.name || "-",
    posicaoBusca: Number(searchCandidate?.rankPosition || 0),
  });
}

console.log(`Circuito verificado: ${circuitId}. Payload inicial: ${circuitDetail.bytes} bytes.`);
console.table(summaries);
