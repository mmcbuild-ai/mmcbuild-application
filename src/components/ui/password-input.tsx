"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * PasswordInput — a password field with an Eye / EyeOff visibility toggle.
 *
 * Drop-in replacement for `<Input type="password" />`. Used on every auth
 * surface (login, signup, reset-password) so the AUTH PAGE PATTERN
 * visibility-toggle requirement is satisfied identically everywhere — one
 * function, consistent behaviour across the app.
 *
 * Registry-free local mirror of `@caistech/corporate-components`
 * `PasswordInput`: kept local because mmcbuild was deliberately decoupled
 * from the private @caistech registry during the 2026-05 migration. Keep the
 * toggle behaviour in sync with the hub component.
 *
 * - Toggle is `tabIndex={-1}` so it never steals tab focus from the form.
 * - `aria-label` switches between "Show password" / "Hide password".
 */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className={cn("pr-11", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export { PasswordInput };
