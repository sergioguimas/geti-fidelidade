import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SearchableSelectProps<T> = {
  label?: string;
  placeholder: string;
  emptyMessage: string;
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  className?: string;
};

export function SearchableSelect<T>({
  label,
  placeholder,
  emptyMessage,
  options,
  value,
  onChange,
  getOptionValue,
  getOptionLabel,
  className = "",
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => getOptionValue(option) === value),
    [options, value, getOptionValue]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options.slice(0, 12);

    return options
      .filter((option) =>
        getOptionLabel(option).toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 12);
  }, [options, query, getOptionLabel]);

  function updateDropdownPosition() {
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();

    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();

    function handleWindowUpdate() {
      updateDropdownPosition();
    }

    window.addEventListener("scroll", handleWindowUpdate, true);
    window.addEventListener("resize", handleWindowUpdate);

    return () => {
      window.removeEventListener("scroll", handleWindowUpdate, true);
      window.removeEventListener("resize", handleWindowUpdate);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      const clickedInsideWrapper =
        wrapperRef.current && wrapperRef.current.contains(target);

      const clickedInsideDropdown =
        dropdownRef.current && dropdownRef.current.contains(target);

      if (!clickedInsideWrapper && !clickedInsideDropdown) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open && selectedOption) {
      setQuery(getOptionLabel(selectedOption));
    }

    if (!open && !selectedOption) {
      setQuery("");
    }
  }, [open, selectedOption, getOptionLabel]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  function selectOption(option: T) {
    const optionValue = getOptionValue(option);
    const optionLabel = getOptionLabel(option);

    onChange(optionValue);
    setQuery(optionLabel);
    setOpen(false);
  }

  return (
    <div className={className}>
      {label ? (
        <label className="mb-1.5 block text-sm font-medium text-zinc-800">
          {label}
        </label>
      ) : null}

      <div ref={wrapperRef} className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

          <input
            type="text"
            value={open ? query : selectedOption ? getOptionLabel(selectedOption) : query}
            onFocus={() => {
              setOpen(true);
              updateDropdownPosition();
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);

              if (!e.target.value.trim()) {
                onChange("");
              }
            }}
            onKeyDown={(e) => {
              if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
                setOpen(true);
                return;
              }

              if (!filteredOptions.length) {
                if (e.key === "Escape") {
                  setOpen(false);
                }
                return;
              }

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  Math.min(prev + 1, filteredOptions.length - 1)
                );
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex((prev) => Math.max(prev - 1, 0));
              }

              if (e.key === "Enter") {
                e.preventDefault();
                selectOption(filteredOptions[highlightedIndex]);
              }

              if (e.key === "Tab") {
                if (open && filteredOptions[highlightedIndex]) {
                  selectOption(filteredOptions[highlightedIndex]);
                }
              }

              if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder={placeholder}
            className="w-full rounded-lg border border-zinc-400 px-3 py-2 pl-9 pr-10 outline-none focus:border-zinc-500 bg-zinc-100 text-zinc-700 placeholder:text-zinc-400"
          />

          {(value || query) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                onChange("");
                setOpen(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open
        ? createPortal(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className="max-h-64 overflow-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl"
            >
              {filteredOptions.length ? (
                <div className="space-y-1">
                  {filteredOptions.map((option, index) => {
                    const optionValue = getOptionValue(option);
                    const optionLabel = getOptionLabel(option);
                    const isSelected = value === optionValue;
                    const isHighlighted = highlightedIndex === index;

                    return (
                      <button
                        key={optionValue}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={() => selectOption(option)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "bg-zinc-900 text-white"
                            : isHighlighted
                            ? "bg-zinc-100 text-zinc-900"
                            : "text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        {optionLabel}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl px-3 py-2 text-sm text-zinc-500">
                  {emptyMessage}
                </div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}