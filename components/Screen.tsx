import type { ReactNode } from "react";

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-screen flex-col gap-6 p-4 md:p-8">{children}</div>;
}
