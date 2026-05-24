import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import NavigationShell from "./navigation-shell";

export const metadata: Metadata = {
  title: "OrbitWatch | Space Debris Risk Intelligence",
  description: "Real-time satellite conjunction tracking and Kessler cascade collision simulation platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-grid-hud min-h-screen text-primary select-none antialiased">
        <Providers>
          <NavigationShell>
            {children}
          </NavigationShell>
        </Providers>
      </body>
    </html>
  );
}
