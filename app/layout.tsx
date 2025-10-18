import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SproutML — Modern Machine Learning Platform",
  description: "Upload your dataset, select your target, and train ML models with ease. A modern, intuitive platform for machine learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
