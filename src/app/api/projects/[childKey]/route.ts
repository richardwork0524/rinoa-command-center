import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ childKey: string }> }
) {
  const { childKey } = await params;

  try {
    const { data: project, error: projError } = await supabase
      .from("rcc_projects")
      .select("*")
      .eq("child_key", childKey)
      .single();

    if (projError || !project) {
      return NextResponse.json(
        { error: { code: "404", type: "not_found", message: "Project not found" } },
        { status: 404 }
      );
    }

    const { data: tasks, error: taskError } = await supabase
      .from("rcc_tasks")
      .select("*")
      .eq("project_key", childKey)
      .order("sort_order")
      .order("created_at");

    if (taskError) throw taskError;

    const grouped = {
      this_week: (tasks || []).filter((t) => t.bucket === "THIS_WEEK" && !t.completed),
      this_month: (tasks || []).filter((t) => t.bucket === "THIS_MONTH" && !t.completed),
      parked: (tasks || []).filter((t) => t.bucket === "PARKED" && !t.completed),
      completed: (tasks || []).filter((t) => t.completed),
    };

    return NextResponse.json({
      child_key: project.child_key,
      display_name: project.display_name,
      brief: project.brief,
      last_session_date: project.last_session_date,
      tasks: grouped,
    });
  } catch (err) {
    console.error("Project detail error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to load project" } },
      { status: 500 }
    );
  }
}
