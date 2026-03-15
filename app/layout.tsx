import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "juniotrack | Stay Connected to Your Child's School Journey",
  description:
    "Juniotrack connects parents and teachers with real-time updates on attendance, homework, reports, marks, and announcements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
