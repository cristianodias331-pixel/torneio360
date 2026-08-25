import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/50-homologation-load-lab.css";
import {
  HOMOLOGATION_LOAD_CIRCUIT_COUNT,
  HOMOLOGATION_LOAD_EMAIL,
  HOMOLOGATION_LOAD_LAYOUT_VERSION,
  HOMOLOGATION_LOAD_MARKER,
  HOMOLOGATION_LOAD_RANKING_ROWS_PER_CIRCUIT,
  HOMOLOGATION_LOAD_SUMMABLE_CIRCUIT_COUNT,
  HOMOLOGATION_LOAD_TOURNAMENT_COUNT,
  assertHomologationLoadTarget,
  buildHomologationCircuitHistoryRows,
  buildHomologationCircuitRows,
  buildHomologationTournamentRows,
  countTournamentParticipantEntries,
  isHomologationLoadCircuit,
} from "../../domain/homologationLoadData.mjs";

const TOURNAMENT_INSERT_BATCH_SIZE = 10;

async function validateAuthenticatedTarget({ supabase, user }) {
  assertHomologationLoadTarget({
    supabaseUrl: supabase?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
    userEmail: user?.email,
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw error || new Error("A sessão de homologação não está disponível.");
  if (data.user.id !== user.id || String(data.user.email || "").toLowerCase() !== HOMOLOGATION_LOAD_EMAIL) {
    throw new Error("A sessão autenticada não corresponde à conta autorizada para o teste.");
  }
  return data.user;
}

async function findLoadDataRows(supabase, userId) {
  const { data: tournaments, error: tournamentError } = await supabase
    .from("tournaments")
    .select("id,data")
    .eq("user_id", userId)
    .contains("data", { loadTestMarker: HOMOLOGATION_LOAD_MARKER });
  if (tournamentError) throw tournamentError;

  const loadTournamentIds = new Set((tournaments || []).map((tournament) => String(tournament.id)));
  const { data: circuitCandidates, error: circuitError } = await supabase
    .from("circuits")
    .select("id,name,tournament_ids,ranking_settings")
    .eq("user_id", userId);
  if (circuitError) throw circuitError;
  const circuits = (circuitCandidates || []).filter((circuit) => (
    isHomologationLoadCircuit(circuit, loadTournamentIds)
  ));

  return { tournaments: tournaments || [], circuits };
}

async function loadCurrentCounts(supabase, userId) {
  const { tournaments, circuits } = await findLoadDataRows(supabase, userId);

  let rankingRows = 0;
  if (circuits?.length) {
    const { count, error: rankingError } = await supabase
      .from("circuit_ranking_history")
      .select("player_key", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("circuit_id", circuits.map((circuit) => circuit.id));
    if (rankingError) throw rankingError;
    rankingRows = Number(count || 0);
  }

  return {
    tournaments: tournaments.length,
    circuits: circuits.length,
    rankingRows,
    participantEntries: tournaments.reduce((sum, tournament) => (
      sum + Number(tournament.data?.loadTestParticipantEntries || countTournamentParticipantEntries(tournament.data))
    ), 0),
    summableCircuits: circuits.filter((circuit) => circuit.ranking_settings?.loadTestRole === "summable").length,
    overlapCircuits: circuits.filter((circuit) => circuit.ranking_settings?.loadTestRole === "overlap").length,
    layoutReady: circuits.length > 0 && circuits.every((circuit) => (
      Number(circuit.ranking_settings?.loadTestLayoutVersion) === HOMOLOGATION_LOAD_LAYOUT_VERSION
    )),
  };
}

async function deleteRowsInBatches(queryFactory, ids, batchSize = 100) {
  for (let index = 0; index < ids.length; index += batchSize) {
    const { error } = await queryFactory(ids.slice(index, index + batchSize));
    if (error) throw error;
  }
}

export default function HomologationLoadLab({ supabase, user }) {
  const eligible = useMemo(() => {
    try {
      assertHomologationLoadTarget({
        supabaseUrl: supabase?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL,
        userEmail: user?.email,
      });
      return true;
    } catch {
      return false;
    }
  }, [supabase, user?.email]);
  const [counts, setCounts] = useState({
    tournaments: 0,
    circuits: 0,
    rankingRows: 0,
    participantEntries: 0,
    summableCircuits: 0,
    overlapCircuits: 0,
    layoutReady: false,
  });
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const busyRef = useRef(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState(null);

  async function refreshCounts() {
    if (!eligible) return;
    const nextCounts = await loadCurrentCounts(supabase, user.id);
    setCounts(nextCounts);
  }

  useEffect(() => {
    if (!eligible) return;
    void refreshCounts().catch((error) => {
      console.error("Não foi possível contar a massa de homologação:", error);
      setMessage({ type: "error", text: "Não foi possível conferir agora os dados de carga existentes." });
    });
  }, [eligible, user?.id]);

  async function purgeLoadDataRows() {
    setProgress("Localizando circuitos do laboratório...");
    const { tournaments, circuits } = await findLoadDataRows(supabase, user.id);

    await deleteRowsInBatches(
      (ids) => supabase.from("circuits").delete().eq("user_id", user.id).in("id", ids),
      circuits.map((circuit) => circuit.id)
    );

    setProgress("Removendo torneios do laboratório...");
    await deleteRowsInBatches(
      (ids) => supabase.from("tournaments").delete().eq("user_id", user.id).in("id", ids),
      tournaments.map((tournament) => tournament.id)
    );
  }

  async function createLoadData({ replaceExisting = false } = {}) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyAction("create");
    setBusy(true);
    setMessage(null);

    try {
      await validateAuthenticatedTarget({ supabase, user });
      const current = await loadCurrentCounts(supabase, user.id);
      if (current.tournaments || current.circuits || current.rankingRows) {
        if (!replaceExisting) {
          throw new Error("Já existe uma massa de carga. Use a ampliação controlada ou remova o lote atual.");
        }
        setProgress("Substituindo somente a massa anterior do laboratório...");
        await purgeLoadDataRows();
      }

      const batchId = crypto.randomUUID();
      const now = new Date();
      const tournamentRows = buildHomologationTournamentRows({ userId: user.id, batchId, now });
      const insertedTournaments = [];

      for (let index = 0; index < tournamentRows.length; index += TOURNAMENT_INSERT_BATCH_SIZE) {
        setProgress(`Criando torneios ${Math.min(index + TOURNAMENT_INSERT_BATCH_SIZE, tournamentRows.length)}/${tournamentRows.length}...`);
        const { data, error } = await supabase
          .from("tournaments")
          .insert(tournamentRows.slice(index, index + TOURNAMENT_INSERT_BATCH_SIZE))
          .select("id,name,type,status,data,updated_at");
        if (error) throw error;
        insertedTournaments.push(...(data || []));
      }

      setProgress("Criando circuitos...");
      const circuitRows = buildHomologationCircuitRows({
        userId: user.id,
        batchId,
        tournaments: insertedTournaments,
        now,
      });
      const { data: insertedCircuits, error: circuitError } = await supabase
        .from("circuits")
        .insert(circuitRows)
        .select("id,name,tournament_ids");
      if (circuitError) throw circuitError;

      for (let index = 0; index < insertedCircuits.length; index += 1) {
        setProgress(`Gerando rankings ${index + 1}/${insertedCircuits.length}...`);
        const historyRows = buildHomologationCircuitHistoryRows({
          circuit: insertedCircuits[index],
          circuitIndex: index,
          now,
        });
        const { error } = await supabase.rpc("replace_circuit_ranking_history", {
          p_circuit_id: insertedCircuits[index].id,
          p_rows: historyRows,
          p_source_versions: [],
        });
        if (error) throw error;
      }

      await refreshCounts();
      setMessage({
        type: "success",
        text: "Massa criada. Recarregue o painel para iniciar os testes práticos com todos os registros.",
      });
      setProgress("");
    } catch (error) {
      console.error("Falha ao gerar massa de homologação:", error);
      setMessage({ type: "error", text: error?.message || "Não foi possível concluir a geração da massa de teste." });
      setProgress("");
      await refreshCounts().catch(() => {});
    } finally {
      busyRef.current = false;
      setBusyAction("");
      setBusy(false);
    }
  }

  async function removeLoadData() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyAction("remove");
    setBusy(true);
    setMessage(null);

    try {
      await validateAuthenticatedTarget({ supabase, user });
      await purgeLoadDataRows();

      await refreshCounts();
      setMessage({ type: "success", text: "A massa de teste foi removida sem alterar seus outros dados." });
      setProgress("");
    } catch (error) {
      console.error("Falha ao remover massa de homologação:", error);
      setMessage({ type: "error", text: error?.message || "Não foi possível remover todo o lote de teste." });
      setProgress("");
      await refreshCounts().catch(() => {});
    } finally {
      busyRef.current = false;
      setBusyAction("");
      setBusy(false);
    }
  }

  if (!eligible) return null;

  const hasLoadData = counts.tournaments > 0 || counts.circuits > 0 || counts.rankingRows > 0;
  const targetRankingRows = HOMOLOGATION_LOAD_RANKING_ROWS_PER_CIRCUIT * HOMOLOGATION_LOAD_CIRCUIT_COUNT;
  const loadDataMatchesTarget = counts.tournaments === HOMOLOGATION_LOAD_TOURNAMENT_COUNT
    && counts.circuits === HOMOLOGATION_LOAD_CIRCUIT_COUNT
    && counts.rankingRows === targetRankingRows
    && counts.layoutReady
    && counts.summableCircuits === HOMOLOGATION_LOAD_SUMMABLE_CIRCUIT_COUNT
    && counts.overlapCircuits === HOMOLOGATION_LOAD_CIRCUIT_COUNT - HOMOLOGATION_LOAD_SUMMABLE_CIRCUIT_COUNT;

  return (
    <section className="card homologationLoadLab">
      <div className="profileSectionHeading">
        <span>Somente homologação</span>
        <h2>Laboratório de carga</h2>
        <p>Gera dados identificados e removíveis exclusivamente no seu perfil do site teste.</p>
      </div>

      <div className="homologationLoadStats" aria-label="Dados atuais do laboratório">
        <div><strong>{counts.tournaments}</strong><span>Torneios</span></div>
        <div><strong>{counts.circuits}</strong><span>Circuitos</span></div>
        <div><strong>{counts.participantEntries}</strong><span>Participantes nos torneios</span></div>
        <div><strong>{counts.rankingRows}</strong><span>Linhas de ranking</span></div>
      </div>

      <p className="homologationLoadDescription">
        Configuração ampliada: {HOMOLOGATION_LOAD_TOURNAMENT_COUNT} torneios, {HOMOLOGATION_LOAD_CIRCUIT_COUNT} circuitos, {HOMOLOGATION_LOAD_RANKING_ROWS_PER_CIRCUIT} nomes por circuito e {targetRankingRows} linhas de ranking.
        {" "}{HOMOLOGATION_LOAD_SUMMABLE_CIRCUIT_COUNT} circuitos têm etapas exclusivas para testar a soma; os demais mantêm sobreposições identificadas para validar o aviso e a contagem única.
      </p>

      {progress ? <div className="homologationLoadProgress" role="status">{progress}</div> : null}
      {message ? <div className={`homologationLoadMessage ${message.type}`} role="status">{message.text}</div> : null}

      <div className="homologationLoadActions">
        <button
          type="button"
          className="actionConfirmBtn"
          disabled={busy || loadDataMatchesTarget}
          aria-busy={busyAction === "create"}
          onClick={() => createLoadData({ replaceExisting: hasLoadData })}
        >
          {busyAction === "create"
            ? "Gerando massa ampliada..."
            : loadDataMatchesTarget
              ? "Massa ampliada pronta"
              : hasLoadData
                ? "Reorganizar massa de teste"
                : "Criar massa ampliada"}
        </button>
        <button type="button" className="deleteBtn" disabled={busy || !hasLoadData} aria-busy={busyAction === "remove"} onClick={removeLoadData}>
          {busyAction === "remove" ? "Removendo massa..." : "Remover massa de teste"}
        </button>
        <button type="button" className="secondaryBtn" disabled={busy} onClick={() => window.location.reload()}>
          Recarregar painel
        </button>
      </div>
    </section>
  );
}
