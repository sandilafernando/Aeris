"use client";

import { cn } from "@/lib/utils";

export function SegmentedControl({ label, name, options, value, onChange, className }) {
  return (
    <fieldset className={className}>
      <legend className="sr-only">{label}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-surface-container p-1.5">
        {options.map((option) => {
          const Icon = option.icon;
          const id = `${name}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-semibold transition-[background-color,color,box-shadow] duration-200",
                "has-[:checked]:bg-primary-container has-[:checked]:text-on-primary-container has-[:checked]:shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
                "hover:bg-surface-container-high",
                value === option.value && "bg-primary-container text-on-primary-container",
              )}
            >
              <input
                id={id}
                name={name}
                type="radio"
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
              <span className="whitespace-nowrap">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
