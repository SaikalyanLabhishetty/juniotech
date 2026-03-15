import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

type AccessTokenPayload = {
    email: string;
    uid: string;
    exp: number;
};

function getJwtSecret() {
    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    }

    if (process.env.NODE_ENV !== "production") {
        return "development-jwt-secret";
    }

    throw new Error("Missing JWT_SECRET in environment.");
}

export async function verifyAccessToken(): Promise<AccessTokenPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
        return null;
    }

    const dotIndex = token.indexOf(".");

    if (dotIndex === -1) {
        return null;
    }

    const encodedPayload = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);

    const expectedSignature = createHmac("sha256", getJwtSecret())
        .update(encodedPayload)
        .digest("base64url");

    if (signature !== expectedSignature) {
        return null;
    }

    try {
        const payload = JSON.parse(
            Buffer.from(encodedPayload, "base64url").toString("utf8"),
        ) as AccessTokenPayload;

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}
