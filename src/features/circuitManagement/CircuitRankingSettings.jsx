import React, { useMemo, useState } from "react";
import FormatExplanationButton from "../tournamentConfig/FormatExplanationButton.jsx";
import {
  circuitTieBreakOptions,
  circuitTournamentFormats,
  getCircuitTieBreakLabel,
  normalizeCircuitPointValue,
  normalizeCircuitRankingSettings,
} from "../../domain/circuitRankingSettings.mjs";
import { rankingCriteriaOptions } from "../../domain/rankingCriteria.mjs";
import {
  mergeParticipantGenderRegistries,
  participantGenderValues,
  setParticipantGender,
  setParticipantGenders,
} from "../../domain/participantGenderRegistry.mjs";

const genderCandidatesPageSize = 40;

function CircuitGenderRegistryEditor({ candidates = [], registry, onChange }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [visibleLimit, setVisibleLimit] = useState(genderCandidatesPageSize);
  const normalizedRegistry = useMemo(() => mergeParticipantGenderRegistries(registry), [registry]);
  const candidateSummary = useMemo(() => {
    const query = search.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
    let pendingCount = 0;
    const filtered = [];
    candidates.forEach((candidate) => {
      const isConfirmed = Boolean(normalizedRegistry[candidate.key]?.confirmed);
      if (!isConfirmed) pendingCount += 1;
      if ((activeTab === "pending" && isConfirmed) || (activeTab === "confirmed" && !isConfirmed)) return;
      const matches = !query || `${candidate.name} ${(candidate.tournaments || []).join(" ")}`
        .normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").includes(query);
      if (matches) filtered.push(candidate);
    });
    return { filtered, pendingCount };
  }, [activeTab, candidates, normalizedRegistry, search]);
  const visibleCandidates = candidateSummary.filtered.slice(0, visibleLimit);
  const pendingCount = candidateSummary.pendingCount;
  const confirmedCount = candidates.length - pendingCount;

  function chooseGender(candidate, gender) {
    onChange(setParticipantGender(normalizedRegistry, candidate.name, gender));
  }

  function applySuggestions() {
    const suggestions = candidates.flatMap((candidate) => (
      !normalizedRegistry[candidate.key]?.confirmed
        && candidate.suggestion
        && candidate.suggestion !== participantGenderValues.unknown
        ? [{ name: candidate.name, gender: candidate.suggestion }]
        : []
    ));
    if (suggestions.length) onChange(setParticipantGenders(normalizedRegistry, suggestions));
  }

  return (
    <section className="circuitGenderRegistry">
      <div className="circuitGenderRegistryHeader">
        <div>
          <strong>Identificação dos atletas</strong>
          <span>Confirme somente para separar os rankings masculino e feminino. Isso nunca bloqueia o torneio.</span>
        </div>
        <span className={`circuitGenderCounter ${pendingCount ? "pending" : "complete"}`}>
          {pendingCount ? `${pendingCount} a confirmar` : "Todos confirmados"}
        </span>
      </div>

      {candidates.length ? (
        <>
          <div className="circuitGenderTabs" role="tablist" aria-label="Situação dos gêneros dos atletas">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pending"}
              className={`pending ${activeTab === "pending" ? "selected" : ""}`}
              onClick={() => { setActiveTab("pending"); setVisibleLimit(genderCandidatesPageSize); }}
            >
              Gêneros a confirmar <span>{pendingCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "confirmed"}
              className={`confirmed ${activeTab === "confirmed" ? "selected" : ""}`}
              onClick={() => { setActiveTab("confirmed"); setVisibleLimit(genderCandidatesPageSize); }}
            >
              Gêneros confirmados <span>{confirmedCount}</span>
            </button>
          </div>
          <div className="circuitGenderRegistryTools">
            <label>
              <span className="srOnly">Pesquisar atleta</span>
              <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleLimit(genderCandidatesPageSize); }} placeholder="Pesquisar atleta..." />
            </label>
            {activeTab === "pending" ? (
              <button type="button" className="circuitGenderSuggestionButton" onClick={applySuggestions}>
                Confirmar sugestões conhecidas
              </button>
            ) : null}
          </div>
          <div className="circuitGenderCandidateList">
            {visibleCandidates.map((candidate) => {
              const entry = normalizedRegistry[candidate.key];
              const selectedGender = entry?.confirmed ? entry.gender : participantGenderValues.unknown;
              const suggestionClass = candidate.suggestion === participantGenderValues.masculine
                ? "masculine"
                : candidate.suggestion === participantGenderValues.feminine
                  ? "feminine"
                  : "unknown";
              const suggestionLabel = candidate.suggestion === participantGenderValues.masculine
                ? "Sugestão: masculino"
                : candidate.suggestion === participantGenderValues.feminine
                  ? "Sugestão: feminino"
                  : "Sistema em dúvida";
              return (
                <article key={candidate.key} className={!entry?.confirmed ? "pending" : "confirmed"}>
                  <div>
                    <strong>{candidate.name}</strong>
                    <small className={`circuitGenderSuggestionLabel ${suggestionClass}`}><span>Sugestão do sistema</span><b>{suggestionLabel.replace("Sugestão: ", "")}</b>{candidate.tournaments?.length ? <em>· {candidate.tournaments.slice(0, 2).join(", ")}</em> : null}</small>
                  </div>
                  <div className="circuitGenderCandidateActions">
                    {!entry?.confirmed && candidate.suggestion !== participantGenderValues.unknown ? (
                      <button type="button" className={`circuitGenderAcceptSuggestion ${suggestionClass}`} onClick={() => chooseGender(candidate, candidate.suggestion)}>
                        Usar sugestão
                      </button>
                    ) : null}
                    <div className="circuitGenderChoices" role="radiogroup" aria-label={`Gênero de ${candidate.name}`}>
                      <button type="button" role="radio" aria-checked={selectedGender === participantGenderValues.masculine} className={selectedGender === participantGenderValues.masculine ? "selected masculine" : ""} onClick={() => chooseGender(candidate, participantGenderValues.masculine)}><span aria-hidden="true">{selectedGender === participantGenderValues.masculine ? "✓" : ""}</span>Masculino</button>
                      <button type="button" role="radio" aria-checked={selectedGender === participantGenderValues.feminine} className={selectedGender === participantGenderValues.feminine ? "selected feminine" : ""} onClick={() => chooseGender(candidate, participantGenderValues.feminine)}><span aria-hidden="true">{selectedGender === participantGenderValues.feminine ? "✓" : ""}</span>Feminino</button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!visibleCandidates.length ? (
              <p className="circuitGenderEmpty circuitGenderTabEmpty">
                {activeTab === "pending"
                  ? "Nenhum gênero pendente nesta pesquisa."
                  : "Nenhum gênero confirmado nesta pesquisa."}
              </p>
            ) : null}
            {visibleLimit < candidateSummary.filtered.length ? (
              <button type="button" className="circuitGenderLoadMore" onClick={() => setVisibleLimit((current) => current + genderCandidatesPageSize)}>
                Carregar mais {Math.min(genderCandidatesPageSize, candidateSummary.filtered.length - visibleLimit)} nome(s)
              </button>
            ) : null}
          </div>
        </>
      ) : <p className="circuitGenderEmpty">Selecione os torneios do circuito para identificar os atletas.</p>}
    </section>
  );
}

export function CircuitGenderRegistryPanel({ candidates = [], value = {}, knownRegistry = {}, onChange }) {
  const registry = useMemo(
    () => mergeParticipantGenderRegistries(knownRegistry, value),
    [knownRegistry, value]
  );

  return (
    <section className="circuitStandaloneGenderRegistry">
      <div className="circuitStandaloneGenderHeader">
        <div>
          <span>Cadastro da arena</span>
          <strong>Gravar gênero dos atletas</strong>
          <small>Confirme os nomes uma vez para reutilizar a identificação nos circuitos desta arena. É opcional e não interfere nos torneios.</small>
        </div>
        <FormatExplanationButton
          iconOnly
          ariaLabel="Entenda o cadastro de gênero dos atletas"
          eyebrow="Cadastro da arena"
          title="Identificação reutilizável"
          intro="Esta função ajuda a separar rankings masculinos e femininos sem alterar participantes, confrontos ou placares."
          sections={[
            { title: "Confirmação", content: <p>O organizador confirma Masculino ou Feminino para cada nome. Sugestões nunca são gravadas automaticamente.</p> },
            { title: "Reutilização", content: <p>Depois de salvo, o mesmo atleta pode ser reconhecido em outros torneios e circuitos desta arena.</p> },
            { title: "Sem bloqueio", content: <p>Nomes não informados continuam normalmente no ranking geral e não impedem nenhuma etapa do evento.</p> },
          ]}
        />
      </div>
      <CircuitGenderRegistryEditor candidates={candidates} registry={registry} onChange={onChange} />
    </section>
  );
}

export function CircuitTournamentFormatSelector({ value, onChange }) {
  return (
    <section className="circuitTournamentFormatSelector">
      <div className="circuitSettingsTitleRow">
        <div>
          <strong>Formato das etapas do circuito</strong>
          <span>Escolha primeiro para visualizar somente os torneios compatíveis.</span>
        </div>
        <FormatExplanationButton
          iconOnly
          ariaLabel="Entenda os formatos das etapas do circuito"
          eyebrow="Formato das etapas"
          title="Quais torneios podem fazer parte deste circuito?"
          intro="Um circuito reúne etapas do mesmo formato. Os dois formatos não podem ser misturados no mesmo circuito."
          sections={[
            { title: "Classificação final — Super e Simples", content: <p>Use para modalidades sem chave eliminatória. Cada etapa termina com uma classificação do 1º ao último colocado, e a pontuação do circuito pode ser definida conforme essa posição final.</p> },
            { title: "Fases alcançadas — Copas", content: <p>Use para torneios com fase de grupos e chave principal. A pontuação do circuito pode considerar campeão, vice, semifinal, quartas, oitavas e as demais fases alcançadas.</p> },
            { title: "Lista de torneios", content: <p>Depois da escolha, aparecem somente os torneios compatíveis. Para reunir torneios do outro formato, crie outro circuito.</p> },
            { title: "Disputas paralelas", content: <p>Nunca pontuam e nenhum resultado, vitória, game, saldo ou colocação das paralelas entra no ranking do circuito.</p> },
          ]}
        />
      </div>
      <div className="circuitFormatOptions" role="radiogroup" aria-label="Formato das etapas do circuito">
        <button type="button" role="radio" aria-checked={value === circuitTournamentFormats.placement} className={value === circuitTournamentFormats.placement ? "selected" : ""} onClick={() => onChange(circuitTournamentFormats.placement)}>
          <span className="circuitChoiceCheck circuitFormatCheck" aria-hidden="true">{value === circuitTournamentFormats.placement ? "✓" : ""}</span>
          <span className="circuitChoiceText circuitFormatText"><strong>Classificação final</strong><em>Super e Simples</em><small>Pontos conforme 1º, 2º, 3º lugar e demais colocações.</small></span>
        </button>
        <button type="button" role="radio" aria-checked={value === circuitTournamentFormats.cup} className={value === circuitTournamentFormats.cup ? "selected" : ""} onClick={() => onChange(circuitTournamentFormats.cup)}>
          <span className="circuitChoiceCheck circuitFormatCheck" aria-hidden="true">{value === circuitTournamentFormats.cup ? "✓" : ""}</span>
          <span className="circuitChoiceText circuitFormatText"><strong>Fases alcançadas</strong><em>Copas</em><small>Pontos conforme campeão, vice, semifinal, quartas e outras fases.</small></span>
        </button>
      </div>
    </section>
  );
}
export function CircuitRankingSettingsEditor({
  value,
  onChange,
  rankingCriteria,
  rankingCriteriaMode,
  onRankingCriteriaChange,
  inheritedCriteria,
  mixedCriteria = false,
  tournamentFormat = "",
}) {
  const settings = normalizeCircuitRankingSettings(value);

  function updateSettings(patch) {
    onChange(normalizeCircuitRankingSettings({ ...settings, ...patch }));
  }

  function updatePoint(group, key, pointValue) {
    const points = {
      ...settings.points,
      [group]: group === "positions"
        ? settings.points.positions.map((item, index) => index === key ? normalizeCircuitPointValue(pointValue) : item)
        : (group === "cup"
          ? { ...settings.points.cup, [key]: normalizeCircuitPointValue(pointValue) }
          : normalizeCircuitPointValue(pointValue)),
    };
    updateSettings({ points });
  }

  function renderGenderDivision() {
    return (
      <div className="circuitGenderDivision">
        <div className="circuitSettingsTitleRow"><div><strong>Como exibir campeonatos de duplas mistas?</strong><span>O organizador confirma cada atleta; a ordem dos nomes não interfere.</span></div><FormatExplanationButton iconOnly ariaLabel="Entenda os rankings masculino e feminino" eyebrow="Duplas mistas" title="Rankings separados por gênero" intro="A separação é opcional e não interfere nos jogos ou nos dados já salvos." sections={[{ title: "Ranking geral", content: <p>Todos os atletas aparecem em uma única tabela.</p> }, { title: "Masculino e feminino", content: <p>Cada atleta recebe integralmente seus resultados ou pontos, mas aparece no ranking confirmado pelo organizador.</p> }, { title: "Sistema em dúvida", content: <p>A plataforma pode sugerir uma opção usando a modalidade e confirmações anteriores da própria arena. Quando não houver segurança, mostrará “A confirmar”.</p> }, { title: "Sem bloqueio", content: <p>Não informar o gênero nunca impede cadastro, sorteio, jogos ou placares. O atleta permanece no ranking geral até a confirmação.</p> }]} /></div>
        <div className="circuitCompactChoices" role="radiogroup" aria-label="Divisão do ranking individual">
          <button type="button" role="radio" aria-checked={settings.rankingDivision === "general"} className={settings.rankingDivision === "general" ? "selected" : ""} onClick={() => updateSettings({ rankingDivision: "general" })}><span className="circuitChoiceCheck" aria-hidden="true">{settings.rankingDivision === "general" ? "✓" : ""}</span><span className="circuitChoiceText"><strong>Ranking geral</strong></span></button>
          <button type="button" role="radio" aria-checked={settings.rankingDivision === "gender"} className={settings.rankingDivision === "gender" ? "selected" : ""} onClick={() => updateSettings({ rankingDivision: "gender" })}><span className="circuitChoiceCheck" aria-hidden="true">{settings.rankingDivision === "gender" ? "✓" : ""}</span><span className="circuitChoiceText"><strong>Masculino e feminino</strong></span></button>
        </div>
      </div>
    );
  }

  const cupPointFields = [
    ["champion", "Campeão"], ["runnerUp", "Vice-campeão"], ["semifinal", "Eliminado na semifinal"],
    ["quarterfinal", "Eliminado nas quartas"], ["round16", "Eliminado nas oitavas"],
    ["round32", "Eliminado na fase de 32"], ["groupStage", "Eliminado na fase de grupos"],
  ];

  return (
    <div className="circuitRankingSettings">
      <div className="circuitSettingsTitleRow">
        <div><strong>Como o ranking do circuito será calculado?</strong><span>Escolha obrigatória</span></div>
        <FormatExplanationButton
          iconOnly
          ariaLabel="Entenda os modelos de ranking do circuito"
          eyebrow="Ranking do circuito"
          title="Como funciona o cálculo da temporada"
          intro="A escolha altera somente o ranking do circuito. Torneios, confrontos e placares continuam preservados."
          sections={[
            { title: "Desempenho acumulado", content: <p>Soma Vitórias, Saldo de Games e Total de Games dos jogos válidos. O organizador escolhe a ordem dos critérios. Nas copas, entram somente os jogos dos grupos e da chave principal; disputas paralelas ficam fora.</p> },
            { title: "Pontuação por colocação", content: <p>Cada atleta ou dupla recebe os pontos definidos para a posição final ou para a fase alcançada na chave principal. O organizador pode colocar qualquer valor, inclusive zero.</p> },
            { title: "Disputas paralelas", content: <p>A 2ª e a 3ª disputas paralelas nunca concedem pontos e seus jogos não são usados nos desempates do circuito.</p> },
            { title: "Alterações posteriores", content: <p>Se o modelo ou os valores forem alterados, o ranking será recalculado com os resultados já salvos. Nenhum dado do torneio será apagado.</p> },
          ]}
        />
      </div>

      <div className="circuitRankingModeOptions" role="radiogroup" aria-label="Modelo do ranking do circuito">
        <button type="button" role="radio" aria-checked={settings.mode === "performance"} className={settings.mode === "performance" ? "selected" : ""} onClick={() => updateSettings({ mode: "performance" })}>
          <span className="circuitChoiceCheck" aria-hidden="true">{settings.mode === "performance" ? "✓" : ""}</span>
          <span className="circuitChoiceText"><strong>Desempenho acumulado</strong><small>Vitórias, Saldo e Total de Games.</small></span>
        </button>
        <button type="button" role="radio" aria-checked={settings.mode === "placement"} className={settings.mode === "placement" ? "selected" : ""} onClick={() => updateSettings({ mode: "placement" })}>
          <span className="circuitChoiceCheck" aria-hidden="true">{settings.mode === "placement" ? "✓" : ""}</span>
          <span className="circuitChoiceText"><strong>Pontuação por colocação</strong><small>Tabela de pontos definida pelo organizador.</small></span>
        </button>
      </div>

      {settings.mode === "performance" ? (
        <div className="circuitPerformanceSettings">
          <label className="circuitAutomaticToggle">
            <input type="checkbox" checked={rankingCriteriaMode !== "manual"} onChange={(event) => onRankingCriteriaChange(event.target.checked ? inheritedCriteria : rankingCriteria, event.target.checked ? "automatic" : "manual")} />
            Acompanhar automaticamente o critério dos torneios
          </label>
          <label><span>Ordem dos critérios</span><select value={rankingCriteriaMode === "manual" ? rankingCriteria : inheritedCriteria} disabled={rankingCriteriaMode !== "manual"} onChange={(event) => onRankingCriteriaChange(event.target.value, "manual")}>{rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {rankingCriteriaMode !== "manual" && mixedCriteria ? <small className="circuitCriteriaWarning">Os torneios usam critérios diferentes. O primeiro selecionado será a referência.</small> : null}
        </div>
      ) : (
        <div className="circuitPlacementSettings">
          <section>
            <div className="circuitSettingsTitleRow">
              <div><strong>Quem acumula os pontos?</strong></div>
              <FormatExplanationButton iconOnly ariaLabel="Entenda a identificação no ranking" eyebrow="Identificação" title="Ranking individual ou por dupla" intro="Defina como os resultados serão acumulados durante a temporada." sections={[
                { title: "Individual", content: <p>Cada atleta recebe integralmente os pontos conquistados. Ele pode trocar de parceiro em outra etapa e continuar com o próprio total.</p> },
                { title: "Por dupla", content: <p>Os dois nomes formam uma única inscrição no ranking. Para acumular corretamente, a escrita da dupla deve permanecer igual nas etapas.</p> },
              ]} />
            </div>
            <div className="circuitCompactChoices" role="radiogroup" aria-label="Quem acumula os pontos">
              <button type="button" role="radio" aria-checked={settings.identity === "individual"} className={settings.identity === "individual" ? "selected" : ""} onClick={() => updateSettings({ identity: "individual" })}><span className="circuitChoiceCheck" aria-hidden="true">{settings.identity === "individual" ? "✓" : ""}</span><span className="circuitChoiceText"><strong>Individual</strong></span></button>
              <button type="button" role="radio" aria-checked={settings.identity === "team"} className={settings.identity === "team" ? "selected" : ""} onClick={() => updateSettings({ identity: "team" })}><span className="circuitChoiceCheck" aria-hidden="true">{settings.identity === "team" ? "✓" : ""}</span><span className="circuitChoiceText"><strong>Por dupla</strong></span></button>
            </div>
          </section>

          {tournamentFormat === circuitTournamentFormats.placement ? <section>
            <div className="circuitSettingsTitleRow"><div><strong>Pontuação por classificação final</strong><span>Super, Simples e formatos sem eliminatória</span></div><FormatExplanationButton iconOnly ariaLabel="Entenda a pontuação por classificação final" eyebrow="Classificação final" title="Pontuação conforme a posição na etapa" intro="A classificação definitiva da etapa determina quantos pontos cada participante receberá no circuito." sections={[{ title: "Do 1º ao 10º lugar", content: <p>Cada colocação recebe o valor definido em seu próprio campo.</p> }, { title: "Outras colocações", content: <p>Do 11º lugar em diante, todos recebem o mesmo valor configurado em “Outras colocações”, sem limite de participantes. Se o valor for zero, essas posições não concedem pontos.</p> }, { title: "Torneios compatíveis", content: <p>Este formato aceita somente modalidades Super, Simples e outras que terminem com uma classificação final, sem chave eliminatória.</p> }]} /></div>
            <div className="circuitPointsGrid positions">
              {settings.points.positions.map((point, index) => <label key={index}><span>{index + 1}º lugar</span><input type="number" min="0" step="1" value={point} onChange={(event) => updatePoint("positions", index, event.target.value)} /></label>)}
              <label className="otherPositions"><span>Outras colocações</span><input type="number" min="0" step="1" value={settings.points.otherPositions} onChange={(event) => updatePoint("otherPositions", null, event.target.value)} /></label>
            </div>
          </section> : null}

          {tournamentFormat === circuitTournamentFormats.cup ? <section>
            <div className="circuitSettingsTitleRow"><div><strong>Pontuação por fases alcançadas</strong><span>Copas com grupos e chave principal</span></div><FormatExplanationButton iconOnly ariaLabel="Entenda a pontuação por fases alcançadas" eyebrow="Fases alcançadas" title="Pontuação conforme o avanço na copa" intro="A última fase atingida na chave principal determina quantos pontos cada participante receberá no circuito." sections={[{ title: "Chave principal", content: <p>Campeão e vice recebem seus valores. Todos os perdedores das semifinais recebem igualmente a pontuação de <strong>Eliminado na semifinal</strong>, mesmo quando houver jogo de 3º lugar.</p> }, { title: "Fase de grupos", content: <p>Quem não avançar recebe o valor definido pelo organizador para eliminação nos grupos, inclusive zero.</p> }, { title: "Torneios compatíveis", content: <p>Este formato aceita somente modalidades de copa com fase de grupos e chave eliminatória principal.</p> }, { title: "Disputas paralelas", content: <p>Resultados e jogos das disputas paralelas são ignorados integralmente e nunca pontuam.</p> }]} /></div>
            <div className="circuitPointsGrid">{cupPointFields.map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" step="1" value={settings.points.cup[key]} onChange={(event) => updatePoint("cup", key, event.target.value)} /></label>)}</div>
          </section> : null}

          <section>
            <div className="circuitSettingsTitleRow"><div><strong>Critérios de desempate</strong><span>Todas as pontuações sempre vêm primeiro</span></div><FormatExplanationButton iconOnly ariaLabel="Entenda os desempates do circuito" eyebrow="Desempates" title="Como os empates serão resolvidos" intro="O total de todas as pontuações é o primeiro critério. Em caso de igualdade, o sistema aplica o 1º e depois o 2º critério escolhidos abaixo." sections={[{ title: "Vitórias", content: <p>Soma cada partida vencida nos jogos válidos dos torneios. Nas modalidades de Copa, entram apenas a fase de grupos e a chave principal.</p> }, { title: "Melhores pontuações nas etapas", content: <p>Compara a maior pontuação obtida em uma etapa; persistindo o empate, compara a segunda maior, depois a terceira e assim sucessivamente.</p> }, { title: "Títulos, vices e terceiros lugares", content: <p>Quando selecionados, comparam quantas vezes o participante alcançou cada colocação na chave principal.</p> }, { title: "Sorteio", content: <p>É sempre o último recurso e só aparece quando o empate permanecer depois dos dois critérios escolhidos.</p> }, { title: "Disputas paralelas", content: <p>Não concedem pontos e nenhum resultado, vitória, game, saldo, título ou colocação das paralelas participa do ranking ou dos desempates.</p> }]} /></div>
            <div className="circuitTieBreakOrder">{settings.tieBreakOrder.map((criterion, index) => <label key={index}><span>{index + 1}º critério</span><select value={criterion} onChange={(event) => { const next = [...settings.tieBreakOrder]; next[index] = event.target.value; updateSettings({ tieBreakOrder: next, tieBreakDrawOrder: [], tieBreakDrawSignatures: {} }); }}>{circuitTieBreakOptions.filter((option) => option.value === criterion || !settings.tieBreakOrder.includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div>
            <p className="circuitRuleSummary">{getCircuitTieBreakLabel(settings)}</p>
          </section>
        </div>
      )}

      {(settings.mode === "performance" || settings.identity === "individual") ? renderGenderDivision() : null}

      <small className="circuitIdentityHint">O ranking unifica automaticamente nomes que diferem somente pela acentuação. Use nome e sobrenome para diferenciar homônimos.</small>
    </div>
  );
}
