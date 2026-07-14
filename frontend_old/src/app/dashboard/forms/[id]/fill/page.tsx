'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { formsAPI, uploadsAPI } from '@/services/api';
import { Loader2, ArrowLeft, Send, CheckCircle2, FileUp } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FillFormPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [answers, setAnswers] = useState<any>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});

  const { data: formData, isLoading } = useQuery({
    queryKey: ['forms', id],
    queryFn: () => formsAPI.get(Number(id))
  });

  const submitMutation = useMutation({
    mutationFn: (payload: any) => formsAPI.submit(Number(id), payload),
    onSuccess: () => {
      toast.success('Response submitted successfully!');
      router.push('/dashboard/forms');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to submit response')
  });

  const handleFileChange = async (qId: number, file: File) => {
    if (!file) return;
    setUploadingFields(prev => ({ ...prev, [qId]: true }));
    try {
      const res = await uploadsAPI.upload(file);
      setAnswers((prev: any) => ({ ...prev, [qId]: { answer: file.name, file_path: res.data.file_url } }));
      toast.success('File uploaded successfully!');
    } catch (err) {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFields(prev => ({ ...prev, [qId]: false }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    // Validate required
    for (const q of form.questions) {
      if (q.required && (!answers[q.id] || (!answers[q.id].answer && !answers[q.id].file_path))) {
        toast.error(`"${q.question}" is required.`);
        return;
      }
    }

    const payload = {
      answers: Object.entries(answers).map(([qId, data]: any) => ({
        question_id: Number(qId),
        answer: data.answer || null,
        file_path: data.file_path || null
      }))
    };

    submitMutation.mutate(payload);
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  if (!formData?.data) return <div className="text-center p-20 text-red-500">Form not found.</div>;

  const form = formData.data;
  const settings = form.settings || {};

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-dark-500 hover:text-dark-900 dark:hover:text-white mb-6 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white dark:bg-dark-800 rounded-2xl p-8 border-t-[10px] border-primary-500 shadow-sm border border-x-dark-200 border-b-dark-200 dark:border-x-dark-700 dark:border-b-dark-700 mb-6">
        <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">{form.title}</h1>
        {form.description && <p className="text-dark-600 dark:text-dark-300 whitespace-pre-wrap">{form.description}</p>}
        
        {settings.allow_only_logged_in && (
          <div className="mt-6 pt-4 border-t border-dark-100 dark:border-dark-700 text-sm text-dark-500">
            <span className="font-semibold">{user?.email}</span> (Not you? Switch account)
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {settings.auto_collect_name && (
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 opacity-70">
            <label className="block text-base font-semibold text-dark-900 dark:text-white mb-2">Name (Auto-filled)</label>
            <input type="text" value={user?.full_name || ''} disabled className="input-field cursor-not-allowed bg-dark-50" />
          </div>
        )}
        {settings.auto_collect_ic && (
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 opacity-70">
            <label className="block text-base font-semibold text-dark-900 dark:text-white mb-2">IC Number (Auto-filled)</label>
            <input type="text" value={user?.ic_number || ''} disabled className="input-field cursor-not-allowed bg-dark-50" />
          </div>
        )}

        {form.questions?.map((q: any) => (
          <div key={q.id} className={`bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm ${q.required && !answers[q.id]?.answer ? 'border-l-4 border-l-red-500' : ''}`}>
            <label className="block text-base font-semibold text-dark-900 dark:text-white mb-4">
              {q.question} {q.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {q.type === 'Short Answer' && (
              <input type="text" className="input-field border-b-2 border-x-0 border-t-0 rounded-none focus:ring-0 px-0 pb-1" placeholder="Your answer"
                value={answers[q.id]?.answer || ''} onChange={e => setAnswers({...answers, [q.id]: { answer: e.target.value }})} required={q.required} />
            )}

            {q.type === 'Paragraph' && (
              <textarea className="input-field border-b-2 border-x-0 border-t-0 rounded-none focus:ring-0 px-0 pb-1 resize-none" rows={3} placeholder="Your answer"
                value={answers[q.id]?.answer || ''} onChange={e => setAnswers({...answers, [q.id]: { answer: e.target.value }})} required={q.required} />
            )}

            {q.type === 'Multiple Choice' && (
              <div className="space-y-3">
                {q.options?.map((opt: any) => (
                  <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name={`q_${q.id}`} value={opt.option_text} className="text-primary-500 w-5 h-5 border-dark-300 focus:ring-primary-500"
                      checked={answers[q.id]?.answer === opt.option_text}
                      onChange={e => setAnswers({...answers, [q.id]: { answer: e.target.value }})} required={q.required} />
                    <span className="text-dark-800 dark:text-dark-200">{opt.option_text}</span>
                  </label>
                ))}
              </div>
            )}

            {q.type === 'Dropdown' && (
              <select className="input-field w-full sm:w-64" required={q.required} value={answers[q.id]?.answer || ''} onChange={e => setAnswers({...answers, [q.id]: { answer: e.target.value }})}>
                <option value="" disabled>Choose</option>
                {q.options?.map((opt: any) => (
                  <option key={opt.id} value={opt.option_text}>{opt.option_text}</option>
                ))}
              </select>
            )}

            {q.type === 'File Upload' && (
              <div className="space-y-2">
                {answers[q.id]?.file_path ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-xl border border-green-200">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                    <span className="truncate flex-1 font-medium">{answers[q.id].answer} (Uploaded)</span>
                    <button type="button" onClick={() => setAnswers({...answers, [q.id]: undefined})} className="text-red-500 text-sm hover:underline">Remove</button>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-dark-300 hover:border-primary-500 dark:border-dark-600 rounded-xl p-6 bg-dark-50 dark:bg-dark-850 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors w-full sm:w-64">
                    {uploadingFields[q.id] ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                    ) : (
                      <>
                        <FileUp className="w-6 h-6 text-dark-400" />
                        <span className="text-sm text-dark-550 font-medium">Add file</span>
                      </>
                    )}
                    <input type="file" onChange={e => handleFileChange(q.id, e.target.files![0])} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploadingFields[q.id]} />
                  </div>
                )}
              </div>
            )}
            
            {/* Adding Checkboxes, Date, Time for completeness if requested */}
            {['Date', 'Time'].includes(q.type) && (
              <input type={q.type.toLowerCase()} className="input-field w-full sm:w-48"
                value={answers[q.id]?.answer || ''} onChange={e => setAnswers({...answers, [q.id]: { answer: e.target.value }})} required={q.required} />
            )}
          </div>
        ))}

        <div className="flex justify-between items-center bg-transparent mt-8">
          <button type="submit" disabled={submitMutation.isPending || Object.values(uploadingFields).some(Boolean)} className="btn-primary px-8 py-3 text-lg font-bold flex items-center gap-2">
            {submitMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            Submit
          </button>
          <button type="button" onClick={() => setAnswers({})} className="text-sm font-semibold text-dark-400 hover:text-dark-600 dark:hover:text-dark-200">
            Clear form
          </button>
        </div>
      </form>
    </div>
  );
}
