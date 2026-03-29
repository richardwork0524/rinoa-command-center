import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: projects, error: projError } = await supabase
      .from("rcc_projects")
      .select("*")
      .order("display_name");

    if (projError) throw projError;

    // Get task counts per project
    const { data: taskCounts, error: taskError } = await supabase
      .from("rcc_tasks")
      .select("project_key, bucket, completed");

    if (taskError) throw taskError;

    // Build count map
    const countMap = new Map<string, { this_week: number; this_month: number; parked: number }>();
    for (const t of taskCounts || []) {
      if (t.completed) continue;
      if (!countMap.has(t.project_key)) {
        countMap.set(t.project_key, { this_week: 0, this_month: 0, parked: 0 });
      }
      const c = countMap.get(t.project_key)!;
      if (t.bucket === "THIS_WEEK") c.this_week++;
      else if (t.bucket === "THIS_MONTH") c.this_month++;
      else if (t.bucket === "PARKED") c.parked++;
    }

    // Determine leaf nodes
    const parentKeys = new Set((projects || []).map((p) => p.parent_key).filter(Boolean));

    const result = (projects || []).map((p) => {
      const isLeaf = !parentKeys.has(p.child_key) || !(projects || []).some((c) => c.parent_key === p.child_key);
      const tc = countMap.get(p.child_key) || { this_week: 0, this_month: 0, parked: 0 };

      // Children roll-up
      let childrenTaskTotal = 0;
      if (!isLeaf) {
        const children = (projects || []).filter((c) => c.parent_key === p.child_key);
        for (const child of children) {
          const cc = countMap.get(child.child_key);
          if (cc) childrenTaskTotal += cc.this_week + cc.this_month + cc.parked;
        }
      }

      return {
        ...p,
        is_leaf: isLeaf,
        task_counts: tc,
        children_task_total: childrenTaskTotal,
      };
    });

    return NextResponse.json({ projects: result });
  } catch (err) {
    console.error("Projects API error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to load projects" } },
      { status: 500 }
    );
  }
}
