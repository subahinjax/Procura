import React, { useRef } from "react";

type Props = {
  label: string;
  value: string;
  onChange: (val: string) => void;
  maxLength: number;
  disabled?: boolean;
  className?: string;
  warningLength?: number;
};

export default function AutoExpandField({
  label,
  value,
  onChange,
  maxLength,
  disabled = false,
  className = "w-full h-10 px-4 py-2 border border-gray-400 rounded-md focus:ring-2 focus:ring-blue-400 mb-2",
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const baseHeight = 40; // 2.25rem approx same as input h-10

  const adjustHeight = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = `${baseHeight}px`;
    el.style.height = `${Math.max(el.scrollHeight, baseHeight)}px`;
  };

  return (
    <div>
      {/* Label + Counter */}
      <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium">{label}</label>

        <span
          className={`text-xs ${
            value.length > maxLength * 0.9 ? "text-red-500" : "text-gray-500"
          }`}
        >
          {value.length}/{maxLength}
        </span>
      </div>

      {/* Textarea behaving like input */}
      <textarea
        ref={ref}
        rows={1}
        disabled={disabled}
        value={value}
        maxLength={maxLength}
        onChange={(e) => {
          const val = e.target.value.slice(0, maxLength);
          onChange(val);
          adjustHeight();
        }}
        onFocus={adjustHeight}
        onBlur={() => {
          if (ref.current) {
            ref.current.style.height = `${baseHeight}px`;
          }
        }}
        className={`
          w-full
          resize-none
          overflow-hidden
          px-3
          py-2
          rounded-lg
          border
          text-sm
          ${disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""}
          focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-500
          ${className}
        `}
        style={{ height: `${baseHeight}px`, lineHeight: "1.4rem" }}
      />
    </div>
  );
}
