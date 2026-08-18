import React, { useEffect, useMemo, useState } from "react";
import { formatParticipantName } from "../../domain/participantNames.mjs";
import { normalizeParticipantAttendance } from "../../domain/participantAttendance.mjs";
import {
  collectTournamentGenderCandidates,
  getOppositeParticipantGender,
  getParticipantGender,
  inferTournamentGenderMode,
  mergeParticipantGenderRegistries,
  participantGenderValues,
  setParticipantGender,
  tournamentGenderModes,
} from "../../domain/participantGenderRegistry.mjs";
import {
  isCupType,
  isIndividualCupType,
  isMixedType,
} from "../../domain/modalityClassification.mjs";

function isMixedParticipantConfig(config) {
  return isMixedType(config);
}

function isTeamParticipantConfig(config) {
  return config.type === "fixed12" || config.type === "fixed16" || (isCupType(config) && !isIndividualCupType(config));
}

function stripParticipantEmojis(value) {
  return String(value || "")
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, " ")
    .replace(/\p{Regional_Indicator}{2}/gu, " ")
    .replace(/\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:[\uFE0E\uFE0F]|\p{Emoji_Modifier})?)*/gu, " ")
    .replace(/[\u200D\uFE0E\uFE0F]/gu, " ")
    .replace(/\p{Emoji_Modifier}/gu, " ");
}

function prepareParticipantLine(value) {
  let line = stripParticipantEmojis(value)
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}\s+&/'’.\-:()[\]{}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const withoutPrefix = line
      .replace(/^\s*(?:(?:dupla|participante|atleta|jogador|homem|mulher)\s*(?:n[º°o.]?\s*)?\p{N}{1,3}\s*[ºª°oa]?\s*[.)\-:]?\s*|\p{N}{1,3}\s*[ºª°oa]?\s*(?:[.)\-:]\s*|\s+)|[-–—•*▪◦]+\s*)/iu, "")
      .trim();

    if (withoutPrefix === line) break;
    line = withoutPrefix;
  }

  return line
    .replace(/^[^\p{L}]+/u, "")
    .trim();
}

function sanitizeParticipantName(value) {
  const sanitized = stripParticipantEmojis(value)
    .normalize("NFKC")
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/[^\p{L}\p{M}\s'’.]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.'’]+|[.'’]+$/g, "")
    .trim();

  return formatParticipantName(sanitized);
}

function parseParticipantList(value, { splitTeams = false } = {}) {
  const names = [];
  let ignored = 0;
  let recognizedTeams = 0;

  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((rawLine) => {
      const preparedLine = prepareParticipantLine(rawLine);
      const parts = splitTeams
        ? preparedLine.split(/\s*(?:\+|&|\/|-|\s+[xX]\s+|\s+[eE]\s+)\s*/u)
        : [preparedLine];
      const cleanedNames = parts.map(sanitizeParticipantName).filter(Boolean);

      if (!cleanedNames.length) {
        ignored += 1;
        return;
      }

      if (splitTeams && cleanedNames.length === 2) {
        recognizedTeams += 1;
        names.push(...cleanedNames);
        return;
      }

      names.push(...cleanedNames);
    });

  return { names, ignored, recognizedTeams };
}

function normalizeParticipantPlaceholder(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function isAutomaticParticipantName(value, expectedValue) {
  const normalized = normalizeParticipantPlaceholder(value);
  const expected = normalizeParticipantPlaceholder(expectedValue);

  if (!normalized || normalized === expected) return true;

  return /^(?:atleta [12](?: da dupla \d+)?|participante \d+|jogador \d+|homem \d+|mulher \d+)$/u.test(normalized);
}

function countDuplicateParticipantNames(names) {
  const occurrences = new Map();

  names.forEach((name) => {
    const key = name.normalize("NFKC").toLocaleLowerCase("pt-BR");
    occurrences.set(key, (occurrences.get(key) || 0) + 1);
  });

  return [...occurrences.values()].filter((count) => count > 1).reduce((total, count) => total + count - 1, 0);
}

function fillParticipantSlots(currentValues, incomingNames, expectedName, replaceAll) {
  const nextValues = [...currentValues];
  const automaticIndexes = currentValues
    .map((value, index) => isAutomaticParticipantName(value, expectedName(index)) ? index : null)
    .filter((index) => index !== null);
  const targetIndexes = replaceAll ? currentValues.map((_, index) => index) : automaticIndexes;
  const imported = Math.min(incomingNames.length, targetIndexes.length);

  targetIndexes.forEach((targetIndex, incomingIndex) => {
    nextValues[targetIndex] = incomingIndex < incomingNames.length
      ? incomingNames[incomingIndex]
      : expectedName(targetIndex);
  });

  return {
    nextValues,
    imported,
    preserved: replaceAll ? 0 : currentValues.length - automaticIndexes.length,
    vacancies: targetIndexes.length - imported,
    overflow: Math.max(0, incomingNames.length - targetIndexes.length),
  };
}

function buildParticipantImportPreview(config, data, drafts, mode) {
  const replaceAll = mode === "replace";

  if (isMixedParticipantConfig(config)) {
    const menList = parseParticipantList(drafts.men);
    const womenList = parseParticipantList(drafts.women);
    const menResult = fillParticipantSlots(
      data.players.men,
      menList.names,
      (index) => `Homem ${index + 1}`,
      replaceAll
    );
    const womenResult = fillParticipantSlots(
      data.players.women,
      womenList.names,
      (index) => `Mulher ${index + 1}`,
      replaceAll
    );
    const incomingNames = [...menList.names, ...womenList.names];

    return {
      nextPlayers: {
        men: menResult.nextValues,
        women: womenResult.nextValues,
      },
      imported: menResult.imported + womenResult.imported,
      preserved: menResult.preserved + womenResult.preserved,
      vacancies: menResult.vacancies + womenResult.vacancies,
      overflow: menResult.overflow + womenResult.overflow,
      ignored: menList.ignored + womenList.ignored,
      duplicates: countDuplicateParticipantNames(incomingNames),
      oddTeamList: false,
      groups: [
        { label: "Homens", values: menResult.nextValues },
        { label: "Mulheres", values: womenResult.nextValues },
      ],
    };
  }

  if (isTeamParticipantConfig(config)) {
    const parsed = parseParticipantList(drafts.general, { splitTeams: true });
    const currentValues = data.players.teams.flatMap((team) => [team.a, team.b]);
    const result = fillParticipantSlots(
      currentValues,
      parsed.names,
      (index) => `Atleta ${(index % 2) + 1} da dupla ${Math.floor(index / 2) + 1}`,
      replaceAll
    );
    const nextTeams = data.players.teams.map((_, teamIndex) => ({
      a: result.nextValues[teamIndex * 2],
      b: result.nextValues[(teamIndex * 2) + 1],
    }));

    return {
      nextPlayers: { teams: nextTeams },
      imported: result.imported,
      preserved: result.preserved,
      vacancies: result.vacancies,
      overflow: result.overflow,
      ignored: parsed.ignored,
      duplicates: countDuplicateParticipantNames(parsed.names),
      oddTeamList: parsed.names.length % 2 !== 0,
      recognizedTeams: parsed.recognizedTeams,
      groups: [{
        label: "Duplas",
        values: nextTeams.map((team) => `${team.a} + ${team.b}`),
      }],
    };
  }

  if (isIndividualCupType(config)) {
    const parsed = parseParticipantList(drafts.general);
    const currentValues = data.players.teams.map((participant) => participant.a);
    const result = fillParticipantSlots(
      currentValues,
      parsed.names,
      (index) => `Jogador ${index + 1}`,
      replaceAll
    );
    const nextTeams = result.nextValues.map((name) => ({ a: name, b: "" }));
    return {
      nextPlayers: { teams: nextTeams },
      imported: result.imported,
      preserved: result.preserved,
      vacancies: result.vacancies,
      overflow: result.overflow,
      ignored: parsed.ignored,
      duplicates: countDuplicateParticipantNames(parsed.names),
      oddTeamList: false,
      recognizedTeams: 0,
      groups: [{ label: "Jogadores", values: result.nextValues }],
    };
  }

  const parsed = parseParticipantList(drafts.general);
  const result = fillParticipantSlots(
    data.players,
    parsed.names,
    (index) => `${config.label} ${index + 1}`,
    replaceAll
  );

  return {
    nextPlayers: result.nextValues,
    imported: result.imported,
    preserved: result.preserved,
    vacancies: result.vacancies,
    overflow: result.overflow,
    ignored: parsed.ignored,
    duplicates: countDuplicateParticipantNames(parsed.names),
    oddTeamList: false,
    recognizedTeams: 0,
    groups: [{ label: "Participantes", values: result.nextValues }],
  };
}

export default function ParticipantImportModal({ type, data, knownRegistry = {}, onClose, onApply, modalityConfig }) {
  const config = modalityConfig[type];
  const isMixed = isMixedParticipantConfig(config);
  const isTeams = isTeamParticipantConfig(config);
  const tournamentGenderMode = inferTournamentGenderMode(data);
  const isFixedMixedTeams = isTeams
    && !isMixed
    && tournamentGenderMode === tournamentGenderModes.mixed;
  const hasSingleTournamentGender = tournamentGenderMode === tournamentGenderModes.masculine
    || tournamentGenderMode === tournamentGenderModes.feminine;
  const shouldConfirmIndividualGenders = tournamentGenderMode === tournamentGenderModes.mixed && !isMixed;
  const [drafts, setDrafts] = useState({ general: "", men: "", women: "" });
  const [mode, setMode] = useState("available");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [genderRegistryDraft, setGenderRegistryDraft] = useState(() => (
    mergeParticipantGenderRegistries(data.participantGenders)
  ));
  const preview = useMemo(
    () => buildParticipantImportPreview(config, data, drafts, mode),
    [config, data, drafts, mode]
  );
  const genderCandidates = useMemo(() => {
    if (!hasSingleTournamentGender && !shouldConfirmIndividualGenders && !isMixed) return [];
    const collected = collectTournamentGenderCandidates({
      type,
      name: data.eventName,
      data: { ...data, players: preview.nextPlayers },
    }, config);
    return [...new Map(collected.map((candidate) => [candidate.key, candidate])).values()];
  }, [config, data, hasSingleTournamentGender, isMixed, preview.nextPlayers, shouldConfirmIndividualGenders, type]);
  const effectiveGenderRegistry = useMemo(
    () => mergeParticipantGenderRegistries(knownRegistry, genderRegistryDraft),
    [genderRegistryDraft, knownRegistry]
  );
  const confirmedGenderCount = genderCandidates.filter((candidate) => (
    getParticipantGender(effectiveGenderRegistry, candidate.name, { confirmedOnly: true }) !== participantGenderValues.unknown
  )).length;
  const mixedTeamPartners = useMemo(() => {
    const partners = new Map();
    if (!isFixedMixedTeams || !Array.isArray(preview.nextPlayers?.teams)) return partners;
    preview.nextPlayers.teams.forEach((team) => {
      const first = genderCandidates.find((candidate) => candidate.name === team?.a);
      const second = genderCandidates.find((candidate) => candidate.name === team?.b);
      if (!first?.key || !second?.key) return;
      partners.set(first.key, second);
      partners.set(second.key, first);
    });
    return partners;
  }, [genderCandidates, isFixedMixedTeams, preview.nextPlayers]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function updateDraft(field, value) {
    setDrafts((current) => ({ ...current, [field]: value }));
    setReplaceConfirmed(false);
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    setReplaceConfirmed(false);
  }

  function handleApply() {
    if (!preview.imported) return;

    if (mode === "replace" && !replaceConfirmed) {
      setReplaceConfirmed(true);
      return;
    }

    let resolvedRegistry = genderRegistryDraft;
    genderCandidates.forEach((candidate) => {
      let gender = getParticipantGender(effectiveGenderRegistry, candidate.name, { confirmedOnly: true });
      if (hasSingleTournamentGender) {
        gender = tournamentGenderMode === tournamentGenderModes.masculine
          ? participantGenderValues.masculine
          : participantGenderValues.feminine;
      } else if (isMixed && candidate.suggestion !== participantGenderValues.unknown) {
        gender = candidate.suggestion;
      }
      if (gender !== participantGenderValues.unknown) {
        resolvedRegistry = setParticipantGender(resolvedRegistry, candidate.name, gender);
      }
    });

    let nextPlayers = preview.nextPlayers;
    if (isFixedMixedTeams && Array.isArray(preview.nextPlayers?.teams)) {
      nextPlayers = {
        ...preview.nextPlayers,
        teams: preview.nextPlayers.teams.map((team) => {
          const firstGender = getParticipantGender(resolvedRegistry, team?.a, { confirmedOnly: true });
          const secondGender = getParticipantGender(resolvedRegistry, team?.b, { confirmedOnly: true });
          return firstGender === participantGenderValues.feminine && secondGender === participantGenderValues.masculine
            ? { ...team, a: team.b, b: team.a }
            : team;
        }),
      };
    }

    onApply(nextPlayers, {
      ...preview,
      participantGenders: resolvedRegistry,
    });
  }

  function assignParticipantGender(registry, candidate, gender) {
    let nextRegistry = setParticipantGender(registry, candidate.name, gender);
    const partner = mixedTeamPartners.get(candidate.key);
    const oppositeGender = getOppositeParticipantGender(gender);
    if (partner && oppositeGender !== participantGenderValues.unknown) {
      nextRegistry = setParticipantGender(nextRegistry, partner.name, oppositeGender);
    }
    return nextRegistry;
  }

  function chooseParticipantGender(candidate, gender) {
    setGenderRegistryDraft((current) => assignParticipantGender(current, candidate, gender));
  }

  function confirmGenderSuggestions() {
    setGenderRegistryDraft((current) => genderCandidates.reduce((registry, candidate) => (
      candidate.suggestion && candidate.suggestion !== participantGenderValues.unknown
        ? assignParticipantGender(registry, candidate, candidate.suggestion)
        : registry
    ), current));
  }

  const previewGroups = useMemo(() => {
    if (!isFixedMixedTeams || !Array.isArray(preview.nextPlayers?.teams)) return preview.groups;
    return [{
      label: "Duplas",
      values: preview.nextPlayers.teams.map((team) => {
        const firstGender = getParticipantGender(effectiveGenderRegistry, team?.a, { confirmedOnly: true });
        const secondGender = getParticipantGender(effectiveGenderRegistry, team?.b, { confirmedOnly: true });
        return firstGender === participantGenderValues.feminine && secondGender === participantGenderValues.masculine
          ? `${team.b} + ${team.a}`
          : `${team.a} + ${team.b}`;
      }),
    }];
  }, [effectiveGenderRegistry, isFixedMixedTeams, preview.groups, preview.nextPlayers]);

  return (
    <div className="participantImportOverlay" role="dialog" aria-modal="true" aria-labelledby="participant-import-title">
      <div className="participantImportModal">
        <div className="participantImportHeader">
          <div>
            <span>Participantes</span>
            <h2 id="participant-import-title">Colar lista de nomes</h2>
            <p>
              {isFixedMixedTeams
                ? "Uma dupla por linha. Ao confirmar o gênero de uma pessoa, o parceiro receberá automaticamente o gênero oposto. O homem ficará na primeira posição e a mulher na segunda. Separe os nomes por +, /, -, e ou &. Símbolos e emojis serão ignorados. Use nome e sobrenome."
                : isTeams
                ? "Uma dupla por linha. Separe os dois nomes por +, /, -, e ou &. Espaços dentro do nome continuam sendo nome e sobrenome. Símbolos e emojis em qualquer posição serão ignorados. Use nome e sobrenome."
                : "Numeração, marcadores e emojis em qualquer posição serão retirados automaticamente. Use nome e sobrenome."}
            </p>
          </div>
          <button type="button" className="participantImportClose" onClick={onClose} aria-label="Fechar importação">×</button>
        </div>

        <div className="participantImportMode" aria-label="Modo da importação">
          <button type="button" className={mode === "available" ? "active" : ""} onClick={() => chooseMode("available")}>
            <strong>Preencher vagas ainda não editadas</strong>
            <small>Recomendado — preserva todos os nomes digitados.</small>
          </button>
          <button type="button" className={mode === "replace" ? "active danger" : ""} onClick={() => chooseMode("replace")}>
            <strong>Substituir todos os participantes</strong>
            <small>Apaga os nomes atuais e exige confirmação.</small>
          </button>
        </div>

        <div className={`participantImportEditors ${isMixed ? "mixed" : ""}`}>
          {isMixed ? (
            <>
              <label>
                <span>Lista de homens</span>
                <textarea
                  value={drafts.men}
                  onChange={(event) => updateDraft("men", event.target.value)}
                  placeholder={"1. João\n2. Marcos\n3. André"}
                />
              </label>
              <label>
                <span>Lista de mulheres</span>
                <textarea
                  value={drafts.women}
                  onChange={(event) => updateDraft("women", event.target.value)}
                  placeholder={"1. Ana\n2. Carla\n3. Beatriz"}
                />
              </label>
            </>
          ) : (
            <label>
              <span>{isTeams ? "Duplas ou nomes, um por linha" : "Um participante por linha"}</span>
              <textarea
                value={drafts.general}
                onChange={(event) => updateDraft("general", event.target.value)}
                placeholder={isFixedMixedTeams
                  ? "Ana + João\nCarla / Marcos\nBeatriz e Pedro"
                  : isTeams
                  ? "Ana + Carla\nBeatriz / Fernanda\nJoão e Marcos\nPaulo-Sérgio\n\nSem separador: João da Silva"
                  : "1. Ana\n2. Beatriz\n3. Carla"}
              />
            </label>
          )}
        </div>

        <div className="participantImportSummary" aria-live="polite">
          <div><strong>{preview.imported}</strong><span>nomes a preencher</span></div>
          <div><strong>{preview.preserved}</strong><span>nomes preservados</span></div>
          <div><strong>{preview.vacancies}</strong><span>vagas automáticas restantes</span></div>
          {isTeams ? <div><strong>{preview.recognizedTeams}</strong><span>duplas reconhecidas por linha</span></div> : null}
        </div>

        {(preview.overflow > 0 || preview.duplicates > 0 || preview.ignored > 0 || preview.oddTeamList || replaceConfirmed) && (
          <div className="participantImportWarnings">
            {preview.overflow > 0 && <p><strong>Atenção:</strong> {preview.overflow} nome{preview.overflow === 1 ? " não cabe" : "s não cabem"} nas vagas disponíveis.</p>}
            {preview.duplicates > 0 && <p><strong>Confira:</strong> a lista contém {preview.duplicates} nome{preview.duplicates === 1 ? " repetido" : "s repetidos"}.</p>}
            {preview.ignored > 0 && <p>{preview.ignored} linha{preview.ignored === 1 ? " foi ignorada" : "s foram ignoradas"} porque não continha um nome válido.</p>}
            {preview.oddTeamList && <p><strong>Dupla incompleta:</strong> há um número ímpar de nomes; a última vaga continuará com o nome automático.</p>}
            {replaceConfirmed && <p><strong>Confirmação final:</strong> todos os nomes atuais serão substituídos pela lista abaixo.</p>}
          </div>
        )}

        {shouldConfirmIndividualGenders && genderCandidates.length ? (
          <section className="participantImportGenderStep" aria-labelledby="participant-import-gender-title">
            <div className="participantImportGenderHeader">
              <div>
                <span>Etapa opcional</span>
                <strong id="participant-import-gender-title">Confirmar gênero para os rankings</strong>
                <small>{isFixedMixedTeams ? "Confirme uma pessoa da dupla; o parceiro recebe o gênero oposto e a ordem homem + mulher é ajustada automaticamente." : "Confirme os gêneros dos nomes desta lista. Isso não interfere nos jogos e nunca impede continuar."}</small>
              </div>
              <b>{confirmedGenderCount} de {genderCandidates.length} confirmados</b>
            </div>
            <div className="participantImportGenderToolbar">
              <p>Use nome e sobrenome. As sugestões servem apenas para reduzir o trabalho e só são gravadas após sua confirmação.</p>
              <button type="button" className="genderSuggestionConfirmButton" onClick={confirmGenderSuggestions}>
                Confirmar sugestões
              </button>
            </div>
            <div className="participantImportGenderList">
              {genderCandidates.map((candidate) => {
                const selected = getParticipantGender(effectiveGenderRegistry, candidate.name, { confirmedOnly: true });
                const suggestion = candidate.suggestion === participantGenderValues.masculine
                  ? "Masculino"
                  : candidate.suggestion === participantGenderValues.feminine
                    ? "Feminino"
                    : "Sem sugestão segura";
                return (
                  <article key={candidate.key}>
                    <div className="participantImportGenderName">
                      <strong>{candidate.name}</strong>
                      <small><span>Sugestão</span><b>{suggestion}</b></small>
                    </div>
                    <div className="participantGenderPanelChoices" role="radiogroup" aria-label={`Gênero de ${candidate.name}`}>
                      <button type="button" role="radio" aria-checked={selected === participantGenderValues.masculine} className={selected === participantGenderValues.masculine ? "selected masculine" : ""} onClick={() => chooseParticipantGender(candidate, participantGenderValues.masculine)}>Masculino</button>
                      <button type="button" role="radio" aria-checked={selected === participantGenderValues.feminine} className={selected === participantGenderValues.feminine ? "selected feminine" : ""} onClick={() => chooseParticipantGender(candidate, participantGenderValues.feminine)}>Feminino</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className="participantImportPreview">
          <div className="participantImportPreviewTitle">
            <strong>Prévia antes de aplicar</strong>
            <small>É assim que os participantes ficarão.</small>
          </div>
          <div className={`participantImportPreviewGroups ${previewGroups.length > 1 ? "multiple" : ""}`}>
            {previewGroups.map((group) => (
              <section key={group.label}>
                <h3>{group.label}</h3>
                <ol>
                  {group.values.map((value, index) => <li key={`${group.label}-${index}`}>{value}</li>)}
                </ol>
              </section>
            ))}
          </div>
        </div>

        <div className="participantImportFooter">
          <button type="button" className="participantImportCancelButton" onClick={onClose}>Cancelar</button>
          <button type="button" className="participantImportApplyButton" onClick={handleApply} disabled={!preview.imported}>
            {mode === "replace" && replaceConfirmed ? "Sim, substituir todos" : mode === "replace" ? "Revisar substituição" : "Aplicar lista"}
          </button>
        </div>
      </div>
    </div>
  );
}
function ParticipantAttendanceButton({ confirmed, onChange }) {
  return (
    <button
      type="button"
      className={`participantAttendanceStatus ${confirmed ? "confirmed" : "pending"}`}
      onClick={() => onChange(!confirmed)}
      aria-pressed={confirmed}
      title={confirmed ? "Clique para marcar como pendente" : "Clique para confirmar a presença"}
    >
      {confirmed ? "Confirmado" : "Pendente"}
    </button>
  );
}

export function PlayerInputs({ type, data, updatePlayer, updateParticipantAttendance, modalityConfig }) {
  const config = modalityConfig[type];
  const attendance = normalizeParticipantAttendance(config, data.players, data.participantAttendance);

  function isConfirmed(path) {
    if (path.kind === "normal") return attendance[path.index] === true;
    if (path.kind === "men") return attendance.men[path.index] === true;
    if (path.kind === "women") return attendance.women[path.index] === true;
    return attendance.teams[path.index]?.[path.field] === true;
  }

  function renderAttendance(path) {
    return (
      <ParticipantAttendanceButton
        confirmed={isConfirmed(path)}
        onChange={(confirmed) => updateParticipantAttendance(path, confirmed)}
      />
    );
  }

  if (isMixedType(config)) {
    return (
      <div className="twoCols">
        <div>
          <h3>Homens</h3>

          {data.players.men.map((name, i) => (
            <div className="numberedInput participantAttendanceRow" key={i}>
              <span>{i + 1}</span>
              <input
                value={name}
                onChange={(e) => updatePlayer({ kind: "men", index: i }, e.target.value)}
              />
              {renderAttendance({ kind: "men", index: i })}
            </div>
          ))}
        </div>

        <div>
          <h3>Mulheres</h3>

          {data.players.women.map((name, i) => (
            <div className="numberedInput participantAttendanceRow" key={i}>
              <span>{config.men + i + 1}</span>
              <input
                value={name}
                onChange={(e) => updatePlayer({ kind: "women", index: i }, e.target.value)}
              />
              {renderAttendance({ kind: "women", index: i })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isIndividualCupType(config)) {
    return (
      <div className="twoCols participantAttendanceColumns">
        {data.players.teams.map((participant, i) => (
          <div className="numberedInput participantAttendanceRow" key={i}>
            <span>{i + 1}</span>
            <input
              value={participant.a}
              onChange={(e) => updatePlayer({ kind: "team", index: i, field: "a" }, e.target.value)}
            />
            {renderAttendance({ kind: "team", index: i, field: "a" })}
          </div>
        ))}
      </div>
    );
  }

  if (config.type === "fixed12" || config.type === "fixed16" || isCupType(config)) {
    return (
      <div className="twoCols">
        {data.players.teams.map((team, i) => (
          <div key={i} className="miniCard">
            <h3>Dupla {i + 1}</h3>

            <div className="numberedInput participantAttendanceRow">
              <span>{i + 1}</span>
              <input
                value={team.a}
                onChange={(e) => updatePlayer({ kind: "team", index: i, field: "a" }, e.target.value)}
              />
              {renderAttendance({ kind: "team", index: i, field: "a" })}
            </div>

            <div className="numberedInput participantAttendanceRow teamSecondParticipantRow">
              <span aria-hidden="true" />
              <input
                value={team.b}
                onChange={(e) => updatePlayer({ kind: "team", index: i, field: "b" }, e.target.value)}
              />
              {renderAttendance({ kind: "team", index: i, field: "b" })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="twoCols participantAttendanceColumns">
      {data.players.map((name, i) => (
        <div className="numberedInput participantAttendanceRow" key={i}>
          <span>{i + 1}</span>
          <input
            value={name}
            onChange={(e) => updatePlayer({ kind: "normal", index: i }, e.target.value)}
          />
          {renderAttendance({ kind: "normal", index: i })}
        </div>
      ))}
    </div>
  );
}
