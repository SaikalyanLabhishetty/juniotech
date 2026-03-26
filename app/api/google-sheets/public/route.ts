import { NextResponse } from "next/server";

type PublicSheetPayload = {
    url?: string;
};

function extractGidFromHash(hash: string) {
    const match = hash.match(/gid=(\d+)/i);

    return match?.[1] || "";
}

function buildPublicSheetCsvUrl(input: string) {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(input);
    } catch {
        throw new Error("Enter a valid Google Sheet URL.");
    }

    if (!/docs\.google\.com$/i.test(parsedUrl.hostname)) {
        throw new Error("Only Google Sheets URLs are supported.");
    }

    const pathMatch = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = pathMatch?.[1] || "";

    if (!sheetId) {
        throw new Error("Unable to detect sheet ID from the URL.");
    }

    const gid =
        parsedUrl.searchParams.get("gid")?.trim() ||
        extractGidFromHash(parsedUrl.hash);

    const exportUrl = new URL(
        `https://docs.google.com/spreadsheets/d/${sheetId}/export`,
    );
    exportUrl.searchParams.set("format", "csv");

    if (gid) {
        exportUrl.searchParams.set("gid", gid);
    }

    return exportUrl.toString();
}

export async function POST(request: Request) {
    try {
        const payload = (await request.json()) as PublicSheetPayload;
        const sheetUrl = (payload.url || "").trim();

        if (!sheetUrl) {
            return NextResponse.json(
                {
                    message: "Google Sheet URL is required.",
                    fieldErrors: {
                        url: "Enter a public Google Sheet URL.",
                    },
                },
                { status: 400 },
            );
        }

        const csvUrl = buildPublicSheetCsvUrl(sheetUrl);
        const response = await fetch(csvUrl, {
            cache: "no-store",
        });

        if (!response.ok) {
            return NextResponse.json(
                {
                    message:
                        "Unable to fetch the Google Sheet. Make sure it is public and shared with view access.",
                },
                { status: 400 },
            );
        }

        const csvText = await response.text();

        if (!csvText.trim()) {
            return NextResponse.json(
                {
                    message: "Google Sheet returned empty data.",
                },
                { status: 400 },
            );
        }

        return NextResponse.json({
            csvText,
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unable to import Google Sheet.";

        return NextResponse.json({ message }, { status: 500 });
    }
}
