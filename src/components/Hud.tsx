import type { GameState } from '../game';
import Coin from './Coin';

/** Compact character strip for Plan, Goals and Trophies. Today shows the full character sheet instead. */
export default function Hud({ game: g, onOpen, name }: { game: GameState; onOpen: () => void; name: string }) {
  const into = g.xp - g.levelStart;
  const need = g.nextLevelAt - g.levelStart;
  return (
    <button type="button" className="hud" onClick={onOpen} data-testid="hud"
      aria-label={`Level ${g.level}, ${g.title}. ${into} of ${need} XP to level ${g.level + 1}. ${g.streak}-day streak${g.streakAtRisk ? ', check in to keep it going' : ''}. Open trophies`}>
      <span aria-hidden="true" className="hud-avatar"><Coin mood="idle" label="" size={40} outfit={g.level} /></span>
      <span className="hud-mid" aria-hidden="true">
        <span className="hud-title">{name} · Lv {g.level} {g.title}</span>
        <span className="xpbar"><span className="xpbar-fill" style={{ width: `${Math.round((into / need) * 100)}%` }} /></span>
      </span>
      <span className={`sheet-streak ${g.activeToday ? 'lit' : g.streakAtRisk ? 'risk' : ''}`} aria-hidden="true">🔥<b>{g.streak}</b></span>
    </button>
  );
}
