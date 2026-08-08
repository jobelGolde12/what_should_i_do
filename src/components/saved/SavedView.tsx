"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  FolderOpen,
  Play,
  Pencil,
  Copy,
  Check,
} from "lucide-react";
import { useTask } from "@/context/TaskContext";
import { formatRelative, snippet } from "@/lib/format";
import { storePendingTemplate } from "@/lib/applyTemplate";
import { Button } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";

export default function SavedView() {
  const router = useRouter();
  const {
    templates,
    saveTemplate,
    deleteTemplate,
    updateTemplate,
    duplicateTemplate,
  } = useTask();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [showForm, setShowForm] = useState(templates.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [appliedId, setAppliedId] = useState<string | null>(null);

  function handleSave() {
    if (!content.trim()) return;
    saveTemplate(name, content);
    setName("");
    setContent("");
    setShowForm(false);
  }

  function applyTemplate(id: string, contentText: string) {
    storePendingTemplate(contentText);
    setAppliedId(id);
    setTimeout(() => setAppliedId(null), 1500);
    router.push("/");
  }

  function startEdit(template: (typeof templates)[number]) {
    setEditingId(template.id);
    setEditName(template.name);
    setEditContent(template.content);
  }

  function saveEdit() {
    if (!editingId || !editContent.trim()) return;
    updateTemplate(editingId, {
      name: editName.trim(),
      content: editContent,
    });
    setEditingId(null);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Saved"
        kicker="Recurring inputs — weekly reports, meeting notes, form letters."
      >
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> New template
          </Button>
        )}
      </PageHeader>

      {showForm && (
        <div className="mb-8 border border-line bg-surface p-4">
          <div className="grid gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name (optional)"
              aria-label="Template name"
              className="h-10 w-full rounded-tm border border-line bg-background px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the template content here…"
              aria-label="Template content"
              rows={5}
              className="w-full resize-none rounded-tm border border-line bg-background p-3 text-sm leading-relaxed text-ink outline-none placeholder:text-muted focus:border-ink"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!content.trim()}>
                Save template
              </Button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 && !showForm && (
        <EmptyState
          title="No saved templates yet"
          hint="Save a recurring input from the New Analysis page, or create one here."
        />
      )}

      {templates.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {templates.map((template) => {
            const editing = editingId === template.id;
            return (
              <li key={template.id} className="flex items-start gap-4 py-4">
                {editing ? (
                  <div className="min-w-0 flex-1 grid gap-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Template name"
                      aria-label="Template name"
                      className="h-10 w-full rounded-tm border border-line bg-background px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={5}
                      className="w-full resize-none rounded-tm border border-line bg-background p-3 text-sm leading-relaxed text-ink outline-none focus:border-ink"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={saveEdit}>
                        Save changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-ink">{template.name}</h3>
                        <span className="font-mono text-2xs text-muted">
                          {formatRelative(template.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                        {snippet(template.content, 200)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {appliedId === template.id ? (
                        <Button variant="dark" size="sm" disabled>
                          <Check className="h-3.5 w-3.5" /> Applied
                        </Button>
                      ) : (
                        <Button
                          variant="dark"
                          size="sm"
                          onClick={() => applyTemplate(template.id, template.content)}
                        >
                          <Play className="h-3.5 w-3.5" /> Apply
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(template)}
                        aria-label="Edit template"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateTemplate(template.id)}
                        aria-label="Duplicate template"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                        aria-label="Delete template"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {templates.length > 0 && (
        <p className="mt-6 flex items-center gap-2 text-xs text-muted">
          <FolderOpen className="h-3.5 w-3.5" />
          Applying a template fills the input area on the New Analysis page.
        </p>
      )}
    </div>
  );
}
