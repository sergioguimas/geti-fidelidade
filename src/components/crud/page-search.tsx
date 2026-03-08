"use client";

import { Search } from "lucide-react";

type PageSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function PageSearch({
  value,
  onChange,
  placeholder,
}: PageSearchProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400"
        />
      </div>
    </section>
  );
}