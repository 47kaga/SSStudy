// A short plain message marked with a heavy accent rule.
export function Notice({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} role="alert" className="border-l-heavy border-accent pl-2 text-caption">
      {children}
    </p>
  );
}
