'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { formsAPI, uploadsAPI } from '@/services/api';
import { 
  Plus, ClipboardList, Eye, Trash2, Copy, X, Loader2, Send, 
  FileUp, Calendar, AlertCircle, CheckCircle2 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function FormsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showFill, setShowFill] = useState<any>(null);
  const [fillData, setFillData] = useState<Record<string, any>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

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
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to duplicate form');
    }
  });

  // Submit response mutation
  const submitMutation = useMutation({
    mutationFn: ({ formId, data }: any) => formsAPI.submit(formId, { data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form response submitted successfully!');
      setShowFill(null);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.detail || 'Failed to submit response');
    },
  });

  // Delete form mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => formsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form deleted successfully');
    },
  });

  // Handle uploading files dynamically for form fields
  const handleFileChange = async (fieldId: string, file: File) => {
    if (!file) return;
    setUploadingFields(prev => ({ ...prev, [fieldId]: true }));
    try {
      const res = await uploadsAPI.upload(file);
      const fileUrl = res.data.file_url;
      setFillData(prev => ({ ...prev, [fieldId]: fileUrl }));
      toast.success('File uploaded successfully!');
    } catch (err) {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFields(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const forms = data?.data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Dynamic Forms</h1>
          <p className="text-dark-500 mt-1">{isAdmin ? 'Create and manage custom forms' : 'Fill active dynamic forms'}</p>
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.is_active ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-dark-300'}`}>
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${f.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-dark-100 text-dark-500'}`}>
                    {f.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>
                <h3 className="font-semibold text-dark-900 dark:text-white line-clamp-1">{f.title}</h3>
                <p className="text-xs text-dark-500 mt-1 line-clamp-2 min-h-[32px]">{f.description || 'No description provided'}</p>
                
                <div className="flex items-center gap-3 mt-4 text-xs text-dark-400">
                  <span>{f.fields?.length || 0} fields</span>
                  {isAdmin && <span>{f.response_count || 0} responses</span>}
                </div>
              </div>

              <div className="flex gap-2 mt-5 pt-4 border-t border-dark-100 dark:border-dark-750">
                {!isAdmin && f.is_active && (
                  <button 
                    onClick={() => { setShowFill(f); setFillData({}); }} 
                    className="btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Fill Form
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => router.push(`/dashboard/forms/${f.id}/responses`)}
                      className="btn-secondary text-xs py-2 flex-1 flex items-center justify-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Responses
                    </button>
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
              <p className="font-medium text-sm">{isAdmin ? 'No dynamic forms created yet.' : 'No active forms to fill.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Fill Form Modal */}
      {showFill && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-xl my-8 border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">{showFill.title}</h3>
              <button onClick={() => setShowFill(null)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>
            {showFill.description && <p className="text-sm text-dark-500 mb-6">{showFill.description}</p>}

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
              {(showFill.fields || []).map((field: any) => {
                const isFile = ['file', 'image', 'pdf', 'ppt', 'document'].includes(field.type);
                return (
                  <div key={field.id} className="space-y-1.5">
                    <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    
                    {field.type === 'paragraph' ? (
                      <textarea 
                        value={fillData[field.id] || ''} 
                        onChange={(e) => setFillData({ ...fillData, [field.id]: e.target.value })}
                        placeholder={field.placeholder || 'Your answer'} 
                        className="input-field" 
                        rows={3} 
                        required={field.required} 
                      />
                    ) : field.type === 'dropdown' ? (
                      <select 
                        value={fillData[field.id] || ''} 
                        onChange={(e) => setFillData({ ...fillData, [field.id]: e.target.value })}
                        className="input-field" 
                        required={field.required}
                      >
                        <option value="">Select...</option>
                        {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'radio' || field.type === 'yes_no' ? (
                      <div className="flex flex-wrap gap-4 pt-1">
                        {(field.options || ['Yes', 'No']).map((opt: string) => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-350 cursor-pointer">
                            <input 
                              type="radio" 
                              name={field.id} 
                              value={opt} 
                              checked={fillData[field.id] === opt}
                              onChange={(e) => setFillData({ ...fillData, [field.id]: e.target.value })} 
                              className="text-primary-500"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex flex-wrap gap-4 pt-1">
                        {(field.options || []).map((opt: string) => (
                          <label key={opt} className="flex items-center gap-2 text-sm text-dark-600 dark:text-dark-350 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={(fillData[field.id] || []).includes(opt)}
                              onChange={(e) => {
                                const current = fillData[field.id] || [];
                                setFillData({ 
                                  ...fillData, 
                                  [field.id]: e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt) 
                                });
                              }} 
                              className="rounded text-primary-500"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : isFile ? (
                      <div className="space-y-2">
                        {fillData[field.id] ? (
                          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-xl border border-green-200 text-xs font-semibold">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate flex-1">File uploaded successfully!</span>
                            <button 
                              type="button" 
                              onClick={() => setFillData({ ...fillData, [field.id]: '' })}
                              className="text-red-500 hover:text-red-650 ml-2"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="relative border border-dashed border-dark-300 hover:border-primary-500 dark:border-dark-600 rounded-xl p-4 bg-dark-50 dark:bg-dark-850 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                            {uploadingFields[field.id] ? (
                              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                            ) : (
                              <>
                                <FileUp className="w-5 h-5 text-dark-400" />
                                <span className="text-xs text-dark-550 font-medium">Click to upload ({field.type.toUpperCase()})</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept={
                                field.type === 'image' ? 'image/*' :
                                field.type === 'pdf' ? '.pdf' :
                                field.type === 'ppt' ? '.ppt,.pptx' :
                                field.type === 'document' ? '.doc,.docx' : '*'
                              }
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileChange(field.id, file);
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              disabled={uploadingFields[field.id]}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <input 
                        type={
                          field.type === 'email' ? 'email' : 
                          field.type === 'number' ? 'number' : 
                          field.type === 'date' ? 'date' : 
                          field.type === 'time' ? 'time' : 
                          field.type === 'url' ? 'url' : 'text'
                        }
                        value={fillData[field.id] || ''} 
                        onChange={(e) => setFillData({ ...fillData, [field.id]: e.target.value })}
                        placeholder={field.placeholder || 'Your answer'} 
                        className="input-field" 
                        required={field.required} 
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 mt-6 border-t border-dark-100 dark:border-dark-700 pt-4">
              <button onClick={() => setShowFill(null)} className="btn-secondary flex-1">Cancel</button>
              <button 
                onClick={() => submitMutation.mutate({ formId: showFill.id, data: fillData })} 
                disabled={submitMutation.isPending || Object.values(uploadingFields).some(Boolean)} 
                className="btn-primary flex-1"
              >
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Response'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
