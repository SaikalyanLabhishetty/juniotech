"use client";

import { useEffect, useState } from "react";

type Organization = {
    name: string;
    email: string;
    phone: string;
    address: string;
    state: string;
    district: string;
    pincode: string;
    createdAt: string;
};

export function ProfileDetails() {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchProfile() {
            try {
                const response = await fetch("/api/organization/profile");
                if (!response.ok) {
                    throw new Error("Failed to fetch profile");
                }
                const data = await response.json();
                setOrganization(data.organization);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to load profile.");
            } finally {
                setIsLoading(false);
            }
        }
        fetchProfile();
    }, []);

    if (isLoading) {
        return (
            <div className="flex animate-pulse flex-col space-y-4">
                <div className="h-4 w-1/4 rounded bg-[#f2f6fc]" />
                <div className="h-10 w-full rounded bg-[#f2f6fc]" />
                <div className="h-4 w-1/4 rounded bg-[#f2f6fc]" />
                <div className="h-10 w-full rounded bg-[#f2f6fc]" />
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

    if (!organization) return null;

    const details = [
        { label: "Organization Name", value: organization.name },
        { label: "Email Address", value: organization.email },
        { label: "Phone Number", value: organization.phone },
        { label: "Address", value: organization.address },
        { label: "Location", value: `${organization.district}, ${organization.state} - ${organization.pincode}` },
        { label: "Joined On", value: new Date(organization.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) },
    ];

    return (
        <div className="grid gap-6 sm:grid-cols-2">
            {details.map((detail) => (
                <div key={detail.label} className="group rounded-[1.2rem] border border-[rgba(18,36,76,0.06)] bg-[#f8fbff] p-4 transition-all hover:border-[rgba(26,97,255,0.1)] hover:bg-white hover:shadow-[0_8px_24px_rgba(26,97,255,0.04)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a96ad]">{detail.label}</p>
                    <p className="mt-1 text-[0.94rem] font-semibold text-[#10203f]">{detail.value}</p>
                </div>
            ))}
        </div>
    );
}
