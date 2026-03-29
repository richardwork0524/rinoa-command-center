"use client";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="mx-4 mt-3 px-4 py-3 rounded-lg bg-danger/10 border border-danger/30 flex items-center justify-between gap-3">
      <p className="text-[13px] text-danger">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[13px] font-semibold text-danger hover:text-danger/80 shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
