'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { announcementsAPI } from '@/services/api';
import { Plus, Megaphone, Trash2, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const priorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', expiry_date: '' });

  const { data } = useQuery({ queryKey: ['announcements'], queryFn: () => announcementsAPI.list({ size: 50 }) });

  const createMutation = useMutation({
    mutationFn: (d: any) => announcementsAPI.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Announcement posted!'); setShowModal(false); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => announcementsAPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Deleted'); },
  });

  const announcements = data?.data?.items || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Announcements</h1>
          <p className="text-dark-500 mt-1">{announcements.length} announcements</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm({ title: '', description: '', priority: 'medium', expiry_date: '' }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Announcement
          </button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.map((a: any, i: number) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-dark-200 dark:border-dark-700"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityColors[a.priority] || priorityColors.medium}`}>
                  {a.priority.toUpperCase()}
                </span>
                <span className="text-xs text-dark-400">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
              {isAdmin && (
                <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(a.id); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white">{a.title}</h3>
            <p className="text-sm text-dark-600 dark:text-dark-400 mt-2 whitespace-pre-wrap">{a.description}</p>
            {a.creator && <p className="text-xs text-dark-400 mt-3">Posted by {a.creator.full_name}</p>}
          </motion.div>
        ))}
        {announcements.length === 0 && (
          <div className="py-20 text-center text-dark-400">
            <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No announcements yet.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">New Announcement</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="input-field" required />
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="input-field" rows={4} required />
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-field">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Post'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
