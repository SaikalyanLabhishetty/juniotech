import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";
import { verifyAccessToken } from "@/lib/verify-access-token";
import { verifyPassword, hashPassword } from "@/lib/organization-auth";

export async function POST(request: Request) {
    try {
        const tokenPayload = await verifyAccessToken(request);

        if (!tokenPayload) {
            return NextResponse.json(
                { message: "Unauthorized. Please login again." },
                { status: 401 },
            );
        }

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { message: "Current and new passwords are required." },
                { status: 400 },
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { message: "New password must be at least 8 characters long." },
                { status: 400 },
            );
        }

        const database = await getDatabase();
        const collection = database.collection("organization");

        const organization = await collection.findOne({ uid: tokenPayload.uid });

        if (!organization) {
            return NextResponse.json(
                { message: "Organization not found." },
                { status: 404 },
            );
        }

        if (!verifyPassword(currentPassword, organization.passwordHash)) {
            return NextResponse.json(
                { message: "Incorrect current password." },
                { status: 401 },
            );
        }

        const newPasswordHash = hashPassword(newPassword);

        await collection.updateOne(
            { uid: tokenPayload.uid },
            { $set: { passwordHash: newPasswordHash, updatedAt: new Date().toISOString() } },
        );

        return NextResponse.json({ message: "Password updated successfully." });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to update password.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
