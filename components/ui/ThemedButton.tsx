import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ThemedButtonVariant = "iron" | "crimson";

const BASE =
  "btn2 min-h-11 min-w-11 justify-center no-underline cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-candle-400 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-night-sky";

const VARIANT: Record<ThemedButtonVariant, string> = {
  iron: "",
  crimson:
    "!border-crimson-400 !bg-none !bg-crimson-700 hover:!bg-crimson-500 !text-moon-100",
};

export function themedButtonClass(
  variant: ThemedButtonVariant = "iron",
  extra?: string,
): string {
  return [BASE, VARIANT[variant], extra].filter(Boolean).join(" ");
}

type CommonProps = {
  variant?: ThemedButtonVariant;
  className?: string;
  children: ReactNode;
};

type LinkProps = CommonProps & {
  href: string;
  rel?: string;
  target?: string;
};

type ButtonProps = CommonProps & {
  href?: undefined;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export type ThemedButtonProps = LinkProps | ButtonProps;

/** Iron/crimson plaque control: a Link when `href` is given, else a button. */
export default function ThemedButton(props: ThemedButtonProps) {
  if (typeof props.href === "string") {
    const { variant, className, children, href, rel, target } =
      props as LinkProps;
    return (
      <Link
        href={href}
        rel={rel}
        target={target}
        className={themedButtonClass(variant, className)}
      >
        {children}
      </Link>
    );
  }
  const { variant, className, children, type, ...rest } = props as ButtonProps;
  return (
    <button
      {...rest}
      type={type ?? "button"}
      className={themedButtonClass(variant, className)}
    >
      {children}
    </button>
  );
}
