'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usersAPI } from '@/services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Users2, Trophy, Shield, Lock, Smartphone, FileBadge,
  X, Upload, CheckCircle2, AlertCircle, Edit2, Loader2, ChevronRight
} from 'lucide-react';
import AchievementsTab from './AchievementsTab';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  
  // Local state for tabs and visuals
  const [activeTab, setActiveTab] = useState<'overview' | 'edit_profile' | 'security' | 'achievements'>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  // Fallbacks if user is not fully loaded yet
  const userName = user?.full_name || 'Member';
  const roleName = user?.role?.name || 'Student';
  const icNumber = user?.ic_number || 'IC0000000';
  const email = user?.email || 'student@example.com';
  const phone = user?.mobile || 'Not provided';
  const teamName = user?.student?.team?.name;

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  
  // Student Specific Fields
  const [bio, setBio] = useState('');
  const [skillsStr, setSkillsStr] = useState(''); // Comma separated for the form
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  
  const [savingProfile, setSavingProfile] = useState(false);

  // Derived array for the tags display in Overview
  const displaySkills = skillsStr.split(',').map(s => s.trim()).filter(Boolean);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setFormEmail(user.email || '');
      setFormPhone(user.mobile || '');
      if (user.student) {
        setBio(user.student.bio || '');
        setSkillsStr(user.student.skills ? user.student.skills.join(', ') : '');
        setLinkedin(user.student.linkedin_url || '');
        setGithub(user.student.github_url || '');
        setPortfolio(user.student.portfolio_url || '');
        setResumeUrl(user.student.resume_url || '');
      }
    }
  }, [user]);

  const handleSaveProfileAssets = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate save for visual edits
    setShowEditModal(false);
    toast.success('Visuals updated (Local simulation)');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }
    setSavingProfile(true);
    try {
      await usersAPI.update(user.id, {
        full_name: fullName,
        email: formEmail || null,
        mobile: formPhone || null,
      });

      if (user.role?.name === 'student') {
        const skillsArray = skillsStr.split(',').map(s => s.trim()).filter(Boolean);

        const { studentsAPI } = await import('@/services/api');
        await studentsAPI.updateSelfProfile({
          bio,
          skills: skillsArray,
          linkedin_url: linkedin,
          github_url: github,
          portfolio_url: portfolio,
          resume_url: resumeUrl
        });
      }

      await refreshUser();
      toast.success('Your changes have been saved');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSavingProfile(false);
    }
  };

  const renderTabs = () => (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 border-b border-dark-100 dark:border-white/10 mb-6 mt-4 px-4">
      <button
        onClick={() => setActiveTab('overview')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
          activeTab === 'overview' 
            ? 'bg-dark-50 dark:bg-white/10 text-dark-900 dark:text-white border border-dark-200 dark:border-white/10 shadow-sm' 
            : 'text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5'
        }`}
      >
        <User className="w-4 h-4" /> Overview
      </button>
      <button
        onClick={() => setActiveTab('edit_profile')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
          activeTab === 'edit_profile' 
            ? 'bg-dark-50 dark:bg-white/10 text-dark-900 dark:text-white border border-dark-200 dark:border-white/10 shadow-sm' 
            : 'text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5'
        }`}
      >
        <Edit2 className="w-4 h-4" /> Edit Profile
      </button>
      <button
        onClick={() => setActiveTab('security')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
          activeTab === 'security' 
            ? 'bg-dark-50 dark:bg-white/10 text-dark-900 dark:text-white border border-dark-200 dark:border-white/10 shadow-sm' 
            : 'text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5'
        }`}
      >
        <Shield className="w-4 h-4" /> Security
      </button>

      {user?.role?.name === 'student' && (
        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
            activeTab === 'achievements' 
              ? 'bg-dark-50 dark:bg-white/10 text-dark-900 dark:text-white border border-dark-200 dark:border-white/10 shadow-sm' 
              : 'text-dark-500 hover:text-dark-900 dark:text-dark-400 dark:hover:text-white hover:bg-dark-50 dark:hover:bg-white/5'
          }`}
        >
          <FileBadge className="w-4 h-4" /> Achievements
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero Banner Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-0 overflow-hidden relative border border-dark-200 dark:border-dark-700"
      >
        <div className="h-40 relative">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              background: bannerUrl 
                ? `url(${bannerUrl}) center/cover no-repeat` 
                : 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)' 
            }}
          />
          <button 
            onClick={() => setShowEditModal(true)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm transition-colors border border-white/10"
            title="Edit Profile Visuals"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="px-8 pb-6">
          <div className="flex flex-wrap items-end gap-6 relative">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-dark-800 border-4 border-white dark:border-dark-800 shadow-xl flex items-center justify-center text-4xl font-black text-brand-indigo shrink-0 -mt-12 overflow-hidden relative z-10">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                userName.substring(0, 2).toUpperCase()
              )}
            </div>
            
            <div className="flex-1 min-w-[200px] pb-1 z-10">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white m-0">
                  {userName}
                </h2>
                <span className="px-2.5 py-1 rounded-full bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 text-xs font-semibold tracking-wide">
                  {roleName}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold tracking-wide flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-1">
                ID: {icNumber}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {renderTabs()}

      <AnimatePresence mode="wait">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="col-span-1 flex flex-col gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-bold border-b border-dark-100 dark:border-dark-700 pb-3 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-brand-indigo" />
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">Email Address</span>
                    <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-200 mt-1">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="break-all">{email}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">Phone Number</span>
                    <div className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-200 mt-1">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>{phone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
              <div className="card p-6">
                <h3 className="text-lg font-bold border-b border-dark-100 dark:border-dark-700 pb-3 mb-5 flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-brand-indigo" />
                  Club Placement & Teams
                </h3>
                {teamName ? (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">Team Workspace Linked</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">You are registered under team identifier:</p>
                      <code className="inline-block mt-2 px-3 py-1.5 bg-dark-50 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg text-sm text-brand-indigo font-mono">
                        {teamName}
                      </code>
                    </div>
                    <button className="btn-secondary text-sm">Leave Team</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">You are currently registered as an Individual student. Joining a team unlocks collaborative workspaces, challenges, and shared meeting rooms.</p>
                    <button className="btn-primary self-start text-sm px-4 py-2">Browse & Join Teams</button>
                  </div>
                )}
              </div>

              <div className="card p-6">
                <h3 className="text-lg font-bold border-b border-dark-100 dark:border-dark-700 pb-3 mb-5 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-brand-indigo" />
                  Skills & Portfolio Tags
                </h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {displaySkills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="px-3 py-1.5 flex items-center gap-2 bg-brand-indigo/10 text-brand-indigo border border-brand-indigo/20 rounded-lg text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                  {displaySkills.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No portfolio tags added. Update them in Edit Profile.</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* EDIT PROFILE TAB */}
        {activeTab === 'edit_profile' && (
          <motion.div
            key="edit_profile"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="card p-8"
          >
            <div className="space-y-6 max-w-3xl">
              <h3 className="text-xl font-bold text-dark-900 dark:text-white border-b border-dark-100 dark:border-white/10 pb-4">Personal Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">IC Number (ID)</label>
                  <input
                    type="text"
                    value={user?.ic_number || ''}
                    disabled
                    className="w-full px-4 py-3 bg-dark-100 dark:bg-dark-900/50 border border-dark-200 dark:border-white/5 rounded-xl text-dark-500 cursor-not-allowed shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Email Address</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                  />
                </div>
              </div>

              {user?.role?.name === 'student' && (
                <>
                  <h3 className="text-xl font-bold text-dark-900 dark:text-white border-b border-dark-100 dark:border-white/10 pb-4 pt-6 mt-8">Student Portfolio</h3>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Bio</label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Skills (comma separated)</label>
                      <input
                        type="text"
                        value={skillsStr}
                        onChange={(e) => setSkillsStr(e.target.value)}
                        placeholder="e.g. React, Python, UI/UX"
                        className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">LinkedIn URL</label>
                        <input
                          type="url"
                          value={linkedin}
                          onChange={(e) => setLinkedin(e.target.value)}
                          placeholder="https://linkedin.com/in/username"
                          className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">GitHub URL</label>
                        <input
                          type="url"
                          value={github}
                          onChange={(e) => setGithub(e.target.value)}
                          placeholder="https://github.com/username"
                          className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Portfolio URL (Optional)</label>
                        <input
                          type="url"
                          value={portfolio}
                          onChange={(e) => setPortfolio(e.target.value)}
                          placeholder="https://myportfolio.com"
                          className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-dark-600 dark:text-dark-300 ml-1">Resume Link</label>
                        <input
                          type="url"
                          value={resumeUrl}
                          onChange={(e) => setResumeUrl(e.target.value)}
                          placeholder="Link to PDF/DOCX"
                          className="w-full px-4 py-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-dark-900 dark:text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-6 border-t border-dark-100 dark:border-white/10 flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="btn-primary"
                >
                  {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Save Profile Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="card p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-cyan/10 rounded-2xl text-brand-cyan">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-dark-900 dark:text-white">Password & Authentication</h3>
                  <p className="text-sm text-dark-500 dark:text-dark-300 mt-1 mb-6">Manage your password and security preferences.</p>
                  
                  <button onClick={() => toast('Password change logic requires OTP as implemented previously.')} className="btn-secondary">
                    Change Password <ChevronRight className="w-4 h-4 text-dark-400" />
                  </button>
                </div>
              </div>
            </div>

            <div className="card p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-indigo/10 rounded-2xl text-brand-indigo">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-dark-900 dark:text-white">Two-Factor Authentication (2FA)</h3>
                      <p className="text-sm text-dark-500 dark:text-dark-300 mt-1">Add an extra layer of security to your account.</p>
                    </div>
                    {/* Mock Toggle */}
                    <div className="w-12 h-6 bg-dark-200 dark:bg-dark-700 rounded-full relative cursor-pointer opacity-50" title="Coming Soon">
                      <div className="w-5 h-5 bg-white dark:bg-dark-400 rounded-full absolute left-0.5 top-0.5 shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ACHIEVEMENTS TAB */}
        {activeTab === 'achievements' && (
          <motion.div
            key="achievements"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <AchievementsTab />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Profile Visuals Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-dark-800 rounded-2xl w-full max-w-lg shadow-2xl border border-dark-200 dark:border-dark-700 flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-dark-100 dark:border-dark-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Profile Visuals</h3>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-dark-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <form onSubmit={handleSaveProfileAssets} className="flex flex-col gap-6">
                  
                  {/* Avatar Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Profile Picture
                    </label>
                    <div className="flex gap-3 items-center mb-3">
                      <label className="btn-secondary cursor-pointer py-2 px-4 text-sm flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Upload from device
                        <input type="file" accept="image/*" className="hidden" />
                      </label>
                      {avatarUrl && (
                        <button 
                          type="button" 
                          onClick={() => setAvatarUrl('')} 
                          className="btn-secondary py-2 px-4 text-sm text-red-500 hover:text-red-600 border-red-500/20"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input 
                      type="text" 
                      className="input-field text-sm" 
                      placeholder="Or paste direct image URL (https://...)" 
                      value={avatarUrl} 
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  </div>

                  {/* Cover Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Cover Banner
                    </label>
                    <div className="flex gap-3 items-center mb-3">
                      <label className="btn-secondary cursor-pointer py-2 px-4 text-sm flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Upload from device
                        <input type="file" accept="image/*" className="hidden" />
                      </label>
                      {bannerUrl && (
                        <button 
                          type="button" 
                          onClick={() => setBannerUrl('')} 
                          className="btn-secondary py-2 px-4 text-sm text-red-500 hover:text-red-600 border-red-500/20"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input 
                      type="text" 
                      className="input-field text-sm" 
                      placeholder="Or paste direct cover URL (https://...)" 
                      value={bannerUrl} 
                      onChange={(e) => setBannerUrl(e.target.value)}
                    />
                    
                    {/* Presets */}
                    <div className="mt-4">
                      <span className="text-xs uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                        Or choose a preset cover
                      </span>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {[
                          '',
                          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
                          'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800',
                          'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800'
                        ].map((url, i) => (
                          <div 
                            key={i} 
                            onClick={() => setBannerUrl(url)}
                            className={`h-10 rounded-lg cursor-pointer transition-all border-2 ${
                              bannerUrl === url ? 'border-brand-indigo' : 'border-transparent'
                            }`}
                            style={{ 
                              background: url ? `url(${url}) center/cover no-repeat` : 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)'
                            }} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button type="submit" className="btn-primary flex-1 py-2.5">
                      Save Visuals
                    </button>
                    <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1 py-2.5">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
