import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import { getDashboardData } from "@/lib/merchant/dashboard";
import type { DashboardRange } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get("range") ?? "30d") as DashboardRange;

    if (!["7d", "30d", "90d"].includes(range)) {
      return NextResponse.json(
        { error: "range inválido." },
        { status: 400 }
      );
    }

    const data = await getDashboardData(supabase, lojistaId, range);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar dashboard.",
      },
      { status: 500 }
    );
  }
}