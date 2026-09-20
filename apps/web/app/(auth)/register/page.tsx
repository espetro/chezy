"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { AuthFields } from "~/components/flow/auth/AuthFields";
import { type RegisterActionState, register } from "../actions";

// Derived from the action state during render — no effect, no toast. A successful
// sign-up never reaches here: the server action redirects into /onboarding.
const errorFor = (status: RegisterActionState["status"]) => {
  if (status === "user_exists") return "That email already has an account. Sign in instead.";
  if (status === "failed") return "We could not create the account. Try again.";
  if (status === "invalid_data") return "Enter a valid email and a password of 6+ characters.";
  return undefined;
};

export default function Page() {
  const [email, setEmail] = useState("");
  const [state, formAction] = useActionState<RegisterActionState, FormData>(register, {
    status: "idle",
  });

  const handleSubmit = (formData: FormData) => {
    setEmail(String(formData.get("email") ?? ""));
    formAction(formData);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-headline-md text-obsidian">Create your account</h1>
        <p className="text-body-default text-steel">
          Next you tell Chezy what you are looking for. It starts scanning partner listings right
          after.
        </p>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-5">
        <AuthFields
          defaultEmail={email}
          error={errorFor(state.status)}
          pendingLabel="Creating your account…"
          submitLabel="Sign up"
        />
        <p className="text-center text-label-md text-fog">
          {"Have an account? "}
          <Link
            className="inline-block py-3.5 text-obsidian underline underline-offset-4 hover:text-ember-deep"
            href="/login"
          >
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
