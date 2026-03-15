import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/organization-auth";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

type UserDocument = {
    uid: string;
    name: string;
    phone: string;
    email: string;
    passwordHash: string;
    role: "teacher" | "parent";
    organizationId: string;
    status: "active";
    createdAt: string;
    updatedAt: string;
};

const COLLECTION_NAME = "users";

export async function GET(request: NextRequest) {
    try {
        const tokenPayload = await verifyAccessToken();

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const role = request.nextUrl.searchParams.get("role");

        if (role && role !== "teacher" && role !== "parent") {
            return NextResponse.json(
                { message: "Role must be teacher or parent." },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const collection = database.collection<UserDocument>(COLLECTION_NAME);

        const filter: Record<string, string> = {
            organizationId: tokenPayload.uid,
        };

        if (role) {
            filter.role = role;
        }

        const users = await collection
            .find(filter, {
                projection: {
                    _id: 1,
                    uid: 1,
                    name: 1,
                    phone: 1,
                    email: 1,
                    role: 1,
                    status: 1,
                    createdAt: 1,
                },
            })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json({ users });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to fetch users.";

        return NextResponse.json({ message }, { status: 500 });
    }
}

type CreateUserPayload = {
    name?: string;
    phone?: string;
    email?: string;
    password?: string;
    role?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;
const validRoles = ["teacher", "parent"] as const;

function normalizeString(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken();

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const payload = (await request.json()) as CreateUserPayload;
        const name = normalizeString(payload.name);
        const email = normalizeString(payload.email).toLowerCase();
        const phone = normalizeString(payload.phone);
        const password = normalizeString(payload.password);
        const role = normalizeString(payload.role).toLowerCase();

        const fieldErrors: Record<string, string> = {};

        if (!name) {
            fieldErrors.name = "Name is required.";
        }

        if (!emailPattern.test(email)) {
            fieldErrors.email = "Enter a valid email address.";
        }

        if (!phonePattern.test(phone)) {
            fieldErrors.phone = "Phone number must be exactly 10 digits.";
        }

        if (password.length < 8) {
            fieldErrors.password = "Password must be at least 8 characters long.";
        }

        if (!validRoles.includes(role as (typeof validRoles)[number])) {
            fieldErrors.role = "Role must be either teacher or parent.";
        }

        if (Object.keys(fieldErrors).length > 0) {
            return NextResponse.json(
                { message: "Validation failed.", fieldErrors },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const collection = database.collection<UserDocument>(COLLECTION_NAME);
        const existingUser = await collection.findOne({ email });

        if (existingUser) {
            return NextResponse.json(
                {
                    message: "A user with this email already exists.",
                    fieldErrors: { email: "This email is already registered." },
                },
                { status: 409 },
            );
        }

        const now = new Date().toISOString();

        const user: UserDocument = {
            uid: randomUUID(),
            name,
            phone,
            email,
            passwordHash: hashPassword(password),
            role: role as "teacher" | "parent",
            organizationId: tokenPayload.uid,
            status: "active",
            createdAt: now,
            updatedAt: now,
        };

        const result = await collection.insertOne(user);

        return NextResponse.json(
            {
                message: "User created successfully.",
                user: {
                    _id: result.insertedId.toHexString(),
                    uid: user.uid,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    status: user.status,
                    createdAt: user.createdAt,
                },
            },
            { status: 201 },
        );
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to create user.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
