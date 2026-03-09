interface RecoverPasswordPanelProps {
  activeTab: "merchant" | "customer";
  onBack: () => void;
}

export function RecoverPasswordPanel({
  activeTab,
  onBack,
}: RecoverPasswordPanelProps) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-8 shadow-sm">
      <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
        Recuperação
      </span>

      <h2 className="mt-4 text-2xl font-semibold text-zinc-900">
        Recuperar acesso
      </h2>

      <p className="mt-3 text-sm leading-6 text-zinc-500">
        {activeTab === "merchant"
          ? "Para lojistas, podemos enviar instruções para redefinição de senha no email cadastrado."
          : "Para clientes, a recuperação pode ser feita usando o CNPJ vinculado ao cadastro e o canal de contato registrado."}
      </p>

      <div className="mt-6 space-y-2">
        <label
          htmlFor="recover-input"
          className="text-sm font-medium text-zinc-700"
        >
          {activeTab === "merchant" ? "Email cadastrado" : "CNPJ cadastrado"}
        </label>

        <input
          id="recover-input"
          type={activeTab === "merchant" ? "email" : "text"}
          className="h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
          placeholder={
            activeTab === "merchant"
              ? "voce@empresa.com"
              : "00.000.000/0000-00"
          }
        />
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4 text-sm text-zinc-600 ring-1 ring-zinc-100">
        Esta tela pode virar um fluxo real depois, com envio de email, validação
        de CNPJ e confirmação por código.
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-8 h-11 w-full rounded-2xl border border-zinc-200 bg-white text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
      >
        Voltar
      </button>
    </div>
  );
}