"use client";

import { useRouter } from "next/navigation";

interface StickyHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export function StickyHeader({ title, showBack, rightAction }: StickyHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 bg-surface border-b border-border">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-9 h-9 rounded-md text-text-2 hover:text-text-1 hover:bg-surface-2 transition-colors"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <h1 className="text-[20px] font-bold text-text-1 truncate">{title}</h1>
      </div>
      {rightAction && <div>{rightAction}</div>}
    </header>
  );
}
