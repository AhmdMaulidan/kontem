"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Callout,
  DetailDrawer,
  Field,
  FormError,
  IconPlus,
  IconX,
  Input,
  Select,
  SubmitButton,
} from "@/components/ui";
import { categoryLabel } from "@/lib/labels";
import { createBriefTemplateAction, type ActionState } from "../actions";

/** Daftar baris yang bisa ditambah dan dihapus — angle, must-show, larangan. */
function RepeatableRows({
  label,
  hint,
  placeholder,
  name,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  name: string;
}) {
  const [rows, setRows] = useState([""]);

  return (
    <Field label={label} hint={hint}>
      <input
        type="hidden"
        name={name}
        value={rows.map((r) => r.trim()).filter(Boolean).join("\n")}
      />
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={row}
              placeholder={placeholder}
              onChange={(event) =>
                setRows(
                  rows.map((isi, i) => (i === index ? event.target.value : isi)),
                )
              }
            />
            <button
              type="button"
              aria-label={`Hapus baris ${index + 1}`}
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="compact"
          title="Tambah baris"
          onClick={() => setRows([...rows, ""])}
        >
          <IconPlus className="h-4 w-4" />
        </Button>
      </div>
    </Field>
  );
}

export function TemplateForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createBriefTemplateAction,
    {},
  );

  return (
    <DetailDrawer
      label="Tambah template"
      trigger="pill"
      icon={<IconPlus className="h-5 w-5" strokeWidth={2} />}
      iconOnly
      title="Tambah Template"
    >
      <form action={formAction} className="space-y-6">
        <FormError message={state.error} />
        {state.success ? (
          <Callout tone="success" title="Berhasil">
            {state.success}
          </Callout>
        ) : null}

        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">Info dasar</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama template">
              <Input
                name="name"
                required
                placeholder="Kuliner - Kedai & Kafe"
              />
            </Field>

            <Field label="Kategori">
              <Select name="category" defaultValue="KULINER">
                {Object.entries(categoryLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="space-y-4 border-t border-line pt-4">
          <p className="text-sm font-semibold text-foreground">Brief kreatif</p>
          <RepeatableRows
            name="angles"
            label="Angle yang disarankan"
            hint="Sudut pengambilan yang biasanya cocok untuk kategori ini."
            placeholder="Suasana senja di area outdoor"
          />

          <RepeatableRows
            name="mustShow"
            label="Wajib ditampilkan"
            placeholder="Nama & logo tempat"
          />

          <RepeatableRows
            name="prohibited"
            label="Larangan"
            placeholder="Membandingkan dengan kompetitor"
          />
        </div>

        <div className="space-y-4 border-t border-line pt-4">
          <p className="text-sm font-semibold text-foreground">Ketentuan lain</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Durasi minimum (detik)">
              <Input
                name="minDurationSec"
                type="number"
                min={5}
                defaultValue={30}
                className="tabular"
              />
            </Field>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-muted">
                Status
              </legend>
              <div className="flex h-[42px] items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="status"
                    value="aktif"
                    defaultChecked
                  />
                  Aktif
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="status" value="arsip" />
                  Arsip
                </label>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <SubmitButton pendingLabel="Menyimpan template...">
            Simpan template
          </SubmitButton>
        </div>
      </form>
    </DetailDrawer>
  );
}
