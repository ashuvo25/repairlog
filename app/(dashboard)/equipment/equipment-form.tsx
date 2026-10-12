"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { PlusIcon } from "@/components/ui/icons";

import {
  createEquipment,
  type EquipmentActionState,
} from "./actions";
import { CategoryField } from "./category-field";

const initialState: EquipmentActionState = {};

export function NewEquipmentForm() {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(
    createEquipment,
    initialState,
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="requestId" value={requestId} />

      <Field
        label="Equipment name"
        hint="Use the name your team says out loud, so reports are easy to match."
      >
        <input
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          autoFocus
          placeholder="Espresso machine"
          className={inputClasses}
        />
      </Field>

      <CategoryField />

      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Link
          href="/equipment"
          className={buttonClasses({ variant: "secondary", size: "lg" })}
        >
          Cancel
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? null : <PlusIcon />}
          {pending ? "Adding equipment…" : "Add equipment"}
        </Button>
      </div>
    </form>
  );
}
