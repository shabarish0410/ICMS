'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { formsAPI } from '@/services/api';
import { 
  Plus, ClipboardList, Trash2, Eye, Send, Loader2, Calendar 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function FormsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ 
    queryKey: ['forms'], 
    queryFn: () => formsAPI.list({ size: 100 }) 
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => formsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form deleted successfully');
    },
  });

  const forms = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Forms</h1>
          <p className="text-dark-500 mt-1">{isAdmin ? 'Manage internal dynamic forms' : 'Fill active forms'}</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => router.push('/dashboard/forms/builder')} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Form
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.status === 'Published' ? 'bg-gradient-to-br from-primary-500 to-primary-600' : 'bg-dark-300'}`}>
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${f.status === 'Published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-dark-100 text-dark-500'}`}>
                    {f.status}
                  </span>
                </div>
                <h3 className="font-semibold text-dark-900 dark:text-white line-clamp-1">{f.title}</h3>
                <p className="text-xs text-dark-500 mt-1 line-clamp-2 min-h-[32px]">{f.description || 'No description provided'}</p>
                
                <div className="flex items-center gap-3 mt-4 text-xs font-medium text-dark-400">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> {new Date(f.created_at).toLocaleDateString()}</span>
                  {isAdmin && <span>• {f.response_count || 0} responses</span>}
                </div>
              </div>

              <div className="flex gap-2 mt-5 pt-4 border-t border-dark-100 dark:border-dark-750">
                {(!isAdmin && f.status === 'Published') || (isAdmin) ? (
                  <button 
                    onClick={() => router.push(`/dashboard/forms/${f.id}/fill`)} 
                    className="btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> {isAdmin ? 'Preview Form' : 'Fill Form'}
                  </button>
                ) : null}
                
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => router.push(`/dashboard/forms/${f.id}/responses`)}
                      className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-dark-100 text-dark-500 hover:text-primary-500 flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" /> Responses
                    </button>
                    <button 
                      onClick={() => { if (confirm('Delete this form?')) deleteMutation.mutate(f.id); }}
                      className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-red-50 dark:hover:bg-red-950/20 text-dark-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
          
          {forms.length === 0 && (
            <div className="col-span-full py-20 text-center text-dark-400 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
              <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-sm">{isAdmin ? 'No forms created yet.' : 'No active forms available.'}</p>
              {isAdmin && (
                <button onClick={() => router.push('/dashboard/forms/builder')} className="mt-4 btn-primary inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Create your first form
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
