import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SHUFFLE_DURATION_SECONDS, SHUFFLE_MOVEMENT_INTERVAL_MS, createShuffleAnimationItems, moveShuffleAnimationItems } from "../media/shuffleAnimation.mjs";

const duration = Math.max(5, SHUFFLE_DURATION_SECONDS);

function TeamCupDrawPresentation({ title, names, onReveal, onCancel }) {
  const [seconds, setSeconds] = useState(duration);
  const [items, setItems] = useState(() => createShuffleAnimationItems(names));
  const cancelRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    let movement, countdown, reveal;
    // Start after the presentation mounts; the actual result is not applied before this deadline.
    const frame = requestAnimationFrame(() => {
      const start = performance.now();
      movement = setInterval(() => setItems(current => moveShuffleAnimationItems(current)), SHUFFLE_MOVEMENT_INTERVAL_MS);
      countdown = setInterval(() => setSeconds(Math.max(1, Math.ceil(duration - (performance.now() - start) / 1000))), 200);
      reveal = setTimeout(onReveal, duration * 1000);
    });
    const keydown = event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onCancel(); }
      if (event.key === "Tab") { event.preventDefault(); event.stopImmediatePropagation(); cancelRef.current?.focus(); }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      cancelAnimationFrame(frame); clearInterval(movement); clearInterval(countdown); clearTimeout(reveal);
      document.removeEventListener("keydown", keydown, true);
      document.body.style.overflow = overflow; previous?.focus?.();
    };
  }, []);
  return createPortal(<div className="shuffleOverlay tc-draw-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <div className="shuffleBox">
      <div className="shuffleHeader"><div><span className="shuffleEyebrow">Sorteio em andamento</span><h2>{title}</h2><p>O resultado será revelado ao final da contagem.</p></div><div className="shuffleTimer" role="status" aria-live="polite">{seconds}s</div></div>
      <div className="shuffleStage" aria-hidden="true">{items.map(item => <div className="floatingName" key={item.id} title={item.name} style={{ left: `${item.left}%`, top: `${item.top}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg)` }}><span>{item.name}</span></div>)}</div>
      <div className="tc-draw-footer"><div className="shuffleProgress"><div style={{ animationDuration: `${duration}s` }} /></div><button type="button" ref={cancelRef} onClick={onCancel}>Cancelar sorteio</button></div>
    </div>
  </div>, document.body);
}

export function useTeamCupDrawPresentation() {
  const [draw, setDraw] = useState(null);
  const pending = useRef(false);
  function present(options) {
    if (pending.current) return;
    pending.current = true;
    setDraw(options);
  }
  function finish(reveal) {
    pending.current = false; setDraw(null);
    if (reveal) draw.onReveal();
  }
  return { busy: Boolean(draw), present, overlay: draw ? <TeamCupDrawPresentation {...draw} onReveal={() => finish(true)} onCancel={() => finish(false)} /> : null };
}
