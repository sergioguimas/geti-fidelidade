type Tab = "merchant" | "customer";

interface LoginTabsProps {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}

export function LoginTabs({ activeTab, onChange }: LoginTabsProps) {
  const isMerchant = activeTab === "merchant";

  function handleToggle() {
    onChange(isMerchant ? "customer" : "merchant");
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={handleToggle}
        className="relative block h-14 w-full select-none overflow-hidden rounded-2xl bg-zinc-100 p-1"
        aria-label={
          isMerchant ? "Trocar para login de cliente" : "Trocar para login de lojista"
        }
      >
        <div
          className="absolute top-1 left-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-[14px] bg-white shadow-sm transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
          style={{
            transform: isMerchant ? "translateX(0%)" : "translateX(calc(100% + 4px))",
          }}
        />

        <div className="relative z-10 grid h-full grid-cols-2">
          <div
            className={`flex items-center justify-center rounded-[14px] text-sm font-medium transition-colors duration-300 ${
              isMerchant ? "text-zinc-950" : "text-zinc-500"
            }`}
          >
            Lojista
          </div>

          <div
            className={`flex items-center justify-center rounded-[14px] text-sm font-medium transition-colors duration-300 ${
              !isMerchant ? "text-zinc-950" : "text-zinc-500"
            }`}
          >
            Cliente
          </div>
        </div>
      </button>
    </div>
  );
}