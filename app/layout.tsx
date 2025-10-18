import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SproutML - Premium ML Training Platform",
  description: "Train machine learning models with ease. Upload, preview, and train with our modern, production-grade platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="min-h-screen bg-background relative">
          {/* Subtle gradient overlay for depth */}
          <div className="fixed inset-0 bg-gradient-to-br from-accent/5 via-transparent to-blue-accent/5 pointer-events-none" />
          <header className="border-b border-border/40 backdrop-blur-sm sticky top-0 z-50 bg-background/95 relative">
            <div className="max-w-[1080px] mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-blue-accent flex items-center justify-center">
                    <svg className="w-5 h-5 text-background" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="text-xl font-semibold gradient-text">SproutML</span>
                </div>
                <nav className="flex items-center gap-6 text-sm">
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Docs</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">API</a>
                  <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Support</a>
                </nav>
              </div>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
