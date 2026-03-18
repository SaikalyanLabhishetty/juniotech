"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Users, UserPlus, GraduationCap, TrendingUp } from "lucide-react";

import { getAuthorizationHeader } from "@/lib/client-auth";

type DashboardStats = {
    totalTeachers: number;
    totalParents: number;
    totalStudents: number;
    studentsByClass: { className: string; count: number }[];
};

export default function DashboardClient() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch("/api/organization/dashboard/stats", {
                    headers: {
                        ...getAuthorizationHeader(),
                    },
                });
                if (!res.ok) {
                    throw new Error("Failed to fetch dashboard stats.");
                }
                const data = await res.json();
                setStats(data.stats);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "An error occurred.";
                setError(message);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0f1f3a]/20 border-t-[#0f1f3a]" />
                    <p className="text-sm text-[#60708d]">Loading dashboard metrics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
                <p>Error: {error}</p>
            </div>
        );
    }

    if (!stats) return null;

    const summaryCards = [
        {
            title: "Total Teachers",
            value: stats.totalTeachers,
            bgColor: "bg-blue-50/50",
            iconColor: "text-blue-600",
            icon: <Users size={28} />,
        },
        {
            title: "Total Parents",
            value: stats.totalParents,
            bgColor: "bg-indigo-50/50",
            iconColor: "text-indigo-600",
            icon: <UserPlus size={28} />,
        },
        {
            title: "Total Students",
            value: stats.totalStudents,
            bgColor: "bg-emerald-50/50",
            iconColor: "text-emerald-600",
            icon: <GraduationCap size={28} />,
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mt-8 flex flex-col gap-8"
        >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {summaryCards.map((card, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index, duration: 0.5 }}
                        className="group flex items-center gap-6 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition-all hover:shadow-md"
                    >
                        <div
                            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 group-hover:rotate-3 ${card.bgColor} ${card.iconColor}`}
                        >
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[#60708d]">
                                {card.title}
                            </p>
                            <h3 className="text-3xl font-bold tracking-tight text-[#0f1f3a]">
                                {card.value}
                            </h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="rounded-3xl border border-[rgba(18,36,76,0.06)] bg-white/70 p-6 shadow-[0_8px_32px_rgba(18,36,76,0.04)] backdrop-blur-[12px] sm:p-8"
            >
                <div className="mb-6 flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-[#0f1f3a]">
                        Students by Class
                    </h2>
                    <p className="text-sm text-[#60708d]">
                        Distribution of students across all registered classes.
                    </p>
                </div>

                {stats.studentsByClass.length === 0 ? (
                    <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#cbd5e1] bg-gray-50/50">
                        <p className="text-sm text-[#60708d]">
                            No students registered yet.
                        </p>
                    </div>
                ) : (
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stats.studentsByClass}
                                margin={{
                                    top: 10,
                                    right: 30,
                                    left: 0,
                                    bottom: 10,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#e2e8f0"
                                />
                                <XAxis
                                    dataKey="className"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#60708d", fontSize: 13 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#60708d", fontSize: 13 }}
                                    dx={-10}
                                />
                                <Tooltip
                                    cursor={{ fill: "#f1f5f9" }}
                                    contentStyle={{
                                        borderRadius: "12px",
                                        border: "1px solid #e2e8f0",
                                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                        fontFamily: "inherit",
                                        fontSize: "14px",
                                    }}
                                    itemStyle={{
                                        color: "#0f1f3a",
                                        fontWeight: 600,
                                    }}
                                />
                                <Bar
                                    dataKey="count"
                                    name="Students"
                                    fill="#4f46e5"
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
