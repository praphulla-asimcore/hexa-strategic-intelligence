import "server-only";
import { auth } from "@/auth";
import { config } from "./config";
import { getRole, type Role } from "./db";

export interface Actor {
  email: string;
  name?: string | null;
  image?: string | null;
  role: Role;
  setupMode: boolean;
}

/** Resolves the caller. Before Google sign-in is configured the app runs in setup mode (single admin). */
export async function getActor(): Promise<Actor | null> {
  if (!config.auth()) return { email: "setup-mode", name: "Setup mode", role: "admin", setupMode: true };
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const role = config.db() ? ((await getRole(email)) ?? "viewer") : "viewer";
  return { email, name: session?.user?.name, image: session?.user?.image, role, setupMode: false };
}

export const canEdit = (a: Actor | null) => !!a && (a.role === "admin" || a.role === "editor");
export const isAdmin = (a: Actor | null) => !!a && a.role === "admin";
