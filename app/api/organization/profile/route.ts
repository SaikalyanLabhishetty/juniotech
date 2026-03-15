import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";

export async function GET() {
    try {
        const tokenPayload = await verifyAccessToken();

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const database = await getDatabase();
        const collection = database.collection("organization");

        const organization = await collection.findOne(
            { uid: tokenPayload.uid },
            {
                projection: {
                    passwordHash: 0,
                    _id: 0,
                },
            },
        );

        if (!organization) {
            return NextResponse.json(
                { message: "Organization not found." },
                { status: 404 },
            );
        }

        return NextResponse.json({ organization });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to fetch profile.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
