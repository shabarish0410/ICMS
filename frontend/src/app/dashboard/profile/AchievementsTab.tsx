import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { achievementsAPI, uploadsAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { Loader2, Plus, Upload, Trash2, Edit2, FileText, CheckCircle2, XCircle, Clock, X } from 'lucide-react';

export default function AchievementsTab() {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const res = await achievementsAPI.listMy();
      setAchievements(res.data || []);
    } catch (err) {
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(selected.type)) {
        toast.error('Please upload a JPG, PNG, or PDF file.');
        return;
      }
      if (selected.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB.');
        return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      toast.error('Title is required');
      return;
    }
    
    setSubmitting(true);
    let certificate_url = '';
    
    try {
      if (file) {
        const uploadRes = await uploadsAPI.upload(file);
        certificate_url = uploadRes.data.file_url;
      }
      
      await achievementsAPI.upload({
        title,
        description,
        issuer,
        issue_date: issueDate || null,
        certificate_url
      });
      
      toast.success('Submitted successfully for review!');
      setIsFormOpen(false);
      resetForm();
      fetchAchievements();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setIssuer('');
    setIssueDate('');
    setFile(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;
    try {
      await achievementsAPI.delete(id);
      toast.success('Deleted successfully');
      fetchAchievements();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'Rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-indigo" /></div>;
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-between items-center bg-dark-50 dark:bg-white/5 p-6 rounded-2xl border border-dark-200 dark:border-white/10">
        <div>
          <h3 className="text-xl font-bold text-dark-900 dark:text-white">Achievements & Certifications</h3>
          <p className="text-dark-500 dark:text-dark-400 mt-1">Manage your portfolio. Submissions require admin approval.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="btn-primary"
        >
          {isFormOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          {isFormOpen ? 'Close Form' : 'Add New'}
        </button>
      </div>

      {isFormOpen && (
        <motion.form 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card p-6 md:p-8 space-y-6"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-dark-600 dark:text-dark-300">Title <span className="text-red-500">*</span></label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. AWS Certified Developer" className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-dark-600 dark:text-dark-300">Issuing Organization</label>
              <input type="text" value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="e.g. Amazon Web Services" className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-dark-600 dark:text-dark-300">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Provide details about this achievement..." rows={3} className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-dark-600 dark:text-dark-300">Issue Date</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-dark-600 dark:text-dark-300">Certificate File (JPG/PNG/PDF)</label>
              <div 
                className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 border-dashed rounded-xl flex items-center gap-3 cursor-pointer hover:bg-dark-100 dark:hover:bg-white/10 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5 text-brand-indigo" />
                <span className="text-dark-600 dark:text-dark-300 flex-1 truncate">
                  {file ? file.name : "Click to select file..."}
                </span>
                <input type="file" ref={fileInputRef} className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end border-t border-dark-100 dark:border-white/10 pt-6">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit for Review'}
            </button>
          </div>
        </motion.form>
      )}

      <div className="space-y-4">
        {achievements.length === 0 ? (
          <div className="glass-card p-12 text-center flex flex-col items-center">
            <FileText className="w-12 h-12 text-dark-300 mb-4" />
            <h4 className="text-lg font-bold text-dark-900 dark:text-white">No achievements yet</h4>
            <p className="text-dark-500 dark:text-dark-400 mt-2">Upload your first certification or achievement to build your portfolio.</p>
          </div>
        ) : (
          achievements.map((item) => (
            <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-bold text-dark-900 dark:text-white">{item.title}</h4>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5
                    ${item.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                    ${item.status === 'Rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                    ${item.status === 'Pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                  `}>
                    {getStatusIcon(item.status)} {item.status}
                  </span>
                </div>
                
                {item.issuer && <p className="text-sm font-semibold text-brand-indigo dark:text-brand-cyan mb-2">{item.issuer} {item.issue_date ? `• ${new Date(item.issue_date).toLocaleDateString()}` : ''}</p>}
                {item.description && <p className="text-sm text-dark-600 dark:text-dark-300 mb-4 leading-relaxed">{item.description}</p>}
                
                {item.status === 'Rejected' && item.rejection_reason && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 mt-2">
                    <p className="text-sm text-red-800 dark:text-red-300"><span className="font-bold">Rejection Reason:</span> {item.rejection_reason}</p>
                  </div>
                )}
                
                {item.certificate_url && (
                  <a href={item.certificate_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-brand-indigo hover:underline">
                    <FileText className="w-4 h-4" /> View Certificate Document
                  </a>
                )}
              </div>
              
              {item.status === 'Pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleDelete(item.id)} className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
