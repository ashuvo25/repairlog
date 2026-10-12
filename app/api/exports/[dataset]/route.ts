import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/permissions/current-membership";
import { createClient } from "@/lib/supabase/server/client";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;

type Row = Record<string, unknown>;

type Dataset = {
  fileName: string;
  columns: { key: string; header: string }[];
  load: (organizationId: string) => Promise<Row[]>;
};

// Spreadsheet apps run cells that start with these characters as formulas.
function toCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns: Dataset["columns"], rows: Row[]) {
  const lines = [
    columns.map((column) => toCell(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => toCell(row[column.key])).join(",")),
  ];

  // The byte-order mark makes Excel read accented characters correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}

async function datasets(): Promise<Record<string, Dataset>> {
  const supabase = await createClient();

  const equipmentNames = async (organizationId: string) => {
    const { data } = await supabase
      .from("equipment")
      .select("id, name")
      .eq("organization_id", organizationId);
    return new Map(
      ((data ?? []) as { id: string; name: string }[]).map((item) => [item.id, item.name]),
    );
  };

  const ticketEquipment = async (organizationId: string) => {
    const [{ data }, names] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, equipment_id")
        .eq("organization_id", organizationId)
        .limit(MAX_ROWS),
      equipmentNames(organizationId),
    ]);
    return new Map(
      ((data ?? []) as { id: string; equipment_id: string }[]).map((ticket) => [
        ticket.id,
        names.get(ticket.equipment_id) ?? "",
      ]),
    );
  };

  async function select(
    table: string,
    columns: string,
    organizationId: string,
    orderBy: string,
  ) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("organization_id", organizationId)
      .order(orderBy, { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      throw new Error(`Export of ${table} failed.`);
    }

    return (data ?? []) as unknown as Row[];
  }

  return {
    equipment: {
      fileName: "equipment",
      columns: [
        { key: "name", header: "Name" },
        { key: "category", header: "Category" },
        { key: "condition", header: "Condition" },
        { key: "archived_at", header: "Archived at" },
        { key: "created_at", header: "Created at" },
        { key: "updated_at", header: "Updated at" },
      ],
      load: (organizationId) =>
        select(
          "equipment",
          "name, category, condition, archived_at, created_at, updated_at",
          organizationId,
          "created_at",
        ),
    },
    tickets: {
      fileName: "tickets",
      columns: [
        { key: "equipment", header: "Equipment" },
        { key: "status", header: "Status" },
        { key: "priority", header: "Priority" },
        { key: "category", header: "Category" },
        { key: "description", header: "Description" },
        { key: "created_at", header: "Reported at" },
        { key: "resolved_at", header: "Resolved at" },
        { key: "reopened_reason", header: "Reopened reason" },
      ],
      load: async (organizationId) => {
        const [rows, names] = await Promise.all([
          select(
            "tickets",
            "equipment_id, status, priority, category, description, created_at, resolved_at, reopened_reason",
            organizationId,
            "created_at",
          ),
          equipmentNames(organizationId),
        ]);
        return rows.map((row) => ({
          ...row,
          equipment: names.get(String(row.equipment_id)) ?? "",
        }));
      },
    },
    "repair-history": {
      fileName: "repair-history",
      columns: [
        { key: "equipment", header: "Equipment" },
        { key: "work_date", header: "Work date" },
        { key: "technician_name", header: "Technician" },
        { key: "work_note", header: "Work done" },
        { key: "created_at", header: "Recorded at" },
      ],
      load: async (organizationId) => {
        const [rows, tickets] = await Promise.all([
          select(
            "repair_updates",
            "ticket_id, work_date, technician_name, work_note, created_at",
            organizationId,
            "work_date",
          ),
          ticketEquipment(organizationId),
        ]);
        return rows.map((row) => ({
          ...row,
          equipment: tickets.get(String(row.ticket_id)) ?? "",
        }));
      },
    },
    costs: {
      fileName: "repair-costs",
      columns: [
        { key: "equipment", header: "Equipment" },
        { key: "recorded_date", header: "Date" },
        { key: "amount", header: "Amount" },
        { key: "currency", header: "Currency" },
        { key: "note", header: "Note" },
      ],
      load: async (organizationId) => {
        const [rows, tickets] = await Promise.all([
          select(
            "repair_costs",
            "ticket_id, recorded_date, amount_minor, currency, note",
            organizationId,
            "recorded_date",
          ),
          ticketEquipment(organizationId),
        ]);
        return rows.map((row) => ({
          ...row,
          equipment: tickets.get(String(row.ticket_id)) ?? "",
          amount: (Number(row.amount_minor) / 100).toFixed(2),
        }));
      },
    },
  };
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/exports/[dataset]">,
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  // Exports include costs, so they are owner-only (row-level security also
  // hides costs from staff).
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ message: "Owner access required." }, { status: 403 });
  }

  const { dataset } = await context.params;
  const all = await datasets();
  const selected = all[dataset];

  if (!selected) {
    return NextResponse.json({ message: "Unknown export." }, { status: 404 });
  }

  try {
    const rows = await selected.load(membership.organizationId);
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(toCsv(selected.columns, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="repairlog-${selected.fileName}-${date}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Export failed", {
      dataset,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ message: "Export failed." }, { status: 500 });
  }
}
