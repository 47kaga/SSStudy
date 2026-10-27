"use client";

import { useActionState } from "react";
import { createProjectAction, type FormState } from "@/app/actions";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { PROJECT_TITLE_MAX_LENGTH } from "@/lib/project-title";

const initialState: FormState = { error: null };

export function ProjectForm() {
  const [state, action, pending] = useActionState(createProjectAction, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="New project"
        name="title"
        maxLength={PROJECT_TITLE_MAX_LENGTH}
        defaultValue={state.value ?? ""}
        error={state.error}
        autoComplete="off"
      />
      <div>
        <Button type="submit" disabled={pending}>
          Add
        </Button>
      </div>
    </form>
  );
}
