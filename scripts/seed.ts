import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = "https://flxedkwpdbgofgeivntq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZseGVka3dwZGJnb2ZnZWl2bnRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDE1NzEsImV4cCI6MjA5MDI3NzU3MX0.veE07MCAl1SataPZ8yS1pqg2uw-70GklkYTpIPBdnoQ";

const RINOA_ROOT = "/Users/richard/My Drive/Rinoa-OS";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface ProjectEntry {
  child_key: string;
  parent_key: string;
  rinoa_path: string;
  display_name: string;
  belongs_to: string;
}

function parseHierarchy(csv: string): ProjectEntry[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  return lines.slice(1).filter(Boolean).map((line) => {
    const [parent, child, rinoa_path, display_name, belongs_to] = line.split(",").map((s) => s.trim());
    return { parent_key: parent, child_key: child, rinoa_path, display_name, belongs_to: belongs_to || "" };
  });
}

function parseSummary(md: string): { brief: string | null; next_action: string | null; last_session_date: string | null } {
  let brief: string | null = null;
  let nextAction: string | null = null;
  let lastSessionDate: string | null = null;

  const briefMatch = md.match(/^##\s*Brief\s*\n([\s\S]*?)(?=\n##|\n$)/im);
  if (briefMatch) brief = briefMatch[1].trim() || null;

  const nextMatch = md.match(/^##\s*Next action\s*\n(.+)/im);
  if (nextMatch) nextAction = nextMatch[1].trim() || null;

  const sessionMatch = md.match(/\[([A-Z][a-z]{2}\s+\d{1,2})\s*\|/);
  if (sessionMatch) {
    const year = new Date().getFullYear();
    const parsed = new Date(`${sessionMatch[1]} ${year}`);
    if (!isNaN(parsed.getTime())) lastSessionDate = parsed.toISOString().split("T")[0];
  }

  return { brief, next_action: nextAction, last_session_date: lastSessionDate };
}

interface TaskItem {
  text: string;
  bucket: string;
  completed: boolean;
  sort_order: number;
  priority: string | null;
  is_owner_action: boolean;
}

function parseTasks(md: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  let currentBucket: string | null = null;
  let sortOrder = 0;

  for (const line of md.split("\n")) {
    const trimmed = line.trim();
    if (/^##\s*THIS WEEK/i.test(trimmed)) { currentBucket = "THIS_WEEK"; continue; }
    if (/^##\s*THIS MONTH/i.test(trimmed)) { currentBucket = "THIS_MONTH"; continue; }
    if (/^##\s*PARKED/i.test(trimmed)) { currentBucket = "PARKED"; continue; }
    if (/^##\s*(COMPLETED|DONE)/i.test(trimmed)) { currentBucket = null; continue; }
    if (/^#/.test(trimmed)) continue;
    if (!currentBucket) continue;

    const taskMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)/);
    if (taskMatch) {
      let taskText = taskMatch[2].trim();
      const completed = taskMatch[1].toLowerCase() === "x";

      // Detect owner-action markers
      let isOwnerAction = false;
      if (taskText.includes("⚡") || taskText.includes("(owner-action)")) {
        isOwnerAction = true;
        taskText = taskText.replace(/⚡/g, "").replace(/\(owner-action\)/gi, "").trim();
      }

      // Detect priority markers
      let priority: string | null = null;
      const priorityMatch = taskText.match(/\b(P[012])\b/);
      if (priorityMatch) {
        priority = priorityMatch[1];
      }

      tasks.push({
        text: taskText,
        bucket: currentBucket,
        completed,
        sort_order: sortOrder++,
        priority,
        is_owner_action: isOwnerAction,
      });
    }
  }
  return tasks;
}

interface SessionLogItem {
  session_date: string;
  surface: string;
  title: string;
  summary: string | null;
}

function parseSessionLog(filename: string, content: string): SessionLogItem | null {
  // Extract date from filename prefix (YYYY-MM-DD)
  const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const sessionDate = dateMatch[1];

  // Extract surface from "Surface: Chat|Code|Cowork" line
  let surface = "CHAT"; // default
  const surfaceMatch = content.match(/Surface:\s*(Chat|Code|Cowork)/i);
  if (surfaceMatch) {
    surface = surfaceMatch[1].toUpperCase();
  }

  // Extract title from first # heading
  let title = filename.replace(/\.md$/, "");
  const titleMatch = content.match(/^#\s+(.+)/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Extract summary from ## Summary section (first paragraph)
  let summary: string | null = null;
  const summaryMatch = content.match(/^##\s*Summary\s*\n([\s\S]*?)(?=\n##|\n$)/im);
  if (summaryMatch) {
    const rawSummary = summaryMatch[1].trim();
    // Take the first paragraph only
    const firstParagraph = rawSummary.split("\n\n")[0]?.trim();
    if (firstParagraph) summary = firstParagraph;
  }

  return { session_date: sessionDate, surface, title, summary };
}

function readFileIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function seed() {
  console.log("Reading _hierarchy.csv...");
  const csvPath = path.join(RINOA_ROOT, "_hierarchy.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");
  const entries = parseHierarchy(csv);
  console.log(`Found ${entries.length} projects`);

  // TRUNCATE existing data (order matters: children first due to FK constraints)
  console.log("Truncating existing rcc_ data...");
  const { error: truncLogErr } = await supabase.from("rcc_session_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (truncLogErr) console.error("  Truncate session_logs:", truncLogErr.message);
  const { error: truncTaskErr } = await supabase.from("rcc_tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (truncTaskErr) console.error("  Truncate tasks:", truncTaskErr.message);
  const { error: truncProjErr } = await supabase.from("rcc_projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (truncProjErr) console.error("  Truncate projects:", truncProjErr.message);

  // Insert projects
  console.log("Inserting projects...");
  for (const entry of entries) {
    const summaryPath = path.join(RINOA_ROOT, entry.rinoa_path, "_summary.md");
    const summaryContent = readFileIfExists(summaryPath);
    const summary = summaryContent ? parseSummary(summaryContent) : { brief: null, next_action: null, last_session_date: null };

    const isStale = summary.last_session_date
      ? (Date.now() - new Date(summary.last_session_date).getTime()) / (1000 * 60 * 60 * 24) > 7
      : false;

    const { error } = await supabase.from("rcc_projects").insert({
      child_key: entry.child_key,
      parent_key: entry.parent_key,
      rinoa_path: entry.rinoa_path,
      display_name: entry.display_name,
      belongs_to: entry.belongs_to || null,
      brief: summary.brief,
      next_action: summary.next_action,
      last_session_date: summary.last_session_date,
      is_stale: isStale,
    });

    if (error) {
      console.error(`  Error inserting project ${entry.child_key}:`, error.message);
    } else {
      console.log(`  + ${entry.display_name}`);
    }
  }

  // Insert tasks
  console.log("\nInserting tasks...");
  let totalTasks = 0;
  for (const entry of entries) {
    const tasksPath = path.join(RINOA_ROOT, entry.rinoa_path, "tasks.md");
    const tasksContent = readFileIfExists(tasksPath);
    if (!tasksContent) continue;

    const tasks = parseTasks(tasksContent);
    if (tasks.length === 0) continue;

    const rows = tasks.map((t) => ({
      project_key: entry.child_key,
      text: t.text,
      bucket: t.bucket,
      completed: t.completed,
      sort_order: t.sort_order,
      priority: t.priority,
      is_owner_action: t.is_owner_action,
    }));

    const { error } = await supabase.from("rcc_tasks").insert(rows);
    if (error) {
      console.error(`  Error inserting tasks for ${entry.child_key}:`, error.message);
    } else {
      console.log(`  + ${entry.display_name}: ${tasks.length} tasks`);
      totalTasks += tasks.length;
    }
  }

  // Insert session logs
  console.log("\nInserting session logs...");
  let totalLogs = 0;
  for (const entry of entries) {
    const sessionDir = path.join(RINOA_ROOT, entry.rinoa_path, "session-logs");
    let files: string[] = [];
    try {
      files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".md"));
    } catch {
      // session-logs dir may not exist for this project
      continue;
    }

    if (files.length === 0) continue;

    const logRows: Array<{
      project_key: string;
      session_date: string;
      surface: string;
      title: string;
      summary: string | null;
    }> = [];

    for (const file of files) {
      const filePath = path.join(sessionDir, file);
      const content = readFileIfExists(filePath);
      if (!content) continue;

      const parsed = parseSessionLog(file, content);
      if (!parsed) continue;

      logRows.push({
        project_key: entry.child_key,
        session_date: parsed.session_date,
        surface: parsed.surface,
        title: parsed.title,
        summary: parsed.summary,
      });
    }

    if (logRows.length === 0) continue;

    // Insert in batches of 50 to avoid payload limits
    const batchSize = 50;
    for (let i = 0; i < logRows.length; i += batchSize) {
      const batch = logRows.slice(i, i + batchSize);
      const { error } = await supabase.from("rcc_session_logs").insert(batch);
      if (error) {
        console.error(`  Error inserting session logs for ${entry.child_key}:`, error.message);
        break;
      }
    }

    console.log(`  + ${entry.display_name}: ${logRows.length} session logs`);
    totalLogs += logRows.length;
  }

  console.log(`\nDone! Inserted ${entries.length} projects, ${totalTasks} tasks, ${totalLogs} session logs.`);
}

seed().catch(console.error);
