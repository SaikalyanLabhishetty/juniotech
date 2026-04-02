import { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  verifyPassword,
} from "@/lib/organization-auth";
import { buildSchoolScopeQuery } from "@/lib/organization-school";
import { getDatabase } from "@/lib/mongodb";

type LoginPayload = {
  email?: string;
  phone?: string;
  identifier?: string;
  password?: string;
};

type UserDocument = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: "teacher" | "parent";
  organizationId: string;
  schoolId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type StudentDocument = {
  uid: string;
  name: string;
  dob?: string;
  enrollmentNumber?: string;
  classId?: string;
  parentId: string;
  organizationId: string;
  schoolId?: string;
  createdAt: string;
};

type ClassDocument = {
  uid: string;
  className?: string;
  section?: string;
  organizationId: string;
  schoolId?: string;
};

type SchoolDocument = {
  uid?: string;
  schoolName?: string;
  name?: string;
};

type OrganizationDocument = {
  uid: string;
  organizationName?: string;
  name?: string;
  schools?: SchoolDocument[];
};

const COLLECTION_NAME = "users";
const STUDENTS_COLLECTION_NAME = "students";
const CLASSES_COLLECTION_NAME = "classes";
const ORGANIZATION_COLLECTION_NAME = "organization";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginPayload;
    const rawIdentifier = normalizeString(
      payload.identifier ?? payload.email ?? payload.phone,
    );
    const isEmail = emailPattern.test(rawIdentifier);
    const isPhone = phonePattern.test(rawIdentifier);
    const email = isEmail ? rawIdentifier.toLowerCase() : "";
    const phone = isPhone ? rawIdentifier : "";
    const password = normalizeString(payload.password);

    const fieldErrors: Record<string, string> = {};

    if (!isEmail && !isPhone) {
      fieldErrors.email = "Enter a valid email address or phone number.";
    }

    if (password.length < 8) {
      fieldErrors.password = "Password must be at least 8 characters long.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        {
          fieldErrors,
          message: "Validation failed.",
        },
        { status: 400 },
      );
    }

    const database = await getDatabase();
    const collection = database.collection<UserDocument>(COLLECTION_NAME);
    const user = await collection.findOne(isPhone ? { phone } : { email });

    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    // Use organizationId as the token uid so all protected org-scoped routes work correctly.
    const schoolId = normalizeString(user.schoolId);
    let parentStudent: Pick<
      StudentDocument,
      "uid" | "name" | "dob" | "enrollmentNumber" | "classId" | "schoolId"
    > | null = null;
    let parentClass: Pick<ClassDocument, "uid" | "className" | "section"> | null =
      null;
    let organization: Pick<
      OrganizationDocument,
      "organizationName" | "name" | "schools"
    > | null = null;

    if (user.role === "parent") {
      const studentsCollection =
        database.collection<StudentDocument>(STUDENTS_COLLECTION_NAME);
      parentStudent = await studentsCollection.findOne(
        {
          parentId: user.uid,
          organizationId: user.organizationId,
          ...buildSchoolScopeQuery(schoolId),
        },
        {
          projection: {
            uid: 1,
            name: 1,
            dob: 1,
            enrollmentNumber: 1,
            classId: 1,
            schoolId: 1,
          },
          sort: {
            createdAt: -1,
          },
        },
      );

      const classId = normalizeString(parentStudent?.classId);
      const parentStudentSchoolId = normalizeString(parentStudent?.schoolId) || schoolId;

      if (classId) {
        const classesCollection =
          database.collection<ClassDocument>(CLASSES_COLLECTION_NAME);
        parentClass = await classesCollection.findOne(
          {
            uid: classId,
            organizationId: user.organizationId,
            ...buildSchoolScopeQuery(parentStudentSchoolId),
          },
          {
            projection: {
              uid: 1,
              className: 1,
              section: 1,
            },
          },
        );
      }

      const organizationsCollection = database.collection<OrganizationDocument>(
        ORGANIZATION_COLLECTION_NAME,
      );
      organization = await organizationsCollection.findOne(
        { uid: user.organizationId },
        {
          projection: {
            organizationName: 1,
            name: 1,
            schools: 1,
          },
        },
      );
    }

    const organizationName =
      normalizeString(organization?.organizationName) ||
      normalizeString(organization?.name);
    const resolvedSchoolId = normalizeString(parentStudent?.schoolId) || schoolId;
    const matchingSchool = organization?.schools?.find(
      (school) => normalizeString(school.uid) === resolvedSchoolId,
    );
    const schoolName =
      normalizeString(matchingSchool?.schoolName) ||
      normalizeString(matchingSchool?.name);
    const className = normalizeString(parentClass?.className);
    const section = normalizeString(parentClass?.section);
    const classAndSection = className && section ? `${className}-${section}` : "";

    const accessToken = createAccessToken({
      email: user.email,
      uid: user.organizationId,
      schoolId: schoolId || undefined,
      userUid: user.uid,
      role: user.role,
    });

    const response = NextResponse.json(
      {
        accessToken,
        message: "Login successful.",
        user: {
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          role: user.role,
          uid: user.uid,
          ...(user.role === "parent"
            ? {
                student_name: parentStudent?.name ?? "",
                student_uid: parentStudent?.uid ?? "",
                dob: parentStudent?.dob ?? "",
                enrollment_number: parentStudent?.enrollmentNumber ?? "",
                school_name: schoolName,
                organization_name: organizationName,
                class_and_section: classAndSection,
                classId: parentStudent?.classId ?? "",
              }
            : {}),
        },
      },
      { status: 200 },
    );

    response.cookies.set({
      httpOnly: true,
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
      name: "access_token",
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      value: accessToken,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to login.";

    return NextResponse.json({ message }, { status: 500 });
  }
}
