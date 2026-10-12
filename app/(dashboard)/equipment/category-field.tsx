"use client";

import { useState } from "react";

import { inputClasses } from "@/components/ui/field";
import { EQUIPMENT_CATEGORIES } from "@/lib/modules/equipment/validation";

// Free-text category. The chips are shortcuts only; any value can be typed.
export function CategoryField({
  defaultValue = "",
}: Readonly<{ defaultValue?: string }>) {
  const [category, setCategory] = useState(defaultValue);
  const typed = category.trim().toLowerCase();

  return (
    <div>
      <label className="block">
        <span className="text-sm font-semibold">Category</span>
        <input
          name="category"
          required
          maxLength={80}
          autoComplete="off"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Type any category, such as Coffee or Furniture"
          className={inputClasses}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Quick picks:</span>
        {EQUIPMENT_CATEGORIES.map((item) => {
          const selected = typed === item.toLowerCase();

          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategory(item)}
              className={`min-h-9 rounded-full border px-3 text-sm font-medium transition-colors ${
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-foreground hover:border-border-strong hover:bg-subtle"
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}
