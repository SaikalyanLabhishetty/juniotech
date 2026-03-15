"use client";

import { useState } from "react";
import { AddUserForm } from "./add-user-form";
import { UsersTable } from "./users-table";

const tabs = [
    { key: "add", label: "Add Users" },
    { key: "teachers", label: "Teachers" },
    { key: "parents", label: "Parents" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function UsersTabs() {
    const [activeTab, setActiveTab] = useState<TabKey>("add");

    return (
        <div className="mt-6">
            <div className="flex gap-1 rounded-[1rem] border border-[rgba(18,36,76,0.08)] bg-[#f2f6fc] p-1">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`rounded-[0.75rem] px-5 py-2.5 text-sm font-semibold transition-all ${activeTab === tab.key
                                ? "bg-white text-[#1a61ff] shadow-[0_2px_8px_rgba(16,32,68,0.08)]"
                                : "text-[#5e6d8c] hover:text-[#243552]"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="mt-6">
                {activeTab === "add" && (
                    <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                            Add New User
                        </h2>
                        <p className="mt-1 text-sm text-[#60708d]">
                            Fill in the details below to create a new user account.
                        </p>
                        <AddUserForm />
                    </section>
                )}

                {activeTab === "teachers" && (
                    <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                            Teachers
                        </h2>
                        <p className="mt-1 mb-5 text-sm text-[#60708d]">
                            All teachers registered in your organization.
                        </p>
                        <UsersTable role="teacher" />
                    </section>
                )}

                {activeTab === "parents" && (
                    <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                            Parents
                        </h2>
                        <p className="mt-1 mb-5 text-sm text-[#60708d]">
                            All parents registered in your organization.
                        </p>
                        <UsersTable role="parent" />
                    </section>
                )}
            </div>
        </div>
    );
}
