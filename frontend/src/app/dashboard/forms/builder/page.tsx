'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Save, ArrowLeft, Trash2, GripVertical, Settings, 
  CheckSquare, AlignLeft, CircleDot, ChevronDown, AlignCenter, Loader2, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formsAPI } from '@/services/api';

const QUESTION_TYPES = [
  { id: 'Short Answer', icon: <AlignLeft className="w-4 h-4" /> },
  { id: 'Paragraph', icon: <AlignCenter className="w-4 h-4" /> },
  { id: 'Multiple Choice', icon: <CircleDot className="w-4 h-4" /> },
  { id: 'Checkboxes', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'Dropdown', icon: <ChevronDown className="w-4 h-4" /> },
  { id: 'File Upload', icon: <Plus className="w-4 h-4" /> },
];

export default function FormBuilder() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('questions'); // 'questions', 'settings'
  
  const [form, setForm] = useState<any>({
    title: 'Untitled Form',
    description: '',
    category: 'Survey',
    status: 'Published',
    publish_date: '',
    close_date: '',
    settings: {
      allow_only_logged_in: true,
      one_response_per_student: true,
      auto_collect_ic: true,
      auto_collect_name: true,
    },
    questions: [
      { id: Date.now(), question: 'Untitled Question', type: 'Multiple Choice', required: false, options: [{ id: Date.now()+1, option_text: 'Option 1' }] }
    ]
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => formsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form published successfully!');
      router.push('/dashboard/forms');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to save form')
  });

  const addQuestion = () => {
    setForm({
      ...form, 
      questions: [...form.questions, { id: Date.now(), question: '', type: 'Short Answer', required: false, options: [] }]
    });
  };

  const updateQuestion = (idx: number, key: string, value: any) => {
    const q = [...form.questions];
    q[idx][key] = value;
    if (['Multiple Choice', 'Checkboxes', 'Dropdown'].includes(value) && q[idx].options.length === 0) {
      q[idx].options = [{ id: Date.now(), option_text: 'Option 1' }];
    }
    setForm({ ...form, questions: q });
  };

  const removeQuestion = (idx: number) => {
    const q = [...form.questions];
    q.splice(idx, 1);
    setForm({ ...form, questions: q });
  };

  const addOption = (qIdx: number) => {
    const q = [...form.questions];
    q[qIdx].options.push({ id: Date.now(), option_text: `Option ${q[qIdx].options.length + 1}` });
    setForm({ ...form, questions: q });
  };

  const updateOption = (qIdx: number, oIdx: number, text: string) => {
    const q = [...form.questions];
    q[qIdx].options[oIdx].option_text = text;
    setForm({ ...form, questions: q });
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const q = [...form.questions];
    q[qIdx].options.splice(oIdx, 1);
    setForm({ ...form, questions: q });
  };

  const handleSave = () => {
    if (!form.title) return toast.error('Form title is required');
    if (form.questions.length === 0) return toast.error('Add at least one question');
    
    // Clean up IDs before sending
    const payload = {
      ...form,
      publish_date: form.publish_date ? new Date(form.publish_date).toISOString() : null,
      close_date: form.close_date ? new Date(form.close_date).toISOString() : null,
      questions: form.questions.map((q: any, i: number) => ({
        question: q.question || 'Untitled',
        type: q.type,
        required: q.required,
        order_no: i,
        validation: {}, logic: {},
        options: q.options.map((o: any, oi: number) => ({
          option_text: o.option_text || 'Empty Option',
          order_no: oi
        }))
      }))
    };
    
    createMutation.mutate(payload);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-dark-50 dark:bg-dark-900 z-10 py-4 border-b border-dark-200 dark:border-dark-800">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/forms')} className="p-2 rounded-xl hover:bg-dark-200 dark:hover:bg-dark-800">
            <ArrowLeft className="w-5 h-5 text-dark-500" />
          </button>
          <input 
            type="text" 
            value={form.title} 
            onChange={(e) => setForm({...form, title: e.target.value})}
            className="text-2xl font-bold bg-transparent border-none focus:ring-0 text-dark-900 dark:text-white placeholder-dark-300 w-[300px]"
            placeholder="Untitled Form"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={createMutation.isPending} className="btn-primary flex items-center gap-2">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publish Form
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="flex bg-dark-100 dark:bg-dark-800 rounded-xl p-1">
          <button onClick={() => setActiveTab('questions')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'questions' ? 'bg-white dark:bg-dark-700 shadow text-primary-500' : 'text-dark-500'}`}>Questions</button>
          <button onClick={() => setActiveTab('settings')} className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'settings' ? 'bg-white dark:bg-dark-700 shadow text-primary-500' : 'text-dark-500'}`}>Settings</button>
        </div>
      </div>

      {activeTab === 'questions' && (
        <div className="space-y-6">
          {/* Form Header Card */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border-t-[8px] border-primary-500 shadow-sm border border-x-dark-200 border-b-dark-200 dark:border-x-dark-700 dark:border-b-dark-700">
            <input 
              type="text" 
              value={form.title} 
              onChange={(e) => setForm({...form, title: e.target.value})}
              className="text-3xl font-bold bg-transparent border-b border-transparent focus:border-primary-500 focus:ring-0 text-dark-900 dark:text-white placeholder-dark-300 w-full mb-4 pb-2 transition-colors"
              placeholder="Form Title"
            />
            <textarea 
              value={form.description} 
              onChange={(e) => setForm({...form, description: e.target.value})}
              className="text-sm bg-transparent border-b border-transparent focus:border-dark-300 dark:focus:border-dark-600 focus:ring-0 text-dark-600 dark:text-dark-300 placeholder-dark-400 w-full pb-2 transition-colors resize-none"
              placeholder="Form description"
              rows={2}
            />
          </div>

          {/* Questions */}
          <AnimatePresence>
            {form.questions.map((q: any, i: number) => (
              <motion.div 
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm relative group focus-within:ring-2 focus-within:ring-primary-500/50 transition-all"
              >
                <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab text-dark-300 hover:text-dark-500">
                  <GripVertical className="w-5 h-5" />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <input 
                    type="text" 
                    value={q.question} 
                    onChange={(e) => updateQuestion(i, 'question', e.target.value)}
                    className="flex-1 text-base font-medium bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 text-dark-900 dark:text-white"
                    placeholder="Question"
                  />
                  <select 
                    value={q.type}
                    onChange={(e) => updateQuestion(i, 'type', e.target.value)}
                    className="w-full sm:w-48 bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded-xl px-4 py-3 text-dark-700 dark:text-dark-200 font-medium"
                  >
                    {QUESTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.id}</option>)}
                  </select>
                </div>

                <div className="pl-2">
                  {['Short Answer', 'Paragraph', 'File Upload', 'Date', 'Time'].includes(q.type) ? (
                    <div className="text-sm text-dark-400 border-b border-dashed border-dark-300 dark:border-dark-600 pb-2 w-1/2">
                      {q.type} text
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {q.options.map((opt: any, oi: number) => (
                        <div key={opt.id} className="flex items-center gap-3">
                          {q.type === 'Multiple Choice' ? <CircleDot className="w-4 h-4 text-dark-300" /> : <CheckSquare className="w-4 h-4 text-dark-300" />}
                          <input 
                            type="text" 
                            value={opt.option_text}
                            onChange={(e) => updateOption(i, oi, e.target.value)}
                            className="flex-1 bg-transparent border-b border-transparent hover:border-dark-200 focus:border-primary-500 text-dark-700 dark:text-dark-200 focus:ring-0 px-0 py-1"
                          />
                          {q.options.length > 1 && (
                            <button onClick={() => removeOption(i, oi)} className="text-dark-400 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-3 mt-2">
                        {q.type === 'Multiple Choice' ? <CircleDot className="w-4 h-4 text-dark-300" /> : <CheckSquare className="w-4 h-4 text-dark-300" />}
                        <button onClick={() => addOption(i)} className="text-sm text-primary-500 font-medium hover:underline">Add option</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-4 mt-6 pt-4 border-t border-dark-100 dark:border-dark-750">
                  <button onClick={() => removeQuestion(i)} className="p-2 text-dark-400 hover:text-red-500 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="w-px h-6 bg-dark-200 dark:bg-dark-700"></div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm font-medium text-dark-600 dark:text-dark-300">Required</span>
                    <input 
                      type="checkbox" 
                      checked={q.required} 
                      onChange={(e) => updateQuestion(i, 'required', e.target.checked)}
                      className="rounded-full text-primary-500 focus:ring-primary-500 border-dark-300 w-10 h-5" 
                      style={{ appearance: 'none', backgroundColor: q.required ? '#8b5cf6' : '#d1d5db' }} // Simple toggle switch styling mock
                    />
                  </label>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button 
            onClick={addQuestion} 
            className="w-full py-4 border-2 border-dashed border-dark-200 dark:border-dark-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-dark-400 hover:text-primary-500 hover:border-primary-500 hover:bg-primary-500/5 transition-all"
          >
            <Plus className="w-6 h-6" />
            <span className="font-semibold text-sm">Add Question</span>
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm space-y-6">
          <h3 className="text-lg font-bold text-dark-900 dark:text-white border-b border-dark-100 dark:border-dark-700 pb-3">Form Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200 mb-1">Category</label>
              <select 
                value={form.category} 
                onChange={(e) => setForm({...form, category: e.target.value})}
                className="input-field"
              >
                {['Attendance', 'Event', 'Project', 'Feedback', 'Survey', 'Registration'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200 mb-1">Status</label>
              <select 
                value={form.status} 
                onChange={(e) => setForm({...form, status: e.target.value})}
                className="input-field"
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200 mb-1">Open Date (Optional)</label>
              <input type="datetime-local" value={form.publish_date} onChange={e => setForm({...form, publish_date: e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-dark-800 dark:text-dark-200 mb-1">Close Date (Optional)</label>
              <input type="datetime-local" value={form.close_date} onChange={e => setForm({...form, close_date: e.target.value})} className="input-field" />
            </div>
          </div>

          <div className="pt-6 space-y-4">
            <h4 className="font-semibold text-dark-800 dark:text-dark-200">Responses & Security</h4>
            {[
              { id: 'allow_only_logged_in', label: 'Allow only logged-in students' },
              { id: 'one_response_per_student', label: 'Limit to 1 response per student' },
              { id: 'auto_collect_ic', label: 'Collect IC Number automatically' },
              { id: 'auto_collect_name', label: 'Collect Name automatically' },
            ].map((setting) => (
              <label key={setting.id} className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={form.settings[setting.id]}
                  onChange={(e) => setForm({...form, settings: {...form.settings, [setting.id]: e.target.checked}})}
                  className="rounded text-primary-500 focus:ring-primary-500 border-dark-300 w-5 h-5"
                />
                <span className="text-sm font-medium text-dark-700 dark:text-dark-300">{setting.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
