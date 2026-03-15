import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type StudentDocument = {
    uid: string;
    name: string;
    rollNumber: number;
    classId: string;
    parentId: string;
    organizationId: string;
    photoUrl: string;
    createdAt: string;
};

type ClassDocument = {
    uid: string;
    organizationId: string;
};

type CreateStudentPayload = {
    name?: string;
    rollNumber?: number | string;
    classId?: string;
};

const STUDENTS_COLLECTION = "students";
const CLASSES_COLLECTION = "classes";

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function parseRollNumber(value: unknown) {
    if (typeof value === "number") {
        return Number.isInteger(value) ? value : Number.NaN;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();

        if (!trimmed) {
            return Number.NaN;
        }

        return Number(trimmed);
    }

    return Number.NaN;
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

        const payload = (await request.json()) as CreateStudentPayload;

        const name = normalizeString(payload.name);
        const classId = normalizeString(payload.classId);
        const rollNumber = parseRollNumber(payload.rollNumber);

        const fieldErrors: Record<string, string> = {};

        if (!name) {
            fieldErrors.name = "Student name is required.";
        }

        if (!classId) {
            fieldErrors.classId = "Class is required.";
        }

        if (!Number.isInteger(rollNumber) || rollNumber <= 0) {
            fieldErrors.rollNumber = "Roll number must be a positive integer.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );

        const classRecord = await classesCollection.findOne({
            uid: classId,
            organizationId: tokenPayload.uid,
        });

        if (!classRecord) {
            return NextResponse.json(
                {
                    message: "Class not found.",
                    fieldErrors: { classId: "Select a valid class." },
                },
                { status: 400 },
            );
        }

        const existingRollNumber = await studentsCollection.findOne({
            classId,
            rollNumber,
            organizationId: tokenPayload.uid,
        });

        if (existingRollNumber) {
            return NextResponse.json(
                {
                    message: "Roll number already exists in this class.",
                    fieldErrors: {
                        rollNumber: "This roll number is already assigned in the selected class.",
                    },
                },
                { status: 409 },
            );
        }

        const studentRecord: StudentDocument = {
            uid: randomUUID(),
            name,
            rollNumber,
            classId,
            parentId: "",
            organizationId: tokenPayload.uid,
            photoUrl: "",
            createdAt: new Date().toISOString().slice(0, 10),
        };

        const result = await studentsCollection.insertOne(studentRecord);

        return NextResponse.json(
            {
                message: "Student added to class successfully.",
                student: {
                    _id: result.insertedId.toHexString(),
                    ...studentRecord,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to add student.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
