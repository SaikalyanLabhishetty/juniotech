"use client";

import { type FormEvent, useState } from "react";

export function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{ tone: "idle" | "error" | "success"; message: string }>({
        tone: "idle",
        message: "",
    });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setStatus({ tone: "error", message: "New passwords do not match." });
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await fetch("/api/organization/profile/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || "Failed to update password");
            }

            setStatus({ tone: "success", message: "Password updated successfully!" });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err) {
            setStatus({ tone: "error", message: err instanceof Error ? err.message : "An error occurred." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)]";

    return (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium text-[#243552]">
                    Current Password
                    <input
                        type="password"
                        className={inputClass}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                    />
                </label>
                <label className="block text-sm font-medium text-[#243552]">
                    New Password
                    <input
                        type="password"
                        className={inputClass}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                    />
                </label>
                <label className="block text-sm font-medium text-[#243552]">
                    Confirm New Password
                    <input
                        type="password"
                        className={inputClass}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                    />
                </label>
            </div>

            <div className="flex items-center justify-between pt-2">
                {status.message && (
                    <p className={`text-sm font-medium ${status.tone === "error" ? "text-[#b42318]" : "text-[#20683c]"}`}>
                        {status.message}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="ml-auto inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(26,97,255,0.16)] transition hover:bg-[#114fe0] disabled:bg-[#7aa5ff]"
                >
                    {isSubmitting ? "Updating..." : "Update Password"}
                </button>
            </div>
        </form>
    );
}
