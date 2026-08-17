import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Grid3X3, MapPin, Trash2, X } from "lucide-react";
import {
  createDefaultCourtNumbers,
  normalizeCourtNumberValue,
} from "../../domain/courtNumbers.mjs";
import { getTournamentCourtCount } from "../../domain/modalitySettings.mjs";

export default function CourtCenterModal({
  openTournaments = [],
  activeTournamentId,
  centers = {},
  usages = [],
  onChange,
  onClose,
  modalityConfig,
  getTournamentVenueKey,
  getTournamentVenueLabel,
  normalizeCourtCenterEntry,
}) {
  const venueOptions = useMemo(() => {
    const venues = new Map();
    openTournaments.forEach((tournament) => {
      const venueKey = getTournamentVenueKey(tournament);
      const venueLabel = getTournamentVenueLabel(tournament);
      const config = modalityConfig[tournament.type];
      const recommendedCount = config ? getTournamentCourtCount(config, tournament.data || {}) : 0;
      const current = venues.get(venueKey) || {
        key: venueKey,
        label: venueLabel,
        tournamentIds: [],
        tournamentNames: [],
        suggestedNumbers: [],
        recommendedCount: 0,
      };
      current.tournamentIds.push(tournament.id);
      current.tournamentNames.push(tournament.name);
      current.recommendedCount += recommendedCount;
      current.suggestedNumbers = createDefaultCourtNumbers(current.recommendedCount);
      venues.set(venueKey, current);
    });
    return [...venues.values()];
  }, [openTournaments]);

  const activeVenueKey = useMemo(() => {
    const activeTournament = openTournaments.find((tournament) => tournament.id === activeTournamentId);
    return activeTournament ? getTournamentVenueKey(activeTournament) : venueOptions[0]?.key;
  }, [activeTournamentId, openTournaments, venueOptions]);
  const [selectedVenueKey, setSelectedVenueKey] = useState(activeVenueKey || venueOptions[0]?.key || "local-nao-informado");
  const [courtQuantity, setCourtQuantity] = useState("");

  useEffect(() => {
    if (venueOptions.some((venue) => venue.key === selectedVenueKey)) return;
    setSelectedVenueKey(activeVenueKey || venueOptions[0]?.key || "local-nao-informado");
  }, [activeVenueKey, selectedVenueKey, venueOptions]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const selectedVenue = venueOptions.find((venue) => venue.key === selectedVenueKey) || venueOptions[0] || {
    key: selectedVenueKey,
    label: "Local não informado",
    tournamentIds: [],
    tournamentNames: [],
    suggestedNumbers: [],
    recommendedCount: 0,
  };
  const center = normalizeCourtCenterEntry(
    centers[selectedVenue.key] || {
      label: selectedVenue.label,
      numbers: [],
      configured: false,
    },
    selectedVenue.label
  );
  const venueUsages = usages.filter((usage) => usage.venueKey === selectedVenue.key);
  const usageByNumber = new Map(venueUsages.map((usage) => [normalizeCourtNumberValue(usage.courtNumber), usage]));
  const unavailable = new Set(center.unavailableNumbers);
  const freeCount = center.numbers.filter((number) => !usageByNumber.has(number) && !unavailable.has(number)).length;

  useEffect(() => {
    setCourtQuantity(center.numbers.length ? String(center.numbers.length) : "");
  }, [selectedVenue.key, center.numbers.length]);

  function commit(nextEntry) {
    onChange(selectedVenue.key, normalizeCourtCenterEntry({
      ...nextEntry,
      label: selectedVenue.label,
      configured: true,
    }, selectedVenue.label));
  }

  function applyCourtQuantity() {
    const quantity = Math.max(0, Math.min(50, Number(courtQuantity) || 0));
    const occupiedNumbers = center.numbers.filter((number) => usageByNumber.has(number));
    if (quantity < occupiedNumbers.length) {
      setCourtQuantity(String(center.numbers.length));
      return;
    }
    const nextNumbers = Array.from(new Set([
      ...occupiedNumbers,
      ...center.numbers.filter((number) => !occupiedNumbers.includes(number)),
    ])).slice(0, quantity);
    let candidate = 1;
    while (nextNumbers.length < quantity) {
      const number = String(candidate);
      if (!nextNumbers.includes(number)) nextNumbers.push(number);
      candidate += 1;
    }
    commit({
      ...center,
      numbers: nextNumbers,
      unavailableNumbers: center.unavailableNumbers.filter((number) => nextNumbers.includes(number)),
    });
  }

  function applySystemCourtSuggestion() {
    const quantity = Math.max(selectedVenue.recommendedCount, venueUsages.length);
    const occupiedNumbers = center.numbers.filter((number) => usageByNumber.has(number));
    const nextNumbers = [...occupiedNumbers];
    let candidate = 1;
    while (nextNumbers.length < quantity) {
      const number = String(candidate);
      if (!nextNumbers.includes(number)) nextNumbers.push(number);
      candidate += 1;
    }
    setCourtQuantity(String(quantity));
    commit({
      ...center,
      numbers: nextNumbers,
      unavailableNumbers: center.unavailableNumbers.filter((number) => nextNumbers.includes(number)),
    });
  }

  function renameCourt(currentNumber, value, input) {
    const nextNumber = normalizeCourtNumberValue(value);
    if (
      !nextNumber
      || nextNumber === currentNumber
      || center.numbers.includes(nextNumber)
      || usageByNumber.has(currentNumber)
    ) {
      if (input) input.value = currentNumber;
      return;
    }
    const replaceNumber = (number) => number === currentNumber ? nextNumber : number;
    commit({
      ...center,
      numbers: center.numbers.map(replaceNumber),
      unavailableNumbers: center.unavailableNumbers.map(replaceNumber),
      tournamentPreferences: Object.fromEntries(
        Object.entries(center.tournamentPreferences || {}).map(([tournamentId, numbers]) => [
          tournamentId,
          numbers.map(replaceNumber),
        ])
      ),
    });
  }

  function removeCourt(number) {
    if (usageByNumber.has(number)) return;
    commit({
      ...center,
      numbers: center.numbers.filter((item) => item !== number),
      unavailableNumbers: center.unavailableNumbers.filter((item) => item !== number),
    });
  }

  function toggleCourtAvailability(number) {
    if (usageByNumber.has(number)) return;
    const nextUnavailable = unavailable.has(number)
      ? center.unavailableNumbers.filter((item) => item !== number)
      : [...center.unavailableNumbers, number];
    commit({ ...center, unavailableNumbers: nextUnavailable });
  }

  function toggleTournamentCourtPreference(tournamentId, number) {
    const currentPreferences = center.tournamentPreferences?.[tournamentId] || [];
    const nextPreferences = currentPreferences.includes(number)
      ? currentPreferences.filter((item) => item !== number)
      : [...currentPreferences, number];
    commit({
      ...center,
      tournamentPreferences: {
        ...center.tournamentPreferences,
        [tournamentId]: nextPreferences,
      },
    });
  }

  function clearTournamentCourtPreference(tournamentId) {
    commit({
      ...center,
      tournamentPreferences: {
        ...center.tournamentPreferences,
        [tournamentId]: [],
      },
    });
  }

  return createPortal(
    <div className="courtCenterOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="courtCenterModal" role="dialog" aria-modal="true" aria-labelledby="court-center-title">
        <header className="courtCenterHeader">
          <div>
            <span>Organização compartilhada</span>
            <h2 id="court-center-title">Central de Quadras</h2>
            <p>Informe as quadras que você realmente tem disponíveis. Os jogos e as rodadas não serão alterados.</p>
          </div>
          <button type="button" className="courtCenterClose" onClick={onClose} aria-label="Fechar"><X aria-hidden="true" /></button>
        </header>

        <div className="courtCenterScrollable">

        {venueOptions.length > 1 ? (
          <div className="courtCenterVenueTabs" role="tablist" aria-label="Locais dos torneios abertos">
            {venueOptions.map((venue) => (
              <button
                type="button"
                key={venue.key}
                className={venue.key === selectedVenue.key ? "active" : ""}
                onClick={() => setSelectedVenueKey(venue.key)}
              >
                <MapPin aria-hidden="true" /> {venue.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="courtCenterLocationSummary">
          <div>
            <small>Local em organização</small>
            <strong><MapPin aria-hidden="true" /> {selectedVenue.label}</strong>
            <span>{selectedVenue.tournamentNames.length} torneio(s) aberto(s) neste local</span>
            <span>Demanda estimada: até {selectedVenue.recommendedCount} jogo(s) simultâneo(s).</span>
          </div>
          <div className="courtCenterCounters" aria-label="Resumo das quadras">
            <span className="free"><strong>{freeCount}</strong> livres</span>
            <span className="occupied"><strong>{venueUsages.length}</strong> em uso</span>
            <span className="paused"><strong>{center.unavailableNumbers.length}</strong> indisponíveis</span>
          </div>
        </div>

        {selectedVenue.recommendedCount > 0 && center.numbers.length !== selectedVenue.recommendedCount ? (
          <div className="courtCenterSuggestion">
            <span>O sistema sugere Quadras 1 a {selectedVenue.recommendedCount} se todos os torneios abertos rodarem ao mesmo tempo.</span>
            <button type="button" onClick={applySystemCourtSuggestion}>Usar sugestão</button>
          </div>
        ) : null}

        <div className="courtCenterAddRow courtCenterCapacityRow">
          <label htmlFor="court-center-quantity">Quantas quadras estão disponíveis neste local?</label>
          <div>
            <span>Quantidade</span>
            <input
              id="court-center-quantity"
              value={courtQuantity}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              placeholder="Ex.: 4"
              onChange={(event) => setCourtQuantity(event.target.value.replace(/\D/g, "").slice(0, 2))}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyCourtQuantity();
              }}
            />
            <button type="button" onClick={applyCourtQuantity} disabled={courtQuantity === ""}>
              <Grid3X3 aria-hidden="true" /> Definir quantidade
            </button>
          </div>
          <small>Depois, confirme abaixo a numeração real de cada quadra.</small>
        </div>

        <div className="courtCenterGrid">
          {center.numbers.length ? center.numbers.map((number) => {
            const usage = usageByNumber.get(number);
            const isUnavailable = unavailable.has(number);
            const status = usage ? "occupied" : isUnavailable ? "paused" : "free";
            return (
              <article className={`courtCenterCard ${status}`} key={number}>
                <div className="courtCenterCardTopline">
                  <label className="courtCenterNumberEditor">
                    <span>Quadra</span>
                    <input
                      key={`${selectedVenue.key}-${number}`}
                      defaultValue={number}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      disabled={Boolean(usage)}
                      aria-label={`Número atual da Quadra ${number}`}
                      onInput={(event) => {
                        event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 4);
                      }}
                      onBlur={(event) => renameCourt(number, event.currentTarget.value, event.currentTarget)}
                    />
                  </label>
                  <span>{usage ? "Em uso" : isUnavailable ? "Indisponível" : "Livre"}</span>
                </div>
                {usage ? (
                  <div className="courtCenterUsage">
                    <small>{usage.tournamentName}</small>
                    <strong>{usage.gameLabel}</strong>
                    <span>A quadra será liberada automaticamente ao concluir o placar.</span>
                  </div>
                ) : (
                  <p>{isUnavailable ? "Fora de uso até você liberar." : "Pronta para receber um jogo chamado."}</p>
                )}
                <div className="courtCenterCardActions">
                  <button type="button" onClick={() => toggleCourtAvailability(number)} disabled={Boolean(usage)}>
                    {isUnavailable ? "Liberar" : "Marcar indisponível"}
                  </button>
                  <button type="button" className="remove" onClick={() => removeCourt(number)} disabled={Boolean(usage)} aria-label={`Remover Quadra ${number}`}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          }) : (
            <div className="courtCenterEmpty">
              <Grid3X3 aria-hidden="true" />
              <strong>Nenhuma quadra informada</strong>
              <span>Adicione os números das quadras que o organizador poderá usar neste local.</span>
            </div>
          )}
        </div>

        {center.numbers.length && selectedVenue.tournamentIds.length ? (
          <section className="courtCenterPreferences" aria-labelledby="court-preferences-title">
            <div className="courtCenterPreferencesHeader">
              <div>
                <span>Opcional</span>
                <h3 id="court-preferences-title">Distribuição inicial por torneio</h3>
                <p>Escolha as quadras preferidas de cada torneio. Durante o evento, qualquer jogo ainda poderá ser movido para qualquer quadra livre.</p>
              </div>
            </div>
            <div className="courtCenterPreferenceList">
              {openTournaments
                .filter((item) => selectedVenue.tournamentIds.includes(item.id))
                .map((item) => {
                  const preferredNumbers = center.tournamentPreferences?.[item.id] || [];
                  return (
                    <article className="courtCenterPreferenceItem" key={item.id}>
                      <div className="courtCenterPreferenceName">
                        <strong>{item.name}</strong>
                        <small>{preferredNumbers.length ? `${preferredNumbers.length} quadra(s) preferida(s)` : "Sem predeterminar"}</small>
                      </div>
                      <div className="courtCenterPreferenceOptions">
                        {center.numbers.map((number) => {
                          const selectedPreference = preferredNumbers.includes(number);
                          return (
                            <button
                              type="button"
                              key={number}
                              className={selectedPreference ? "selected" : ""}
                              disabled={unavailable.has(number)}
                              onClick={() => toggleTournamentCourtPreference(item.id, number)}
                            >
                              {selectedPreference ? "✓ " : ""}Quadra {number}
                            </button>
                          );
                        })}
                        {preferredNumbers.length ? (
                          <button type="button" className="clear" onClick={() => clearTournamentCourtPreference(item.id)}>
                            Sem predeterminar
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>
        ) : null}
        </div>

        <footer className="courtCenterFooter">
          <p><strong>Importante:</strong> uma quadra só fica ocupada quando o jogo muda para “Em andamento”.</p>
          <button type="button" onClick={onClose}>Concluir</button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
