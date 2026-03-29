import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childKey: string }> }
) {
  const { childKey } = await params;
  const body = await request.json();
  const { text, bucket } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: { code: "400", type: "validation_error", message: "Task text is required" } },
      { status: 400 }
    );
  }

  const validBuckets = ["THIS_WEEK", "THIS_MONTH", "PARKED"];
  if (!bucket || !validBuckets.includes(bucket)) {
    return NextResponse.json(
      { error: { code: "400", type: "validation_error", message: "Invalid bucket value" } },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("rcc_tasks")
      .insert({ project_key: childKey, text: text.trim(), bucket })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    console.error("Add task error:", err);
    return NextResponse.json(
      { error: { code: "500", type: "internal_error", message: "Failed to add task" } },
      { status: 500 }
    );
  }
}
