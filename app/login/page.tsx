import { ArrowRight, LockKeyhole } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { hasValidSessionFromNextCookies, isQaAuthConfigured, safeNextPath } from "@/lib/auth";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ error?: string; next?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const configured = isQaAuthConfigured();
  const next = safeNextPath(params.next);

  if (configured && (await hasValidSessionFromNextCookies())) {
    redirect(next);
  }

  const errorMessage =
    params.error === "invalid"
      ? "Invalid username or password."
      : params.error === "not-configured"
        ? "QA login is not configured on this deployment."
        : null;

  return (
    <main className="loginShell">
      <section className="loginCard" aria-label="VIDSLOOM QA login">
        <div className="loginBrand">
          <Image src="/brand/VIDSLOOM_Logo.png" alt="VIDSLOOM logo" width={50} height={50} priority unoptimized />
          <div>
            <p className="eyebrow">VIDSLOOM QA</p>
            <h1>Workspace Login</h1>
          </div>
        </div>

        <p className="loginCopy">
          Sign in to review the campaign engine, generate test campaign packs, and inspect the approval workflow.
        </p>

        {errorMessage ? <p className="errorLine">{errorMessage}</p> : null}
        {!configured ? <p className="errorLine">Ask the operator to configure the QA username and password.</p> : null}

        <form className="loginForm" action="/api/auth/login" method="post">
          <input name="next" type="hidden" value={next} />
          <label className="field">
            <span>Username</span>
            <input name="username" autoComplete="username" required disabled={!configured} />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required disabled={!configured} />
          </label>
          <button className="primaryButton" type="submit" disabled={!configured}>
            <LockKeyhole size={18} />
            Sign in
          </button>
        </form>

        <Link className="loginBackLink" href="/">
          Back to public site
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
