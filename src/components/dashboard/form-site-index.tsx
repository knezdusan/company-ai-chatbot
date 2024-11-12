"use client";

import { useActionState } from "react";
import { crawler } from "@/actions/crawler";
import { Button } from "../ui/button";
// import { useDashAuthContext } from "./dash-auth-provider";

export default function FormSiteIndex() {
  // const { hostname } = useDashAuthContext();
  const [crawlerState, action, isPending] = useActionState(crawler, null);

  return (
    <form action={action} className="flex flex-col gap-2 items-center justify-center">
      <input id="rootUrl" name="rootUrl" className="border border-gray-500 p-1" placeholder="https://example.com" />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Indexing..." : "Index Site"}
      </Button>

      {!crawlerState?.success ? (
        <p className="text-sm text-red-500" dangerouslySetInnerHTML={{ __html: crawlerState?.message || "" }} />
      ) : (
        <p className="text-sm text-green-500" dangerouslySetInnerHTML={{ __html: crawlerState.message }} />
      )}
    </form>
  );
}
