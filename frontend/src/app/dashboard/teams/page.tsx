'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { teamsAPI } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Plus, Edit2, Trash2, Users2, X, Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeamsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', department: '', mentor_name: '' });

  const { data, isLoading } = useQuery({ 
    queryKey: ['teams'], 
    queryFn: () => teamsAPI.list({ size: 100 }) 
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => teamsAPI.create(d),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['teams'] }); 
      toast.success('Team created!'); 
      setShowModal(false); 
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to create team'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => teamsAPI.update(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['teams'] }); 
      toast.success('Team updated successfully!'); 
      setShowModal(false); 
    },
    onError: (e: any) => toast.error('Failed to update team'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teamsAPI.delete(id),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['teams'] }); 
      toast.success('Team deleted successfully'); 
    },
    onError: (e: any) => toast.error('Failed to delete team'),
  });

  const openEdit = (t: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering route details click
    setEditing(t); 
    setForm({ name: t.name, description: t.description || '', department: t.department || '', mentor_name: t.mentor_name || '' }); 
    setShowModal(true);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering route details click
    if (confirm('Are you sure you want to delete this team? All student assignments will be cleared.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const teams = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Teams</h1>
          <p className="text-dark-500 mt-1">Manage Innovation Center project groups and student allocations</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setEditing(null); setForm({ name: '', description: '', department: '', mentor_name: '' }); setShowModal(true); }} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Team
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teams.map((t: any, i: number) => (
            <motion.div 
              key={t.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.05 }}
              onClick={() => router.push(`/dashboard/teams/${t.id}`)}
              className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 hover:shadow-md cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
                    <Users2 className="w-5 h-5 text-white" />
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button 
                        onClick={(e) => openEdit(t, e)} 
                        className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-primary-500"
                        title="Edit Team Info"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(t.id, e)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500"
                        title="Delete Team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                
                <h3 className="font-semibold text-dark-900 dark:text-white group-hover:text-primary-500 transition-colors">{t.name}</h3>
                <p className="text-xs text-dark-500 mt-1 line-clamp-2 min-h-[32px]">{t.description || 'No team description.'}</p>
                
                <div className="flex items-center gap-3 mt-4 text-xs font-semibold text-dark-400">
                  {t.department && (
                    <span className="px-2.5 py-0.5 bg-dark-100 dark:bg-dark-750 text-dark-600 dark:text-dark-350 rounded-full">
                      {t.department}
                    </span>
                  )}
                  <span>{t.member_count || 0} members</span>
                </div>
                {t.mentor_name && <p className="text-xs text-dark-450 mt-2 font-medium">Mentor: {t.mentor_name}</p>}
              </div>

              <div className="flex items-center justify-between mt-5 pt-3 border-t border-dark-100 dark:border-dark-750/60 text-[10px] font-bold text-dark-400 group-hover:text-primary-500 transition-colors">
                <span>VIEW TEAM DETAILS</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
          {teams.length === 0 && (
            <div className="col-span-full py-20 text-center text-dark-400 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
              <Users2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No teams created yet.</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">{editing ? 'Edit Team' : 'Create Team'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Team Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input-field" placeholder="e.g. Team Alpha" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} placeholder="Describe the team focus area..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Department</label>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input-field text-sm" placeholder="e.g. Computer Science" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Mentor Name</label>
                  <input value={form.mentor_name} onChange={(e) => setForm({ ...form, mentor_name: e.target.value })} className="input-field text-sm" placeholder="e.g. Dr. John" />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">
                  {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Update Team' : 'Create Team'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
