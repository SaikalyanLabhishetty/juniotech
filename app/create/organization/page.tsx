import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = {
  title: "Create Organization | juniotrack",
  description:
    "Create a new organization profile with admin contact, location, and password details.",
};

export default function CreateOrganizationPage() {
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

      <main className="relative z-[3] mx-auto mt-10 w-full max-w-[760px] px-4 sm:px-6 lg:px-10 xl:px-0">
        <section className="rounded-[2rem] border border-white/80 bg-white/88 p-6 shadow-[0_24px_60px_rgba(16,32,68,0.1)] backdrop-blur-[10px] sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1a61ff]">
              Create Organization
            </p>
            <h1 className="mt-2 text-[clamp(1.9rem,3vw,2.6rem)] font-semibold tracking-[-0.03em]">
              Enter organization details
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#60708d]">
              Fill the required fields below to create the organization
              account.
            </p>
          </div>
          <OrganizationForm />
        </section>
      </main>
    </div>
  );
}
