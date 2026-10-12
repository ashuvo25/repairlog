"use client";

import { useActionState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import {
  CONDITION_LABELS,
  type EquipmentCondition,
} from "@/lib/modules/equipment/conditions";
import { EQUIPMENT_CONDITIONS } from "@/lib/modules/equipment/validation";

import {
  archiveEquipment,
  changeEquipmentCondition,
  rotateEquipmentQrCode,
  updateEquipment,
  type EquipmentActionState,
} from "./actions";
import { CategoryField } from "./category-field";

const initialState: EquipmentActionState = {};

function ActionMessages({ state }: Readonly<{ state: EquipmentActionState }>) {
  return (
    <>
      {state.error ? <FormMessage tone="error">{state.error}</FormMessage> : null}
      {state.success ? (
        <FormMessage tone="success">{state.success}</FormMessage>
      ) : null}
    </>
  );
}

export function EditEquipmentForm({
  equipmentId,
  version,
  name,
  category,
}: Readonly<{
  equipmentId: string;
  version: number;
  name: string;
  category: string;
}>) {
  const boundAction = updateEquipment.bind(null, equipmentId);
  const [state, action, pending] = useActionState(boundAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="version" value={version} />
      <Field label="Name">
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={name}
          autoComplete="off"
          className={inputClasses}
        />
      </Field>
      <CategoryField defaultValue={category} />
      <ActionMessages state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}

export function ConditionForm({
  equipmentId,
  version,
  condition,
}: Readonly<{
  equipmentId: string;
  version: number;
  condition: EquipmentCondition;
}>) {
  const boundAction = changeEquipmentCondition.bind(null, equipmentId);
  const [state, action, pending] = useActionState(boundAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="version" value={version} />
      <Field
        label="Verified condition"
        hint="Record what you checked in person. Confirming a repair sets it back to Operational."
      >
        <select
          name="condition"
          defaultValue={condition}
          className={inputClasses}
        >
          {EQUIPMENT_CONDITIONS.map((item) => (
            <option key={item} value={item}>
              {CONDITION_LABELS[item]}
            </option>
          ))}
        </select>
      </Field>
      <ActionMessages state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Confirming…" : "Confirm condition"}
      </Button>
    </form>
  );
}

export function RotateQrForm({
  equipmentId,
  version,
}: Readonly<{ equipmentId: string; version: number }>) {
  const boundAction = rotateEquipmentQrCode.bind(null, equipmentId);
  const [state, action, pending] = useActionState(boundAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="version" value={version} />
      <p className="text-sm leading-6 text-muted">
        Replace the code if a label is lost or shared by mistake. The old QR
        link stops working immediately, so printed labels must be replaced.
      </p>
      <ActionMessages state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Replacing…" : "Replace QR code"}
      </Button>
    </form>
  );
}

export function ArchiveEquipmentForm({
  equipmentId,
  version,
  name,
}: Readonly<{ equipmentId: string; version: number; name: string }>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAction = archiveEquipment.bind(null, equipmentId);
  const [state, action, pending] = useActionState(boundAction, initialState);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        Archiving keeps the repair history and turns off new public reports.
      </p>
      <Button variant="danger" onClick={() => dialogRef.current?.showModal()}>
        Archive equipment
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="archive-dialog-title"
        className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-foreground/40"
      >
        <h3 id="archive-dialog-title" className="text-lg font-semibold">
          Archive {name}?
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Its QR code will stop working and the machine will leave your active
          list. Repair history is kept.
        </p>
        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="version" value={version} />
          {state.error ? (
            <FormMessage tone="error">{state.error}</FormMessage>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
