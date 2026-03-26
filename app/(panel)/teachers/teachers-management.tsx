"use client";

import { useState } from "react";
import { AddTeacherForm } from "./add-teacher-form";
import { TeachersUploadCsv } from "./teachers-upload-csv";

type TeachersTab = "add-teacher" | "upload-csv";

export function TeachersManagement() {
    const [tab, setTab] = useState<TeachersTab>("add-teacher");

    return (
        <div className="mt-6">
            <section className="rounded-3xl border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                    Teachers
                </h2>
                <p className="mt-1 text-sm text-[#60708d]">
                    Add individual teachers or upload teachers via CSV.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setTab("add-teacher")}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                            tab === "add-teacher"
                                ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                                : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                        }`}
                    >
                        Add Teacher
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("upload-csv")}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                            tab === "upload-csv"
                                ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                                : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                        }`}
                    >
                        Teachers Upload CSV
                    </button>
                </div>

                {tab === "add-teacher" ? <AddTeacherForm /> : <TeachersUploadCsv />}
            </section>
        </div>
    );
}
