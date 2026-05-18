import type { ReactNode } from "react";

export const metadata = {
  title: "Pokedex",
  description: "Mergify demo pokedex",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
