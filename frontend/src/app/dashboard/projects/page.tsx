'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { projectsAPI, teamsAPI } from '@/services/api';
import { FolderKanban, Plus, Edit2, Trash2, Upload, Eye, CheckCircle, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  planning: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  ongoing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  on_hold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function ProjectsPage() {
  const { isAdmin, isStudent } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showSubmissions, setShowSubmissions] = useState<any>(null);
  const [showSubmitModal, setShowSubmitModal] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', team_id: '', status: 'planning' });
  const [subForm, setSubForm] = useState({ submission_type: 'report', title: '', description: '' });

  const { data } = useQuery({ queryKey: ['projects'], queryFn: () => projectsAPI.list({ size: 50 }) });
  const { data: teamsData } = useQuery({ queryKey: ['teams-all'], queryFn: () => teamsAPI.list({ size: 100 }) });

  const createMutation = useMutation({
    mutationFn: (d: any) => projectsAPI.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project created!'); setShowModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => projectsAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('Updated!'); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('Deleted'); },
  });

  const submitMutation = useMutation({
    mutationFn: ({ projectId, data }: any) => projectsAPI.createSubmission(projectId, data),
    onSuccess: () => { toast.success('Submitted!'); setShowSubmitModal(null); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const projects = data?.data?.items || [];
  const teams = teamsData?.data?.items || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, team_id: form.team_id ? Number(form.team_id) : undefined };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{isAdmin ? 'Project Management' : 'My Project'}</h1>
          <p className="text-dark-500 mt-1">{projects.length} projects</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setForm({ title: '', description: '', category: '', team_id: '', status: 'planning' }); setShowModal(true); }}
            className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Project</button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p: any, i: number) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-dark-200 dark:border-dark-700 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusColors[p.status] || statusColors.planning}`}>
                {p.status.replace('_', ' ')}
              </span>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(p); setForm({ title: p.title, description: p.description || '', category: p.category || '', team_id: p.team_id?.toString() || '', status: p.status }); setShowModal(true); }}
                    className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-primary-500"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(p.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <h3 className="font-semibold text-dark-900 dark:text-white mb-1">{p.title}</h3>
            <p className="text-sm text-dark-500 line-clamp-2 mb-3">{p.description || 'No description'}</p>
            <div className="flex items-center gap-2 text-xs text-dark-400 mb-3">
              {p.category && <span className="px-2 py-0.5 bg-dark-100 dark:bg-dark-700 rounded-full">{p.category}</span>}
              {p.team && <span>{p.team.name}</span>}
            </div>
            <div className="w-full bg-dark-200 dark:bg-dark-700 rounded-full h-2 mb-2">
              <div className={`h-2 rounded-full ${p.progress >= 100 ? 'bg-green-500' : 'bg-primary-500'}`} style={{ width: `${p.progress}%` }} />
            </div>
            <div className="flex justify-between items-center text-xs text-dark-400">
              <span>{p.progress}% complete</span>
              <div className="flex gap-2">
                {isStudent && (
                  <button onClick={() => { setShowSubmitModal(p); setSubForm({ submission_type: 'report', title: '', description: '' }); }}
                    className="text-primary-500 hover:text-primary-600 flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Upload</button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">{editing ? 'Edit Project' : 'New Project'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Project Title" className="input-field" required />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="input-field" rows={3} />
              <div className="grid grid-cols-2 gap-4">
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" className="input-field" />
                <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} className="input-field">
                  <option value="">No Team</option>
                  {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {editing && (
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-field">
                  <option value="planning">Planning</option><option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option><option value="on_hold">On Hold</option>
                </select>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Upload Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Upload to: {showSubmitModal.title}</h3>
              <button onClick={() => setShowSubmitModal(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <select value={subForm.submission_type} onChange={(e) => setSubForm({ ...subForm, submission_type: e.target.value })} className="input-field">
                <option value="report">Weekly Report</option><option value="document">Document</option>
                <option value="presentation">Presentation</option><option value="source_code">Source Code</option>
              </select>
              <input value={subForm.title} onChange={(e) => setSubForm({ ...subForm, title: e.target.value })} placeholder="Submission Title" className="input-field" required />
              <textarea value={subForm.description} onChange={(e) => setSubForm({ ...subForm, description: e.target.value })} placeholder="Description" className="input-field" rows={3} />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSubmitModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => submitMutation.mutate({ projectId: showSubmitModal.id, data: subForm })} disabled={submitMutation.isPending} className="btn-primary flex-1">
                  {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
