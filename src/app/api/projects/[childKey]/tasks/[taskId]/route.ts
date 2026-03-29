import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ childKey: string; taskId: string }> }
) {
  const { taskId } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !["open", "completed"].includes(status)) {
    return NextResponse.json(
      { error: { code: "400", type: "validation_error", message: "Invalid status value" } },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("rcc_tasks")
      .update({ completed: status === "completed" })
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: { code: "404", type: "not_found", message: "Task not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ task: data });
  } catch (err) {
    console.error("Toggle task error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to update task" } },
      { status: 500 }
    );
  }
}
