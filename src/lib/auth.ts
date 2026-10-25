import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials, type AdminRole } from "@/lib/admin/auth-users";
import { verifyCustomerCredentials } from "@/lib/customers/accounts";
import { customerForOrderAccess } from "@/lib/customers/order-access";

export type Role = AdminRole | "customer";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
    /** When this person signed in (seconds) — checked against the account, see customers/session.ts. */
    issuedAt?: number;
    /** Signed in from an order link, on an account that has no password yet. */
    unconfirmed?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    name?: string;
    email?: string;
    unconfirmed?: boolean;
    /** When the person signed in (ms). Our own field, set once: Auth.js re-issues `iat` whenever the session is refreshed. */
    signedInAt?: number;
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

    // The buyer's way straight into the account their order just created — only ever under
    // the strict rules in customers/account-rules.ts. Used by /api/account/enter, never by
    // the sign-in form.
    Credentials({
      id: "order-access",
      credentials: { ref: {}, token: {} },
      async authorize(credentials) {
        const customer = await customerForOrderAccess(
          String(credentials?.ref ?? ""),
          String(credentials?.token ?? "")
        );
        if (!customer) return null;
        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          role: "customer" as const,
          unconfirmed: true,
        };
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
        token.unconfirmed = (user as { unconfirmed?: boolean }).unconfirmed ? true : undefined;
        token.signedInAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id ?? "";
      session.user.role = token.role ?? "customer";
      session.user.name = token.name ?? "";
      session.user.email = token.email ?? "";
      session.issuedAt = token.signedInAt ? Math.floor(token.signedInAt / 1000) : undefined;
      session.unconfirmed = token.unconfirmed;
      return session;
    },
  },
});

/** Where a signed-in user's role means they should land. */
export function homeForRole(role: Role): string {
  if (role === "customer") return "/dashboard";
  if (role === "rider") return "/rider";
  if (role === "kitchen") return "/kitchen";
  return "/admin";
}
