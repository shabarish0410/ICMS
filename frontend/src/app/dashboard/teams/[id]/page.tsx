'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { teamsAPI, projectsAPI, weeklyReportsAPI, meetingsAPI } from '@/services/api';
import { 
  Users2, FolderKanban, Calendar, Clock, FileText, 
  ArrowLeft, Plus, Loader2, Save, Trash, CalendarClock,
  ExternalLink, UserCheck, Settings, AlertCircle, Sparkles, X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const teamId = parseInt(params.id as string);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  
  // Project form state
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    problem_statement: '',
    proposed_solution: '',
    development_stage: 'Ideation',
    status: 'ongoing',
    technologies_used: ''
  });

  // Meeting form state
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    agenda: '',
    date: '',
    duration_minutes: 45
  });

  // Queries
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamsAPI.get(teamId),
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members', teamId],
    queryFn: () => teamsAPI.members(teamId),
  });

  const { data: projectsListData } = useQuery({
    queryKey: ['team-projects'],
    queryFn: () => projectsAPI.list({ size: 100 }),
  });

  const { data: reportsData } = useQuery({
    queryKey: ['team-reports'],
    queryFn: () => weeklyReportsAPI.list({ size: 100 }),
  });



  // Project Mutation
  const saveProjectMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        ...data,
        technologies_used: typeof data.technologies_used === 'string'
          ? data.technologies_used.split(',').map((s: string) => s.trim()).filter(Boolean)
          : data.technologies_used
      };
      const existing = projectsListData?.data?.items?.find((p: any) => p.team_id === teamId);
      if (existing) {
        return projectsAPI.update(existing.id, payload);
      } else {
        return projectsAPI.create({ ...payload, team_id: teamId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-projects'] });
      toast.success('Project details successfully saved!');
      setShowProjectModal(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to save project details');
    }
  });

  // Meeting Mutation
  const scheduleMeetingMutation = useMutation({
    mutationFn: (data: any) => meetingsAPI.create({ 
      ...data, 
      meeting_link: 'internal'
    }),
    onSuccess: () => {
      toast.success('Meeting successfully scheduled for this team!');
      setShowMeetingModal(false);
      setMeetingForm({ title: '', agenda: '', date: '', duration_minutes: 45 });
    },
    onError: (err: any) => {
      toast.error('Failed to schedule meeting');
    }
  });

  if (teamLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const team = teamData?.data;
  const members = membersData?.data || [];
  const project = projectsListData?.data?.items?.find((p: any) => p.team_id === teamId);
  const reports = (reportsData?.data?.items || []).filter((r: any) => r.student?.team_id === teamId);


  const openProjectModal = () => {
    if (project) {
      setProjectForm({
        title: project.title,
        description: project.description || '',
        problem_statement: project.problem_statement || '',
        proposed_solution: project.proposed_solution || '',
        development_stage: project.development_stage || 'Ideation',
        status: project.status || 'ongoing',
        technologies_used: Array.isArray(project.technologies_used)
          ? project.technologies_used.join(', ')
          : project.technologies_used || ''
      });
    } else {
      setProjectForm({
        title: '',
        description: '',
        problem_statement: '',
        proposed_solution: '',
        development_stage: 'Ideation',
        status: 'ongoing',
        technologies_used: ''
      });
    }
    setShowProjectModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/teams')} className="p-2 rounded-lg bg-dark-50 dark:bg-dark-750 hover:bg-dark-100 text-dark-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">{team?.name}</h1>
          <p className="text-dark-500 mt-1">{team?.department || 'General'} Department · {team?.mentor_name ? `Mentor: ${team.mentor_name}` : 'No mentor assigned'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Project Info & Members */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Card */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-dark-900 dark:text-white flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-indigo-500" /> Project Details
              </h3>
              {isAdmin && (
                <button 
                  onClick={openProjectModal}
                  className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" /> Manage Project
                </button>
              )}
            </div>

            {project ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-lg font-bold text-dark-900 dark:text-white">{project.title}</h4>
                  <p className="text-sm text-dark-500 mt-1">{project.description || 'No description provided.'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-dark-50 dark:bg-dark-850 p-3 rounded-xl border border-dark-150 text-xs">
                    <span className="text-dark-450 font-medium block">Development Phase:</span>
                    <span className="font-bold text-indigo-600 mt-0.5 block">{project.development_stage}</span>
                  </div>
                  <div className="bg-dark-50 dark:bg-dark-850 p-3 rounded-xl border border-dark-150 text-xs">
                    <span className="text-dark-450 font-medium block">Status:</span>
                    <span className="font-bold text-dark-800 dark:text-white capitalize mt-0.5 block">{project.status.replace('_', ' ')}</span>
                  </div>
                </div>

                {project.problem_statement && (
                  <div>
                    <h5 className="text-xs font-bold text-dark-450 uppercase tracking-wider mb-1">Problem Statement:</h5>
                    <p className="text-xs text-dark-600 dark:text-dark-400 italic">"{project.problem_statement}"</p>
                  </div>
                )}

                {project.proposed_solution && (
                  <div>
                    <h5 className="text-xs font-bold text-dark-450 uppercase tracking-wider mb-1">Proposed Solution:</h5>
                    <p className="text-xs text-dark-600 dark:text-dark-400 italic">"{project.proposed_solution}"</p>
                  </div>
                )}

                {project.technologies_used && (
                  <div>
                    <h5 className="text-xs font-bold text-dark-450 uppercase tracking-wider mb-1.5">Technologies / Stack:</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {(Array.isArray(project.technologies_used)
                        ? project.technologies_used
                        : typeof project.technologies_used === 'string'
                        ? project.technologies_used.split(',')
                        : []
                      ).map((tech: string) => (
                        <span key={tech} className="px-2 py-0.5 bg-indigo-55 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 rounded-md text-[10px] font-bold uppercase">
                          {tech.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-dark-200 rounded-xl">
                <FolderKanban className="w-12 h-12 mx-auto mb-2 opacity-25" />
                <p className="text-sm text-dark-550 font-medium">No project assigned to this team yet.</p>
                {isAdmin && (
                  <button onClick={openProjectModal} className="btn-primary text-xs mt-4 py-2">
                    Initialize Team Project
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Members List */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm">
            <h3 className="font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
              <Users2 className="w-5 h-5 text-indigo-500" /> Active Members ({members.length})
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-850/60 border border-dark-150 dark:border-dark-750/60 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                    {m.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-dark-900 dark:text-white">{m.name}</h4>
                    <p className="text-xs text-dark-500">{m.department || 'Student'}</p>
                    <p className="text-[10px] text-dark-400 font-mono">IC: {m.ic_number}</p>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <p className="text-xs text-dark-450 italic py-4 col-span-full">No students assigned to this team.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Action list & Weekly Logs list */}
        <div className="space-y-6">
          {/* Quick Actions */}
          {isAdmin && (
            <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm space-y-3">
              <h3 className="font-bold text-dark-900 dark:text-white text-xs uppercase tracking-wider">Quick Actions</h3>
              <button 
                onClick={() => setShowMeetingModal(true)}
                className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-xs"
              >
                <CalendarClock className="w-4 h-4" /> Schedule Team Call
              </button>
            </div>
          )}

          {/* Weekly Reports List */}
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 border border-dark-200 dark:border-dark-700 shadow-sm flex flex-col justify-between min-h-[200px]">
            <div>
              <h3 className="font-bold text-dark-900 dark:text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500" /> Weekly Logs ({reports.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {reports.map((r: any) => (
                  <div 
                    key={r.id}
                    onClick={() => router.push('/dashboard/weekly-reports')}
                    className="p-2.5 bg-dark-50 dark:bg-dark-850 hover:bg-dark-100/50 border border-dark-150 hover:border-primary-500 rounded-xl cursor-pointer transition-colors text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-dark-850 dark:text-dark-200">Week {r.week_number} Log</span>
                      <span className="text-dark-450 block text-[10px]">{r.student?.user?.full_name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-primary-500 uppercase">{r.status.replace('_', ' ')}</span>
                  </div>
                ))}
                {reports.length === 0 && (
                  <p className="text-xs text-dark-450 italic py-4">No log submissions found.</p>
                )}
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* Project Form Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-lg my-8 border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Initialize/Edit Project</h3>
              <button onClick={() => setShowProjectModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Project Title *</label>
                <input 
                  type="text" 
                  value={projectForm.title} 
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} 
                  className="input-field"
                  placeholder="e.g. Smart IoT Agriculture System" 
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Description</label>
                <textarea 
                  value={projectForm.description} 
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} 
                  className="input-field" 
                  rows={2} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Problem Statement</label>
                <textarea 
                  value={projectForm.problem_statement} 
                  onChange={(e) => setProjectForm({ ...projectForm, problem_statement: e.target.value })} 
                  className="input-field" 
                  rows={2} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Proposed Solution</label>
                <textarea 
                  value={projectForm.proposed_solution} 
                  onChange={(e) => setProjectForm({ ...projectForm, proposed_solution: e.target.value })} 
                  className="input-field" 
                  rows={2} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Phase</label>
                  <select 
                    value={projectForm.development_stage} 
                    onChange={(e) => setProjectForm({ ...projectForm, development_stage: e.target.value })} 
                    className="input-field text-sm"
                  >
                    <option value="Ideation">Ideation</option>
                    <option value="Prototyping">Prototyping</option>
                    <option value="MVP">MVP</option>
                    <option value="Scaling">Scaling</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Status</label>
                  <select 
                    value={projectForm.status} 
                    onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })} 
                    className="input-field text-sm"
                  >
                    <option value="planning">Planning</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Technologies (Comma separated)</label>
                <input 
                  type="text" 
                  value={projectForm.technologies_used} 
                  onChange={(e) => setProjectForm({ ...projectForm, technologies_used: e.target.value })} 
                  className="input-field"
                  placeholder="React, PyTorch, LoRaWAN, SQLite" 
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700 mt-6">
              <button onClick={() => setShowProjectModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button 
                onClick={() => saveProjectMutation.mutate(projectForm)} 
                disabled={saveProjectMutation.isPending} 
                className="btn-primary flex-1"
              >
                {saveProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Project'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Meeting Form Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-6 w-full max-w-md border border-dark-200 dark:border-dark-700 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 border-b border-dark-100 dark:border-dark-700 pb-3">
              <h3 className="text-lg font-bold text-dark-900 dark:text-white">Schedule Call with Team</h3>
              <button onClick={() => setShowMeetingModal(false)} className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-750"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Call Title *</label>
                <input 
                  type="text" 
                  value={meetingForm.title} 
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })} 
                  className="input-field"
                  placeholder={`Progress Sync - ${team?.name}`}
                  required 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Agenda</label>
                <textarea 
                  value={meetingForm.agenda} 
                  onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })} 
                  placeholder="Review weekly logs, verify prototypes, etc."
                  className="input-field" 
                  rows={3} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Start Time *</label>
                  <input 
                    type="datetime-local" 
                    value={meetingForm.date} 
                    onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })} 
                    className="input-field text-sm"
                    required 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-dark-700 dark:text-dark-300 mb-1">Duration (min)</label>
                  <input 
                    type="number" 
                    value={meetingForm.duration_minutes} 
                    onChange={(e) => setMeetingForm({ ...meetingForm, duration_minutes: parseInt(e.target.value) || 30 })} 
                    className="input-field" 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-dark-100 dark:border-dark-700 mt-6">
                <button onClick={() => setShowMeetingModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button 
                  onClick={() => scheduleMeetingMutation.mutate(meetingForm)} 
                  disabled={scheduleMeetingMutation.isPending} 
                  className="btn-primary flex-1"
                >
                  {scheduleMeetingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Schedule'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
