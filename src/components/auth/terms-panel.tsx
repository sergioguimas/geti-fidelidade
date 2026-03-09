interface TermsPanelProps {
  onBack: () => void;
}

export function TermsPanel({ onBack }: TermsPanelProps) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-8 shadow-sm">
      <span className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
        Termos
      </span>

      <h2 className="mt-4 text-2xl font-semibold text-zinc-900">
        Termos e condições
      </h2>

      <div className="mt-4 max-h-[320px] space-y-4 overflow-y-auto pr-2 text-sm leading-6 text-zinc-500">
        <p>
          Ao acessar a plataforma, o usuário concorda com o uso do sistema
          conforme as regras operacionais e de segurança definidas.
        </p>
        <p>
          O acesso é pessoal e vinculado ao cadastro autorizado. O uso indevido
          das credenciais pode resultar em bloqueio preventivo.
        </p>
        <p>
          Informações sensíveis devem ser tratadas com responsabilidade, e o
          usuário deve manter seus dados de autenticação em sigilo.
        </p>
        <p>
          Este conteúdo é provisório e depois pode ser substituído pelos termos
          reais da operação.
        </p>
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