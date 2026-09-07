import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials, type AdminRole } from "@/lib/admin/auth-users";
import { verifyCustomerCredentials } from "@/lib/customers/accounts";

export type Role = AdminRole | "customer";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    name?: string;
    email?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT sessions, not the database adapter — neither admin_users nor
  // customers is a full Auth.js schema, they're plain credential tables.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  // Reuses ADMIN_SESSION_SECRET (already in .env.example) rather than
  // requiring a second secret named AUTH_SECRET.
  secret: process.env.ADMIN_SESSION_SECRET,

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // One login form for everyone; staff/owner accounts are checked
        // first since that table is small and rarely hit, customers are
        // the common case. If the same email somehow exists in both
        // tables, the admin account wins — that's an edge case worth
        // noting, not one worth building account-linking for right now.
        const admin = await verifyCredentials(email, password);
        if (admin) {
          return { id: admin.id, email: admin.email, name: admin.name, role: admin.role };
        }

        const customer = await verifyCustomerCredentials(email, password);
        if (customer) {
          return {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            role: "customer" as const,
          };
        }

        return null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // `user` only exists on the sign-in request; persist what the session
      // needs onto the token so it survives subsequent requests.
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
        token.name = user.name ?? undefined;
        token.email = user.email ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id ?? "";
      session.user.role = token.role ?? "customer";
      session.user.name = token.name ?? "";
      session.user.email = token.email ?? "";
      return session;
    },
  },
});

/** Where a signed-in user's role means they should land. */
export function homeForRole(role: Role): string {
  if (role === "customer") return "/dashboard";
  if (role === "rider") return "/rider";
  return "/admin";
}
