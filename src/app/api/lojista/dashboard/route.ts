import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/merchant/dashboard";
import type { DashboardRange } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lojistaId = searchParams.get("lojistaId");
    const range = (searchParams.get("range") ?? "30d") as DashboardRange;

    if (!lojistaId) {
      return NextResponse.json(
        { error: "lojistaId é obrigatório." },
        { status: 400 }
      );
    }

    if (!["7d", "30d", "90d"].includes(range)) {
      return NextResponse.json(
        { error: "range inválido." },
        { status: 400 }
      );
    }

    const data = await getDashboardData(lojistaId, range);
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