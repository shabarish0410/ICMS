'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminAchievementsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { Loader2, Search, Filter, CheckCircle2, XCircle, FileText, Clock, ExternalLink } from 'lucide-react';

export default function AdminAchievementsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [filterStatus]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'All') {
        params.status = filterStatus;
      }
      const res = await adminAchievementsAPI.listAll(params);
      setSubmissions(res.data || []);
    } catch (err) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status: string) => {
    if (!selectedSubmission) return;
    if (status === 'Rejected' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setIsReviewing(true);
      await adminAchievementsAPI.review(selectedSubmission.id, status, rejectionReason);
      toast.success(`Submission ${status} successfully`);
      setSelectedSubmission(null);
      setRejectionReason('');
      fetchSubmissions();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update submission');
    } finally {
      setIsReviewing(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = sub.student?.user?.full_name?.toLowerCase() || '';
    const ic = sub.student?.user?.ic_number?.toLowerCase() || '';
    return name.includes(q) || ic.includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-extrabold text-dark-900 dark:text-white tracking-tight">Achievements Approvals</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-2 font-medium">Review and approve student achievements and certifications.</p>
        </div>
      </motion.div>

      {/* Filters & Search */}
      <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <Filter className="w-5 h-5 text-dark-400" />
          {['Pending', 'Approved', 'Rejected', 'All'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filterStatus === status 
                  ? 'bg-brand-indigo/10 text-brand-indigo dark:bg-brand-indigo/20 dark:text-brand-cyan shadow-sm' 
                  : 'text-dark-500 hover:bg-dark-50 dark:text-dark-400 dark:hover:bg-white/5'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-indigo/50"
          />
          <Search className="w-4 h-4 text-dark-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-indigo" />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center">
          <FileText className="w-12 h-12 text-dark-300 mb-4" />
          <h4 className="text-lg font-bold text-dark-900 dark:text-white">No submissions found</h4>
          <p className="text-dark-500 dark:text-dark-400 mt-2">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSubmissions.map((sub, idx) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-6 flex flex-col hover:border-brand-indigo/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-dark-900 dark:text-white line-clamp-1">{sub.title}</h3>
                  <p className="text-sm text-brand-indigo dark:text-brand-cyan">{sub.student?.user?.full_name}</p>
                </div>
                {sub.status === 'Pending' && <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Pending</span>}
                {sub.status === 'Approved' && <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Approved</span>}
                {sub.status === 'Rejected' && <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> Rejected</span>}
              </div>
              
              <div className="flex-1 space-y-2 mb-6">
                <p className="text-sm text-dark-600 dark:text-dark-300 line-clamp-2">{sub.description}</p>
                {sub.issuer && <p className="text-xs text-dark-500"><strong>Issuer:</strong> {sub.issuer}</p>}
                {sub.issue_date && <p className="text-xs text-dark-500"><strong>Date:</strong> {new Date(sub.issue_date).toLocaleDateString()}</p>}
              </div>
              
              <button
                onClick={() => setSelectedSubmission(sub)}
                className="w-full py-2.5 bg-dark-50 dark:bg-white/5 hover:bg-dark-100 dark:hover:bg-white/10 text-dark-900 dark:text-white rounded-xl font-medium transition-colors text-sm border border-dark-200 dark:border-white/10"
              >
                Review Details
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm"
              onClick={() => !isReviewing && setSelectedSubmission(null)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 shadow-2xl rounded-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-dark-100 dark:border-white/10">
                <h2 className="text-xl font-bold text-dark-900 dark:text-white">Review Submission</h2>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div>
                  <h4 className="text-sm font-semibold text-dark-500 uppercase tracking-wider mb-2">Student Info</h4>
                  <div className="bg-dark-50 dark:bg-white/5 p-4 rounded-xl">
                    <p className="font-bold text-dark-900 dark:text-white">{selectedSubmission.student?.user?.full_name}</p>
                    <p className="text-sm text-dark-600 dark:text-dark-300">{selectedSubmission.student?.user?.ic_number} • {selectedSubmission.student?.user?.email}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-dark-500 uppercase tracking-wider mb-2">Achievement Details</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-dark-400">Title</p>
                      <p className="font-medium text-dark-900 dark:text-white">{selectedSubmission.title}</p>
                    </div>
                    {selectedSubmission.description && (
                      <div>
                        <p className="text-xs text-dark-400">Description</p>
                        <p className="text-sm text-dark-700 dark:text-dark-300 mt-1 whitespace-pre-wrap">{selectedSubmission.description}</p>
                      </div>
                    )}
                    <div className="flex gap-6">
                      {selectedSubmission.issuer && (
                        <div>
                          <p className="text-xs text-dark-400">Issuer</p>
                          <p className="text-sm text-dark-700 dark:text-dark-300">{selectedSubmission.issuer}</p>
                        </div>
                      )}
                      {selectedSubmission.issue_date && (
                        <div>
                          <p className="text-xs text-dark-400">Date</p>
                          <p className="text-sm text-dark-700 dark:text-dark-300">{new Date(selectedSubmission.issue_date).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedSubmission.certificate_url && (
                  <div>
                    <h4 className="text-sm font-semibold text-dark-500 uppercase tracking-wider mb-2">Attached Document</h4>
                    <a 
                      href={selectedSubmission.certificate_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex items-center justify-between p-4 bg-brand-indigo/5 border border-brand-indigo/20 rounded-xl hover:bg-brand-indigo/10 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-brand-indigo" />
                        <span className="font-medium text-brand-indigo">View Certificate</span>
                      </div>
                      <ExternalLink className="w-5 h-5 text-brand-indigo opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>
                )}
                
                {selectedSubmission.status === 'Pending' && (
                  <div>
                    <h4 className="text-sm font-semibold text-dark-500 uppercase tracking-wider mb-2">Rejection Reason (If Rejecting)</h4>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Required if rejecting..."
                      className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      rows={2}
                    />
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-dark-100 dark:border-white/10 flex justify-end gap-3 bg-dark-50/50 dark:bg-dark-900">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  disabled={isReviewing}
                  className="px-5 py-2.5 rounded-xl font-medium text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
                {selectedSubmission.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => handleReview('Rejected')}
                      disabled={isReviewing}
                      className="px-5 py-2.5 rounded-xl font-medium bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors flex items-center gap-2"
                    >
                      {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                    <button
                      onClick={() => handleReview('Approved')}
                      disabled={isReviewing}
                      className="px-5 py-2.5 rounded-xl font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                    >
                      {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Approve
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
