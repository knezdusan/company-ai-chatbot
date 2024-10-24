"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { ChevronsLeftRightEllipsis, LayoutDashboard } from "lucide-react";
import { useDashAuthContext } from "../dashboard/dash-auth-provider";
import { TAuth } from "@/lib/def";
import Link from "next/link";

export function DashSidebarHead() {
  const { hostname }: TAuth = useDashAuthContext();

  console.log("hostname", hostname);

  const { state, toggleSidebar } = useSidebar();

  return (
    <div className="mt-4">
      <Link className="flex items-center px-2 gap-2 hover:bg-sidebar-accent" href="/dashboard">
        <LayoutDashboard className="h-4 w-4" />
        {state === "expanded" && hostname}
      </Link>
      <button
        onClick={toggleSidebar}
        title="Toggle Sidebar"
        className="absolute -right-2 top-1 hover:bg-sidebar-accent"
      >
        <ChevronsLeftRightEllipsis className="h-4 w-4" />
      </button>
    </div>
  );
}
