"use client";

import { useActionState } from "react";
import ButtonSubmit from "@/components/custom/ButtonSubmit";
import { Input } from "@/components/ui/input";
import { reset } from "../actions";

export default function FormPasswordReset({ email }: { email: string }) {
  const [state, action] = useActionState(reset, { errors: { password: [email] } });

  return (
    <form className="grid gap-4 py-4" action={action}>
      <div className="flex items-center">
        <Input
          id="password1"
          name="password1"
          placeholder="New Password"
          type="password"
          className="flex-grow"
          required
          minLength={8}
          maxLength={16}
        />
      </div>
      <div className="flex items-center">
        <Input
          id="password2"
          name="password2"
          placeholder="Re-type New Password"
          type="password"
          className="flex-grow"
          required
          minLength={8}
          maxLength={16}
        />
      </div>
      {state &&
        typeof state === "object" &&
        state.errors &&
        "password" in state.errors &&
        state.errors.password?.toString() !== email && (
          <p className="text-red-500 text-sm relative bottom-1 left-3">{state.errors.password?.toString()}</p>
        )}
      <div className="text-center relative top-3">
        <ButtonSubmit>Reset Password</ButtonSubmit>
      </div>
    </form>
  );
}
