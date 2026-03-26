"use client";

import { Upload } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { getAuthorizationHeader, getStoredAccessTokenPayload } from "@/lib/client-auth";

type ClassOption = {
    uid: string;
    className: string;
    section: string;
    academicYear: string;
};

type UploadError = {
    rowNumber: number;
    lineNumber: number;
    column: string;
    message: string;
    value: string;
};

type BulkUploadResponse = {
    message?: string;
    insertedCount?: number;
    failedCount?: number;
    results?: Array<{
        index: number;
        success: boolean;
        fieldErrors?: Record<string, string>;
        message?: string;
    }>;
};

type PublicSheetResponse = {
    message?: string;
    csvText?: string;
};

type OrganizationProfileResponse = {
    message?: string;
    organization?: {
        schools?: Array<{
            uid?: string;
            subjects?: string[];
        }>;
    };
};

type CsvRow = {
    lineNumber: number;
    values: Record<string, string>;
};

type PreparedTeacher = {
    rowNumber: number;
    lineNumber: number;
    payload: {
        name: string;
        phone: string;
        dob: string;
        classIds: string[];
        classTeacherClassId: string;
        subjects: string[];
        isClassTeacher: boolean;
    };
    source: Record<string, string>;
};

const requiredHeaders = [
    "name",
    "phone",
    "dob",
    "classes",
    "subjects",
    "isclassteacher",
    "classteacherclass",
];

const sampleCsv = [
    "name,phone,dob,classes,subjects,isClassTeacher,classTeacherClass",
    "Ravi Kumar,9876543210,2010-05-12,5-A|5-B,Mathematics|Science,true,5-A",
    "Sana Begum,9123456780,2011-08-23,6-A,English|Social Science,false,",
].join("\n");

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

function normalizeHeader(value: string) {
    return value.trim().toLowerCase();
}

function normalizeCell(value: string) {
    return value.trim();
}

function parseBoolean(value: string) {
    const normalized = value.trim().toLowerCase();

    return normalized === "true" || normalized === "yes" || normalized === "1";
}

function splitPipeValues(value: string) {
    return value
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeClassLabel(value: string) {
    const compact = value.trim().toUpperCase().replace(/\s+/g, "");

    if (!compact) {
        return "";
    }

    const hyphenNormalized = compact.replace(/-+/g, "-");

    if (hyphenNormalized.includes("-")) {
        return hyphenNormalized;
    }

    const match = hyphenNormalized.match(/^([0-9A-Z]+)([A-Z])$/);

    if (match) {
        return `${match[1]}-${match[2]}`;
    }

    return hyphenNormalized;
}

function parseCsv(content: string) {
    const rows: string[][] = [];
    let currentCell = "";
    let currentRow: string[] = [];
    let inQuotes = false;

    for (let index = 0; index < content.length; index += 1) {
        const char = content[index];
        const nextChar = content[index + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            currentRow.push(currentCell);
            currentCell = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && nextChar === "\n") {
                index += 1;
            }
            currentRow.push(currentCell);
            if (currentRow.some((cell) => cell.trim() !== "")) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentCell = "";
            continue;
        }

        currentCell += char;
    }

    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim() !== "")) {
        rows.push(currentRow);
    }

    if (!rows.length) {
        return {
            headers: [] as string[],
            dataRows: [] as CsvRow[],
            parseErrors: ["CSV file is empty."],
        };
    }

    const headers = rows[0].map((header) => normalizeHeader(header));
    const parseErrors: string[] = [];

    requiredHeaders.forEach((requiredHeader) => {
        if (!headers.includes(requiredHeader)) {
            parseErrors.push(`Missing required column: ${requiredHeader}`);
        }
    });

    const dataRows: CsvRow[] = rows.slice(1).map((row, rowIndex) => {
        const values: Record<string, string> = {};

        headers.forEach((header, headerIndex) => {
            values[header] = normalizeCell(row[headerIndex] || "");
        });

        return {
            lineNumber: rowIndex + 2,
            values,
        };
    });

    return {
        headers,
        dataRows,
        parseErrors,
    };
}

function triggerTextFileDownload(fileName: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
}

function createErrorCsv(errors: UploadError[]) {
    const header = "rowNumber,lineNumber,column,message,value";

    const lines = errors.map((error) => {
        const value = error.value.replaceAll('"', '""');
        const message = error.message.replaceAll('"', '""');
        const column = error.column.replaceAll('"', '""');

        return `${error.rowNumber},${error.lineNumber},"${column}","${message}","${value}"`;
    });

    return [header, ...lines].join("\n");
}

export function TeachersUploadCsv() {
    const [isClient, setIsClient] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [googleSheetUrl, setGoogleSheetUrl] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [status, setStatus] = useState<{ tone: "idle" | "error" | "success"; message: string }>({
        tone: "idle",
        message: "",
    });
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
        current: 0,
        total: 0,
    });
    const [errorRows, setErrorRows] = useState<UploadError[]>([]);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
        setStatus({ tone: "idle", message: "" });
        setErrorRows([]);
    };

    const downloadSampleCsv = () => {
        triggerTextFileDownload("teachers-sample.csv", sampleCsv, "text/csv;charset=utf-8");
    };

    const closeModal = () => {
        if (isUploading) {
            return;
        }

        setFile(null);
        setGoogleSheetUrl("");
        setStatus({ tone: "idle", message: "" });
        setBatchProgress({ current: 0, total: 0 });
        setErrorRows([]);
        setFileInputKey((current) => current + 1);
        setIsModalOpen(false);
    };

    const processCsvContent = async (csvContent: string) => {
        setIsUploading(true);
        setStatus({ tone: "idle", message: "" });
        setBatchProgress({ current: 0, total: 0 });
        setErrorRows([]);

        try {
            const [classesResponse, profileResponse] = await Promise.all([
                fetch("/api/organization/classes", {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                }),
                fetch("/api/organization/profile", {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                }),
            ]);

            if (!classesResponse.ok) {
                const data = (await classesResponse.json()) as { message?: string };
                throw new Error(data.message || "Unable to load classes for CSV mapping.");
            }

            if (!profileResponse.ok) {
                const data = (await profileResponse.json()) as { message?: string };
                throw new Error(data.message || "Unable to load school subjects for CSV mapping.");
            }

            const classesData = (await classesResponse.json()) as { classes: ClassOption[] };
            const profileData = (await profileResponse.json()) as OrganizationProfileResponse;
            const parserResult = parseCsv(csvContent);

            if (parserResult.parseErrors.length > 0) {
                setStatus({
                    tone: "error",
                    message: parserResult.parseErrors.join(" "),
                });
                return;
            }

            if (parserResult.dataRows.length === 0) {
                setStatus({
                    tone: "error",
                    message: "CSV has no teacher rows. Add at least one row below headers.",
                });
                return;
            }

            const classesMap = new Map(
                classesData.classes.map((classItem) => [
                    normalizeClassLabel(`${classItem.className}-${classItem.section}`),
                    classItem.uid,
                ]),
            );

            const schools = Array.isArray(profileData.organization?.schools)
                ? profileData.organization?.schools
                : [];
            const activeSchoolId = getStoredAccessTokenPayload()?.schoolId?.trim();
            const activeSchool = activeSchoolId
                ? schools.find((school) => (school.uid || "").trim() === activeSchoolId)
                : schools[0];
            const schoolSubjects = Array.isArray(activeSchool?.subjects)
                ? activeSchool.subjects
                : [];
            const schoolSubjectSet = new Set(
                schoolSubjects
                    .filter((subject): subject is string => typeof subject === "string")
                    .map((subject) => subject.trim()),
            );
            const schoolSubjectMap = new Map(
                Array.from(schoolSubjectSet).map((subject) => [
                    subject.toLowerCase(),
                    subject,
                ]),
            );

            const upfrontErrors: UploadError[] = [];
            const preparedTeachers: PreparedTeacher[] = parserResult.dataRows.flatMap((row, rowIndex) => {
                const name = row.values.name || "";
                const phone = row.values.phone || "";
                const dob = row.values.dob || "";
                const classValues = splitPipeValues(row.values.classes || "").map((value) =>
                    normalizeClassLabel(value),
                );
                const sourceSubjectValues = splitPipeValues(row.values.subjects || "");
                const subjectValues =
                    schoolSubjectSet.size > 0
                        ? sourceSubjectValues
                              .map((subject) => schoolSubjectMap.get(subject.toLowerCase()) || "")
                              .filter(Boolean)
                        : sourceSubjectValues;
                const isClassTeacher = parseBoolean(row.values.isclassteacher || "");
                const classTeacherClass = normalizeClassLabel(
                    row.values.classteacherclass || "",
                );

                const classIds = classValues
                    .map((classLabel) => classesMap.get(classLabel) || "")
                    .filter(Boolean);

                if (!name) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "name", message: "Name is required.", value: name });
                }
                if (!phone) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "phone", message: "Phone is required.", value: phone });
                }
                if (!dob) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "dob", message: "DOB is required.", value: dob });
                }
                if (classValues.length === 0) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "classes", message: "At least one class is required.", value: row.values.classes || "" });
                } else if (classIds.length !== classValues.length) {
                    const invalidClass = classValues.find((classLabel) => !classesMap.has(classLabel)) || "";
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "classes", message: `Class not found: ${invalidClass}`, value: row.values.classes || "" });
                }
                if (schoolSubjectSet.size > 0) {
                    const invalidSubject = sourceSubjectValues.find(
                        (subject) => !schoolSubjectMap.has(subject.toLowerCase()),
                    );

                    if (invalidSubject) {
                        upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "subjects", message: `Subject not configured for school: ${invalidSubject}`, value: row.values.subjects || "" });
                    }
                }

                const classTeacherClassId = classTeacherClass ? classesMap.get(classTeacherClass) || "" : "";

                if (isClassTeacher && !classTeacherClass) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "classTeacherClass", message: "Class teacher class is required when isClassTeacher is true.", value: row.values.classteacherclass || "" });
                }
                if (classTeacherClass && !classTeacherClassId) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "classTeacherClass", message: `Class not found: ${classTeacherClass}`, value: row.values.classteacherclass || "" });
                }

                const hasRowError = upfrontErrors.some((error) => error.rowNumber === rowIndex + 1);

                if (hasRowError) {
                    return [];
                }

                return [{
                    rowNumber: rowIndex + 1,
                    lineNumber: row.lineNumber,
                    source: row.values,
                    payload: { name, phone, dob, classIds, classTeacherClassId, subjects: subjectValues, isClassTeacher },
                }];
            });

            const BATCH_SIZE = 50;
            const batches = Array.from(
                { length: Math.ceil(preparedTeachers.length / BATCH_SIZE) },
                (_, index) => preparedTeachers.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
            );

            setBatchProgress({ current: 0, total: batches.length });

            const uploadErrors = [...upfrontErrors];
            let successCount = 0;

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
                const batch = batches[batchIndex];
                setBatchProgress({ current: batchIndex + 1, total: batches.length });

                const bulkResponse = await fetch("/api/organization/teachers/bulk", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthorizationHeader(),
                    },
                    body: JSON.stringify({ teachers: batch.map((teacher) => teacher.payload) }),
                });

                const bulkResponseBody = (await bulkResponse.json()) as BulkUploadResponse;

                if (!bulkResponse.ok || !Array.isArray(bulkResponseBody.results)) {
                    batch.forEach((teacher) => {
                        uploadErrors.push({ rowNumber: teacher.rowNumber, lineNumber: teacher.lineNumber, column: "", message: bulkResponseBody.message || "Bulk upload failed for this batch.", value: "" });
                    });
                    continue;
                }

                batch.forEach((teacher, batchRowIndex) => {
                    const result = bulkResponseBody.results?.find((item) => item.index === batchRowIndex);

                    if (result?.success) {
                        successCount += 1;
                        return;
                    }

                    const errorEntries = Object.entries(result?.fieldErrors || {});

                    if (errorEntries.length === 0) {
                        uploadErrors.push({ rowNumber: teacher.rowNumber, lineNumber: teacher.lineNumber, column: "", message: result?.message || bulkResponseBody.message || "Unknown error while creating teacher.", value: "" });
                        return;
                    }

                    errorEntries.forEach(([field, message]) => {
                        const columnMap: Record<string, string> = {
                            name: "name",
                            phone: "phone",
                            dob: "dob",
                            classIds: "classes",
                            subjects: "subjects",
                            classTeacherClassId: "classTeacherClass",
                            isClassTeacher: "isClassTeacher",
                        };
                        const column = columnMap[field] || field;
                        const sourceKey = column.toLowerCase();

                        uploadErrors.push({ rowNumber: teacher.rowNumber, lineNumber: teacher.lineNumber, column, message, value: teacher.source[sourceKey] || "" });
                    });
                });
            }

            setErrorRows(uploadErrors);

            if (uploadErrors.length > 0) {
                const errorCsv = createErrorCsv(uploadErrors);
                triggerTextFileDownload("teachers-upload-errors.csv", errorCsv, "text/csv;charset=utf-8");
                setStatus({
                    tone: "error",
                    message: `Uploaded ${successCount} teachers. ${uploadErrors.length} validation issue(s) found. Download error CSV for details.`,
                });
                return;
            }

            setStatus({
                tone: "success",
                message: `Uploaded ${successCount} teachers successfully in ${batches.length || 1} batch call(s).`,
            });
        } catch (error) {
            setStatus({
                tone: "error",
                message: error instanceof Error ? error.message : "Failed to upload CSV.",
            });
        } finally {
            setIsUploading(false);
        }
    };

    const uploadCsv = async () => {
        if (!file) {
            setStatus({ tone: "error", message: "Select a CSV file first." });
            return;
        }

        const csvContent = await file.text();
        await processCsvContent(csvContent);
    };

    const importGoogleSheet = async () => {
        if (!googleSheetUrl.trim()) {
            setStatus({ tone: "error", message: "Enter a public Google Sheet URL first." });
            return;
        }

        try {
            setIsUploading(true);
            setStatus({ tone: "idle", message: "" });
            setBatchProgress({ current: 0, total: 0 });
            setErrorRows([]);

            const response = await fetch("/api/google-sheets/public", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: googleSheetUrl,
                }),
            });
            const responseData = (await response.json()) as PublicSheetResponse;

            if (!response.ok || !responseData.csvText) {
                setStatus({
                    tone: "error",
                    message:
                        responseData.message ||
                        "Unable to import the public Google Sheet.",
                });
                setIsUploading(false);
                return;
            }

            await processCsvContent(responseData.csvText);
        } catch (error) {
            setStatus({
                tone: "error",
                message:
                    error instanceof Error ? error.message : "Failed to import Google Sheet.",
            });
            setIsUploading(false);
        }
    };

    const statusClassName = useMemo(() => {
        if (status.tone === "error") {
            return "border-[#f3c3c3] bg-[#fff5f5] text-[#a23232]";
        }

        if (status.tone === "success") {
            return "border-[#bddfc7] bg-[#f3fff6] text-[#20683c]";
        }

        return "";
    }, [status.tone]);

    return (
        <div className="mt-6">
            <div
                className="rounded-2xl border-2 border-dashed border-[rgba(18,36,76,0.18)] bg-[#f8fbff] p-8 text-center"
                role="button"
                tabIndex={0}
                onClick={() => setIsModalOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setIsModalOpen(true);
                    }
                }}
            >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(26,97,255,0.12)] text-[#1a61ff]">
                    <Upload className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-semibold text-[#243552]">Upload from computer</p>
                <p className="mt-1 text-xs text-[#60708d]">
                    Click to open CSV upload modal for teachers.
                </p>
            </div>

            {isModalOpen && isClient
                ? createPortal(
                <div className="fixed inset-0 z-200 flex items-center justify-center bg-[rgba(15,23,42,0.52)] p-4">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(16,32,68,0.25)] sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-semibold text-[#0f1f3a]">Teachers CSV Upload</h3>
                                <p className="mt-1 text-sm text-[#60708d]">
                                    Upload teachers in batches of 50 records per call.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={isUploading}
                                className="rounded-full border border-[rgba(18,36,76,0.12)] px-3 py-1 text-xs font-semibold text-[#42506a] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed"
                            >
                                Close
                            </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-[rgba(18,36,76,0.1)] bg-[#f8fbff] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#5e6d8c]">Sample CSV</p>
                                <button
                                    type="button"
                                    onClick={downloadSampleCsv}
                                    className="rounded-full border border-[rgba(18,36,76,0.12)] bg-white px-4 py-1.5 text-xs font-semibold text-[#1a61ff] transition hover:bg-[#f2f7ff]"
                                >
                                    Download Sample CSV
                                </button>
                            </div>
                            <pre className="mt-3 overflow-x-auto rounded-xl bg-white p-3 text-xs leading-5 text-[#354564]">
{sampleCsv}
                            </pre>
                            <p className="mt-3 text-xs text-[#60708d]">
                                Note: Class values are flexible. You can enter <span className="font-semibold">5-A</span> as <span className="font-semibold">5-a</span>, <span className="font-semibold">5a</span>, or <span className="font-semibold">5A</span>. Subject names are case-insensitive, so <span className="font-semibold">Hindi</span> can be entered as <span className="font-semibold">hindi</span>.
                            </p>
                        </div>

                        <label className="mt-5 block text-sm font-medium text-[#243552]">
                            Public Google Sheet URL
                            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <input
                                    className={`${inputClassName} mt-0`}
                                    type="url"
                                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=0#gid=0"
                                    value={googleSheetUrl}
                                    onChange={(event) => setGoogleSheetUrl(event.target.value)}
                                    disabled={isUploading}
                                />
                                <button
                                    type="button"
                                    onClick={importGoogleSheet}
                                    disabled={isUploading}
                                    className="inline-flex min-w-55 items-center justify-center rounded-full border border-[rgba(26,97,255,0.18)] bg-[#eef4ff] px-6 py-3 text-sm font-semibold text-[#1a61ff] transition hover:-translate-y-px hover:bg-[#e3edff] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isUploading ? "Importing..." : "Import"}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-[#60708d]">
                                Make sure the sheet is public and viewable by anyone with the link.
                            </p>
                        </label>

                        <label className="mt-5 block text-sm font-medium text-[#243552]">
                            CSV File
                            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <input
                                    key={fileInputKey}
                                    className={`${inputClassName} mt-0`}
                                    type="file"
                                    accept=".csv,text/csv"
                                    onChange={handleFileSelection}
                                    disabled={isUploading}
                                />
                                <button
                                    type="button"
                                    onClick={uploadCsv}
                                    disabled={isUploading}
                                    className="inline-flex min-w-55 items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                                >
                                    {isUploading ? "Uploading..." : "Upload CSV"}
                                </button>
                            </div>
                            {file ? (
                                <p className="mt-2 text-xs font-medium text-[#5e6d8c]">Selected: {file.name}</p>
                            ) : null}
                        </label>

                        {batchProgress.total > 0 ? (
                            <p className="mt-3 text-xs font-medium text-[#5e6d8c]">
                                Uploading batch {batchProgress.current} of {batchProgress.total}
                            </p>
                        ) : null}

                        {status.message ? (
                            <p className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusClassName}`}>
                                {status.message}
                            </p>
                        ) : null}
                    </div>
                </div>,
                document.body,
            )
                : null}
        </div>
    );
}
