import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { hashPassword } from "@/lib/organization-auth";
import { verifyAccessToken } from "@/lib/verify-access-token";

type StudentDocument = {
    uid: string;
    name: string;
    dob: string;
    enrollmentNumber: string;
    classId: string;
    parentId: string;
    organizationId: string;
    schoolId: string;
    address: string;
    photoUrl: string;
    createdAt: string;
};

type ClassDocument = {
    uid: string;
    organizationId: string;
    schoolId: string;
};

type ParentDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    passwordHash?: string;
    role: "parent";
    organizationId: string;
    schoolId: string;
    status: "active";
    createdAt: string;
    updatedAt: string;
};

type CreateStudentPayload = {
    name?: string;
    dob?: string;
    enrollmentNumber?: string;
    classId?: string;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    address?: string;
};

type BulkCreateStudentPayload = {
    students?: CreateStudentPayload[];
};

const STUDENTS_COLLECTION = "students";
const CLASSES_COLLECTION = "classes";
const USERS_COLLECTION = "users";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
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

        const payload = (await request.json()) as BulkCreateStudentPayload;
        const students = Array.isArray(payload.students) ? payload.students : [];

        if (students.length === 0) {
            return NextResponse.json(
                {
                    message: "No student records provided.",
                    fieldErrors: {
                        students: "Provide at least one student record.",
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
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const usersCollection = database.collection<ParentDocument>(USERS_COLLECTION);

        const [classes, existingStudents, existingParents] = await Promise.all([
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
            studentsCollection
                .find(
                    {
                        organizationId: tokenPayload.uid,
                        ...buildSchoolScopeQuery(schoolId),
                    },
                    {
                        projection: {
                            classId: 1,
                            enrollmentNumber: 1,
                        },
                    },
                )
                .toArray(),
            usersCollection
                .find(
                    {
                        organizationId: tokenPayload.uid,
                        role: "parent",
                        ...buildSchoolScopeQuery(schoolId),
                    },
                    {
                        projection: {
                            uid: 1,
                            name: 1,
                            phone: 1,
                            email: 1,
                            passwordHash: 1,
                            schoolId: 1,
                        },
                    },
                )
                .toArray(),
        ]);

        const validClassIdSet = new Set(classes.map((classItem) => classItem.uid));
        const existingEnrollmentSet = new Set(
            existingStudents.map(
                (student) => `${normalizeString(student.classId)}::${normalizeString(student.enrollmentNumber)}`,
            ),
        );
        const seenBatchEnrollmentSet = new Set<string>();

        const existingParentMap = new Map(
            existingParents.map((parent) => [normalizeString(parent.email).toLowerCase(), parent]),
        );
        const parentIdByEmail = new Map<string, string>();
        const parentUpdatesById = new Map<string, Partial<ParentDocument>>();
        const newParentsByEmail = new Map<string, ParentDocument>();

        const now = new Date().toISOString();

        const rowsToInsert: Array<{ index: number; document: StudentDocument }> = [];
        const results: Array<{
            index: number;
            success: boolean;
            fieldErrors?: Record<string, string>;
            message?: string;
        }> = [];

        students.forEach((studentPayload, index) => {
            const name = normalizeString(studentPayload.name);
            const dob = normalizeString(studentPayload.dob);
            const enrollmentNumber = normalizeString(studentPayload.enrollmentNumber);
            const classId = normalizeString(studentPayload.classId);
            const parentName = normalizeString(studentPayload.parentName);
            const parentPhone = normalizeString(studentPayload.parentPhone);
            const parentEmail = normalizeString(studentPayload.parentEmail).toLowerCase();
            const address = normalizeString(studentPayload.address);

            const fieldErrors: Record<string, string> = {};

            if (!name) {
                fieldErrors.name = "Student name is required.";
            }

            if (!dob) {
                fieldErrors.dob = "Date of birth is required.";
            }

            if (!enrollmentNumber) {
                fieldErrors.enrollmentNumber = "Enrollment number is required.";
            }

            if (!classId) {
                fieldErrors.classId = "Class is required.";
            } else if (!validClassIdSet.has(classId)) {
                fieldErrors.classId = "Select a valid class.";
            }

            if (!parentName) {
                fieldErrors.parentName = "Parent name is required.";
            }

            if (!phonePattern.test(parentPhone)) {
                fieldErrors.parentPhone = "Phone number must be exactly 10 digits.";
            }

            if (!emailPattern.test(parentEmail)) {
                fieldErrors.parentEmail = "Enter a valid email address.";
            }

            if (!address) {
                fieldErrors.address = "Address is required.";
            }

            const enrollmentKey = `${classId}::${enrollmentNumber}`;

            if (classId && enrollmentNumber) {
                if (existingEnrollmentSet.has(enrollmentKey)) {
                    fieldErrors.enrollmentNumber =
                        "This enrollment number is already assigned in the selected class.";
                } else if (seenBatchEnrollmentSet.has(enrollmentKey)) {
                    fieldErrors.enrollmentNumber =
                        "Duplicate enrollment number in uploaded CSV for the selected class.";
                }
            }

            if (Object.keys(fieldErrors).length > 0) {
                results.push({
                    index,
                    success: false,
                    fieldErrors,
                });
                return;
            }

            seenBatchEnrollmentSet.add(enrollmentKey);

            let parentId = parentIdByEmail.get(parentEmail) || "";

            if (!parentId) {
                const existingParent = existingParentMap.get(parentEmail);

                if (existingParent) {
                    parentId = existingParent.uid;
                    parentIdByEmail.set(parentEmail, parentId);

                    const parentUpdates: Partial<ParentDocument> =
                        parentUpdatesById.get(parentId) || {};

                    if (existingParent.name !== parentName) {
                        parentUpdates.name = parentName;
                    }

                    if (existingParent.phone !== parentPhone) {
                        parentUpdates.phone = parentPhone;
                    }

                    if (!existingParent.passwordHash) {
                        parentUpdates.passwordHash = hashPassword(formatDobPassword(dob));
                    }

                    if (existingParent.schoolId !== schoolId) {
                        parentUpdates.schoolId = schoolId;
                    }

                    if (Object.keys(parentUpdates).length > 0) {
                        parentUpdates.updatedAt = now;
                        parentUpdatesById.set(parentId, parentUpdates);
                    }
                } else {
                    const pendingParent = newParentsByEmail.get(parentEmail);

                    if (pendingParent) {
                        parentId = pendingParent.uid;
                    } else {
                        const newParent: ParentDocument = {
                            uid: randomUUID(),
                            name: parentName,
                            phone: parentPhone,
                            email: parentEmail,
                            passwordHash: hashPassword(formatDobPassword(dob)),
                            role: "parent",
                            organizationId: tokenPayload.uid,
                            schoolId,
                            status: "active",
                            createdAt: now,
                            updatedAt: now,
                        };
                        parentId = newParent.uid;
                        newParentsByEmail.set(parentEmail, newParent);
                    }

                    parentIdByEmail.set(parentEmail, parentId);
                }
            }

            const studentRecord: StudentDocument = {
                uid: randomUUID(),
                name,
                dob,
                enrollmentNumber,
                classId,
                parentId,
                organizationId: tokenPayload.uid,
                schoolId,
                address,
                photoUrl: "",
                createdAt: now,
            };

            rowsToInsert.push({ index, document: studentRecord });
        });

        if (newParentsByEmail.size > 0) {
            await usersCollection.insertMany(Array.from(newParentsByEmail.values()));
        }

        if (parentUpdatesById.size > 0) {
            await usersCollection.bulkWrite(
                Array.from(parentUpdatesById.entries()).map(([uid, updates]) => ({
                    updateOne: {
                        filter: { uid, organizationId: tokenPayload.uid },
                        update: {
                            $set: updates,
                        },
                    },
                })),
            );
        }

        if (rowsToInsert.length > 0) {
            await studentsCollection.insertMany(rowsToInsert.map((row) => row.document));
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
                        ? "Some student records failed validation."
                        : "Students inserted successfully.",
                insertedCount,
                failedCount,
                results,
            },
            { status: 200 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to upload students.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
