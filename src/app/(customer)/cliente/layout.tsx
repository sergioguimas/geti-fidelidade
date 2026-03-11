import type { ReactNode } from "react";
import { CustomerShell } from "@/components/cliente/customer-shell";

export default function ClienteLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <CustomerShell>{children}</CustomerShell>;
}