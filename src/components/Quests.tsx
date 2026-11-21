import { useApp } from '../app-context';
import { reminderCopy } from '../reminders';

const ICON: Record<string, string> = { check: '👁️', log: '📜', bill: '🛡️', save: '💎', insight: '🔮' };

/** Today's three quests as cards that flip over when done. */
export default function Quests() {
  const { game: g, checkInNow, markNoSpend, go, pendingReminder: rem } = useApp();
  const waiting = rem && rem.opened ? reminderCopy(rem.stage, rem.tone) : null;
  const all = g.questsDone === g.quests.length;
  const act = (a?: string) => {
    if (a === 'checkIn') checkInNow();
    else if (a === 'noSpend') markNoSpend();
    else if (a === 'plan' || a === 'goals' || a === 'insights' || a === 'talk') go({ name: a });
  };
  return (
    <section className="questboard" aria-labelledby="checkin-h" data-testid="checkin">
      <div className="questboard-head">
        <h2 id="checkin-h">{all ? 'All quests done!' : g.quests[0].done ? 'Checked in today' : 'Daily quests'}</h2>
        <p className="quest-sub"><b>{g.questsDone} of {g.quests.length}</b> done · {all ? '+30 XP bonus earned' : 'all 3 for +30 XP bonus'}</p>
        {waiting && !g.quests[0].done && <p className="quest-risk">The coin is still waiting for you.</p>}
        {g.streakAtRisk && <p className="quest-risk">🔥 Check in today to keep your {g.streak}-day streak.</p>}
      </div>
      <ol className="qcards">
        {g.quests.map((q) => (
          <li key={q.id} className={`qcard quest ${q.done ? 'done' : ''}`} data-testid={`quest-${q.id}`}>
            <div className="qcard-inner">
              <div className="qcard-face qcard-front" aria-hidden={q.done}>
                <span className="qcard-tag">Quest</span>
                <span className="qcard-icon" aria-hidden="true">{ICON[q.id] ?? '⭐'}</span>
                <span className="qcard-label">{q.label}<span className="visually-hidden">{q.done ? ', done' : ', not done yet'}</span></span>
                <span className="qcard-xp">+{q.xp} XP</span>
                {!q.done && q.actionLabel && (
                  <button type="button" className={`btn ${q.id === 'check' ? 'primary' : 'secondary'} qcard-btn`} onClick={() => act(q.action)}>{q.actionLabel}</button>
                )}
              </div>
              {q.done && (
                <div className="qcard-face qcard-back">
                  <span className="qcard-seal" aria-hidden="true">✓</span>
                  <span className="qcard-label">{q.label}</span>
                  <span className="qcard-xp">+{q.xp} XP earned</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
