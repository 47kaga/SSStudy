import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Primary (accent fill) is for the single main action on screen. */
  variant?: "primary" | "secondary";
  size?: "default" | "small";
};

const base =
  "border-hairline border-ink text-label uppercase focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-dashed disabled:bg-background disabled:text-ink";

const variants = {
  primary: "bg-accent text-background",
  secondary: "bg-background text-ink",
} as const;

const sizes = {
  default: "px-4 py-2",
  small: "px-2 py-1",
} as const;

export function Button({
  variant = "secondary",
  size = "default",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
