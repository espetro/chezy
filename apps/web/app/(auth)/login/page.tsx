"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { AuthFields } from "~/components/flow/auth/AuthFields";
import { type LoginActionState, login } from "../actions";

// Derived from the action state during render — no effect, no toast. A successful
// sign-in never reaches here: the server action redirects to /explore.
const errorFor = (status: LoginActionState["status"]) => {
  if (status === "failed") return "That email and password do not match an account.";
  if (status === "invalid_data") return "Enter a valid email and a password of 6+ characters.";
  return undefined;
};

export default function Page() {
  const [email, setEmail] = useState("");
  const [state, formAction] = useActionState<LoginActionState, FormData>(login, { status: "idle" });

  const handleSubmit = (formData: FormData) => {
    setEmail(String(formData.get("email") ?? ""));
    formAction(formData);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-headline-md text-obsidian">Welcome back</h1>
        <p className="text-body-default text-steel">
          Sign in to pick up where your agent left off.
        </p>
      </div>

      <form action={handleSubmit} className="flex flex-col gap-5">
        <AuthFields
          defaultEmail={email}
          error={errorFor(state.status)}
          pendingLabel="Signing you in…"
          submitLabel="Sign in"
        />
        <p className="text-center text-label-md text-fog">
          {"No account? "}
          <Link
            className="text-obsidian underline underline-offset-4 hover:text-ember-deep"
            href="/register"
          >
            Sign up
          </Link>
        </p>
      </form>
    </>
  );
}
