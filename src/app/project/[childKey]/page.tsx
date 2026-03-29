"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { StickyHeader } from "@/components/sticky-header";
import { TaskAddBar } from "@/components/task-add-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Toast } from "@/components/toast";

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  bucket: string;
}

interface ProjectDetail {
  child_key: string;
  display_name: string;
  brief: string | null;
  last_session_date: string | null;
  tasks: {
    this_week: TaskItem[];
    this_month: TaskItem[];
    parked: TaskItem[];
    completed: TaskItem[];
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const childKey = params.childKey as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [moveSheet, setMoveSheet] = useState<{ taskId: string; currentBucket: string } | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/projects/${childKey}`);
      if (res.status === 404) {
        setError("Project not found.");
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProject(data);
    } catch {
      setError("Failed to load tasks. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, [childKey]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  async function handleToggleTask(taskId: string, currentCompleted: boolean) {
    const newStatus = currentCompleted ? "open" : "completed";
    try {
      const res = await fetch(`/api/projects/${childKey}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchProject();
    } catch {
      setToast("Failed to update task. Try again.");
    }
  }

  async function handleMoveTask(taskId: string, targetBucket: string) {
    setMoveSheet(null);
    try {
      const res = await fetch(`/api/projects/${childKey}/tasks/${taskId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_bucket: targetBucket }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchProject();
    } catch {
      setToast("Failed to move task. Try again.");
    }
  }

  async function handleAddTask(text: string, bucket: string) {
    const res = await fetch(`/api/projects/${childKey}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, bucket }),
    });
    if (!res.ok) throw new Error("Failed");
    await fetchProject();
  }

  const totalOpen = project
    ? project.tasks.this_week.length + project.tasks.this_month.length + project.tasks.parked.length
    : 0;

  return (
    <div className="flex flex-col min-h-screen bg-bg pb-16">
      <StickyHeader title={project?.display_name || "Loading..."} showBack />

      {error && <ErrorBanner message={error} onRetry={fetchProject} />}

      <PullToRefresh onRefresh={fetchProject}>
        {loading ? (
          <div className="px-4 py-3 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-surface animate-pulse" />
            ))}
          </div>
        ) : !project && !error ? (
          <EmptyState message="Project not found." />
        ) : project ? (
          <>
            {(project.brief || project.last_session_date) && (
              <div className="px-4 py-3 border-b border-border">
                {project.brief && <p className="text-[13px] text-text-2 mb-1">{project.brief}</p>}
                {project.last_session_date && (
                  <p className="text-[12px] text-text-3">Last session: {project.last_session_date}</p>
                )}
              </div>
            )}

            {totalOpen === 0 && project.tasks.completed.length === 0 ? (
              <EmptyState message="No tasks yet. Add your first task below." />
            ) : (
              <div className="px-4 py-3">
                <BucketSection title="THIS WEEK" tasks={project.tasks.this_week} color="badge-week" onToggle={handleToggleTask} onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "THIS_WEEK" })} />
                <BucketSection title="THIS MONTH" tasks={project.tasks.this_month} color="badge-month" onToggle={handleToggleTask} onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "THIS_MONTH" })} />
                <BucketSection title="PARKED" tasks={project.tasks.parked} color="badge-parked" onToggle={handleToggleTask} onLongPress={(id) => setMoveSheet({ taskId: id, currentBucket: "PARKED" })} />

                {project.tasks.completed.length > 0 && (
                  <div className="mt-4">
                    <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 text-[12px] font-semibold text-text-3 uppercase tracking-[0.07em] mb-2">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${showCompleted ? "rotate-90" : ""}`}>
                        <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span className="text-success">&#10003;</span>
                      Completed ({project.tasks.completed.length})
                    </button>
                    {showCompleted && (
                      <div className="space-y-0.5">
                        {project.tasks.completed.map((task) => (
                          <TaskRow key={task.id} task={task} onToggle={handleToggleTask} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </PullToRefresh>

      {project && <TaskAddBar onSubmit={handleAddTask} position="bottom" />}

      {moveSheet && (
        <BucketMoveSheet currentBucket={moveSheet.currentBucket} onSelect={(bucket) => handleMoveTask(moveSheet.taskId, bucket)} onClose={() => setMoveSheet(null)} />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} persistent />}
    </div>
  );
}

function BucketSection({ title, tasks, color, onToggle, onLongPress }: { title: string; tasks: TaskItem[]; color: string; onToggle: (id: string, completed: boolean) => void; onLongPress: (id: string) => void }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[11px] font-semibold text-${color} uppercase tracking-[0.07em]`}>{title}</span>
        <span className="text-[11px] text-text-3">{tasks.length}</span>
      </div>
      <div className="space-y-0.5">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={onToggle} onLongPress={() => onLongPress(task.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggle, onLongPress }: { task: TaskItem; onToggle: (id: string, completed: boolean) => void; onLongPress?: () => void }) {
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  return (
    <div
      className="flex items-start gap-3 px-3 py-[10px] rounded-md hover:bg-surface-2/50 transition-colors"
      onTouchStart={() => { if (onLongPress) longPressTimer = setTimeout(onLongPress, 500); }}
      onTouchEnd={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
      onTouchCancel={() => { if (longPressTimer) clearTimeout(longPressTimer); }}
      onContextMenu={(e) => { e.preventDefault(); onLongPress?.(); }}
    >
      <button onClick={() => onToggle(task.id, task.completed)} className={`mt-0.5 w-[18px] h-[18px] rounded border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? "bg-success border-success" : "border-border-light hover:border-primary"}`}>
        {task.completed && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </button>
      <span className={`text-[14px] leading-snug ${task.completed ? "text-text-3 line-through" : "text-text-1"}`}>{task.text}</span>
    </div>
  );
}

function BucketMoveSheet({ currentBucket, onSelect, onClose }: { currentBucket: string; onSelect: (bucket: string) => void; onClose: () => void }) {
  const buckets = [
    { value: "THIS_WEEK", label: "This Week", color: "text-badge-week" },
    { value: "THIS_MONTH", label: "This Month", color: "text-badge-month" },
    { value: "PARKED", label: "Parked", color: "text-badge-parked" },
  ];
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-xl p-4 pb-8">
        <div className="w-10 h-1 rounded-full bg-border-light mx-auto mb-4" />
        <p className="text-[13px] text-text-3 mb-3 text-center">Move to</p>
        <div className="space-y-1">
          {buckets.map((b) => {
            const disabled = b.value === currentBucket;
            return (
              <button key={b.value} onClick={() => !disabled && onSelect(b.value)} disabled={disabled} className={`w-full text-left px-4 py-3 rounded-lg text-[14px] font-medium transition-colors ${disabled ? "text-text-3 opacity-40 cursor-not-allowed" : `${b.color} hover:bg-surface-2`}`}>
                {b.label}{disabled && " (current)"}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className="w-full mt-3 px-4 py-3 rounded-lg text-[14px] text-text-3 hover:bg-surface-2 transition-colors text-center">Cancel</button>
      </div>
    </>
  );
}
