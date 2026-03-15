"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { getAuthorizationHeader } from "@/lib/client-auth";

type UserFormData = {
    name: string;
    phone: string;
    email: string;
    password: string;
    role: "teacher" | "parent";
};

type FormFieldErrors = Partial<Record<keyof UserFormData, string>>;

type CreateUserResponse = {
    message?: string;
    fieldErrors?: FormFieldErrors;
};

const initialFormData: UserFormData = {
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "teacher",
};

const inputClassName =
    "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d{10}$/;

function validateField(
    name: keyof UserFormData,
    value: string,
): string | undefined {
    if (name === "name" && !value.trim()) {
        return "Name is required.";
    }

    if (name === "email" && !emailPattern.test(value.trim())) {
        return "Enter a valid email address.";
    }

    if (name === "phone" && !phonePattern.test(value)) {
        return "Phone number must be exactly 10 digits.";
    }

    if (name === "password" && value.length < 8) {
        return "Password must be at least 8 characters.";
    }

    return undefined;
}

export function AddUserForm() {
    const [formData, setFormData] = useState<UserFormData>(initialFormData);
    const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<{
        tone: "idle" | "error" | "success";
        message: string;
    }>({
        tone: "idle",
        message: "",
    });

    const handleChange = (
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = event.target;
        const fieldName = name as keyof UserFormData;
        let nextValue = value;

        if (fieldName === "phone") {
            nextValue = nextValue.replace(/\D/g, "").slice(0, 10);
        }

        setFormData((current) => ({
            ...current,
            [fieldName]: nextValue,
        }));

        if (
            fieldName === "name" ||
            fieldName === "email" ||
            fieldName === "phone" ||
            fieldName === "password"
        ) {
            setFieldErrors((current) => ({
                ...current,
                [fieldName]: validateField(fieldName, nextValue),
            }));
        }

        if (status.tone !== "idle") {
            setStatus({ tone: "idle", message: "" });
        }
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const nextFieldErrors: FormFieldErrors = {
            name: validateField("name", formData.name),
            email: validateField("email", formData.email),
            phone: validateField("phone", formData.phone),
            password: validateField("password", formData.password),
        };

        setFieldErrors(nextFieldErrors);

        if (Object.values(nextFieldErrors).some(Boolean)) {
            setStatus({
                tone: "error",
                message: "Fix the highlighted fields and submit again.",
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const response = await fetch("/api/organization/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...getAuthorizationHeader(),
                },
                body: JSON.stringify(formData),
            });

            const responseData = (await response.json()) as CreateUserResponse;

            if (!response.ok) {
                if (responseData.fieldErrors) {
                    setFieldErrors((current) => ({
                        ...current,
                        ...responseData.fieldErrors,
                    }));
                }

                setStatus({
                    tone: "error",
                    message: responseData.message || "Unable to create user.",
                });
                return;
            }

            setFormData(initialFormData);
            setFieldErrors({});
            setStatus({
                tone: "success",
                message: responseData.message || "User created successfully.",
            });
        } catch {
            setStatus({
                tone: "error",
                message: "Network error while creating the user.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#243552]">
                    Full Name
                    <input
                        className={inputClassName}
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Enter full name"
                        autoComplete="name"
                        required
                    />
                    {fieldErrors.name ? (
                        <p className={errorTextClassName}>{fieldErrors.name}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Email
                    <input
                        className={inputClassName}
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="Enter email address"
                        autoComplete="email"
                        required
                    />
                    {fieldErrors.email ? (
                        <p className={errorTextClassName}>{fieldErrors.email}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Phone
                    <input
                        className={inputClassName}
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Enter 10-digit phone number"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        required
                    />
                    {fieldErrors.phone ? (
                        <p className={errorTextClassName}>{fieldErrors.phone}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Password
                    <input
                        className={inputClassName}
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        minLength={8}
                        required
                    />
                    {fieldErrors.password ? (
                        <p className={errorTextClassName}>{fieldErrors.password}</p>
                    ) : null}
                </label>

                <label className="block text-sm font-medium text-[#243552]">
                    Role
                    <select
                        className={inputClassName}
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                    >
                        <option value="teacher">Teacher</option>
                        <option value="parent">Parent</option>
                    </select>
                </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[#60708d]">
                    The user will be linked to your organization automatically.
                </p>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
                >
                    {isSubmitting ? "Creating..." : "Add User"}
                </button>
            </div>

            {status.message ? (
                <p
                    className={`rounded-[1rem] border px-4 py-3 text-sm ${status.tone === "error"
                            ? "border-[#f3c3c3] bg-[#fff5f5] text-[#a23232]"
                            : "border-[#bddfc7] bg-[#f3fff6] text-[#20683c]"
                        }`}
                    aria-live="polite"
                >
                    {status.message}
                </p>
            ) : null}
        </form>
    );
}
