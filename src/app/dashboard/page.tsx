// if not logged in, redirect to login page
import { verifyAuthSession } from "@/auth/session";
import FormSiteIndex from "@/components/dashboard/form-site-index";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return {
    title: "Dashboard Home",
  };
}

export default async function Dashboard() {
  const authSession = await verifyAuthSession();
  if (!authSession) {
    redirect("/auth/sign-in");
  }

  const { hostname } = authSession;

  return (
    <div id="dashboard-home" className="p-4">
      <section id="site-index" className="flex flex-col gap-3 items-center justify-center">
        <h2>Index Site: {hostname}</h2>
        <FormSiteIndex />
      </section>
    </div>
  );
}
