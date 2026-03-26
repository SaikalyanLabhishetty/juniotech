"use client";

import { type ChangeEvent, type FormEvent, type KeyboardEvent, useMemo, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type Mode = "single" | "bulk";

type SingleClassFormData = {
    className: string;
    section: string;
    academicYear: string;
};

type BulkClassFormData = {
    count: string;
    className: string;
    sections: string[];
    sectionInput: string;
    academicYear: string;
};

type FormFieldErrors = Partial<Record<string, string>>;

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

const initialSingleFormData: SingleClassFormData = {
    className: "",
    section: "",
    academicYear: getDefaultAcademicYear(),
};

const initialBulkFormData: BulkClassFormData = {
    count: "1",
    className: "",
    sections: [],
    sectionInput: "",
    academicYear: getDefaultAcademicYear(),
};

function isValidAcademicYear(value: string) {
    const match = value.match(/^(\d{4})-(\d{4})$/);

    if (!match) {
        return false;
    }

    return Number(match[2]) === Number(match[1]) + 1;
}

function normalizeSectionInput(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9,\s]/g, "");
}

function normalizeSectionValue(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getSectionSuffix(index: number) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    if (index < alphabet.length) {
        return alphabet[index];
    }

    const first = Math.floor(index / alphabet.length) - 1;
    const second = index % alphabet.length;

    return `${alphabet[Math.max(first, 0)]}${alphabet[second]}`;
}

export function ClassesForm() {
    const [mode, setMode] = useState<Mode>("single");
    const [singleFormData, setSingleFormData] =
        useState<SingleClassFormData>(initialSingleFormData);
    const [bulkFormData, setBulkFormData] =
        useState<BulkClassFormData>(initialBulkFormData);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{
        tone: "idle" | "error" | "success";
        message: string;
    }>({
        tone: "idle",
        message: "",
    });

    const bulkCountNumber = useMemo(() => Number(bulkFormData.count), [bulkFormData.count]);
    const bulkSectionsPreview = useMemo(() => {
        const inputTokens = bulkFormData.sectionInput
            .split(",")
            .map((token) => normalizeSectionValue(token))
            .filter(Boolean);

        const combined = [...bulkFormData.sections];

        inputTokens.forEach((token) => {
            if (!combined.includes(token)) {
                combined.push(token);
            }
        });

        return combined;
    }, [bulkFormData.sectionInput, bulkFormData.sections]);
    const suggestedSectionsPreview = useMemo(() => {
        const className = bulkFormData.className.trim().toUpperCase();

        if (!className || !Number.isFinite(bulkCountNumber) || bulkCountNumber < 1) {
            return [] as string[];
        }

        const cappedCount = Math.min(bulkCountNumber, 52);

        return Array.from({ length: cappedCount }, (_, index) => {
            const suffix = getSectionSuffix(index);

            return `${className}${suffix}`;
        });
    }, [bulkCountNumber, bulkFormData.className]);

    const setModeAndReset = (nextMode: Mode) => {
        setMode(nextMode);
        setFieldErrors({});
        setStatus({ tone: "idle", message: "" });
    };

    const handleSingleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        let nextValue = value;

        if (name === "className" || name === "section") {
            nextValue = nextValue.toUpperCase();
        }

        if (name === "section") {
            nextValue = nextValue.replace(/[^A-Z]/g, "");
        }

        setSingleFormData((current) => ({
            ...current,
            [name]: nextValue,
        }));
    };

    const handleBulkChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;

        if (name === "count") {
            const sanitized = value.replace(/\D/g, "");
            setBulkFormData((current) => ({
                ...current,
                count: sanitized,
            }));
            return;
        }

        if (name === "className") {
            setBulkFormData((current) => ({
                ...current,
                className: value.toUpperCase(),
            }));
            return;
        }

        if (name === "sectionInput") {
            setBulkFormData((current) => ({
                ...current,
                sectionInput: normalizeSectionInput(value),
            }));
            return;
        }

        if (name === "academicYear") {
            setBulkFormData((current) => ({
                ...current,
                academicYear: value,
            }));
        }
    };

    const addSectionsFromInput = () => {
        if (!bulkFormData.sectionInput.trim()) {
            return;
        }

        const tokens = bulkFormData.sectionInput
            .split(",")
            .map((token) => normalizeSectionValue(token))
            .filter(Boolean);

        if (tokens.length === 0) {
            setBulkFormData((current) => ({
                ...current,
                sectionInput: "",
            }));
            return;
        }

        setBulkFormData((current) => {
            const nextSections = [...current.sections];
            tokens.forEach((token) => {
                if (!nextSections.includes(token)) {
                    nextSections.push(token);
                }
            });

            return {
                ...current,
                sections: nextSections,
                sectionInput: "",
            };
        });
    };

    const handleBulkSectionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            if (bulkFormData.sectionInput.trim()) {
                event.preventDefault();
                addSectionsFromInput();
            }
        }
    };

    const removeBulkSection = (section: string) => {
        setBulkFormData((current) => ({
            ...current,
            sections: current.sections.filter((item) => item !== section),
        }));
    };

    const validateSingleForm = () => {
        const errors: FormFieldErrors = {};

        if (!singleFormData.className.trim()) {
            errors.className = "Class name is required.";
        }

        if (!singleFormData.section.trim()) {
            errors.section = "Section is required.";
        }

        if (!isValidAcademicYear(singleFormData.academicYear)) {
            errors.academicYear = "Academic year must be in YYYY-YYYY format (e.g. 2025-2026).";
        }

        return errors;
    };

    const collectBulkSections = () => {
        const inputTokens = bulkFormData.sectionInput
            .split(",")
            .map((token) => normalizeSectionValue(token))
            .filter(Boolean);

        const nextSections = [...bulkFormData.sections];
        inputTokens.forEach((token) => {
            if (!nextSections.includes(token)) {
                nextSections.push(token);
            }
        });

        return nextSections;
    };

    const validateBulkForm = (sectionsOverride?: string[]) => {
        const sections = sectionsOverride ?? bulkFormData.sections;
        const errors: FormFieldErrors = {};

        if (!bulkFormData.count.trim()) {
            errors.count = "Number of classes is required.";
        } else if (!Number.isFinite(bulkCountNumber) || bulkCountNumber < 1) {
            errors.count = "Enter a valid count (minimum 1).";
        } else if (bulkCountNumber > 52) {
            errors.count = "Use a count up to 52 for readable section suggestions.";
        }

        if (!bulkFormData.className.trim()) {
            errors.className = "Class name is required.";
        }

        if (sections.length === 0) {
            errors.sections = "Add at least one section (e.g. 1A, 1B, 1C).";
        }

        if (!isValidAcademicYear(bulkFormData.academicYear)) {
            errors.academicYear = "Academic year must be in YYYY-YYYY format (e.g. 2025-2026).";
        }

        return errors;
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const bulkSections = mode === "bulk" ? collectBulkSections() : [];

        if (mode === "bulk" && bulkFormData.sectionInput.trim()) {
            setBulkFormData((current) => ({
                ...current,
                sections: bulkSections,
                sectionInput: "",
            }));
        }
        const nextErrors =
            mode === "single" ? validateSingleForm() : validateBulkForm(bulkSections);

        setFieldErrors(nextErrors);

        if (Object.values(nextErrors).some(Boolean)) {
            setStatus({
                tone: "error",
                message: "Fix the highlighted fields and submit again.",
            });
            return;
        }

        try {
            setIsSubmitting(true);

            if (mode === "single") {
                const response = await fetch("/api/organization/classes", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthorizationHeader(),
                    },
                    body: JSON.stringify(singleFormData),
                });

                const responseData = (await response.json()) as CreateClassResponse;

                if (!response.ok) {
                    setStatus({
                        tone: "error",
                        message: responseData.message || "Unable to create class.",
                    });
                    return;
                }

                setSingleFormData((current) => ({
                    ...initialSingleFormData,
                    className: current.className,
                }));
                setFieldErrors({});
                setStatus({
                    tone: "success",
                    message: responseData.message || "Class created successfully.",
                });
                return;
            }

            const className = bulkFormData.className.trim().toUpperCase();
            const sections = bulkSections.map((section) =>
                section.toUpperCase().trim(),
            );

            const payloads = sections.map((sectionValue) => {
                let resolvedClassName = className;
                let resolvedSection = sectionValue;

                if (resolvedClassName && sectionValue.startsWith(resolvedClassName)) {
                    resolvedSection = sectionValue.slice(resolvedClassName.length);
                } else if (!resolvedClassName) {
                    const match = sectionValue.match(/^([0-9A-Z]+?)([A-Z]+)$/);
                    if (match) {
                        resolvedClassName = match[1];
                        resolvedSection = match[2];
                    }
                }

                return {
                    className: resolvedClassName,
                    section: resolvedSection,
                    academicYear: bulkFormData.academicYear,
                };
            });

            const invalidPayload = payloads.find(
                (payload) =>
                    !payload.className ||
                    !payload.section ||
                    !/^[A-Z]+$/.test(payload.section),
            );

            if (invalidPayload) {
                setStatus({
                    tone: "error",
                    message:
                        "Sections must be alphabetic (A-Z). Example: 1A, 1B, 1C.",
                });
                return;
            }

            const responses = await Promise.all(
                payloads.map((payload) =>
                    fetch("/api/organization/classes", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...getAuthorizationHeader(),
                        },
                        body: JSON.stringify(payload),
                    }),
                ),
            );

            const failedIndex = responses.findIndex((response) => !response.ok);

            if (failedIndex >= 0) {
                const responseData = (await responses[failedIndex].json()) as CreateClassResponse;
                setStatus({
                    tone: "error",
                    message: responseData.message || "Unable to create all classes.",
                });
                return;
            }

            setBulkFormData((current) => ({
                ...initialBulkFormData,
                className: current.className,
                academicYear: current.academicYear,
            }));
            setFieldErrors({});
            setStatus({
                tone: "success",
                message: "Classes created successfully.",
            });
        } catch {
            setStatus({
                tone: "error",
                message: "Network error while creating classes.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setModeAndReset("single")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${mode === "single"
                        ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                        : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                        }`}
                >
                    Add Single Class
                </button>
                <button
                    type="button"
                    onClick={() => setModeAndReset("bulk")}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${mode === "bulk"
                        ? "bg-[#1a61ff] text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)]"
                        : "border border-[rgba(18,36,76,0.12)] bg-white text-[#48566f] hover:text-[#1a61ff]"
                        }`}
                >
                    Add Bulk Classes
                </button>
            </div>

            {mode === "single" ? (
                <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-[0.82rem] font-bold tracking-tight text-[#4a5a7a]">
                        Class Name
                        <input
                            className={inputClassName}
                            name="className"
                            type="text"
                            value={singleFormData.className}
                            onChange={handleSingleChange}
                            placeholder="Example: 5"
                            required
                        />
                        {fieldErrors.className ? (
                            <p className={errorTextClassName}>{fieldErrors.className}</p>
                        ) : null}
                    </label>

                    <label className="block text-[0.82rem] font-bold tracking-tight text-[#4a5a7a]">
                        Section
                        <input
                            className={inputClassName}
                            name="section"
                            type="text"
                            value={singleFormData.section}
                            onChange={handleSingleChange}
                            placeholder="Example: A"
                            maxLength={3}
                            required
                        />
                        {fieldErrors.section ? (
                            <p className={errorTextClassName}>{fieldErrors.section}</p>
                        ) : null}
                    </label>

                    <label className="block text-[0.82rem] font-bold tracking-tight text-[#4a5a7a] sm:col-span-2">
                        Academic Year
                        <input
                            className={inputClassName}
                            name="academicYear"
                            type="text"
                            value={singleFormData.academicYear}
                            onChange={handleSingleChange}
                            placeholder="2025-2026"
                            required
                        />
                        {fieldErrors.academicYear ? (
                            <p className={errorTextClassName}>{fieldErrors.academicYear}</p>
                        ) : null}
                    </label>
                </div>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-[0.82rem] font-bold tracking-tight text-[#4a5a7a]">
                        Step 1: Class Name
                        <input
                            className={inputClassName}
                            name="className"
                            type="text"
                            value={bulkFormData.className}
                            onChange={handleBulkChange}
                            placeholder="Example: 1"
                            required
                        />
                        {fieldErrors.className ? (
                            <p className={errorTextClassName}>{fieldErrors.className}</p>
                        ) : (
                            <p className="mt-2 text-[0.7rem] font-medium text-[#8a96ad]">
                                Example: 1, 2, 3, 10, NURSERY
                            </p>
                        )}
                    </label>

                    <label className="block text-[0.82rem] font-bold tracking-tight text-[#4a5a7a]">
                        Step 2: Count (for section preview)
                        <input
                            className={inputClassName}
                            name="count"
                            type="text"
                            value={bulkFormData.count}
                            onChange={handleBulkChange}
                            placeholder="Example: 5"
                            inputMode="numeric"
                            required
                        />
                        {fieldErrors.count ? (
                            <p className={errorTextClassName}>{fieldErrors.count}</p>
                        ) : (
                            <p className="mt-2 text-[0.7rem] font-medium text-[#8a96ad]">
                                Example: class name 5 with count 5 suggests 5A, 5B, 5C, 5D, 5E.
                            </p>
                        )}
                    </label>

                    <div className="sm:col-span-2 rounded-[1rem] border border-[rgba(18,36,76,0.1)] bg-[#f8fbff] p-4">
                        <p className="text-[0.75rem] font-bold uppercase tracking-[0.06em] text-[#5e6d8c]">
                            Suggested by count
                        </p>
                        <p className="mt-1 text-[0.8rem] text-[#60708d]">
                            Use this as reference before entering sections.
                        </p>
                        {suggestedSectionsPreview.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {suggestedSectionsPreview.map((suggestedValue) => (
                                    <span
                                        key={suggestedValue}
                                        className="inline-flex items-center rounded-full border border-[rgba(18,36,76,0.12)] bg-white px-3 py-1 text-[0.75rem] font-semibold text-[#3c4d6c]"
                                    >
                                        {suggestedValue}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-3 text-[0.75rem] font-medium text-[#8a96ad]">
                                Enter class name and count to see suggestions.
                            </p>
                        )}
                    </div>

                    <label className="block text-[0.82rem] font-bold tracking-tight text-[#4a5a7a] sm:col-span-2">
                        Step 3: Sections (Press Enter or use comma)
                        <input
                            className={inputClassName}
                            name="sectionInput"
                            type="text"
                            value={bulkFormData.sectionInput}
                            onChange={handleBulkChange}
                            onBlur={addSectionsFromInput}
                            onKeyDown={handleBulkSectionKeyDown}
                            placeholder="Example: A, B, C"
                        />
                        {!fieldErrors.sections ? (
                            <p className="mt-2 text-[0.7rem] font-medium text-[#8a96ad]">
                                You can enter section letters only (A, B, C) or combined values (1A, 1B).
                            </p>
                        ) : null}
                        {bulkFormData.sections.length > 0 ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {bulkFormData.sections.map((section) => (
                                    <span
                                        key={section}
                                        className="inline-flex items-center gap-2 rounded-xl bg-[rgba(26,97,255,0.08)] border border-[rgba(26,97,255,0.12)] px-3 py-1.5 text-[0.75rem] font-bold text-[#1a61ff]"
                                    >
                                        {section}
                                        <button
                                            type="button"
                                            onClick={() => removeBulkSection(section)}
                                            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-[rgba(26,97,255,0.1)] text-[#1a61ff] transition hover:bg-[rgba(255,71,71,0.1)] hover:text-[#ff4747]"
                                            aria-label={`Remove ${section}`}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {bulkSectionsPreview.length > 0 && bulkFormData.className.trim() ? (
                            <>
                                <p className="mt-3 text-[0.75rem] font-semibold text-[#5e6d8c]">
                                    Will be created from entered sections:
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {bulkSectionsPreview.map((section) => (
                                        <span
                                            key={section}
                                            className="inline-flex items-center rounded-full border border-[rgba(26,97,255,0.16)] bg-white px-3 py-1 text-[0.75rem] font-semibold text-[#1a61ff]"
                                        >
                                            {bulkFormData.className.toUpperCase()} - {section}
                                        </span>
                                    ))}
                                </div>
                            </>
                        ) : null}
                        {fieldErrors.sections ? (
                            <p className={errorTextClassName}>{fieldErrors.sections}</p>
                        ) : null}
                    </label>

                    <label className="block text-[0.82rem] font-bold tracking-tight text-[#4a5a7a] sm:col-span-2">
                        Academic Year
                        <input
                            className={inputClassName}
                            name="academicYear"
                            type="text"
                            value={bulkFormData.academicYear}
                            onChange={handleBulkChange}
                            placeholder="2025-2026"
                            required
                        />
                        {fieldErrors.academicYear ? (
                            <p className={errorTextClassName}>{fieldErrors.academicYear}</p>
                        ) : null}
                    </label>
                </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-[#1a61ff] px-8 py-3.5 text-xs font-bold text-white shadow-[0_12px_24px_rgba(26,97,255,0.25)] transition-all hover:-translate-y-0.5 hover:bg-[#114fe0] hover:shadow-[0_18px_32px_rgba(26,97,255,0.3)] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        {isSubmitting ? (
                            <>
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 transition-transform group-hover:scale-110">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                                {mode === "single" ? "Create Class" : "Create Classes"}
                            </>
                        )}
                    </span>
                </button>
            </div>

            {status.message ? (
                <div
                    className={`rounded-2xl border px-5 py-4 text-[0.85rem] font-medium transition-all animate-in fade-in slide-in-from-top-2 ${status.tone === "error"
                        ? "border-[#f3c3c3] bg-[#fff5f5] text-[#a23232]"
                        : "border-[#bddfc7] bg-[#f3fff6] text-[#20683c]"
                        }`}
                    aria-live="polite"
                >
                    <div className="flex items-center gap-2.5">
                        {status.tone === "error" ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        )}
                        {status.message}
                    </div>
                </div>
            ) : null}
        </form>
    );
}
