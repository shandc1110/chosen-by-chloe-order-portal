import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireStaff, type StaffContext } from "@/lib/thomas/auth/require-staff";

export type StaffRouteContext<TParams = Record<string, string>> = {
  supabase: SupabaseClient;
  staff: StaffContext;
  request: Request;
  params: TParams;
};

/**
 * Wraps admin API handlers with defence-in-depth auth (requireStaff)
 * and consistent Supabase admin client + error handling.
 */
export function staffRoute<TParams = Record<string, string>>(
  handler: (ctx: StaffRouteContext<TParams>) => Promise<NextResponse>,
) {
  return async (
    request: Request,
    context?: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    const auth = await requireStaff();
    if (auth.error) return auth.error;

    let supabase: SupabaseClient;
    try {
      supabase = getSupabaseAdmin();
    } catch {
      return NextResponse.json(
        { success: false, error: "Server not configured." },
        { status: 500 },
      );
    }

    const params = context?.params ? await context.params : ({} as TParams);

    try {
      return await handler({ supabase, staff: auth.staff, request, params });
    } catch {
      return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
    }
  };
}
