export const ACCESS_TOKEN_STORAGE_KEY = "access_token";

export function getStoredAccessToken() {
    if (typeof window === "undefined") {
        return "";
    }

    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)?.trim() || "";
}

export function getAuthorizationHeader() {
    const token = getStoredAccessToken();

    if (!token) {
        return {} as Record<string, string>;
    }

    return {
        Authorization: `Bearer ${token}`,
    };
}
