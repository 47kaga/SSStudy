import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Primary (accent fill) is for the single main action on screen. */
  variant?: "primary" | "secondary";
};

const base =
  "border-hairline border-ink px-4 py-2 text-label uppercase focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-background disabled:text-ink";

const variants = {
  primary: "bg-accent text-background",
  secondary: "bg-background text-ink",
} as const;

export function Button({ variant = "secondary", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
