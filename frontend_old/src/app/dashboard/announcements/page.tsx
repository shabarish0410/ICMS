'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { announcementsAPI } from '@/services/api';
import { Plus, Megaphone, Trash2, X, Loader2, AlertTriangle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const priorityColors: Record<string, string> = {
  low: 'bg-dark-100 text-dark-700 dark:bg-dark-800 dark:text-dark-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const defaultForm = {
  title: '',
  description: '',
  priority: 'medium',
  expiry_date: '',
};

export default function AnnouncementsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsAPI.list({ size: 50 })
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => announcementsAPI.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement posted!');
      setShowModal(false);
      setForm({ ...defaultForm });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to post announcement');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => announcementsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to delete announcement');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      title: form.title,
      description: form.description,
      priority: form.priority,
    };
    if (form.expiry_date) {
      payload.expiry_date = new Date(form.expiry_date).toISOString();
    }
    createMutation.mutate(payload);
  };

  const announcements = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Announcements</h1>
          <p className="text-dark-500 mt-1">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''} active</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setForm({ ...defaultForm }); setShowModal(true); }}
            className="btn-primary flex items-center gap-2"
            id="new-announcement-btn"
          >
            <Plus className="w-4 h-4" /> New Announcement
          </button>
        )}
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
              <div className="skeleton h-5 w-1/3" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ))
        ) : announcements.length > 0 ? (
          announcements.map((a: any, i: number) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-dark-800 rounded-xl p-5 border border-dark-200 dark:border-dark-700 shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${priorityColors[a.priority] || priorityColors.medium}`}>
                    {a.priority}
                  </span>
                  <span className="text-xs text-dark-400">
                    {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { if (confirm('Delete this announcement?')) deleteMutation.mutate(a.id); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">{a.title}</h3>
              <p className="text-sm text-dark-600 dark:text-dark-400 mt-2 whitespace-pre-wrap leading-relaxed">{a.description}</p>
              {a.creator && (
                <p className="text-xs text-dark-450 mt-4 font-medium">
                  Posted by <span className="text-dark-750 dark:text-dark-300 font-semibold">{a.creator.full_name}</span>
                </p>
              )}
            </motion.div>
          ))
        ) : (
          <div className="py-20 text-center text-dark-400 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
            <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-30 text-dark-300" />
            <p className="font-medium">No announcements posted yet.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white">New Announcement</h3>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Announcement Title"
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Description *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Write details of announcement..."
                    className="input-field resize-none"
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Priority *</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="input-field"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Expiry Date (Optional)</label>
                    <input
                      type="datetime-local"
                      value={form.expiry_date}
                      onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Post Announcement'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
