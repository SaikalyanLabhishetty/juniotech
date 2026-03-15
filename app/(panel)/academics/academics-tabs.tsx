"use client";

import { useState } from "react";
import { AddStudentForm } from "./add-student-form";
import { CreateClassForm } from "./create-class-form";

const tabs = [
    { key: "create-class", label: "Create Class" },
    { key: "add-students", label: "Add Students" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function AcademicsTabs() {
    const [activeTab, setActiveTab] = useState<TabKey>("create-class");

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
                {activeTab === "create-class" ? (
                    <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                            Create Class
                        </h2>
                        <p className="mt-1 text-sm text-[#60708d]">
                            Add a class and assign a class teacher.
                        </p>
                        <CreateClassForm />
                    </section>
                ) : (
                    <section className="rounded-[1.5rem] border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                            Add Students
                        </h2>
                        <p className="mt-1 text-sm text-[#60708d]">
                            Add students to an existing class.
                        </p>
                        <AddStudentForm />
                    </section>
                )}
            </div>
        </div>
    );
}
