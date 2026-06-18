'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { eventsAPI } from '@/services/api';
import { Event } from '@/types';
import { Search, Plus, Calendar, MapPin, Users, ChevronLeft, ChevronRight } from 'lucide-react';

const typeConfig: Record<string, { color: string; bg: string }> = {
  workshop: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
  hackathon: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
  seminar: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' },
  competition: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10' },
  guest_lecture: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' },
};

export default function EventsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['events', page, search, eventType],
    queryFn: () => eventsAPI.list({ page, size: 12, search, event_type: eventType }),
  });

  const events = data?.data?.items || [];
  const totalPages = data?.data?.pages || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Events</h1>
          <p className="text-dark-500 dark:text-dark-400 mt-1">Workshops, hackathons, and more</p>
        </div>
        <button className="btn-primary" id="create-event-btn">
          <Plus className="w-4 h-4" /> Create Event
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input type="text" placeholder="Search events..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input-field pl-10 py-2 text-sm" />
        </div>
        <select value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }}
          className="input-field w-auto py-2 text-sm">
          <option value="">All Types</option>
          <option value="workshop">Workshop</option>
          <option value="hackathon">Hackathon</option>
          <option value="seminar">Seminar</option>
          <option value="competition">Competition</option>
          <option value="guest_lecture">Guest Lecture</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ))
        ) : events.length > 0 ? (
          events.map((event: Event) => {
            const cfg = typeConfig[event.event_type] || typeConfig.workshop;
            const date = new Date(event.date);
            return (
              <motion.div key={event.id} whileHover={{ y: -2 }}
                className="glass-card overflow-hidden hover:shadow-lg transition-all group cursor-pointer">
                <div className={`px-5 pt-5 pb-3`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
                      {event.event_type.replace('_', ' ')}
                    </div>
                    <span className={`badge ${event.status === 'upcoming' ? 'badge-green' : event.status === 'completed' ? 'badge-gray' : 'badge-yellow'}`}>
                      {event.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-dark-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-xs text-dark-500 dark:text-dark-400 line-clamp-2 mb-4">
                    {event.description || 'No description'}
                  </p>
                </div>
                <div className="px-5 pb-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                    <Calendar className="w-3.5 h-3.5" />
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' • '}
                    {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {event.venue && (
                    <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                      <MapPin className="w-3.5 h-3.5" /> {event.venue}
                    </div>
                  )}
                  {event.max_participants && (
                    <div className="flex items-center gap-2 text-xs text-dark-500 dark:text-dark-400">
                      <Users className="w-3.5 h-3.5" /> Max {event.max_participants} participants
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 border-t border-dark-100 dark:border-dark-700/50 bg-dark-50/50 dark:bg-dark-800/30">
                  <button className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
                    View Details →
                  </button>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-16">
            <Calendar className="w-12 h-12 text-dark-300 mx-auto mb-3" />
            <p className="text-dark-400">No events found</p>
          </div>
        )}
      </div>

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
    </motion.div>
  );
}
