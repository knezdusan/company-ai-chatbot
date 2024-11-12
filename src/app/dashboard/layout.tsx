import { SidebarProvider } from "@/components/ui/sidebar";
import { DashSidebar } from "@/components/sidebar/dash-sidebar";
import { verifyAuthSession } from "@/auth/session";
import DashAuthProvider from "@/components/dashboard/dash-auth-provider";
import { redirect } from "next/navigation";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const authSession = await verifyAuthSession();

  return !authSession ? (
    redirect("/auth/sign-in")
  ) : (
    <DashAuthProvider authSession={authSession}>
      <SidebarProvider style={{ flexDirection: "column", minHeight: "unset" }}>
        <main className="">{children}</main>
        <DashSidebar />
      </SidebarProvider>
    </DashAuthProvider>
  );
}
