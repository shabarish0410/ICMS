'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { weeklyReportsAPI, uploadsAPI } from '@/services/api';
import { 
  FileText, Plus, CheckCircle, Clock, AlertCircle, X, Loader2, 
  Paperclip, Download, Trash, Search, Filter 
} from 'lucide-react';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reviewed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  revision_requested: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function WeeklyReportsPage() {
  const { isAdmin, isStudent } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showReview, setShowReview] = useState<any>(null);
  
  // Submit Form State
  const [form, setForm] = useState({ 
    week_number: 1, 
    work_completed: '', 
    challenges: '', 
    next_plan: '', 
    attachments: [] as string[] 
  });
  const [uploading, setUploading] = useState(false);

  // Review State
  const [reviewData, setReviewData] = useState({ status: 'approved', admin_comments: '' });

  // Filters State for Admin
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch Reports
  const { data, isLoading } = useQuery({ 
    queryKey: ['weekly-reports'], 
    queryFn: () => weeklyReportsAPI.list({ size: 100 }) 
  });

  // Submit Mutation
  const submitMutation = useMutation({
    mutationFn: (d: any) => weeklyReportsAPI.submit(d),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] }); 
      toast.success('Weekly report successfully submitted!'); 
      setShowModal(false); 
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Submission failed'),
  });

  // Review Mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: any) => weeklyReportsAPI.review(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['weekly-reports'] }); 
      toast.success('Report review successfully submitted!'); 
      setShowReview(null); 
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Review failed'),
  });

  // File Upload Handlers
  const handleAttachmentUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadsAPI.upload(file);
      const url = res.data.file_url;
      setForm(prev => ({ ...prev, attachments: [...prev.attachments, url] }));
      toast.success('Attachment uploaded successfully!');
    } catch (err) {
      toast.error('Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setForm(prev => ({ 
      ...prev, 
      attachments: prev.attachments.filter((_, i) => i !== index) 
    }));
  };

  const rawReports = data?.data?.items || [];

  // Filter reports on frontend (or backend if supported, search/filters done locally for convenience)
  const filteredReports = rawReports.filter((r: any) => {
    const studentName = r.student?.user?.full_name || '';
    const studentDept = r.student?.department || '';
    const searchLower = searchQuery.toLowerCase();
    
    const matchesSearch = 
      studentName.toLowerCase().includes(searchLower) || 
      studentDept.toLowerCase().includes(searchLower) ||
      `week ${r.week_number}`.includes(searchLower);

    const matchesStatus = !statusFilter || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Weekly Reports</h1>
          <p className="text-dark-500 mt-1">{isAdmin ? 'Track student weekly work and attachments' : 'Submit weekly logs and download templates'}</p>
        </div>
        {isStudent && (
          <button 
            onClick={() => { 
              setForm({ week_number: 1, work_completed: '', challenges: '', next_plan: '', attachments: [] }); 
              setShowModal(true); 
            }} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Submit Report
          </button>
        )}
      </div>

      {/* Admin Filters Area */}
      {isAdmin && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-dark-200 dark:border-dark-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student, department, or week number..."
              className="input-field pl-9 text-sm py-2"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-dark-450" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field text-sm py-2 px-3 bg-dark-50 dark:bg-dark-750 border-dark-200"
            >
              <option value="">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="revision_requested">Revision Requested</option>
            </select>
          </div>
        </div>
      )}

      {/* List reports */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReports.map((r: any, i: number) => (
            <motion.div 
              key={r.id} 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4 border-b border-dark-100 dark:border-dark-750 pb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                    W{r.week_number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-dark-900 dark:text-white">Week {r.week_number} Log Submission</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-dark-400">
                      {isAdmin && r.student?.user && (
                        <>
                          <span className="font-semibold text-dark-700 dark:text-dark-300">{r.student.user.full_name}</span>
                          <span className="w-1 h-1 rounded-full bg-dark-300" />
                          <span>{r.student.department}</span>
                          <span className="w-1 h-1 rounded-full bg-dark-300" />
                        </>
                      )}
                      <span>Submitted on {new Date(r.submitted_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${statusColors[r.status] || statusColors.submitted}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                  {isAdmin && r.status === 'submitted' && (
                    <button 
                      onClick={() => { 
                        setShowReview(r); 
                        setReviewData({ status: 'approved', admin_comments: '' }); 
                      }}
                      className="btn-primary text-xs py-1.5 px-3.5"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>

              {/* Weekly Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h4 className="font-semibold text-dark-850 dark:text-dark-250 mb-1">Work Completed:</h4>
                    <p className="text-dark-600 dark:text-dark-400 whitespace-pre-wrap">{r.work_completed}</p>
                  </div>
                  {r.challenges && (
                    <div>
                      <h4 className="font-semibold text-dark-850 dark:text-dark-250 mb-1">Challenges Faced:</h4>
                      <p className="text-dark-600 dark:text-dark-400 whitespace-pre-wrap">{r.challenges}</p>
                    </div>
                  )}
                  {r.next_plan && (
                    <div>
                      <h4 className="font-semibold text-dark-850 dark:text-dark-250 mb-1">Next Week's Action Plan:</h4>
                      <p className="text-dark-600 dark:text-dark-400 whitespace-pre-wrap">{r.next_plan}</p>
                    </div>
                  )}
                </div>

                {/* Attachments Section */}
                <div className="bg-dark-50 dark:bg-dark-850/60 p-4 rounded-2xl border border-dark-150 dark:border-dark-750 flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-dark-800 dark:text-dark-300 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-500" /> Uploaded Attachments
                    </h4>
                    
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {(r.attachments || []).map((url: string, index: number) => {
                        const filename = url.split('/').pop() || `Attachment_${index + 1}`;
                        return (
                          <a 
                            key={index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2.5 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-xl text-xs font-medium text-dark-700 dark:text-dark-300 transition-colors"
                          >
                            <span className="truncate flex-1 pr-2">{filename}</span>
                            <Download className="w-3.5 h-3.5 text-dark-400" />
                          </a>
                        );
                      })}
                      {(r.attachments || []).length === 0 && (
                        <p className="text-xs text-dark-450 italic py-2">No attachments uploaded</p>
                      )}
                    </div>
                  </div>

                  {r.admin_comments && (
                    <div className="mt-4 pt-4 border-t border-dark-200 dark:border-dark-750 space-y-1">
                      <span className="text-[10px] font-bold text-primary-500 uppercase tracking-wider">Admin Feedback:</span>
                      <p className="text-xs text-dark-600 dark:text-dark-300 italic whitespace-pre-wrap">"{r.admin_comments}"</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {filteredReports.length === 0 && (
            <div className="py-20 text-center text-dark-400 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{isStudent ? 'You haven\'t submitted any weekly logs yet.' : 'No weekly logs match your filter criteria.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Submit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg my-8 border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Submit Weekly Report</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Week Number</label>
                <input 
                  type="number" 
                  min={1} 
                  max={52} 
                  value={form.week_number} 
                  onChange={(e) => setForm({ ...form, week_number: parseInt(e.target.value) || 1 })} 
                  className="input-field" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Work Completed *</label>
                <textarea 
                  value={form.work_completed} 
                  onChange={(e) => setForm({ ...form, work_completed: e.target.value })} 
                  placeholder="Summarize the core features built, updates shipped..."
                  className="input-field" 
                  rows={4} 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Challenges Faced</label>
                <textarea 
                  value={form.challenges} 
                  onChange={(e) => setForm({ ...form, challenges: e.target.value })} 
                  placeholder="Blockers or bugs faced (optional)..."
                  className="input-field" 
                  rows={2} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Next Week's Action Plan</label>
                <textarea 
                  value={form.next_plan} 
                  onChange={(e) => setForm({ ...form, next_plan: e.target.value })} 
                  placeholder="Target tasks for the next sprint..."
                  className="input-field" 
                  rows={2} 
                />
              </div>

              {/* Attachments Upload area */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300">Supporting Attachments</label>
                <div className="relative border border-dashed border-dark-300 hover:border-primary-500 rounded-xl p-4 bg-dark-50 dark:bg-dark-850 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                  ) : (
                    <>
                      <Paperclip className="w-4 h-4 text-dark-400" />
                      <span className="text-xs font-semibold text-dark-550">Click to upload file (PDF, DOCX, PPTX)</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAttachmentUpload(file);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                </div>

                {/* Uploaded items list */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.attachments.map((url, idx) => {
                    const fname = url.split('/').pop() || `File_${idx + 1}`;
                    return (
                      <div key={idx} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 rounded-lg text-xs font-medium border border-primary-200 dark:border-primary-900">
                        <span className="truncate max-w-[120px]">{fname}</span>
                        <button 
                          type="button" 
                          onClick={() => removeAttachment(idx)}
                          className="p-0.5 hover:bg-primary-100 dark:hover:bg-primary-900 rounded-full"
                        >
                          <X className="w-3 h-3 text-red-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button 
                  onClick={() => submitMutation.mutate(form)} 
                  disabled={submitMutation.isPending || uploading} 
                  className="btn-primary flex-1"
                >
                  {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Report'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Review Modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Review Weekly Report - Week {showReview.week_number}</h3>
              <button onClick={() => setShowReview(null)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-dark-50 dark:bg-dark-850 p-4 rounded-xl text-xs space-y-1.5 mb-2">
                <div className="flex justify-between">
                  <span className="text-dark-500">Student:</span>
                  <span className="font-semibold text-dark-800 dark:text-white">{showReview.student?.user?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-500">Department:</span>
                  <span className="font-semibold text-dark-800 dark:text-white">{showReview.student?.department}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1.5">Review Action</label>
                <select 
                  value={reviewData.status} 
                  onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })} 
                  className="input-field text-sm"
                >
                  <option value="approved">Approve Report</option>
                  <option value="revision_requested">Request Revision</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-500 uppercase tracking-wider mb-1.5">Admin Comments / Feedback</label>
                <textarea 
                  value={reviewData.admin_comments} 
                  onChange={(e) => setReviewData({ ...reviewData, admin_comments: e.target.value })} 
                  placeholder="Provide detailed feedback or revision reasons..." 
                  className="input-field" 
                  rows={3} 
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                <button onClick={() => setShowReview(null)} className="btn-secondary flex-1">Cancel</button>
                <button 
                  onClick={() => reviewMutation.mutate({ id: showReview.id, data: reviewData })} 
                  disabled={reviewMutation.isPending} 
                  className="btn-primary flex-1"
                >
                  {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Review'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
