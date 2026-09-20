"use client";

import { useFormStatus } from "react-dom";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowTextField } from "~/components/flow/ui/TextField";

// Inner component so useFormStatus reads the enclosing <form>: the page owns the action
// state, this owns the pending state.
const AuthSubmit = ({ label, pendingLabel }: { label: string; pendingLabel: string }) => {
  const { pending } = useFormStatus();

  return (
    <FlowButton className="mt-1 w-full" disabled={pending} type="submit">
      {pending ? pendingLabel : label}
      <output aria-live="polite" className="sr-only">
        {pending ? pendingLabel : ""}
      </output>
    </FlowButton>
  );
};

interface AuthFieldsProps {
  submitLabel: string;
  pendingLabel: string;
  defaultEmail?: string;
  /** Rendered above the submit button; comes from the action state, never an effect. */
  error?: string;
}

export const AuthFields = ({
  submitLabel,
  pendingLabel,
  defaultEmail = "",
  error,
}: AuthFieldsProps) => (
  <div className="flex flex-col gap-3.5">
    <FlowTextField
      autoComplete="email"
      className="bg-paper focus:bg-paper"
      defaultValue={defaultEmail}
      inputMode="email"
      label="Email"
      name="email"
      placeholder="you@example.com"
      required
      type="email"
    />
    <FlowTextField
      autoComplete="current-password"
      className="bg-paper focus:bg-paper"
      label="Password"
      name="password"
      placeholder="At least 6 characters"
      required
      type="password"
    />
    {error === undefined ? undefined : (
      <p className="text-label-md text-ember-deep" role="alert">
        {error}
      </p>
    )}
    <AuthSubmit label={submitLabel} pendingLabel={pendingLabel} />
  </div>
);
