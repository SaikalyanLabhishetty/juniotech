import type { Metadata } from "next";
import Image from "next/image";
import { SiteHeader } from "../components/site-header";
import { OrganizationLoginForm } from "./organization-login-form";

const highlights = [
  "Access your organization workspace with the registered admin email.",
  "Continue managing school updates, records, and day-to-day operations.",
  "Your session is stored in a secure access token cookie for 7 days.",
];

export const metadata: Metadata = {
  title: "Organization Admin Login | juniotrack",
  description:
    "Login for organization admins using email and password to access juniotrack.",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#edf3ff] via-[#f8fbff] to-[#eef7ff] pb-14 pt-0 text-[#0f1f3a]">
      <div
        className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(15,31,58,0.035)_0.8px,transparent_0.8px)] [background-size:3px_3px]"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="absolute -right-20 top-0 h-72 w-72 rounded-full [background:radial-gradient(circle_at_30%_30%,rgba(70,156,255,0.55),rgba(70,156,255,0.1))]" />
        <span className="absolute bottom-[-70px] left-[-30px] h-64 w-64 rounded-full [background:radial-gradient(circle_at_30%_30%,rgba(89,217,200,0.45),rgba(89,217,200,0.08))]" />
      </div>

      <SiteHeader />

      <main className="relative z-[3] mx-auto mt-10 w-full max-w-[1160px] px-4 sm:px-6 lg:px-10 xl:px-0">
        <section className="grid gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="h-full overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.48)] bg-[linear-gradient(145deg,rgba(17,69,202,0.96),rgba(31,104,255,0.86))] p-8 text-white shadow-[0_30px_60px_rgba(13,51,145,0.24)] sm:p-10">
            <p className="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white/90">
              Organization Access
            </p>
            <h1 className="mt-5 max-w-[12ch] text-[clamp(2rem,4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
              Admin control with a focused sign-in flow.
            </h1>
            <p className="mt-4 max-w-[44ch] text-sm leading-6 text-[rgba(237,244,255,0.9)] sm:text-base">
              Keep the left and right split layout while giving organization
              admins a clean place to login and continue their work.
            </p>

            <div className="mt-8 space-y-3">
              {highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-[1.1rem] border border-white/14 bg-white/10 px-4 py-3 text-sm leading-6 text-white/92 backdrop-blur-sm"
                >
                  {highlight}
                </div>
              ))}
            </div>
          </div>

          <div className="h-full rounded-[2rem] border border-white/80 bg-white/88 p-6 shadow-[0_24px_60px_rgba(16,32,68,0.1)] backdrop-blur-[10px] sm:p-8 lg:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1a61ff]">
              Organization Access
            </p>
            <h2 className="mt-2 text-[clamp(1.9rem,3vw,2.6rem)] font-semibold tracking-[-0.03em] text-[#0f1f3a]">
              Admin Login
            </h2>
            <p className="mt-3 max-w-[38ch] text-sm leading-6 text-[#60708d]">
              Login with your organization admin email and password.
            </p>

            <OrganizationLoginForm />
          </div>
        </section>
      </main>
    </div>
  );
}
