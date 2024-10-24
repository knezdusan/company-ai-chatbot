"use client";

import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut } from "lucide-react";
import { deleteAuthSession } from "../session";
import Link from "next/link";

export default function NavbarAuthSignOut() {
  const handleLogout = async () => {
    await deleteAuthSession(); // Call the server action
  };

  return (
    <div className="flex gap-2">
      <Link href="/dashboard" className="font-medium flex items-center text-sm transition-colors hover:underline">
        <LayoutDashboard className="mr-2 h-4 w-4" />
        Dashboard
      </Link>
      <Button variant="link" className="flex items-center" onClick={handleLogout}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}
