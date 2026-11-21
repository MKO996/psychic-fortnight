import { useApp } from '../app-context';
import Coin from './Coin';
import { reminderCopy } from '../reminders';

/** Today's three quests. Replaces the plain check-in card; always on. */
export default function Quests() {
  const { game: g, checkInNow, markNoSpend, go, pendingReminder: rem } = useApp();
  const waiting = rem && rem.opened ? reminderCopy(rem.stage, rem.tone) : null;
  const all = g.questsDone === g.quests.length;
  const mood = all || g.quests[0].done ? 'celebrate' : waiting ? waiting.mood : 'idle';
  const act = (a?: string) => {
    if (a === 'checkIn') checkInNow();
    else if (a === 'noSpend') markNoSpend();
    else if (a === 'plan' || a === 'goals' || a === 'insights' || a === 'talk') go({ name: a });
  };
  return (
    <section className="card quests" aria-labelledby="checkin-h" data-testid="checkin">
      <div className="quest-head">
        <Coin mood={mood} label={all ? 'The coin is thrilled' : g.quests[0].done ? 'The coin is happy' : waiting ? `${waiting.moodLabel}, still waiting` : 'The coin is waiting'} size={64} />
        <div>
          <h2 id="checkin-h">{all ? 'All quests done!' : g.quests[0].done ? 'Checked in today' : 'Daily quests'}</h2>
          <p className="quest-sub">
            <strong>{g.questsDone} of {g.quests.length}</strong> done
            {all ? ' · +30 XP bonus earned' : ' · finish all 3 for +30 XP'}
          </p>
          {g.streakAtRisk && <p className="quest-risk">🔥 Check in today to keep your {g.streak}-day streak.</p>}
        </div>
      </div>
      <ol className="quest-list">
        {g.quests.map((q) => (
          <li key={q.id} className={`quest ${q.done ? 'done' : ''}`} data-testid={`quest-${q.id}`}>
            <span className="quest-box" aria-hidden="true">{q.done ? '✓' : ''}</span>
            <span className="quest-label">
              {q.label}
              <span className="visually-hidden">{q.done ? ', done' : ', not done yet'}</span>
            </span>
            <span className="quest-xp">+{q.xp} XP</span>
            {!q.done && q.actionLabel && (
              <button type="button" className={`btn ${q.id === 'check' ? 'primary' : 'secondary'} quest-btn`} onClick={() => act(q.action)}>{q.actionLabel}</button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
