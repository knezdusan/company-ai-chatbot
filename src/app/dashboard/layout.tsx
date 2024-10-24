import { SidebarProvider } from "@/components/ui/sidebar";
import { DashSidebar } from "@/components/sidebar/dash-sidebar";
import { verifyAuthSession } from "@/auth/session";
import NavbarAuthSignInUp from "@/auth/components/NavbarAuthSignInUp";
import DashAuthProvider from "@/components/dashboard/dash-auth-provider";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const authSession = await verifyAuthSession();

  return !authSession ? (
    <NavbarAuthSignInUp />
  ) : (
    <DashAuthProvider authSession={authSession}>
      <SidebarProvider>
        <DashSidebar />
        <main>{children}</main>
      </SidebarProvider>
    </DashAuthProvider>
  );
}
