import { UsersTabs } from "./users-tabs";

export default function UsersPage() {
    return (
        <>
            <div>
                <h1 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold tracking-[-0.03em] text-[#0f1f3a]">
                    Users
                </h1>
                <p className="mt-1 text-sm leading-6 text-[#60708d]">
                    Add and manage teachers and parents in your organization.
                </p>
            </div>

            <UsersTabs />
        </>
    );
}
