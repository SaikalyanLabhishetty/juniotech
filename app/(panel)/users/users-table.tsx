"use client";

import { useCallback, useEffect, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type UserRow = {
    _id: string;
    uid: string;
    name: string;
    phone: string;
    email: string;
    role: "teacher" | "parent";
    status: string;
    createdAt: string;
};

const thClassName =
    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] text-[#5e6d8c]";
const tdClassName = "px-4 py-3 text-sm text-[#243552]";

export function UsersTable({ role }: { role: "teacher" | "parent" }) {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchUsers = useCallback(async () => {
        try {
            setIsLoading(true);
            setError("");

            const response = await fetch(
                `/api/organization/users?role=${role}`,
                {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                },
            );

            if (!response.ok) {
                const data = (await response.json()) as { message?: string };
                setError(data.message || "Failed to load users.");
                return;
            }

            const data = (await response.json()) as { users: UserRow[] };
            setUsers(data.users);
        } catch {
            setError("Network error while fetching users.");
        } finally {
            setIsLoading(false);
        }
    }, [role]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1a61ff] border-t-transparent" />
                <span className="ml-3 text-sm text-[#5e6d8c]">
                    Loading {role}s...
                </span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-[1rem] border border-[#f3c3c3] bg-[#fff5f5] px-4 py-3 text-sm text-[#a23232]">
                {error}
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="py-16 text-center">
                <p className="text-sm font-medium text-[#5e6d8c]">
                    No {role}s found in your organization.
                </p>
                <p className="mt-1 text-xs text-[#8a96ad]">
                    Add a {role} from the &quot;Add Users&quot; tab.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-[1rem] border border-[rgba(18,36,76,0.08)]">
            <table className="w-full min-w-[640px] border-collapse">
                <thead>
                    <tr className="border-b border-[rgba(18,36,76,0.06)] bg-[#f8fbff]">
                        <th className={thClassName}>#</th>
                        <th className={thClassName}>Name</th>
                        <th className={thClassName}>Email</th>
                        <th className={thClassName}>Phone</th>
                        <th className={thClassName}>Status</th>
                        <th className={thClassName}>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user, index) => (
                        <tr
                            key={user._id}
                            className="border-b border-[rgba(18,36,76,0.04)] transition-colors last:border-b-0 hover:bg-[rgba(26,97,255,0.02)]"
                        >
                            <td className={`${tdClassName} font-medium text-[#8a96ad]`}>
                                {index + 1}
                            </td>
                            <td className={`${tdClassName} font-medium`}>{user.name}</td>
                            <td className={tdClassName}>{user.email}</td>
                            <td className={tdClassName}>{user.phone}</td>
                            <td className={tdClassName}>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-xs font-semibold text-[#20683c]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-[#34c759]" />
                                    {user.status}
                                </span>
                            </td>
                            <td className={`${tdClassName} text-[#8a96ad]`}>
                                {new Date(user.createdAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
