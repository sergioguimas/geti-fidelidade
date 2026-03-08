import "./globals.css";

export const metadata = {
  title: "Geti Fidelidade",
  description: "Sistema de fidelidade",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}