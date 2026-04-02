import { type NextRequest, NextResponse } from "next/server";
import { buildSchoolScopeQuery, resolveSchoolId } from "@/lib/organization-school";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type StudentDocument = {
    uid: string;
    name: string;
    classId: string;
    dob: string;
    enrollmentNumber: string;
    parentId: string;
    organizationId: string;
    schoolId?: string;
};

type AttendanceDocument = {
    uid?: string;
    date?: string | Date;
    classId: string;
    organizationId: string;
    schoolId?: string;
    studentAttendance?: Array<{
        studentUid: string;
        status: string;
    }>;
};

const STUDENTS_COLLECTION = "students";
const ATTENDANCE_COLLECTION = "attendance";
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function extractDateString(value: string | Date | undefined): string {
    if (!value) return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const trimmed = value.trim();
    // handle stored ISO datetime like "2026-03-29T00:00:00.000Z"
    if (trimmed.length > 10 && trimmed.includes("T")) return trimmed.slice(0, 10);
    return trimmed;
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

        if (tokenPayload.role !== "parent") {
            return NextResponse.json(
                { message: "Parent access required." },
                { status: 403 },
            );
        }

        const parentUid = normalizeString(tokenPayload.userUid);
        const studentUid = normalizeString(request.nextUrl.searchParams.get("studentUid"));

        // Default to current month if not provided
        const now = new Date();
        const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
        const month = normalizeString(request.nextUrl.searchParams.get("month")) || defaultMonth;

        const fieldErrors: Record<string, string> = {};

        if (!studentUid) {
            fieldErrors.studentUid = "studentUid is required.";
        }

        if (!MONTH_PATTERN.test(month)) {
            fieldErrors.month = "month must be in YYYY-MM format.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
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

        // Verify student belongs to this parent
        const studentsCollection = database.collection<StudentDocument>(STUDENTS_COLLECTION);
        const student = await studentsCollection.findOne(
            {
                uid: studentUid,
                parentId: parentUid,
                organizationId: tokenPayload.uid,
                ...buildSchoolScopeQuery(schoolId),
            },
            {
                projection: {
                    uid: 1,
                    name: 1,
                    classId: 1,
                    dob: 1,
                    enrollmentNumber: 1,
                },
            },
        );

        if (!student) {
            return NextResponse.json(
                { message: "Student not found or does not belong to this parent." },
                { status: 404 },
            );
        }

        // Build month date range (YYYY-MM-01 to YYYY-MM+1-01)
        const [yearStr, monthStr] = month.split("-");
        const year = Number(yearStr);
        const monthNum = Number(monthStr);
        const monthStart = `${month}-01`;
        const nextMonth = monthNum === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

        const attendanceCollection = database.collection<AttendanceDocument>(ATTENDANCE_COLLECTION);

        // Fetch all attendance records for this class in the month
        const records = await attendanceCollection
            .find(
                {
                    organizationId: tokenPayload.uid,
                    classId: student.classId,
                    ...buildSchoolScopeQuery(schoolId),
                    $or: [
                        // stored as string "YYYY-MM-DD"
                        {
                            date: {
                                $gte: monthStart,
                                $lt: nextMonth,
                            },
                        },
                        // stored as Date object
                        {
                            date: {
                                $gte: new Date(`${monthStart}T00:00:00.000Z`),
                                $lt: new Date(`${nextMonth}T00:00:00.000Z`),
                            },
                        },
                    ],
                },
                {
                    projection: {
                        date: 1,
                        studentAttendance: 1,
                    },
                    sort: { date: 1 },
                },
            )
            .toArray();

        // Build day-wise attendance for this student
        let present = 0;
        let absent = 0;
        let late = 0;
        let unmarked = 0;

        const days = records.map((record) => {
            const dateStr = extractDateString(record.date);
            const item = Array.isArray(record.studentAttendance)
                ? record.studentAttendance.find((a) => a.studentUid === studentUid)
                : undefined;
            const status = normalizeString(item?.status) || "unmarked";

            if (status === "present") present++;
            else if (status === "absent") absent++;
            else if (status === "late") late++;
            else unmarked++;

            return { date: dateStr, status };
        });

        const workingDays = records.length;
        const markedDays = present + absent + late;
        const percentage =
            markedDays > 0 ? parseFloat(((present / markedDays) * 100).toFixed(2)) : 0;

        return NextResponse.json({
            studentUid: student.uid,
            studentName: student.name,
            classId: student.classId,
            month,
            summary: {
                workingDays,
                present,
                absent,
                late,
                unmarked,
                percentage,
            },
            days,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to fetch attendance.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
