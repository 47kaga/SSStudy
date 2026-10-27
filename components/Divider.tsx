type DividerProps = {
  weight?: "hairline" | "heavy";
};

export function Divider({ weight = "hairline" }: DividerProps) {
  const border = weight === "heavy" ? "border-t-heavy" : "border-t-hairline";
  return <hr className={`${border} border-ink`} />;
}
