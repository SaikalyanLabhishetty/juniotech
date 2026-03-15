"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type TeacherOption = {
    uid: string;
    name: string;
    email: string;
};

type CreateClassFormData = {
    className: string;
    section: string;
    teacherId: string;
    academicYear: string;
};

type FormFieldErrors = Partial<Record<keyof CreateClassFormData, string>>;

type CreateClassResponse = {
    message?: string;
    fieldErrors?: FormFieldErrors;
};

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";

function getDefaultAcademicYear() {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
}

const initialFormData: CreateClassFormData = {
    className: "",
    section: "",
    teacherId: "",
    academicYear: getDefaultAcademicYear(),
};

function validateField(
    name: keyof CreateClassFormData,
    value: string,
): string | undefined {
    if (name === "className" && !value.trim()) {
        return "Class name is required.";
    }

    if (name === "section" && !/^[A-Z]+$/.test(value)) {
        return "Section must contain only alphabets (A-Z).";
    }

    if (name === "teacherId" && !value.trim()) {
        return "Class teacher is required.";
    }

    if (name === "academicYear") {
        const match = value.match(/^(\d{4})-(\d{4})$/);

        if (!match || Number(match[2]) !== Number(match[1]) + 1) {
            return "Academic year must be in YYYY-YYYY format (e.g. 2025-2026).";
        }
    }

    return undefined;
}

export function CreateClassForm() {
    const [formData, setFormData] = useState<CreateClassFormData>(initialFormData);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
    const [teachers, setTeachers] = useState<TeacherOption[]>([]);
    const [status, setStatus] = useState<{
        tone: "idle" | "error" | "success";
        message: string;
    }>({
        tone: "idle",
        message: "",
    });

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                setIsLoadingTeachers(true);

                const response = await fetch("/api/organization/users?role=teacher", {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                });

                if (!response.ok) {
                    const data = (await response.json()) as { message?: string };
                    setStatus({
                        tone: "error",
                        message: data.message || "Unable to load teachers.",
                    });
                    return;
                }

                const data = (await response.json()) as {
                    users: Array<{ uid: string; name: string; email: string }>;
                };

                setTeachers(data.users);
            } catch {
                setStatus({
                    tone: "error",
                    message: "Network error while loading teachers.",
                });
            } finally {
                setIsLoadingTeachers(false);
            }
        };

        fetchTeachers();
    }, []);

    const handleChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = event.target;
        const fieldName = name as keyof CreateClassFormData;
        let nextValue = value;

        if (fieldName === "className" || fieldName === "section") {
            nextValue = nextValue.toUpperCase();
        }

        if (fieldName === "section") {
            nextValue = nextValue.replace(/[^A-Z]/g, "");
        }

        setFormData((current) => ({
            ...current,
            [fieldName]: nextValue,
        }));

        setFieldErrors((current) => ({
            ...current,
            [fieldName]: validateField(fieldName, nextValue),
        }));

        if (status.tone !== "idle") {
            setStatus({ tone: "idle", message: "" });
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextFieldErrors: FormFieldErrors = {
            className: validateField("className", formData.className),
            section: validateField("section", formData.section),
            teacherId: validateField("teacherId", formData.teacherId),
            academicYear: validateField("academicYear", formData.academicYear),
        };

        setFieldErrors(nextFieldErrors);

        if (Object.values(nextFieldErrors).some(Boolean)) {
            setStatus({
                tone: "error",
                message: "Fix the highlighted fields and submit again.",
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const response = await fetch("/api/organization/classes", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify(formData),
            });

            const responseData = (await response.json()) as CreateClassResponse;

            if (!response.ok) {
                if (responseData.fieldErrors) {
                    setFieldErrors((current) => ({
                        ...current,
                        ...responseData.fieldErrors,
                    }));
                }

                setStatus({
                    tone: "error",
                    message: responseData.message || "Unable to create class.",
                });
                return;
            }

            setFormData((current) => ({
                ...initialFormData,
                teacherId: current.teacherId,
            }));
            setFieldErrors({});
            setStatus({
                tone: "success",
                message: responseData.message || "Class created successfully.",
            });
        } catch {
            setStatus({
                tone: "error",
                message: "Network error while creating class.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#243552]">
                    Class Name
                    <input
                        className={inputClassName}
                        name="className"
                        type="text"
                        value={formData.className}
                        onChange={handleChange}
                        placeholder="Example: 5"
                        required
                    />
                    {fieldErrors.className ? (
                        <p className={errorTextClassName}>{fieldErrors.className}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Section
                    <input
                        className={inputClassName}
                        name="section"
                        type="text"
                        value={formData.section}
                        onChange={handleChange}
                        placeholder="Example: A"
                        maxLength={3}
                        required
                    />
                    {fieldErrors.section ? (
                        <p className={errorTextClassName}>{fieldErrors.section}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Class Teacher
                    <select
                        className={inputClassName}
                        name="teacherId"
                        value={formData.teacherId}
                        onChange={handleChange}
                        required
                        disabled={isLoadingTeachers}
                    >
                        <option value="">
                            {isLoadingTeachers ? "Loading teachers..." : "Select teacher"}
                        </option>
                        {teachers.map((teacher) => (
                            <option key={teacher.uid} value={teacher.uid}>
                                {teacher.name} ({teacher.email})
                            </option>
                        ))}
                    </select>
                    {fieldErrors.teacherId ? (
                        <p className={errorTextClassName}>{fieldErrors.teacherId}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Academic Year
                    <input
                        className={inputClassName}
                        name="academicYear"
                        type="text"
                        value={formData.academicYear}
                        onChange={handleChange}
                        placeholder="2025-2026"
                        required
                    />
                    {fieldErrors.academicYear ? (
                        <p className={errorTextClassName}>{fieldErrors.academicYear}</p>
                    ) : null}
                </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting || isLoadingTeachers}
                    className="inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                >
                    {isSubmitting ? "Creating..." : "Create Class"}
                </button>
            </div>

            {status.message ? (
                <p
                    className={`rounded-2xl border px-4 py-3 text-sm ${status.tone === "error"
                        ? "border-[#f3c3c3] bg-[#fff5f5] text-[#a23232]"
                        : "border-[#bddfc7] bg-[#f3fff6] text-[#20683c]"
                        }`}
                    aria-live="polite"
                >
                    {status.message}
                </p>
            ) : null}
        </form>
    );
}
