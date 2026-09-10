import React, { useEffect, useMemo, useRef, useState } from "react";
import { BracketColumn } from "../brackets/CupBracketView.jsx";

export default function TeamCupBracketView({ brackets, phase, title, renderMatch }) {
  const root = useRef(null);
  const [nodeHeight, setNodeHeight] = useState(360);
  const rounds = useMemo(() => {
    const grouped = new Map();
    for (const game of brackets) {
      if (game.phase !== phase) continue;
      if (!grouped.has(game.roundName)) grouped.set(game.roundName, { title: game.roundName, games: [] });
      grouped.get(game.roundName).games.push(game);
    }
    return [...grouped.values()];
  }, [brackets, phase]);

  useEffect(() => {
    const cards = [...(root.current?.querySelectorAll(".tc-match") || [])];
    if (!cards.length) return;
    // Every lane uses the same slot height, including BYEs and waiting games.
    // Full rosters and the three set fields can be taller than doubles cards.
    const measure = () => setNodeHeight(Math.ceil(Math.max(...cards.map(card => card.getBoundingClientRect().height))) + 40);
    measure();
    const observer = new ResizeObserver(measure);
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [rounds]);

  if (!rounds.length) return null;
  return <div ref={root} className="cupBrackets bracketTreeCollection tc-brackets" style={{ "--tc-bracket-node-height": `${nodeHeight}px` }}>
    <BracketColumn title={title} rounds={rounds} showRoundActions={false}
      renderGame={(game, round, index) => renderMatch(game, index + 1, round.title)} />
  </div>;
}
