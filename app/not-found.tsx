import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="num text-6xl font-bold tracking-tight text-gold">404</p>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        That spot doesn&apos;t exist
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-mute">
        Someone may have claimed it, or the link is off by a character. The
        board itself is right where you left it.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Go to the board
      </Link>
    </div>
  );
}
