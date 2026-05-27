import { NextRequest, NextResponse } from "next/server";
import { requireLojistaContext } from "@/lib/auth/server-context";
import { getDashboardData } from "@/lib/merchant/dashboard";

function isValidDateOnly(value: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getDefaultPeriod() {
  const hoje = new Date();
  const dataFim = hoje.toISOString().slice(0, 10);

  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 30);
  const dataInicio = inicio.toISOString().slice(0, 10);

  return {
    dataInicio,
    dataFim,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, lojistaId } = await requireLojistaContext(request);
    const { searchParams } = new URL(request.url);

    const defaultPeriod = getDefaultPeriod();

    const dataInicioParam = searchParams.get("dataInicio");
    const dataFimParam = searchParams.get("dataFim");

    const dataInicio = isValidDateOnly(dataInicioParam)
      ? dataInicioParam!
      : defaultPeriod.dataInicio;

    const dataFim = isValidDateOnly(dataFimParam)
      ? dataFimParam!
      : defaultPeriod.dataFim;

    if (dataInicio > dataFim) {
      return NextResponse.json(
        { error: "A data inicial não pode ser maior que a data final." },
        { status: 400 }
      );
    }

    const data = await getDashboardData(supabase, lojistaId, {
      dataInicio,
      dataFim,
    });

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