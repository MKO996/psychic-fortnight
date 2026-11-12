import type { Mood } from '../reminders';

/** LEFT's coin mascot. Decorative motion only; the mood is always given in text too. */
export default function Coin({ mood, label, size = 112 }: { mood: Mood; label: string; size?: number }) {
  return (
    <span className={`coin coin-${mood}`} role="img" aria-label={label} style={{ width: size, height: size }} data-mood={mood}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        {mood === 'celebrate' && (
          <g className="coin-sparks">
            <path d="M14 30l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" />
            <path d="M104 18l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" />
            <path d="M108 78l3 5 5 3-5 3-3 5-3-5-5-3 5-3z" />
          </g>
        )}
        <g className="coin-body">
          {/* arm (waving, or folded when offended) */}
          {mood === 'wave' && <path className="coin-arm wave-arm" d="M92 62 q14 -8 16 -26" />}
          {mood === 'celebrate' && (
            <>
              <path className="coin-arm" d="M92 58 q14 -10 14 -28" />
              <path className="coin-arm" d="M28 58 q-14 -10 -14 -28" />
            </>
          )}
          {mood === 'idle' && <path className="coin-arm" d="M92 70 q10 6 12 16" />}
          <circle cx="60" cy="62" r="40" className="coin-rim" />
          <circle cx="60" cy="62" r="33" className="coin-face" />
          <path d="M44 40 q16 -10 32 0" className="coin-shine" />
          {/* eyes */}
          {mood === 'sigh' ? (
            <>
              <path d="M44 58 q6 5 12 0" className="coin-line" />
              <path d="M64 58 q6 5 12 0" className="coin-line" />
            </>
          ) : mood === 'celebrate' ? (
            <>
              <path d="M44 60 q6 -8 12 0" className="coin-line" />
              <path d="M64 60 q6 -8 12 0" className="coin-line" />
            </>
          ) : (
            <>
              <circle cx="50" cy="58" r="4.5" className="coin-eye" />
              <circle cx="70" cy="58" r="4.5" className="coin-eye" />
            </>
          )}
          {mood === 'offended' && (
            <>
              <path d="M42 48 l14 5" className="coin-line" />
              <path d="M78 48 l-14 5" className="coin-line" />
            </>
          )}
          {/* mouth */}
          {mood === 'wave' && <path d="M50 72 q10 9 20 0" className="coin-line" />}
          {mood === 'idle' && <path d="M51 73 q9 6 18 0" className="coin-line" />}
          {mood === 'offended' && <path d="M51 76 h18" className="coin-line" />}
          {mood === 'sigh' && <path d="M53 76 q7 -4 14 0" className="coin-line" />}
          {mood === 'celebrate' && <path d="M47 70 q13 16 26 0 z" className="coin-mouth" />}
          {mood === 'offended' && <path className="coin-arm" d="M30 80 q30 12 60 0" />}
          {mood === 'sigh' && <path className="coin-puff" d="M80 78 q8 -2 10 4 q6 -2 8 4 q-4 4 -10 2 q-6 2 -8 -4z" />}
        </g>
      </svg>
    </span>
  );
}
