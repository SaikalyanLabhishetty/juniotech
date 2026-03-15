import { AcademicsTabs } from "./academics-tabs";

export default function AcademicsPage() {
    return (
        <>
            <div>
                <h1 className="text-[clamp(1.8rem,3.5vw,2.4rem)] font-semibold tracking-[-0.03em] text-[#0f1f3a]">
                    Academics
                </h1>
                <p className="mt-1 text-sm leading-6 text-[#60708d]">
                    Create classes, assign class teachers, and add students.
                </p>
            </div>

            <AcademicsTabs />
        </>
    );
}
