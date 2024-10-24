"use client";

import { TAuth } from "@/lib/def";
import { redirect } from "next/navigation";
import { createContext, useContext } from "react";

const dashAuthContextDefault: TAuth = {
  name: "",
  email: "",
  role: "USER",
  clientId: "",
  company: "",
  hostname: "",
  status: "INACTIVE",
};

const dashAuthContext = createContext<TAuth>(dashAuthContextDefault);

export default function DashAuthProvider({ children, authSession }: { children: React.ReactNode; authSession: TAuth }) {
  if (!authSession) {
    console.error("authSession is required for DashAuthProvider");
    // redirect to login page
    redirect("/auth/sign-in");
  } else {
    return <dashAuthContext.Provider value={authSession}>{children}</dashAuthContext.Provider>;
  }
}

export function useDashAuthContext() {
  return useContext(dashAuthContext);
}
