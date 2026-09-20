"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createUser, getUser } from "~/lib/db/queries";

import { signIn } from "./auth";

// Where each surface hands off once the session cookie is set. Sign-up goes straight
// into the preferences flow; sign-in goes to the feed, which itself redirects to
// /onboarding when the account has no profile yet. Both must run outside the
// try/catch below — redirect() signals by throwing, and a bare catch would swallow it.
const AFTER_LOGIN = "/explore";
const AFTER_REGISTER = "/onboarding";

const authFormSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export type LoginActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
};

const attemptLogin = async (formData: FormData): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export const login = async (_: LoginActionState, formData: FormData): Promise<LoginActionState> => {
  const state = await attemptLogin(formData);
  if (state.status === "success") {
    redirect(AFTER_LOGIN);
  }
  return state;
};

export type RegisterActionState = {
  status: "idle" | "in_progress" | "success" | "failed" | "user_exists" | "invalid_data";
};

const attemptRegister = async (formData: FormData): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists" } as RegisterActionState;
    }
    await createUser(validatedData.email, validatedData.password);
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }

    return { status: "failed" };
  }
};

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  const state = await attemptRegister(formData);
  if (state.status === "success") {
    redirect(AFTER_REGISTER);
  }
  return state;
};
