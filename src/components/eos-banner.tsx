'use client';

import { SurfaceBadge } from './surface-badge';

interface EOSData {
  id: string;
  project_key: string | null;
  display_name: string | null;
  session_date: string;
  surface: string;
  title: string;
  summary: string | null;
}

interface EOSBannerProps {
  eos: EOSData | null;
  label?: string;
}

export function EOSBanner({ eos, label = 'Last Session' }: EOSBannerProps) {
  if (!eos) return null;

  const SURFACE_BORDERS: Record<string, string> = {
    CHAT: 'var(--purple)',
    CODE: 'var(--green)',
    COWORK: 'var(--accent)',
    MOBILE: 'var(--orange)',
  };
  const borderColor = eos.surface ? SURFACE_BORDERS[eos.surface.toUpperCase()] || 'var(--border2)' : 'var(--border2)';

  return (
    <div
      className="rounded-[var(--r)] bg-[var(--card)] border border-[var(--border)] p-3"
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold text-[var(--text3)] uppercase tracking-wide">{label}</span>
        <span className="text-[12px] text-[var(--text3)]">{eos.session_date}</span>
        {eos.surface && <SurfaceBadge surface={eos.surface} />}
      </div>
      <div className="flex items-center gap-2">
        {eos.display_name && (
          <span className="text-[11px] text-[var(--text3)] shrink-0">{eos.display_name}</span>
        )}
        <span className="text-[13px] font-semibold text-[var(--text)] truncate">{eos.title}</span>
      </div>
      {eos.summary && (
        <p className="text-[12px] text-[var(--text2)] mt-1 line-clamp-2 leading-relaxed">{eos.summary}</p>
      )}
    </div>
  );
}
