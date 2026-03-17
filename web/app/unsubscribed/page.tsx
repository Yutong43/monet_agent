import Link from "next/link";

export default function UnsubscribedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1ea] px-4">
      <div className="bg-white border border-[#e7e0d2] rounded-3xl p-10 max-w-md w-full text-center shadow-sm">
        <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">
          Monet
        </p>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          You&apos;re unsubscribed
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          You won&apos;t receive any more daily recap emails. You can re-subscribe at
          any time from the Monet dashboard or landing page.
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-medium underline underline-offset-4 text-foreground hover:text-muted-foreground transition-colors"
        >
          Back to Monet
        </Link>
      </div>
    </div>
  );
}
