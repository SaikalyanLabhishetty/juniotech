import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/verify-access-token";

export async function POST(request: Request) {
    const tokenPayload = await verifyAccessToken(request);

    if (!tokenPayload) {
        return NextResponse.json(
            { message: "Unauthorized. Please login again." },
            { status: 401 },
        );
    }

    const cookieStore = await cookies();
    cookieStore.delete("access_token");

    return NextResponse.json({ message: "Logged out successfully" });
}
