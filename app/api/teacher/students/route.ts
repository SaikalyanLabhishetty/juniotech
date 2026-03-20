import { type NextRequest, NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type TeacherDocument = {
    uid: string;
    role: "teacher";
    organizationId: string;
    schoolId: string;
    classIds: string[];
};

type ClassDocument = {
    uid: string;
    className: string;
    section: string;
    teacherId: string;
    organizationId: string;
    schoolId: string;
    academicYear: string;
    createdAt: string;
};

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

type ParentDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    role: "parent";
    organizationId: string;
    schoolId: string;
};

type StudentResponse = StudentDocument & {
    parentName: string;
    parentPhone: string;
    parentEmail: string;
};

const USERS_COLLECTION = "users";
const CLASSES_COLLECTION = "classes";
const STUDENTS_COLLECTION = "students";

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}

export async function GET(request: NextRequest) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const teacherUid = normalizeString(tokenPayload.userUid);
        const classId = normalizeString(request.nextUrl.searchParams.get("classId"));

        if (tokenPayload.role !== "teacher" || !teacherUid) {
            return NextResponse.json(
                { message: "Teacher access required. Please login again." },
                { status: 403 },
            );
        }

        if (!classId) {
            return NextResponse.json(
                {
                    message: "Validation failed.",
                    fieldErrors: {
                        classId: "classId is required.",
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

        const usersCollection = database.collection<TeacherDocument>(USERS_COLLECTION);
        const classesCollection = database.collection<ClassDocument>(CLASSES_COLLECTION);
        const studentsCollection = database.collection<StudentDocument>(
            STUDENTS_COLLECTION,
        );
        const parentsCollection = database.collection<ParentDocument>(USERS_COLLECTION);

        const teacher = await usersCollection.findOne(
            {
                uid: teacherUid,
                role: "teacher",
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    classIds: 1,
                },
            },
        );

        if (!teacher) {
            return NextResponse.json(
                { message: "Teacher not found for this organization." },
                { status: 404 },
            );
        }

        const classRecord = await classesCollection.findOne(
            {
                uid: classId,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    className: 1,
                    section: 1,
                    teacherId: 1,
                    organizationId: 1,
                    schoolId: 1,
                    academicYear: 1,
                    createdAt: 1,
                },
            },
        );

        if (!classRecord) {
            return NextResponse.json(
                {
                    message: "Class not found for this organization.",
                    fieldErrors: {
                        classId: "No matching class found.",
                    },
                },
                { status: 404 },
            );
        }

        const teacherClassIds = new Set(normalizeStringArray(teacher.classIds));
        const isAssignedByTeacherClassIds = teacherClassIds.has(classId);
        const isAssignedByClassTeacherId = normalizeString(classRecord.teacherId) === teacherUid;

        if (!isAssignedByTeacherClassIds && !isAssignedByClassTeacherId) {
            return NextResponse.json(
                { message: "You do not have access to this class." },
                { status: 403 },
            );
        }

        const students = await studentsCollection
            .find(
                {
                    organizationId: tokenPayload.uid,
                    classId,
                    ...buildSchoolScopeQuery(schoolId),
                },
                {
                    projection: {
                        _id: 1,
                        uid: 1,
                        name: 1,
                        dob: 1,
                        enrollmentNumber: 1,
                        classId: 1,
                        parentId: 1,
                        organizationId: 1,
                        schoolId: 1,
                        address: 1,
                        photoUrl: 1,
                        createdAt: 1,
                    },
                },
            )
            .sort({ enrollmentNumber: 1 })
            .toArray();

        const parentIds = [
            ...new Set(students.map((student) => student.parentId).filter(Boolean)),
        ];
        const parents = parentIds.length
            ? await parentsCollection
                  .find(
                      {
                          organizationId: tokenPayload.uid,
                          role: "parent",
                          uid: { $in: parentIds },
                          ...buildSchoolScopeQuery(schoolId),
                      },
                      {
                          projection: {
                              uid: 1,
                              name: 1,
                              phone: 1,
                              email: 1,
                          },
                      },
                  )
                  .toArray()
            : [];

        const parentMap = new Map(parents.map((parent) => [parent.uid, parent]));
        const studentsWithParents: StudentResponse[] = students.map((student) => {
            const parent = parentMap.get(student.parentId);

            return {
                ...student,
                parentName: parent?.name ?? "",
                parentPhone: parent?.phone ?? "",
                parentEmail: parent?.email ?? "",
            };
        });

        return NextResponse.json({
            class: classRecord,
            students: studentsWithParents,
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unable to fetch students for teacher.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
