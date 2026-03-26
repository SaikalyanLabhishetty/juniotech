import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { hashPassword } from "@/lib/organization-auth";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type TeacherDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    passwordHash: string;
    role: "teacher";
    organizationId: string;
    schoolId: string;
    status: "active";
    createdAt: string;
    updatedAt: string;
    dob: string;
    classIds: string[];
    classTeacherClassId: string;
    subjects: string[];
    isClassTeacher: boolean;
};

type ClassDocument = {
    uid: string;
    organizationId: string;
    schoolId: string;
};

type OrganizationDocument = {
    uid: string;
    schools?: Array<{
        uid?: string;
        subjects?: string[];
    }>;
};

type CreateTeacherPayload = {
    name?: string;
    phone?: string;
    dob?: string;
    classIds?: string[];
    classTeacherClassId?: string;
    subjects?: string[];
    isClassTeacher?: boolean;
};

type BulkCreateTeacherPayload = {
    teachers?: CreateTeacherPayload[];
};

const USERS_COLLECTION = "users";
const CLASSES_COLLECTION = "classes";
const phonePattern = /^\d{10}$/;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

function formatDobPassword(value: string) {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[3]}${isoMatch[2]}${isoMatch[1]}`;
    }

    const dmyMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, "0");
        const month = dmyMatch[2].padStart(2, "0");
        return `${day}${month}${dmyMatch[3]}`;
    }

    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 8) {
        if (/^(19|20)\d{6}$/.test(digits)) {
            return `${digits.slice(6, 8)}${digits.slice(4, 6)}${digits.slice(0, 4)}`;
        }

        return digits;
    }

    return digits;
}

export async function POST(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const payload = (await request.json()) as BulkCreateTeacherPayload;
        const teachers = Array.isArray(payload.teachers) ? payload.teachers : [];

        if (teachers.length === 0) {
            return NextResponse.json(
                {
                    message: "No teacher records provided.",
                    fieldErrors: {
                        teachers: "Provide at least one teacher record.",
                    },
                },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const schoolId = await resolveSchoolId(
            database,
            tokenPayload.uid,
            tokenPayload.schoolId,
        );

        if (!schoolId) {
            return NextResponse.json(
                { message: "No school found for this organization." },
                { status: 404 },
            );
        }

        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);
        const organizationsCollection = database.collection<OrganizationDocument>(
            "organization",
        );
        const usersCollection = database.collection<TeacherDocument>(USERS_COLLECTION);

        const [classes, organization] = await Promise.all([
            classesCollection
                .find(
                    {
                        organizationId: tokenPayload.uid,
                        ...buildSchoolScopeQuery(schoolId),
                    },
                    {
                        projection: {
                            uid: 1,
                        },
                    },
                )
                .toArray(),
            organizationsCollection.findOne(
                { uid: tokenPayload.uid },
                {
                    projection: {
                        schools: 1,
                    },
                },
            ),
        ]);

        const validClassIdSet = new Set(classes.map((classItem) => classItem.uid));
        const schools = Array.isArray(organization?.schools)
            ? organization?.schools
            : [];
        const activeSchool = schools.find(
            (school) => normalizeString(school.uid) === schoolId,
        );
        const schoolSubjects = Array.isArray(activeSchool?.subjects)
            ? activeSchool.subjects.map((subject) => normalizeString(subject)).filter(Boolean)
            : [];
        const validSubjectSet = new Set(schoolSubjects);

        const now = new Date().toISOString();
        const rowsToInsert: Array<{ index: number; document: TeacherDocument }> = [];
        const results: Array<{
            index: number;
            success: boolean;
            fieldErrors?: Record<string, string>;
            message?: string;
        }> = [];

        teachers.forEach((teacherPayload, index) => {
            const name = normalizeString(teacherPayload.name);
            const phone = normalizeString(teacherPayload.phone);
            const dob = normalizeString(teacherPayload.dob);
            const classIds = normalizeArray(teacherPayload.classIds);
            const classTeacherClassId = normalizeString(teacherPayload.classTeacherClassId);
            const subjects = normalizeArray(teacherPayload.subjects);
            const isClassTeacher = Boolean(teacherPayload.isClassTeacher);

            const fieldErrors: Record<string, string> = {};

            if (!name) {
                fieldErrors.name = "Teacher name is required.";
            }

            if (!phonePattern.test(phone)) {
                fieldErrors.phone = "Phone number must be exactly 10 digits.";
            }

            if (!dob) {
                fieldErrors.dob = "Date of birth is required.";
            }

            const uniqueClassIds = [...new Set(classIds)];

            if (uniqueClassIds.length === 0) {
                fieldErrors.classIds = "Select at least one class.";
            } else if (uniqueClassIds.some((classId) => !validClassIdSet.has(classId))) {
                fieldErrors.classIds = "Select valid classes for the current school.";
            }

            if (validSubjectSet.size > 0 && subjects.length === 0) {
                fieldErrors.subjects = "Select at least one subject.";
            } else if (
                validSubjectSet.size > 0 &&
                subjects.some((subject) => !validSubjectSet.has(subject))
            ) {
                fieldErrors.subjects = "Select valid subjects for the current school.";
            }

            if (isClassTeacher && !classTeacherClassId) {
                fieldErrors.classTeacherClassId = "Select the class teacher assignment.";
            } else if (isClassTeacher && !uniqueClassIds.includes(classTeacherClassId)) {
                fieldErrors.classTeacherClassId =
                    "Class teacher assignment must be one of the selected classes.";
            } else if (
                isClassTeacher &&
                classTeacherClassId &&
                !validClassIdSet.has(classTeacherClassId)
            ) {
                fieldErrors.classTeacherClassId =
                    "Class teacher assignment must belong to the selected school.";
            }

            if (Object.keys(fieldErrors).length > 0) {
                results.push({
                    index,
                    success: false,
                    fieldErrors,
                });
                return;
            }

            const document: TeacherDocument = {
                uid: randomUUID(),
                name,
                phone,
                email: "",
                passwordHash: hashPassword(formatDobPassword(dob)),
                role: "teacher",
                organizationId: tokenPayload.uid,
                schoolId,
                status: "active",
                createdAt: now,
                updatedAt: now,
                dob,
                classIds: uniqueClassIds,
                classTeacherClassId: isClassTeacher ? classTeacherClassId : "",
                subjects,
                isClassTeacher,
            };

            rowsToInsert.push({ index, document });
        });

        if (rowsToInsert.length > 0) {
            await usersCollection.insertMany(rowsToInsert.map((row) => row.document));
            rowsToInsert.forEach((row) => {
                results.push({
                    index: row.index,
                    success: true,
                });
            });
        }

        results.sort((first, second) => first.index - second.index);

        const insertedCount = results.filter((result) => result.success).length;
        const failedCount = results.length - insertedCount;

        return NextResponse.json(
            {
                message:
                    failedCount > 0
                        ? "Some teacher records failed validation."
                        : "Teachers inserted successfully.",
                insertedCount,
                failedCount,
                results,
            },
            { status: 200 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to upload teachers.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
