import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { allowedDomain, config } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const { error, callbackUrl } = await searchParams;
  if (!config.auth()) redirect("/");
  if ((await auth())?.user) redirect(callbackUrl || "/");
  const domain = allowedDomain();

  return (
    <div className="relative z-10 flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass hexa-accent-top w-full max-w-md rounded-3xl p-8 text-center">
        <Image src="/hexa-logo.png" alt="HEXA" width={477} height={110} priority className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-xl font-semibold text-ink">Strategic Intelligence</h1>
        <p className="mt-1 text-sm text-muted">Where can Hexa win profitable business next — against whom, at what price, and what must we do?</p>
        {error && (
          <p className="mt-5 rounded-xl bg-bad-50 px-3 py-2 text-xs text-bad ring-1 ring-inset ring-bad-200">
            {error === "AccessDenied" ? `Access is limited to @${domain} Google accounts.` : "Sign-in failed. Please try again."}
          </p>
        )}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl || "/" });
          }}
        >
          <button type="submit" className="btn-hexa inline-flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#fff" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c6.92 0 9.2-4.86 9.2-7.36 0-.5-.05-.88-.12-1.27z" />
            </svg>
            Continue with Google
          </button>
        </form>
        <p className="mt-4 text-[11px] text-subtle">Restricted to @{domain} accounts. Activity is recorded in the audit log.</p>
      </div>
    </div>
  );
}
