import React, { useEffect, useRef, useState } from 'react';
import { TieBreakDrawOverlay } from '../ranking/TieBreakPanels.jsx';
import { SHUFFLE_DURATION_SECONDS } from '../media/shuffleAnimation.mjs';

export default function ReiDoSolTieBreakDraw({ draw, onComplete, onClose }) {
  const [seconds, setSeconds] = useState(SHUFFLE_DURATION_SECONDS);
  const [spotlight, setSpotlight] = useState(0);
  const completed = useRef(false);
  useEffect(() => {
    const countdown = setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    const movement = setInterval(() => setSpotlight(value => value + 1), 130);
    return () => { clearInterval(countdown); clearInterval(movement); };
  }, []);
  useEffect(() => {
    if (seconds === 0 && !completed.current) { completed.current = true; onComplete(); }
  }, [seconds, onComplete]);
  return <TieBreakDrawOverlay draw={{ ...draw, phase: seconds > 0 ? 'drawing' : 'result', seconds,
    candidates: draw.candidates, spotlight: draw.candidates[spotlight % draw.candidates.length] }} onClose={onClose} />;
}
