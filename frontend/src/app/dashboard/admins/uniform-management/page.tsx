'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { uniformsAPI } from '@/services/api';
import {
  Shirt, Plus, Edit2, Trash2, Upload, CheckCircle, AlertCircle, X,
  Camera, Image as ImageIcon, Loader2, Eye, RefreshCw, Shield,
  ChevronDown, TestTube, Zap, Building2, Users, Sun, Snowflake
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Uniform {
  id: number;
  department: string;
  gender: string;
  season: string;
  label?: string;
  front_image_url?: string;
  back_image_url?: string;
  side_image_url?: string;
  logo_image_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface TestResult {
  valid: boolean;
  confidence: number;
  reason: string;
  details?: {
    color: string;
    collar: string;
    sleeve: string;
    pattern: string;
    logo: string;
    id_card: string;
  };
}

const DEPARTMENTS = ['all', 'CSE', 'ECE', 'ME', 'CE', 'EEE', 'IT', 'MBA', 'MCA'];
const GENDERS = ['all', 'male', 'female'];
const SEASONS = ['all', 'summer', 'winter'];

const GENDER_LABELS: Record<string, string> = { all: 'All Genders', male: 'Male', female: 'Female' };
const SEASON_LABELS: Record<string, string> = { all: 'All Seasons', summer: 'Summer', winter: 'Winter' };
const DEPT_COLORS: Record<string, string> = {
  all: 'indigo', CSE: 'blue', ECE: 'violet', ME: 'orange',
  CE: 'teal', EEE: 'yellow', IT: 'cyan', MBA: 'pink', MCA: 'emerald'
};

// ─── Image Upload Widget ──────────────────────────────────────────────────────
function ImageUploadSlot({
  label, type, value, onChange, disabled
}: {
  label: string;
  type: 'front' | 'back' | 'side' | 'logo';
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Only image files are allowed.'); return; }
    setUploading(true);
    try {
      const res = await uniformsAPI.uploadImage(file, type);
      onChange(res.data.url);
      toast.success(`${label} uploaded!`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || `Failed to upload ${label}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
      <div
        onClick={() => !uploading && !disabled && inputRef.current?.click()}
        className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
          ${value ? 'border-emerald-500/40 bg-emerald-900/10' : 'border-slate-600 hover:border-indigo-500/60 bg-slate-800/40'}
          ${disabled || uploading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-700/30'}`}
      >
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : value ? (
          <>
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <p className="text-white text-xs font-semibold">Click to replace</p>
            </div>
            <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Upload className="w-6 h-6 text-slate-500" />
            <span className="text-xs text-slate-500">Upload</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}

// ─── Detection Result Badge ───────────────────────────────────────────────────
function DetectionBadge({ label, value }: { label: string; value: string }) {
  const isMatch = value === 'match' || value === 'detected';
  const isMismatch = value === 'mismatch' || value === 'not_detected';
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs
      ${isMatch ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300' :
        isMismatch ? 'bg-red-900/30 border-red-500/30 text-red-300' :
        'bg-slate-700/50 border-slate-600/50 text-slate-400'}`}
    >
      <span className="font-medium capitalize">{label}</span>
      <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full
        ${isMatch ? 'bg-emerald-500/20' : isMismatch ? 'bg-red-500/20' : 'bg-slate-600/50'}`}
      >
        {value.replace(/_/g, ' ')}
      </span>
    </div>
  );
}

// ─── Uniform Card ─────────────────────────────────────────────────────────────
function UniformCard({ uniform, onEdit, onDelete, onToggle }: {
  uniform: Uniform;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const deptColor = DEPT_COLORS[uniform.department] || 'indigo';
  const imgs = [uniform.front_image_url, uniform.back_image_url, uniform.side_image_url, uniform.logo_image_url].filter(Boolean);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-slate-800/60 border rounded-3xl overflow-hidden transition-all
        ${uniform.is_active ? 'border-slate-700/50' : 'border-slate-700/20 opacity-60'}`}
    >
      {/* Image Strip */}
      <div className="grid grid-cols-4 gap-0 h-28">
        {imgs.slice(0, 4).map((url, i) => (
          <div key={i} className="relative overflow-hidden bg-slate-900">
            <img src={url} alt="" className="w-full h-full object-cover" />
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - imgs.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-slate-900 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-slate-700" />
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-white font-semibold text-sm">
              {uniform.label || `${uniform.department.toUpperCase()} Uniform`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full bg-${deptColor}-500/15 text-${deptColor}-300 border border-${deptColor}-500/20 font-medium`}>
                {uniform.department === 'all' ? 'All Depts' : uniform.department}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                {GENDER_LABELS[uniform.gender]}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                {SEASON_LABELS[uniform.season]}
              </span>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${uniform.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/40 text-slate-500'}`}>
            {uniform.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex gap-2">
          <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={onToggle} className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs rounded-xl transition-colors
            ${uniform.is_active ? 'bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 border border-orange-500/20' : 'bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 border border-emerald-500/20'}`}
          >
            {uniform.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={onDelete} className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl transition-colors border border-red-500/20">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UniformManagementPage() {
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterDept, setFilterDept] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testCameraOpen, setTestCameraOpen] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [testDept, setTestDept] = useState('all');

  // Form state
  const [form, setForm] = useState({
    department: 'all', gender: 'all', season: 'all', label: '',
    front_image_url: '', back_image_url: '', side_image_url: '', logo_image_url: '',
    is_active: true,
  });

  const { data: uniformsData, isLoading } = useQuery({
    queryKey: ['uniforms', filterDept],
    queryFn: () => uniformsAPI.list({ department: filterDept }),
  });
  const uniforms: Uniform[] = uniformsData?.data?.items || [];

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => uniformsAPI.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uniforms'] }); toast.success('Uniform created!'); resetForm(); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to create uniform'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => uniformsAPI.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uniforms'] }); toast.success('Uniform updated!'); resetForm(); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => uniformsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uniforms'] }); toast.success('Uniform deleted.'); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || 'Failed to delete'),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ department: 'all', gender: 'all', season: 'all', label: '', front_image_url: '', back_image_url: '', side_image_url: '', logo_image_url: '', is_active: true });
  };

  const openEdit = (u: Uniform) => {
    setForm({
      department: u.department, gender: u.gender, season: u.season, label: u.label || '',
      front_image_url: u.front_image_url || '', back_image_url: u.back_image_url || '',
      side_image_url: u.side_image_url || '', logo_image_url: u.logo_image_url || '',
      is_active: u.is_active,
    });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.front_image_url && !form.logo_image_url) {
      toast.error('Please upload at least a front or logo image.');
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  // ── Test Camera ───────────────────────────────────────────────────────────
  const openTestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setTestCameraOpen(true);
    } catch { toast.error('Could not open camera for testing.'); }
  };

  const captureTestImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    setTestImage(dataUrl);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setTestCameraOpen(false);
  };

  const runTest = async () => {
    if (!testImage) { toast.error('Please capture a test image first.'); return; }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await uniformsAPI.testDetection(testImage, testDept);
      setTestResult(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Test failed');
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); }, []);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <Shirt className="w-6 h-6 text-indigo-400" />
            </div>
            Uniform Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Upload official uniform reference images for AI detection during face attendance.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 rounded-xl transition-colors text-sm font-semibold"
          >
            <TestTube className="w-4 h-4" />
            Test Detection
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl transition-all text-sm font-semibold shadow-lg shadow-indigo-500/25"
          >
            <Plus className="w-4 h-4" />
            Add Uniform
          </button>
        </div>
      </div>

      {/* Info Banner */}
      {uniforms.length === 0 && !isLoading && (
        <div className="p-5 bg-amber-900/30 border border-amber-500/30 rounded-2xl flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-amber-300 font-semibold">No uniforms registered yet</p>
            <p className="text-amber-400/70 text-sm mt-1">
              Until you upload official uniform images, the AI will fall back to a generic
              formal-clothes check. Add at least one uniform entry with front and logo images for
              accurate detection.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-slate-400 text-sm font-medium">Filter by department:</span>
        {['', ...DEPARTMENTS.filter(d => d !== 'all')].map((dept) => (
          <button
            key={dept || 'All'}
            onClick={() => setFilterDept(dept)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterDept === dept
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {dept || 'All'}
          </button>
        ))}
        <span className="text-slate-600 text-xs ml-2">
          {uniforms.length} uniform{uniforms.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Uniform Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {uniforms.map((u) => (
              <UniformCard
                key={u.id}
                uniform={u}
                onEdit={() => openEdit(u)}
                onDelete={() => { if (confirm('Delete this uniform entry?')) deleteMutation.mutate(u.id); }}
                onToggle={() => updateMutation.mutate({ id: u.id, data: { is_active: !u.is_active } })}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Create / Edit Form Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="bg-slate-900 border border-slate-700/60 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-white font-bold text-xl">{editingId ? 'Edit Uniform' : 'Add New Uniform'}</h2>
                  <p className="text-slate-400 text-sm">Upload reference images for AI uniform detection</p>
                </div>
                <button onClick={resetForm} className="p-2 text-slate-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Classification */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Department', key: 'department', options: DEPARTMENTS },
                  { label: 'Gender', key: 'gender', options: GENDERS },
                  { label: 'Season', key: 'season', options: SEASONS },
                ].map(({ label, key, options }) => (
                  <div key={key}>
                    <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5 block">{label}</label>
                    <select
                      value={(form as any)[key]}
                      onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {options.map(o => (
                        <option key={o} value={o}>
                          {o === 'all' ? (key === 'department' ? 'All Depts' : key === 'gender' ? 'All Genders' : 'All Seasons') : o}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="mb-6">
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5 block">Label (optional)</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. CSE Male Summer Uniform 2024"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Image Uploads */}
              <div className="mb-6">
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3 block">
                  Reference Images — upload at least Front or Logo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <ImageUploadSlot label="Front View" type="front" value={form.front_image_url} onChange={(url) => setForm(f => ({ ...f, front_image_url: url }))} />
                  <ImageUploadSlot label="Back View" type="back" value={form.back_image_url} onChange={(url) => setForm(f => ({ ...f, back_image_url: url }))} />
                  <ImageUploadSlot label="Side View" type="side" value={form.side_image_url} onChange={(url) => setForm(f => ({ ...f, side_image_url: url }))} />
                  <ImageUploadSlot label="Logo / Badge" type="logo" value={form.logo_image_url} onChange={(url) => setForm(f => ({ ...f, logo_image_url: url }))} />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 mb-6 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <button
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-indigo-600' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${form.is_active ? 'left-6' : 'left-0.5'}`} />
                </button>
                <span className="text-slate-300 text-sm font-medium">
                  {form.is_active ? 'Active — will be used for detection' : 'Inactive — skipped during detection'}
                </span>
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                <button onClick={resetForm} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white rounded-xl transition-all font-semibold flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> {editingId ? 'Update Uniform' : 'Create Uniform'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Test Detection Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              className="bg-slate-900 border border-slate-700/60 rounded-3xl p-6 w-full max-w-lg"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-bold text-xl flex items-center gap-2">
                    <TestTube className="w-5 h-5 text-violet-400" />
                    Test Uniform Detection
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">Capture or upload a photo to test the AI against registered uniforms</p>
                </div>
                <button onClick={() => { setShowTestModal(false); setTestResult(null); setTestImage(null); setTestCameraOpen(false); streamRef.current?.getTracks().forEach(t => t.stop()); }}
                  className="p-2 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Department Select */}
              <div className="mb-4">
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-1.5 block">
                  Test against department uniforms
                </label>
                <select
                  value={testDept}
                  onChange={(e) => setTestDept(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500"
                >
                  <option value="all">All Departments</option>
                  {DEPARTMENTS.filter(d => d !== 'all').map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Camera / Image Preview */}
              {testCameraOpen ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video mb-4 border border-slate-700">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  <button onClick={captureTestImage}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-full font-semibold text-sm shadow-lg">
                    <Camera className="w-4 h-4" /> Capture
                  </button>
                </div>
              ) : testImage ? (
                <div className="relative rounded-2xl overflow-hidden bg-slate-800 aspect-video mb-4 border border-slate-700">
                  <img src={testImage} alt="Test" className="w-full h-full object-contain" />
                  <button onClick={() => { setTestImage(null); setTestResult(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-900/80 text-white rounded-full transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-800/60 border border-dashed border-slate-600 aspect-video flex flex-col items-center justify-center gap-3 mb-4">
                  <Camera className="w-10 h-10 text-slate-600" />
                  <p className="text-slate-500 text-sm">No image captured yet</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />

              {/* Test Result */}
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mb-4 p-4 rounded-2xl border ${testResult.valid ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-red-900/30 border-red-500/30'}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-xl ${testResult.valid ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                      {testResult.valid ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${testResult.valid ? 'text-emerald-300' : 'text-red-300'}`}>
                        {testResult.valid ? '✅ PASS' : '❌ FAIL'} — {testResult.confidence}% confidence
                      </p>
                      <p className="text-xs text-slate-400">{testResult.reason}</p>
                    </div>
                  </div>
                  {testResult.details && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(testResult.details).map(([k, v]) => (
                        <DetectionBadge key={k} label={k} value={v} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {!testCameraOpen && !testImage && (
                  <button onClick={openTestCamera}
                    className="flex-1 py-3 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors text-sm font-semibold">
                    <Camera className="w-4 h-4" /> Open Camera
                  </button>
                )}
                {testImage && (
                  <button
                    onClick={runTest}
                    disabled={testLoading}
                    className="flex-1 py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl font-semibold transition-all text-sm"
                  >
                    {testLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Zap className="w-4 h-4" /> Run Test</>}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
