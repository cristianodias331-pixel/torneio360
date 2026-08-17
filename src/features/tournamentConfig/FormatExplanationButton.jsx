import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { getSimplePlayerCount } from "../../domain/modalitySettings.mjs";
export default function FormatExplanationButton({
  label,
  ariaLabel,
  eyebrow,
  title,
  intro,
  sections,
  publicView = false,
  iconOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => closeRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`formatInfoTrigger ${publicView ? "public" : ""} ${iconOnly ? "iconOnly" : ""}`}
        onClick={() => setOpen(true)}
        aria-label={ariaLabel || label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CircleHelp aria-hidden="true" />
        {!iconOnly ? <span>{label}</span> : null}
      </button>

      {open && createPortal(
        <div
          className="formatInfoOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="formatInfoDialog formatInfoDialogCompact"
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel || title}
          >
            <header className="formatInfoHeader">
              <div>
                <span>{eyebrow}</span>
                <h2>{title}</h2>
                {intro ? <p>{intro}</p> : null}
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Fechar explicação">×</button>
            </header>

            <div className="formatInfoSections">
              {sections.map((section, index) => (
                <article key={section.title}>
                  <span className="formatInfoStep">{index + 1}</span>
                  <div>
                    <h3>{section.title}</h3>
                    {section.content}
                  </div>
                </article>
              ))}
            </div>

            <footer className="formatInfoFooter">
              <span>{publicView ? "Esta explicação é somente para consulta." : "Use esta explicação para escolher o formato do evento."}</span>
              <button type="button" onClick={() => setOpen(false)}>Entendi</button>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

export function SimpleFormatInfoButton({ data, config, publicView = false }) {
  const playerCount = getSimplePlayerCount(config, data);
  const rounds = playerCount - 1;
  const matchesPerRound = playerCount / 2;
  const totalMatches = (playerCount * (playerCount - 1)) / 2;

  return (
    <FormatExplanationButton
      label={`Como funciona com ${playerCount} jogadores`}
      ariaLabel={`Explicação da modalidade Simples com ${playerCount} jogadores`}
      eyebrow={`Formato calculado para ${playerCount} jogadores`}
      title="Simples — todos contra todos"
      intro="Veja como o sistema organiza as rodadas e o ranking individual."
      publicView={publicView}
      sections={[
        {
          title: "Formato",
          content: <p>Os <strong>{playerCount} jogadores</strong> participam individualmente, sem formação de duplas.</p>,
        },
        {
          title: "Rodadas e partidas",
          content: <p>Serão <strong>{rounds} rodadas</strong>, com {matchesPerRound} jogos por rodada e <strong>{totalMatches} partidas</strong> no total.</p>,
        },
        {
          title: "Participação e ranking",
          content: <><p>Cada jogador enfrenta todos os demais exatamente uma vez, sem folgas.</p><p>Os resultados alimentam um único ranking individual conforme os critérios escolhidos pelo organizador.</p></>,
        },
      ]}
    />
  );
}
