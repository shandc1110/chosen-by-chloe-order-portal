import "server-only";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type StaffContext = {
  userId: string;
  email: string | undefined;
};

/** Defence-in-depth staff auth check for API route handlers. */
export async function requireStaff(): Promise<
  { staff: StaffContext; error: null } | { staff: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      staff: null,
      error: NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 }),
    };
  }

  return {
    staff: { userId: user.id, email: user.email },
    error: null,
  };
}
