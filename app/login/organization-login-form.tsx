"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormData = {
  email: string;
  password: string;
};

type LoginFieldErrors = Partial<Record<keyof LoginFormData, string>>;

type LoginResponse = {
  message?: string;
  fieldErrors?: LoginFieldErrors;
};

const inputClassName =
  "mt-2 w-full rounded-[1rem] border border-[rgba(18,36,76,0.12)] bg-[#f8fbff] px-4 py-3 text-sm text-[#10203f] outline-none transition placeholder:text-[#8a96ad] focus:border-[#1a61ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(26,97,255,0.12)] disabled:cursor-not-allowed disabled:bg-[#eef3fb] disabled:text-[#8a96ad]";

const errorTextClassName = "mt-2 text-xs font-medium text-[#b42318]";

export function OrganizationLoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    tone: "idle" | "error" | "success";
    message: string;
  }>({
    tone: "idle",
    message: "",
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const fieldName = name as keyof LoginFormData;

    setFormData((current) => ({
      ...current,
      [fieldName]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [fieldName]: undefined,
    }));

    if (status.tone !== "idle") {
      setStatus({ tone: "idle", message: "" });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/organization/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(formData),
      });

      const responseData = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setFieldErrors(responseData.fieldErrors || {});
        setStatus({
          tone: "error",
          message: responseData.message || "Unable to login.",
        });
        return;
      }

      setFieldErrors({});
      setFormData((current) => ({
        ...current,
        password: "",
      }));
      setStatus({ tone: "idle", message: "" });
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setStatus({
        tone: "error",
        message: "Network error while logging in.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <label className="block text-sm font-medium text-[#243552]">
        Email
        <input
          className={inputClassName}
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your registered email"
          autoComplete="email"
          required
        />
        {fieldErrors.email ? (
          <p className={errorTextClassName}>{fieldErrors.email}</p>
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
          placeholder="Enter your password"
          autoComplete="current-password"
          minLength={8}
          required
        />
        {fieldErrors.password ? (
          <p className={errorTextClassName}>{fieldErrors.password}</p>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-full bg-[#1a61ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(26,97,255,0.28)] transition hover:-translate-y-px hover:bg-[#114fe0] disabled:cursor-not-allowed disabled:bg-[#7aa5ff] disabled:shadow-none"
      >
        {isSubmitting ? "Logging in..." : "Login"}
      </button>

      {status.message ? (
        <p
          className={`rounded-[1rem] border px-4 py-3 text-sm ${
            status.tone === "error"
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
