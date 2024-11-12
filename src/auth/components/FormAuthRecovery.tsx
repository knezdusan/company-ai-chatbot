import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recovery } from "../actions";
import ButtonSubmit from "@/components/custom/ButtonSubmit";

export default function AuthRecovery() {
  const [state, action] = useActionState(recovery, null);

  const signUpSuccess =
    state &&
    typeof state === "object" &&
    state.errors &&
    "password" in state.errors &&
    state?.errors?.password?.includes("Success");

  return signUpSuccess ? (
    <p>🚀 Recovery email sent, please check your email (and spam folder, just in case 😅).</p>
  ) : (
    <form className="grid gap-4 py-4" action={action}>
      <div className="flex items-center">
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="Your Company Email Address"
          className="flex-grow"
          required
        />
      </div>
      {state && typeof state === "object" && state.errors && "email" in state.errors && (
        <p className="text-red-500 text-sm relative bottom-1 left-3">{state.errors.email}</p>
      )}
      <div className="text-center relative top-3">
        <Button type="submit" className="min-w-56">
          <ButtonSubmit>Send Recovery Email</ButtonSubmit>
        </Button>
      </div>
    </form>
  );
}
