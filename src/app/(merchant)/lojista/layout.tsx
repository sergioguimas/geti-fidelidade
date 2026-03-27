import type { ReactNode } from "react";
import { MerchantShell } from "@/components/lojista/merchant-shell";
import { requireLojistaPageContext } from "@/lib/auth/page-context";

export default async function LojistaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireLojistaPageContext();

  return <MerchantShell>{children}</MerchantShell>;
}