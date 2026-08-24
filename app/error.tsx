"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">Something broke</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        The board hit a snag
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        {error.digest ? (
          <>
            Reference <span className="num text-dim">{error.digest}</span> —{" "}
          </>
        ) : null}
        it was logged on our side. Try again, or head back to the board.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          The board
        </Link>
      </div>
    </div>
  );
}
