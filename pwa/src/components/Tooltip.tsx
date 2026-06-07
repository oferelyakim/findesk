import { useState, useRef } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
  text: string;
  children?: React.ReactNode;
  showIcon?: boolean;
}

export default function Tooltip({ text, children, showIcon = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {showIcon && <Info size={13} style={{ color: 'var(--muted)', cursor: 'help', flexShrink: 0 }} />}

      {visible && (
        <div
          className="absolute z-50 bottom-full left-0 mb-2 w-64 rounded-lg p-3 text-xs leading-relaxed shadow-xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        >
          {text}
          <div
            className="absolute top-full left-4 w-2 h-2 rotate-45"
            style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginTop: '-4px' }}
          />
        </div>
      )}
    </div>
  );
}

/** Convenience: label + info icon with tooltip */
export function LabelWithTip({ label, tip }: { label: string; tip: string }) {
  return (
    <Tooltip text={tip} showIcon>
      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
    </Tooltip>
  );
}
