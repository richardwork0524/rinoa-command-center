import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  const projectKey = request.nextUrl.searchParams.get("project_key");

  try {
    let query = supabase
      .from("angelo_session_logs")
      .select("id, project_key, session_date, surface, title, summary")
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (scope !== "global" && projectKey) {
      query = query.eq("project_key", projectKey);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;

    if (!data) {
      return NextResponse.json({ eos: null });
    }

    let displayName: string | null = null;
    if (data.project_key) {
      const { data: proj } = await supabase
        .from("angelo_projects")
        .select("display_name")
        .eq("child_key", data.project_key)
        .single();
      displayName = proj?.display_name || null;
    }

    return NextResponse.json({
      eos: { ...data, display_name: displayName },
    });
  } catch (err) {
    console.error("EOS API error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to load EOS" } },
      { status: 500 }
    );
  }
}
