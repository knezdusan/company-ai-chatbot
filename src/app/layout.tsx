import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/navbar/Navbar";

export const metadata: Metadata = {
  title: "Entry Frame Intelligent Chatbot Technology",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="page-wrapper min-h-svh max-w-7xl mx-auto border-x-2 border-slate-300">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}
