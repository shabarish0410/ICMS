'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI } from '@/services/api';
import { Event } from '@/types';
import {
  Search, Plus, Calendar, MapPin, Users, ChevronLeft, ChevronRight,
  Edit2, Trash2, X, Loader2, Globe, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

const typeConfig: Record<string, { color: string; bg: string }> = {
  workshop: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
  hackathon: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
  seminar: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' },
  competition: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10' },
  guest_lecture: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' },
};

const statusBadge: Record<string, string> = {
  upcoming: 'badge-green',
  ongoing: 'badge-yellow',
  completed: 'badge-gray',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
};

const defaultForm = {
  title: '',
  description: '',
  event_type: 'workshop',
  date: '',
  end_date: '',
  venue: '',
  max_participants: '',
  status: 'upcoming',
};

export default function EventsPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [viewEvent, setViewEvent] = useState<Event | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['events', page, search, eventType],
    queryFn: () => eventsAPI.list({ page, size: 12, event_type: eventType }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => eventsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create event'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => eventsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated!');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to update event'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => eventsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to delete event'),
  });

  const registerMutation = useMutation({
    mutationFn: (id: number) => eventsAPI.register(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Successfully registered for the event!');
      setViewEvent(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to register'),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm({ ...defaultForm });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm });
    setShowModal(true);
  };

  const openEdit = (event: Event) => {
    setEditing(event);
    setForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      date: event.date ? event.date.slice(0, 16) : '',
      end_date: event.end_date ? event.end_date.slice(0, 16) : '',
      venue: event.venue || '',
      max_participants: event.max_participants?.toString() || '',
      status: event.status,
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      title: form.title,
      description: form.description || undefined,
      event_type: form.event_type,
      date: form.date,
      end_date: form.end_date || undefined,
      venue: form.venue || undefined,
      max_participants: form.max_participants ? Number(form.max_participants) : undefined,
    };
    if (editing) {
      payload.status = form.status;
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const events = data?.data?.items || [];
  const totalPages = data?.data?.pages || 0;
  const total = data?.data?.total || 0;
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Events</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">{total} event{total !== 1 ? 's' : ''} found</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2" id="create-event-btn">
            <Plus className="w-4 h-4" /> Create Event
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10 py-2 text-sm"
          />
        </div>
        <select
          value={eventType}
          onChange={(e) => { setEventType(e.target.value); setPage(1); }}
          className="input-field w-auto py-2 text-sm"
        >
          <option value="">All Types</option>
          <option value="workshop">Workshop</option>
          <option value="hackathon">Hackathon</option>
          <option value="seminar">Seminar</option>
          <option value="competition">Competition</option>
          <option value="guest_lecture">Guest Lecture</option>
        </select>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))
        ) : events.length > 0 ? (
          events.map((event: Event) => {
            const cfg = typeConfig[event.event_type] || typeConfig.workshop;
            const dateObj = new Date(event.date);
            return (
              <motion.div
                key={event.id}
                whileHover={{ y: -2 }}
                className="glass-card overflow-hidden hover:shadow-lg transition-all group"
              >
                <div className="px-5 pt-5 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
                      {event.event_type.replace('_', ' ')}
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge[event.status] || 'badge-gray'}`}>
                      {event.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-dark-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-xs text-dark-500 dark:text-dark-400 line-clamp-2 mb-4">
                    {event.description || 'No description provided'}
                  </p>
                </div>

                <div className="px-5 pb-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' • '}
                    {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {event.venue && (
                    <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {event.venue}
                    </div>
                  )}
                  {event.max_participants && (
                    <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" /> Max {event.max_participants} participants
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-dark-100 dark:border-dark-700/50 bg-dark-50/50 dark:bg-dark-800/30 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewEvent(event)}
                    className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    View Details →
                  </button>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(event)}
                        className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-primary-500 transition-colors"
                        title="Edit Event"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${event.title}"?`)) deleteMutation.mutate(event.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-dark-400 hover:text-red-500 transition-colors"
                        title="Delete Event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-16">
            <Calendar className="w-12 h-12 text-dark-300 mx-auto mb-3" />
            <p className="text-dark-400 font-medium">No events found</p>
            {isAdmin && (
              <button onClick={openCreate} className="mt-4 btn-primary text-sm">
                <Plus className="w-4 h-4 inline mr-1" /> Create First Event
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-ghost p-2 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-dark-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-ghost p-2 disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View Details Modal */}
      <AnimatePresence>
        {viewEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 min-w-0">
                  <div className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold mb-2 ${typeConfig[viewEvent.event_type]?.color || ''} ${typeConfig[viewEvent.event_type]?.bg || ''}`}>
                    {viewEvent.event_type.replace('_', ' ')}
                  </div>
                  <h2 className="text-xl font-bold text-dark-900 dark:text-white">{viewEvent.title}</h2>
                </div>
                <button onClick={() => setViewEvent(null)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 ml-3 flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {viewEvent.description && (
                <p className="text-sm text-dark-600 dark:text-dark-400 mb-5 leading-relaxed">{viewEvent.description}</p>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-dark-600 dark:text-dark-400">
                  <Calendar className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  {new Date(viewEvent.date).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                </div>
                {viewEvent.end_date && (
                  <div className="flex items-center gap-3 text-sm text-dark-600 dark:text-dark-400">
                    <Clock className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    Ends: {new Date(viewEvent.end_date).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                  </div>
                )}
                {viewEvent.venue && (
                  <div className="flex items-center gap-3 text-sm text-dark-600 dark:text-dark-400">
                    <MapPin className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    {viewEvent.venue}
                  </div>
                )}
                {viewEvent.max_participants && (
                  <div className="flex items-center gap-3 text-sm text-dark-600 dark:text-dark-400">
                    <Users className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    Capacity: {viewEvent.max_participants} participants
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[viewEvent.status] || 'badge-gray'}`}>
                    {viewEvent.status}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setViewEvent(null)} className="btn-secondary flex-1">Close</button>
                {!isAdmin && viewEvent.status === 'upcoming' && (
                  <button
                    onClick={() => registerMutation.mutate(viewEvent.id)}
                    disabled={registerMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {registerMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Register for Event'}
                  </button>
                )}
                {isAdmin && (
                  <button onClick={() => { setViewEvent(null); openEdit(viewEvent); }} className="btn-primary flex-1">
                    <Edit2 className="w-4 h-4 mr-1 inline" /> Edit Event
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-200 dark:border-dark-700 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-dark-900 dark:text-white">
                  {editing ? 'Edit Event' : 'Create New Event'}
                </h3>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Title *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    placeholder="Event title"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="Event description"
                    className="input-field resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Event Type *</label>
                    <select
                      value={form.event_type}
                      onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                      className="input-field"
                    >
                      <option value="workshop">Workshop</option>
                      <option value="hackathon">Hackathon</option>
                      <option value="seminar">Seminar</option>
                      <option value="competition">Competition</option>
                      <option value="guest_lecture">Guest Lecture</option>
                    </select>
                  </div>
                  {editing && (
                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="input-field"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">End Date & Time</label>
                    <input
                      type="datetime-local"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Venue</label>
                    <input
                      value={form.venue}
                      onChange={(e) => setForm({ ...form, venue: e.target.value })}
                      placeholder="Location / Room / Online"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Max Participants</label>
                    <input
                      type="number"
                      min={1}
                      value={form.max_participants}
                      onChange={(e) => setForm({ ...form, max_participants: e.target.value })}
                      placeholder="Unlimited"
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={isPending} className="btn-primary flex-1">
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : editing ? 'Update Event' : 'Create Event'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
