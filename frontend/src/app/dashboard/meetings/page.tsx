'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { meetingsAPI } from '@/services/api';
import { Plus, Video, Trash2, X, Loader2, Calendar, Clock, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MeetingsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ 
    title: '', 
    agenda: '', 
    date: '', 
    duration_minutes: 60, 
    meeting_link: 'internal' 
  });

  // Fetch scheduled meetings
  const { data, isLoading } = useQuery({ 
    queryKey: ['meetings'], 
    queryFn: () => meetingsAPI.list({ size: 100 }) 
  });

  // Create meeting mutation
  const createMutation = useMutation({
    mutationFn: (d: any) => meetingsAPI.create(d),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['meetings'] }); 
      toast.success('Meeting successfully scheduled!'); 
      setShowModal(false); 
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to schedule meeting'),
  });

  // Delete meeting mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => meetingsAPI.delete(id),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['meetings'] }); 
      toast.success('Meeting successfully deleted'); 
    },
    onError: (e: any) => toast.error('Failed to delete meeting'),
  });

  const meetings = data?.data?.items || [];
  const isPast = (d: string) => new Date(d) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Video Conferences</h1>
          <p className="text-dark-500 mt-1">Schedule and join built-in peer-to-peer secure audio/video rooms</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => { 
              setForm({ title: '', agenda: '', date: '', duration_minutes: 45, meeting_link: 'internal' }); 
              setShowModal(true); 
            }} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Schedule Call
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {meetings.map((m: any, i: number) => {
            const past = isPast(m.date);
            return (
              <motion.div 
                key={m.id} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }}
                className={`bg-white dark:bg-dark-800 rounded-2xl p-5 border flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${past ? 'border-dark-200 dark:border-dark-750 opacity-70' : 'border-indigo-150 dark:border-indigo-950/60'}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase font-bold text-indigo-500 bg-indigo-55 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full tracking-wider">
                      Built-in secured
                    </span>
                    {past && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-dark-100 dark:bg-dark-750 text-dark-500 uppercase tracking-wider">
                        Ended / Past
                      </span>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-dark-900 dark:text-white text-base line-clamp-1">{m.title}</h3>
                  {m.agenda && <p className="text-xs text-dark-500 mt-1 line-clamp-2 min-h-[32px]">{m.agenda}</p>}
                  
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-dark-450 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> 
                      {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> 
                      {new Date(m.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {m.duration_minutes}m
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-5 pt-4 border-t border-dark-100 dark:border-dark-750">
                  <span className="text-[10px] text-dark-400">
                    Host: {m.creator?.full_name || 'Innovation Center Admin'}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {!past && (
                      <button 
                        onClick={() => router.push(`/dashboard/meetings/${m.id}`)}
                        className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" /> Join Room
                      </button>
                    )}
                    {isAdmin && (
                      <button 
                        onClick={() => { if (confirm('Are you sure you want to delete this meeting?')) deleteMutation.mutate(m.id); }} 
                        className="p-1.5 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-red-50 dark:hover:bg-red-950/20 text-dark-400 hover:text-red-500"
                        title="Cancel Meeting"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {meetings.length === 0 && (
            <div className="col-span-full py-20 text-center text-dark-400 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-2xl">
              <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No video calls scheduled yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Schedule Call Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Schedule Video Call</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Call Title *</label>
                <input 
                  type="text" 
                  value={form.title} 
                  onChange={(e) => setForm({ ...form, title: e.target.value })} 
                  placeholder="Weekly Progress Review, Brainstorming, etc." 
                  className="input-field" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Agenda</label>
                <textarea 
                  value={form.agenda} 
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })} 
                  placeholder="Outline what needs to be discussed..." 
                  className="input-field" 
                  rows={3} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Start Date & Time *</label>
                  <input 
                    type="datetime-local" 
                    value={form.date} 
                    onChange={(e) => setForm({ ...form, date: e.target.value })} 
                    className="input-field text-sm" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Duration (minutes)</label>
                  <input 
                    type="number" 
                    value={form.duration_minutes} 
                    onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 30 })} 
                    className="input-field" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button 
                  onClick={() => createMutation.mutate(form)} 
                  disabled={createMutation.isPending} 
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Schedule Call'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
