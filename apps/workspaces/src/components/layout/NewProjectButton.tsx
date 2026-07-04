'use client';

// "New project" quick-create — lives in the navbar, left of the profile menu.
// Creates a project by name and jumps straight into it, same destination as
// the full /projects creation flow.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { useCreateProject } from '@/lib/hooks/useProjects';

export function NewProjectButton() {
  const router = useRouter();
  const create = useCreateProject();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const project = await create.mutateAsync({ name: name.trim() });
    setName('');
    setOpen(false);
    router.push(`/projects/${project.id}`);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-500 transition"
      >
        <Plus className="w-4 h-4" /> <span className="hidden xl:inline">New project</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <form onSubmit={submit}
            className="absolute right-0 z-20 mt-2 w-72 rounded-xl bg-white dark:bg-dark-card shadow-lg border border-gray-100 dark:border-dark-border p-3 animate-fade-in">
            <input className="saas-input !py-2 text-sm" value={name} autoFocus
              onChange={(e) => setName(e.target.value)} placeholder="Project name" />
            <div className="flex items-center gap-2 mt-2">
              <button type="submit" disabled={create.isPending || !name.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-xs font-semibold">
                {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
