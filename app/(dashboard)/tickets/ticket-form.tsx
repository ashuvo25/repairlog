"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";

import { createTicket, type TicketActionState } from "./actions";

const initialState: TicketActionState = {};
const MAX_LENGTH = 4000;

export function NewTicketForm({
  equipment,
  selectedEquipmentId,
  isOwner,
}: Readonly<{
  equipment: readonly { id: string; name: string; category: string }[];
  selectedEquipmentId: string | null;
  isOwner: boolean;
}>) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [equipmentId, setEquipmentId] = useState(selectedEquipmentId ?? "");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [state, action, pending] = useActionState(createTicket, initialState);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="requestId" value={requestId} />

      <Field label="Equipment">
        <select
          name="equipmentId"
          required
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
          className={inputClasses}
        >
          <option value="" disabled>
            Choose the equipment
          </option>
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.category}
            </option>
          ))}
        </select>
      </Field>

      <Field label="What is wrong?">
        <textarea
          name="description"
          required
          rows={5}
          maxLength={MAX_LENGTH}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe what you see, hear or smell, and when it started."
          className={`${inputClasses} resize-y py-3 leading-6`}
        />
      </Field>

      <Field
        label="Priority"
        hint="Urgent means service is stopped or there is a safety risk."
      >
        <select
          name="priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className={inputClasses}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </Field>

      {isOwner ? (
        <Field
          label="Machine condition"
          hint="Choose Unavailable if the machine can't be used; menu items that need it show as affected."
        >
          <select name="condition" defaultValue="keep" className={inputClasses}>
            <option value="keep">Keep as it is</option>
            <option value="unavailable">Unavailable: not working</option>
            <option value="operational">Operational: still works</option>
            <option value="unknown">Unknown: needs checking</option>
          </select>
        </Field>
      ) : null}

      <p className="rounded-lg bg-subtle px-4 py-3 text-sm leading-6 text-muted">
        {isOwner
          ? "You can add up to two photos on the next screen."
          : "The owner decides whether the machine is out of service. You can add up to two photos on the next screen."}
      </p>


      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Link
          href="/tickets"
          className={buttonClasses({ variant: "secondary", size: "lg" })}
        >
          Cancel
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating ticket…" : "Create ticket"}
        </Button>
      </div>
    </form>
  );
}
