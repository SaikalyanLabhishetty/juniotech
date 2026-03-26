"use client";

import { Upload } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type ClassOption = {
    uid: string;
    className: string;
    section: string;
    academicYear: string;
};

type CsvRow = {
    lineNumber: number;
    values: Record<string, string>;
};

type UploadError = {
    rowNumber: number;
    lineNumber: number;
    column: string;
    message: string;
    value: string;
};

type PreparedStudent = {
    rowNumber: number;
    lineNumber: number;
    payload: {
        name: string;
        classId: string;
        dob: string;
        enrollmentNumber: string;
        parentName: string;
        parentPhone: string;
        parentEmail: string;
        address: string;
    };
    source: Record<string, string>;
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

const requiredHeaders = [
    "name",
    "class",
    "dob",
    "enrollmentnumber",
    "parentname",
    "parentphone",
    "parentemail",
    "address",
];

const sampleCsv = [
    "name,class,dob,enrollmentNumber,parentName,parentPhone,parentEmail,address",
    "Aarav Sharma,5-a,2012-07-16,ENR-5001,Rakesh Sharma,9876543210,rakesh.sharma@example.com,\"Flat 12, Green Residency, Hyderabad\"",
    "Sana Khan,6B,2011-11-04,ENR-6002,Salma Khan,9123456780,salma.khan@example.com,\"H.No 4-2-10, Hanamkonda, Warangal\"",
].join("\n");

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

function normalizeHeader(value: string) {
    return value.trim().toLowerCase();
}

function normalizeCell(value: string) {
    return value.trim();
}

function splitCsvRows(content: string) {
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

    return rows;
}

function parseCsv(content: string) {
    const rows = splitCsvRows(content);

    if (!rows.length) {
        return {
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
        dataRows,
        parseErrors,
    };
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

export function StudentsUploadCsv() {
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

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
        setStatus({ tone: "idle", message: "" });
    };

    const closeModal = () => {
        if (isUploading) {
            return;
        }

        setFile(null);
        setGoogleSheetUrl("");
        setStatus({ tone: "idle", message: "" });
        setBatchProgress({ current: 0, total: 0 });
        setFileInputKey((current) => current + 1);
        setIsModalOpen(false);
    };

    const downloadSampleCsv = () => {
        triggerTextFileDownload("students-sample.csv", sampleCsv, "text/csv;charset=utf-8");
    };

    const processCsvContent = async (csvContent: string) => {
        setIsUploading(true);
        setStatus({ tone: "idle", message: "" });
        setBatchProgress({ current: 0, total: 0 });

        try {
            const classesResponse = await fetch("/api/organization/classes", {
                headers: {
                    ...getAuthorizationHeader(),
                },
            });

            if (!classesResponse.ok) {
                const data = (await classesResponse.json()) as { message?: string };
                throw new Error(data.message || "Unable to load classes for CSV mapping.");
            }

            const classesData = (await classesResponse.json()) as { classes: ClassOption[] };
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
                    message: "CSV has no student rows. Add at least one row below headers.",
                });
                return;
            }

            const classesMap = new Map(
                classesData.classes.map((classItem) => [
                    normalizeClassLabel(`${classItem.className}-${classItem.section}`),
                    classItem.uid,
                ]),
            );

            const upfrontErrors: UploadError[] = [];
            const preparedStudents: PreparedStudent[] = parserResult.dataRows.flatMap((row, rowIndex) => {
                const name = row.values.name || "";
                const classValue = normalizeClassLabel(row.values.class || "");
                const dob = row.values.dob || "";
                const enrollmentNumber = row.values.enrollmentnumber || "";
                const parentName = row.values.parentname || "";
                const parentPhone = (row.values.parentphone || "").replace(/\D/g, "");
                const parentEmail = (row.values.parentemail || "").toLowerCase();
                const address = row.values.address || "";

                const classId = classesMap.get(classValue) || "";

                if (!name) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "name", message: "Student name is required.", value: name });
                }
                if (!classValue) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "class", message: "Class is required.", value: row.values.class || "" });
                } else if (!classId) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "class", message: `Class not found: ${row.values.class || ""}` , value: row.values.class || "" });
                }
                if (!dob) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "dob", message: "Date of birth is required.", value: dob });
                }
                if (!enrollmentNumber) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "enrollmentNumber", message: "Enrollment number is required.", value: enrollmentNumber });
                }
                if (!parentName) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "parentName", message: "Parent name is required.", value: parentName });
                }
                if (!/^\d{10}$/.test(parentPhone)) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "parentPhone", message: "Phone number must be exactly 10 digits.", value: row.values.parentphone || "" });
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "parentEmail", message: "Enter a valid email address.", value: row.values.parentemail || "" });
                }
                if (!address) {
                    upfrontErrors.push({ rowNumber: rowIndex + 1, lineNumber: row.lineNumber, column: "address", message: "Address is required.", value: address });
                }

                const hasRowError = upfrontErrors.some((error) => error.rowNumber === rowIndex + 1);

                if (hasRowError) {
                    return [];
                }

                return [{
                    rowNumber: rowIndex + 1,
                    lineNumber: row.lineNumber,
                    source: row.values,
                    payload: { name, classId, dob, enrollmentNumber, parentName, parentPhone, parentEmail, address },
                }];
            });

            const BATCH_SIZE = 50;
            const batches = Array.from(
                { length: Math.ceil(preparedStudents.length / BATCH_SIZE) },
                (_, index) => preparedStudents.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
            );

            setBatchProgress({ current: 0, total: batches.length });

            const uploadErrors = [...upfrontErrors];
            let successCount = 0;

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
                const batch = batches[batchIndex];
                setBatchProgress({ current: batchIndex + 1, total: batches.length });

                const bulkResponse = await fetch("/api/organization/students/bulk", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...getAuthorizationHeader(),
                    },
                    body: JSON.stringify({
                        students: batch.map((student) => student.payload),
                    }),
                });

                const bulkResponseBody = (await bulkResponse.json()) as BulkUploadResponse;

                if (!bulkResponse.ok || !Array.isArray(bulkResponseBody.results)) {
                    batch.forEach((student) => {
                        uploadErrors.push({ rowNumber: student.rowNumber, lineNumber: student.lineNumber, column: "", message: bulkResponseBody.message || "Bulk upload failed for this batch.", value: "" });
                    });
                    continue;
                }

                batch.forEach((student, batchRowIndex) => {
                    const result = bulkResponseBody.results?.find((item) => item.index === batchRowIndex);

                    if (result?.success) {
                        successCount += 1;
                        return;
                    }

                    const errorEntries = Object.entries(result?.fieldErrors || {});

                    if (errorEntries.length === 0) {
                        uploadErrors.push({ rowNumber: student.rowNumber, lineNumber: student.lineNumber, column: "", message: result?.message || bulkResponseBody.message || "Unknown error while creating student.", value: "" });
                        return;
                    }

                    errorEntries.forEach(([field, message]) => {
                        const columnMap: Record<string, string> = {
                            name: "name",
                            classId: "class",
                            dob: "dob",
                            enrollmentNumber: "enrollmentNumber",
                            parentName: "parentName",
                            parentPhone: "parentPhone",
                            parentEmail: "parentEmail",
                            address: "address",
                        };
                        const column = columnMap[field] || field;

                        uploadErrors.push({ rowNumber: student.rowNumber, lineNumber: student.lineNumber, column, message, value: student.source[column.toLowerCase()] || "" });
                    });
                });
            }

            if (uploadErrors.length > 0) {
                const errorCsv = createErrorCsv(uploadErrors);
                triggerTextFileDownload("students-upload-errors.csv", errorCsv, "text/csv;charset=utf-8");
                setStatus({
                    tone: "error",
                    message: `Uploaded ${successCount} students. ${uploadErrors.length} validation issue(s) found. Error CSV downloaded.`,
                });
                return;
            }

            setStatus({
                tone: "success",
                message: `Uploaded ${successCount} students successfully in ${batches.length || 1} batch call(s).`,
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

            const response = await fetch("/api/google-sheets/public", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: googleSheetUrl }),
            });
            const responseData = (await response.json()) as PublicSheetResponse;

            if (!response.ok || !responseData.csvText) {
                setStatus({
                    tone: "error",
                    message: responseData.message || "Unable to import the public Google Sheet.",
                });
                setIsUploading(false);
                return;
            }

            await processCsvContent(responseData.csvText);
        } catch (error) {
            setStatus({
                tone: "error",
                message: error instanceof Error ? error.message : "Failed to import Google Sheet.",
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
                    Click to open CSV upload modal for students.
                </p>
            </div>

            {isModalOpen && isClient
                ? createPortal(
                    <div className="fixed inset-0 z-200 flex items-center justify-center bg-[rgba(15,23,42,0.52)] p-4">
                        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(16,32,68,0.25)] sm:p-8">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-[#0f1f3a]">Students CSV Upload</h3>
                                    <p className="mt-1 text-sm text-[#60708d]">
                                        Upload students in batches of 50 records per call.
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
                                    Note: Class values are flexible. You can enter <span className="font-semibold">5-A</span> as <span className="font-semibold">5-a</span>, <span className="font-semibold">5a</span>, or <span className="font-semibold">5A</span>. If address contains commas, wrap it in double quotes, for example <span className="font-semibold">&quot;Flat 12, Green Residency, Hyderabad&quot;</span>.
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
