import Link from "next/link";
import { LogIn } from "lucide-react";

type SiteHeaderProps = {
  actionHref?: string;
  actionLabel?: string;
  showAction?: boolean;
  title?: string;
  subtitle?: string;
};

export function SiteHeader({
  actionHref = "/login",
  actionLabel = "Login",
  showAction = true,
  title,
  subtitle,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(255,255,255,0.3)] bg-white/60 px-4 py-3 shadow-[0_8px_32px_rgba(16,32,68,0.06)] backdrop-blur-[12px] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between">
        <div className="flex items-center gap-3.5">
          {title ? (
            <div>
              <h1 className="m-0 text-[1.05rem] font-bold tracking-tight text-[#0f1f3a] sm:text-[1.15rem]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 hidden text-[0.7rem] font-medium text-[#5e6d8c] sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid h-[2.2rem] w-[2.2rem] place-content-center rounded-[0.7rem] bg-gradient-to-br from-[#1a61ff] to-[#6c8eff] font-semibold text-white shadow-[0_8px_16px_rgba(26,97,255,0.2)]">
                J
              </div>
              <div>
                <p className="m-0 text-[0.95rem] font-bold tracking-tight text-[#0f1f3a]">
                  juniotrack
                </p>
                <span className="mt-0.5 hidden text-[0.68rem] font-medium tracking-[0.01em] text-[#5e6d8c] sm:block">
                  School Progress For Every Parent
                </span>
              </div>
            </>
          )}
        </div>
        {showAction && (
          <Link
            className="flex items-center gap-2 rounded-full border border-[rgba(18,36,76,0.1)] bg-white/80 px-4 py-2 text-xs font-bold text-[#10203f] no-underline transition-all hover:-translate-y-px hover:border-[rgba(26,97,255,0.3)] hover:bg-white hover:shadow-[0_8px_20px_rgba(26,97,255,0.12)]"
            href={actionHref}
          >
            <LogIn size={14} strokeWidth={2.5} />
            {actionLabel}
          </Link>
        )}
      </div>
    </header>
  );
}
