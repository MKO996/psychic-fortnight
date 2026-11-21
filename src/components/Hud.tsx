import type { GameState } from '../game';

/** Always-visible game bar: level, XP to the next level, and the check-in streak. */
export default function Hud({ game: g, onOpen }: { game: GameState; onOpen: () => void }) {
  const into = g.xp - g.levelStart;
  const need = g.nextLevelAt - g.levelStart;
  const pct = Math.round((into / need) * 100);
  return (
    <button type="button" className="hud" onClick={onOpen} data-testid="hud"
      aria-label={`Level ${g.level}, ${g.title}. ${into} of ${need} XP to level ${g.level + 1}. ${g.streak}-day streak${g.streakAtRisk ? ', check in to keep it going' : ''}. Open trophies`}>
      <span className="hud-level" aria-hidden="true"><span>{g.level}</span></span>
      <span className="hud-mid" aria-hidden="true">
        <span className="hud-title">{g.title}</span>
        <span className="hud-bar"><span className="hud-fill" style={{ width: `${pct}%` }} /></span>
        <span className="hud-xp">{into} / {need} XP</span>
      </span>
      <span className={`hud-streak ${g.activeToday ? 'lit' : g.streakAtRisk ? 'risk' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" /></svg>
        <span>{g.streak}</span>
      </span>
    </button>
  );
}
