import { Crown } from 'lucide-react';

interface Props {
  conquered: number;
  total: number;
  size?: 'sm' | 'lg';
  showLabel?: boolean;
}

function getVariant(pct: number): string {
  if (pct >= 100) return 'kgp-bar-complete';
  if (pct >= 75) return 'kgp-bar-high';
  if (pct >= 25) return 'kgp-bar-mid';
  return 'kgp-bar-low';
}

export default function KgpProgressBar({
  conquered,
  total,
  size = 'sm',
  showLabel = true,
}: Props) {
  const pct = total > 0 ? Math.round((conquered / total) * 100) : 0;
  const variant = getVariant(pct);
  const isComplete = pct >= 100;

  return (
    <div className={`kgp-progress-bar-wrap kgp-progress-bar-${size}`}>
      {isComplete && (
        <div className="kgp-progress-complete-header">
          <Crown size={size === 'lg' ? 28 : 20} className="kgp-progress-crown" />
          <p className="kgp-progress-congrats">Gratulacje! Ukończono Koronę Gór Polskich!</p>
        </div>
      )}
      {showLabel && (
        <span className="kgp-progress-bar-label">
          {conquered}/{total} ({pct}%)
        </span>
      )}
      <div className={`kgp-progress-bar progress-bar ${size === 'lg' ? 'progress-bar-lg' : ''}`}>
        <div
          className={`kgp-progress-fill progress-fill ${variant}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
