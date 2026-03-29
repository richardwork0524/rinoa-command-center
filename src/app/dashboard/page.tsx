"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StickyHeader } from "@/components/sticky-header";
import { TaskAddBar } from "@/components/task-add-bar";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ErrorBanner } from "@/components/error-banner";
import { EmptyState } from "@/components/empty-state";
import { Toast } from "@/components/toast";

interface Project {
  child_key: string;
  display_name: string;
  rinoa_path: string;
  parent_key: string;
  is_leaf: boolean;
  task_counts: { this_week: number; this_month: number; parked: number };
  next_action: string | null;
  last_session_date: string | null;
  is_stale: boolean;
  children_task_total: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setProjects(data.projects);
    } catch {
      setError("Failed to load projects. Pull to retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleAddTask(text: string, bucket: string, projectKey?: string) {
    if (!projectKey) throw new Error("No project selected");
    const res = await fetch(`/api/projects/${projectKey}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, bucket }),
    });
    if (!res.ok) throw new Error("Failed");
    await fetchProjects();
  }

  const leafProjects = projects.filter((p) => p.is_leaf);

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <StickyHeader title="Rinoa" />

      {leafProjects.length > 0 && (
        <TaskAddBar
          projects={leafProjects.map((p) => ({ child_key: p.child_key, display_name: p.display_name }))}
          onSubmit={handleAddTask}
        />
      )}

      {error && <ErrorBanner message={error} onRetry={fetchProjects} />}

      <PullToRefresh onRefresh={fetchProjects}>
        {loading ? (
          <div className="px-4 py-3 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-surface animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 && !error ? (
          <EmptyState message="No projects found. Run the seed script to import from Rinoa-OS." />
        ) : (
          <div className="px-4 py-3 space-y-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.child_key}
                project={project}
                onClick={() => router.push(`/project/${project.child_key}`)}
              />
            ))}
          </div>
        )}
      </PullToRefresh>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const totalTasks = project.task_counts.this_week + project.task_counts.this_month + project.task_counts.parked;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-[14px] rounded-lg bg-surface border border-border hover:border-border-light transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {project.is_stale && (
            <span className="w-[7px] h-[7px] rounded-full bg-warning shrink-0" title="Stale" />
          )}
          <span className="text-[15px] font-semibold text-text-1 truncate">{project.display_name}</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-3 shrink-0">
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {project.task_counts.this_week > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-badge-week/15 text-badge-week text-[11px] font-semibold uppercase tracking-[0.07em]">
            {project.task_counts.this_week} Week
          </span>
        )}
        {project.task_counts.this_month > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-badge-month/15 text-badge-month text-[11px] font-semibold uppercase tracking-[0.07em]">
            {project.task_counts.this_month} Month
          </span>
        )}
        {project.task_counts.parked > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-badge-parked/15 text-badge-parked text-[11px] font-semibold uppercase tracking-[0.07em]">
            {project.task_counts.parked} Parked
          </span>
        )}
        {!project.is_leaf && project.children_task_total > 0 && (
          <span className="text-[11px] text-text-3 ml-1">
            +{project.children_task_total} in children
          </span>
        )}
        {totalTasks === 0 && project.children_task_total === 0 && (
          <span className="text-[11px] text-text-3">No tasks</span>
        )}
      </div>

      {project.is_leaf && project.next_action && (
        <p className="mt-2 text-[13px] text-text-2 truncate">{project.next_action}</p>
      )}
    </button>
  );
}
