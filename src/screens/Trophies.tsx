import { useApp } from '../app-context';
import { TITLES, XP, xpForLevel } from '../game';
import Coin from '../components/Coin';

export default function Trophies() {
  const { game: g } = useApp();
  const earned = g.badges.filter((b) => b.earned).length;
  return (
    <div className="screen trophies">
      <h1 tabIndex={-1}>Trophies</h1>
      <section className="card level-card">
        <Coin mood="celebrate" label="The coin wearing your level" size={88} />
        <div>
          <p className="level-big">Level {g.level}</p>
          <p className="level-title">{g.title}</p>
          <p className="hint">{g.xp} XP in total · {g.nextLevelAt - g.xp} XP to level {g.level + 1}</p>
        </div>
      </section>
      <dl className="stat-chips">
        <div><dt>Streak</dt><dd>🔥 {g.streak} {g.streak === 1 ? 'day' : 'days'}</dd></div>
        <div><dt>Best streak</dt><dd>{g.bestStreak} days</dd></div>
        <div><dt>Badges</dt><dd>{earned} of {g.badges.length}</dd></div>
      </dl>

      <h2 className="section-h">Badges</h2>
      <ul className="badge-grid">
        {g.badges.map((b) => (
          <li key={b.id} className={`badge-tile ${b.earned ? 'earned' : 'locked'}`} data-testid={`badge-${b.id}`}>
            <span className="badge-icon" aria-hidden="true">{b.earned ? b.icon : '🔒'}</span>
            <strong>{b.name}</strong>
            <small>{b.earned ? 'Earned' : b.how}</small>
          </li>
        ))}
      </ul>

      <h2 className="section-h">Level path</h2>
      <ol className="level-path">
        {TITLES.map((t, i) => {
          const n = i + 1;
          return (
            <li key={t} className={n < g.level ? 'past' : n === g.level ? 'now' : ''}>
              <span className="lp-dot" aria-hidden="true">{n < g.level ? '✓' : n}</span>
              <span>{t}</span>
              <small>{xpForLevel(n)} XP</small>
              {n === g.level && <span className="visually-hidden">, you are here</span>}
            </li>
          );
        })}
      </ol>

      <section className="card quiet">
        <h2>How you earn XP</h2>
        <ul className="xp-rules">
          <li>Check your money: +{XP.activeDay} XP a day</li>
          <li>Log spending or money in: +{XP.log} XP (up to {XP.logsPerDayCap} a day)</li>
          <li>Mark a bill or debt payment paid: +{XP.billPaid} XP</li>
          <li>Move money to a goal: +{XP.saved} XP</li>
          <li>Finish all 3 daily quests: +{XP.questsDone} XP · each badge: +{XP.badge} XP</li>
        </ul>
        <p className="hint">XP is for good habits, never for spending. The amount doesn’t matter: logging £2 counts the same as £200. Undo takes the XP back.</p>
      </section>
    </div>
  );
}
