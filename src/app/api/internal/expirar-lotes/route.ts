import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = `Bearer ${process.env.INTERNAL_CRON_SECRET}`;

    if (!process.env.INTERNAL_CRON_SECRET) {
      return NextResponse.json(
        { error: "INTERNAL_CRON_SECRET não configurado." },
        { status: 500 }
      );
    }

    if (authHeader !== expected) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase.rpc("fn_expirar_lotes");

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      expirados: Number(data ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao expirar lotes.",
      },
      { status: 500 }
    );
  }
}