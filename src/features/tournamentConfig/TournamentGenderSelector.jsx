import React from "react";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import { isMixedType } from "../../domain/modalityClassification.mjs";
import { tournamentGenderModes } from "../../domain/participantGenderRegistry.mjs";
import { getEffectiveTournamentGenderMode } from "../../domain/tournamentGenderConfig.mjs";

const tournamentGenderOptions = [
  { value: tournamentGenderModes.masculine, label: "Masculino" },
  { value: tournamentGenderModes.feminine, label: "Feminino" },
  { value: tournamentGenderModes.mixed, label: "Mista" },
  { value: tournamentGenderModes.open, label: "Livre" },
  { value: tournamentGenderModes.other, label: "Outro" },
];

export default function TournamentGenderSelector({
  type,
  value,
  customValue = "",
  onChange,
  onCustomChange,
  compact = false,
}) {
  const fixedByModality = isMixedType(modalityConfig[type]);
  const selectedValue = getEffectiveTournamentGenderMode(type, value);

  return (
    <div className={`tournamentGenderSelector ${compact ? "compact" : ""}`}>
      <select
        className="tournamentGenderSelect"
        value={selectedValue}
        disabled={fixedByModality}
        required={!fixedByModality}
        aria-required={!fixedByModality}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Gênero do torneio"
      >
        {!fixedByModality ? <option value="" disabled>Escolha o gênero</option> : null}
        {tournamentGenderOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {fixedByModality ? <small className="tournamentGenderHint">Esta modalidade já separa homens e mulheres automaticamente.</small> : null}
      {selectedValue === tournamentGenderModes.other ? (
        <input
          className="tournamentGenderOtherInput"
          value={customValue}
          onChange={(event) => onCustomChange(event.target.value)}
          placeholder="Escreva o gênero"
          aria-label="Outro gênero"
        />
      ) : null}
    </div>
  );
}
