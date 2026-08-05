import { createInventorySupabaseClient } from "./supabase-server";
import { cookies } from "next/headers";

export const INVENTORY_MODULE_ID = "inventory";
export const STICKNEY_DEPARTMENT_SLUG = "stickney-fire-department";

export type InventorySessionContext = {
  user: {
    id: string;
    email: string;
  };
  department: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
  grants: string[];
  expiresAt: number;
};

export type InventorySessionResult =
  | {
    ok: true;
    token: string;
    context: InventorySessionContext;
  }
  | {
    ok: false;
    status: number;
    error: string;
  };

async function verifiedSession(): Promise<InventorySessionResult> {
  try {
    const supabase = await createInventorySupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.id || !user.email) {
      return {
        ok: false,
        status: 401,
        error: "Your session has expired. Sign in to the department portal again.",
      };
    }

    const [{ data: department, error: departmentError }, ownerResult] = await Promise.all([
      supabase
        .from("departments")
        .select("id,name,slug")
        .eq("slug", STICKNEY_DEPARTMENT_SLUG)
        .maybeSingle(),
      supabase.rpc("is_platform_owner"),
    ]);
    if (departmentError || !department?.id) {
      return {
        ok: false,
        status: 503,
        error: "Stickney Inventory has not finished connecting to the department record.",
      };
    }

    const membershipResult = await supabase
      .from("department_memberships")
      .select("role,status")
      .eq("department_id", department.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (ownerResult.error || membershipResult.error) {
      return {
        ok: false,
        status: 503,
        error: "Department authorization could not be verified.",
      };
    }

    const isOwner = ownerResult.data === true;
    const membership = membershipResult.data as { role?: string } | null;
    if (!isOwner && !membership?.role) {
      return {
        ok: false,
        status: 403,
        error: "A Stickney administrator must approve Inventory access for this account.",
      };
    }

    const cookieStore = await cookies();
    const unlockToken = cookieStore.get("__Secure-firehouse-pin")?.value ?? "";
    const { data: pinRows, error: pinError } = await supabase.rpc("portal_pin_status", {
      p_unlock_token: unlockToken || null,
    });
    if (pinError) {
      return { ok: false, status: 503, error: "Portal PIN security could not be verified." };
    }
    const pinStatus = (Array.isArray(pinRows) ? pinRows[0] : pinRows) as { configured?: boolean; unlocked?: boolean } | null;
    if (!pinStatus?.configured) {
      return { ok: false, status: 423, error: "Open the Operations Portal and create your 4 to 6 digit PIN before opening Inventory." };
    }
    if (pinStatus?.configured && !pinStatus.unlocked) {
      return { ok: false, status: 423, error: "Open the Operations Portal and enter your PIN before opening Inventory." };
    }

    return {
      ok: true,
      token: "",
      context: {
        user: { id: user.id, email: user.email.toLowerCase() },
        department: {
          id: String(department.id),
          name: String(department.name),
          slug: String(department.slug),
        },
        role: isOwner ? "owner" : String(membership?.role || "user"),
        grants: [INVENTORY_MODULE_ID],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      },
    };
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Inventory secure access is temporarily unavailable.",
    };
  }
}

export async function verifyInventoryRequest(request: Request) {
  void request;
  return verifiedSession();
}

export async function verifyInventoryServerSession() {
  return verifiedSession();
}

export function sameOriginInventoryRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function canMutateInventory(role: string) {
  return ["owner", "admin", "chief", "inspector", "user"].includes(
    role.trim().toLowerCase(),
  );
}

export function sessionFailureResponse(
  result: Extract<InventorySessionResult, { ok: false }>,
) {
  return Response.json(
    { authenticated: false, error: result.error },
    {
      status: result.status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
