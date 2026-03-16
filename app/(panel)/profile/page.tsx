import { ProfileDetails } from "./profile-details";
import { ChangePasswordForm } from "./change-password-form";

export default function ProfilePage() {
    return (
        <>
            <div className="space-y-8 mt-6">
                <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(26,97,255,0.08)] text-[#1a61ff]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">Basic Information</h2>
                            <p className="text-xs text-[#60708d]">Your organization&apos;s registered details.</p>
                        </div>
                    </div>
                    <ProfileDetails />
                </section>

                <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(255,149,0,0.08)] text-[#ff9500]">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">Security</h2>
                            <p className="text-xs text-[#60708d]">Update your account password.</p>
                        </div>
                    </div>
                    <ChangePasswordForm />
                </section>
            </div>
        </>
    );
}
