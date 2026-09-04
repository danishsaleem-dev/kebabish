import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import TeamView from "@/components/admin/TeamView";
import { auth } from "@/lib/auth";
import { listAdminUsers } from "@/lib/admin/auth-users";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const users = await listAdminUsers();

  return (
    <AdminShell title="Team">
      <TeamView
        users={users}
        currentUserId={session.user.id}
        isOwner={session.user.role === "owner"}
      />
    </AdminShell>
  );
}
