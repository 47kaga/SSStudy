import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Notice } from "@/components/Notice";

const control =
  "w-full border-hairline border-ink bg-background px-2 py-2 text-body text-ink focus:outline-2 focus:outline-accent disabled:cursor-not-allowed";

type Shared = {
  label: string;
  error?: string | null;
};

function FieldFrame({ label, error, id, children }: Shared & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label uppercase">
        {label}
      </label>
      {children}
      {error ? <Notice id={`${id}-error`}>{error}</Notice> : null}
    </div>
  );
}

export function Field({ label, error, ...input }: Shared & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} id={id}>
      <input
        id={id}
        type="text"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={control}
        {...input}
      />
    </FieldFrame>
  );
}

export function SelectField({ label, error, children, ...select }: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} id={id}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={control}
        {...select}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

export function TextAreaField({ label, error, ...textarea }: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldFrame label={label} error={error} id={id}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={control}
        {...textarea}
      />
    </FieldFrame>
  );
}
