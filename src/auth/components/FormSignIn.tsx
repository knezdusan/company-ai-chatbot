import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { signin } from "../actions";
import ButtonSubmit from "@/components/custom/ButtonSubmit";

export default function FormSignIn() {
  const [state, action] = useActionState(signin, null);

  return (
    <form className="grid gap-4 py-4" action={action}>
      <div className="flex items-center">
        <Input id="email" name="email" type="email" placeholder="Your Company email" className="flex-grow" required />
      </div>
      {state && typeof state === "object" && state.errors && "email" in state.errors && (
        <p className="text-red-500 text-sm relative bottom-1 left-3">{state.errors.email}</p>
      )}
      <div className="flex items-center">
        <Input
          id="password"
          name="password"
          placeholder="Password"
          type="password"
          className="flex-grow"
          required
          minLength={8}
          maxLength={16}
        />
      </div>
      {state && typeof state === "object" && state.errors && "password" in state.errors && (
        <p className="text-red-500 text-sm relative bottom-1 left-3 pl-3">{state.errors.password}</p>
      )}
      <div className="text-center relative top-3">
        <ButtonSubmit>Sign in</ButtonSubmit>
      </div>
    </form>
  );
}
