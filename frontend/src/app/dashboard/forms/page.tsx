'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { formsAPI } from '@/services/api';
import { 
  Plus, ClipboardList, Trash2, Copy, X, Loader2, Send 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function FormsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', google_form_url: '', is_active: true });

  // Query forms list
  const { data, isLoading } = useQuery({ 
    queryKey: ['forms'], 
    queryFn: () => formsAPI.list({ size: 100 }) 
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: (id: number) => formsAPI.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form duplicated successfully!');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to duplicate form')
  });

  // Create form mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => formsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form created successfully!');
      setShowAddModal(false);
      setFormData({ title: '', description: '', google_form_url: '', is_active: true });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create form')
  });

  // Delete form mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => formsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form deleted successfully');
    },
  });

  const handleCreateForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.google_form_url) {
      toast.error('Title and Google Form URL are required');
      return;
    }
    createMutation.mutate({
      title: formData.title,
      description: formData.description || undefined,
      google_form_url: formData.google_form_url,
      is_active: formData.is_active,
    });
  };

  const forms = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Forms</h1>
          <p className="text-dark-500 mt-1">{isAdmin ? 'Manage Google Forms' : 'Fill active forms'}</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowAddModal(true)} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Google Form
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {forms.map((f: any, i: number) => (
            <motion.div 
              key={f.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.is_active ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-dark-300'}`}>
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${f.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-dark-100 text-dark-500'}`}>
                    {f.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>
                <h3 className="font-semibold text-dark-900 dark:text-white line-clamp-1">{f.title}</h3>
                <p className="text-xs text-dark-500 mt-1 line-clamp-2 min-h-[32px]">{f.description || 'No description provided'}</p>
              </div>

              <div className="flex gap-2 mt-5 pt-4 border-t border-dark-100 dark:border-dark-750">
                {(!isAdmin && f.is_active) || (isAdmin) ? (
                  <button 
                    onClick={() => window.open(f.google_form_url, '_blank')} 
                    className="btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Open Google Form
                  </button>
                ) : null}
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => duplicateMutation.mutate(f.id)}
                      disabled={duplicateMutation.isPending}
                      className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-dark-100 text-dark-500 hover:text-primary-500"
                      title="Duplicate Form"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => { if (confirm('Are you sure you want to delete this form?')) deleteMutation.mutate(f.id); }}
                      className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-red-50 dark:hover:bg-red-950/20 text-dark-400 hover:text-red-500"
                      title="Delete Form"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
          
          {forms.length === 0 && (
            <div className="col-span-full py-20 text-center text-dark-400 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
              <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-sm">{isAdmin ? 'No forms added yet.' : 'No active forms available.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Add Form Modal (Admin Only) */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-xl my-8 border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Add Google Form</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateForm} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200 mb-1">Title *</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. End of Year Survey" 
                  className="input-field" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200 mb-1">Description (Optional)</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief instructions..." 
                  className="input-field" 
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200 mb-1">Google Form URL *</label>
                <input 
                  type="url" 
                  value={formData.google_form_url} 
                  onChange={(e) => setFormData({ ...formData, google_form_url: e.target.value })}
                  placeholder="https://forms.gle/..." 
                  className="input-field" 
                  required 
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.is_active} 
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-dark-300 text-primary-500 focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-dark-700 dark:text-dark-300 cursor-pointer">
                  Active (Visible to Students)
                </label>
              </div>

              <div className="flex gap-3 mt-6 border-t border-dark-100 dark:border-dark-700 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button 
                  type="submit" 
                  disabled={createMutation.isPending} 
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Form Link'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
