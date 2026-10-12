"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";

import {
  archiveMenuItem,
  saveMenuItem,
  type MenuActionState,
} from "./actions";

const initialState: MenuActionState = {};

type Machine = { id: string; name: string; category: string };

export function MenuItemForm({
  machines,
  item,
}: Readonly<{
  machines: readonly Machine[];
  item?: {
    id: string;
    name: string;
    alternative: string | null;
    updatedAt: string;
    equipmentIds: readonly string[];
  };
}>) {
  const [state, action, pending] = useActionState(saveMenuItem, initialState);
  const linked = new Set(item?.equipmentIds ?? []);

  return (
    <form action={action} className="space-y-5">
      {item ? (
        <>
          <input type="hidden" name="menuItemId" value={item.id} />
          <input type="hidden" name="updatedAt" value={item.updatedAt} />
        </>
      ) : null}

      <Field label="Menu item">
        <input
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={item?.name}
          placeholder="Flat white"
          className={inputClasses}
        />
      </Field>

      <fieldset>
        <legend className="text-sm font-semibold">Machines needed to make it</legend>
        {machines.length ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {machines.map((machine) => (
              <label
                key={machine.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 hover:border-border-strong has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
              >
                <input
                  type="checkbox"
                  name="equipmentIds"
                  value={machine.id}
                  defaultChecked={linked.has(machine.id)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {machine.name}
                  </span>
                  <span className="block text-xs text-muted">{machine.category}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Add equipment first, then link it here.
          </p>
        )}
      </fieldset>

      <Field
        label="Approved alternative (optional)"
        hint="What staff should offer while this item is affected."
      >
        <textarea
          name="alternative"
          rows={2}
          maxLength={1000}
          defaultValue={item?.alternative ?? ""}
          placeholder="Offer a filter coffee or cold brew instead."
          className={`${inputClasses} resize-y py-3 leading-6`}
        />
      </Field>

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : item ? "Save changes" : "Add menu item"}
      </Button>
    </form>
  );
}

export function ArchiveMenuItemButton({
  menuItemId,
  name,
}: Readonly<{ menuItemId: string; name: string }>) {
  const [state, action, pending] = useActionState(archiveMenuItem, initialState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${name} from menu impact?`)) {
          event.preventDefault();
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="menuItemId" value={menuItemId} />
      <Button type="submit" variant="danger" disabled={pending}>
        {pending ? "Removing…" : "Remove item"}
      </Button>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
    </form>
  );
}
