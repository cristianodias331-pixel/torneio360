import React from "react";
import FormatExplanationButton from "../tournamentConfig/FormatExplanationButton.jsx";
import {
  circuitTieBreakOptions,
  circuitTournamentFormats,
  getCircuitTieBreakLabel,
  normalizeCircuitPointValue,
  normalizeCircuitRankingSettings,
} from "../../domain/circuitRankingSettings.mjs";
import { rankingCriteriaOptions } from "../../domain/rankingCriteria.mjs";

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
            {settings.identity === "individual" ? <div className="circuitGenderDivision">
              <div className="circuitSettingsTitleRow"><div><strong>Como exibir campeonatos de duplas mistas?</strong><span>Na dupla, o 1º nome representa o masculino e o 2º, o feminino</span></div><FormatExplanationButton iconOnly ariaLabel="Entenda os rankings masculino e feminino" eyebrow="Duplas mistas" title="Rankings separados por gênero" intro="A separação é uma escolha do organizador e não tenta descobrir o gênero pelo nome." sections={[{ title: "Ranking geral", content: <p>Todos os atletas aparecem em uma única tabela.</p> }, { title: "Masculino e feminino", content: <p>Em cada dupla fixa mista, o primeiro atleta entra no Ranking Masculino e o segundo no Ranking Feminino. Ambos recebem integralmente os pontos conquistados pela dupla.</p> }, { title: "Padronização", content: <p>Cadastre sempre o homem no primeiro campo e a mulher no segundo. A plataforma usa somente essa posição, sem tentar interpretar nomes.</p> }]} /></div>
              <div className="circuitCompactChoices" role="radiogroup" aria-label="Divisão do ranking individual">
                <button type="button" role="radio" aria-checked={settings.rankingDivision === "general"} className={settings.rankingDivision === "general" ? "selected" : ""} onClick={() => updateSettings({ rankingDivision: "general" })}><span className="circuitChoiceCheck" aria-hidden="true">{settings.rankingDivision === "general" ? "✓" : ""}</span><span className="circuitChoiceText"><strong>Ranking geral</strong></span></button>
                <button type="button" role="radio" aria-checked={settings.rankingDivision === "gender"} className={settings.rankingDivision === "gender" ? "selected" : ""} onClick={() => updateSettings({ rankingDivision: "gender" })}><span className="circuitChoiceCheck" aria-hidden="true">{settings.rankingDivision === "gender" ? "✓" : ""}</span><span className="circuitChoiceText"><strong>Masculino e feminino</strong></span></button>
              </div>
            </div> : null}
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

      <small className="circuitIdentityHint">O ranking unifica automaticamente nomes que diferem somente pela acentuação. Use nome e sobrenome para diferenciar homônimos.</small>
    </div>
  );
}
