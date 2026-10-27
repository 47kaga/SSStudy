import type { ReactNode } from "react";

// A ruled grid cell with a label. Parents provide the top and left rules.
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b-hairline border-r-hairline border-ink p-4 md:p-6">
      <h2 className="text-label uppercase">{title}</h2>
      {children}
    </section>
  );
}
