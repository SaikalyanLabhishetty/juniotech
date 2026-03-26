"use client";

import { useState } from "react";
import { AddStudentForm } from "./add-student-form";
import { StudentsUploadCsv } from "./students-upload-csv";

type StudentsTab = "add-student" | "upload-csv";

export function StudentsManagement() {
    const [tab, setTab] = useState<StudentsTab>("add-student");

    return (
        <div className="mt-6">
            <section className="rounded-3xl border border-[rgba(18,36,76,0.08)] bg-white/90 p-6 shadow-[0_16px_40px_rgba(16,32,68,0.06)] backdrop-blur-[6px] sm:p-8">
                <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0f1f3a]">
                    Students
                </h2>
                <p className="mt-1 text-sm text-[#60708d]">
                    Add individual students or upload students via CSV.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setTab("add-student")}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                            tab === "add-student"
                                ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                                : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                        }`}
                    >
                        Add Student
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
                        Students Upload CSV
                    </button>
                </div>

                {tab === "add-student" ? <AddStudentForm /> : <StudentsUploadCsv />}
            </section>
        </div>
    );
}
