import type { ReactNode } from "react";
import { MerchantShell } from "@/components/lojista/merchant-shell";

export default function LojistaLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <MerchantShell>{children}</MerchantShell>;
}