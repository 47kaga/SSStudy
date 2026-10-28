// One labeled value in a two-column ruled grid. The parent provides the grid and its top and left rules:
// <div className="grid grid-cols-2 border-l-hairline border-t-hairline border-ink">.
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <div className="border-b-hairline border-r-hairline border-ink px-2 py-2 text-label uppercase md:px-4">{label}</div>
      <div className="border-b-hairline border-r-hairline border-ink px-2 py-2 text-right tabular-nums md:px-4">
        {value}
      </div>
    </div>
  );
}
