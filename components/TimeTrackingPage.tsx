
import React, { useState, useEffect, useRef } from 'react';
import type { TimeEntry, Project, LeaveType, TimeOffRequest, TimeAdminSettings, WeeklyTimesheet, SalaryConfig } from '../types';
import { PlayIcon, StopIcon, ClockIcon, CalendarCheckIcon, CheckIcon, CancelIcon, SettingsIcon, CurrencyIcon, ChartIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

// --- Mock Data & Config ---
const MOCK_PROJECTS: Project[] = [
    { id: 'p1', name: 'Website Redesign', color: '#ec4899' },
    { id: 'p2', name: 'Client Outreach', color: '#6366f1' },
    { id: 'p3', name: 'Internal Admin', color: '#a855f7' },
    { id: 'p4', name: 'Marketing Campaign', color: '#22c55e' },
];

const DEFAULT_SETTINGS: TimeAdminSettings = {
    minDailyHours: 8,
    minWeeklyHours: 40,
    leaveBalances: {
        'Emergency': 5,
        'Casual': 10,
        'Festival': 8,
        'Sick': 7,
        'Unpaid': 0 // Infinite effectively
    }
};

const CURRENCIES = [
    { label: 'USD ($)', symbol: '$' },
    { label: 'EUR (€)', symbol: '€' },
    { label: 'GBP (£)', symbol: '£' },
    { label: 'INR (₹)', symbol: '₹' },
    { label: 'AUD (A$)', symbol: 'A$' },
    { label: 'CAD (C$)', symbol: 'C$' },
    { label: 'JPY (¥)', symbol: '¥' },
];

// --- Helpers ---

const formatDuration = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getMonday = (d: Date) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

const formatDateISO = (date: Date) => date.toISOString().split('T')[0];

// --- Components ---

export const TimeTrackingPage: React.FC = () => {
    const { currentUser, users } = useAuth();
    const [activeTab, setActiveTab] = useState<'tracker' | 'timesheet' | 'timeoff' | 'payroll' | 'admin'>('tracker');
    const [isLoading, setIsLoading] = useState(true);
    
    // State
    const [projects] = useState<Project[]>(MOCK_PROJECTS);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<TimeOffRequest[]>([]);
    const [adminSettings, setAdminSettings] = useState<TimeAdminSettings>(DEFAULT_SETTINGS);
    const [weeklySubmissions, setWeeklySubmissions] = useState<WeeklyTimesheet[]>([]);
    const [userSalaries, setUserSalaries] = useState<SalaryConfig[]>([]);

    // Tracker State
    const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [selectedProject, setSelectedProject] = useState(MOCK_PROJECTS[0].id);
    const [taskName, setTaskName] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Timesheet View State
    const [viewWeekStart, setViewWeekStart] = useState<Date>(getMonday(new Date()));

    // --- Supabase Data Loading ---
    const fetchData = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            // 1. Settings
            const { data: settingsData } = await supabase.from('app_settings').select('data').eq('id', 'time_tracking_config').single();
            if (settingsData?.data) setAdminSettings(settingsData.data);

            // 2. Time Entries
            // Admin theoretically might want to see all, but for this view we primarily need user's own entries for calculation.
            // If we implement a detail view for Admin, we'd need to fetch all. Keeping it lightweight for now.
            const entryQuery = supabase.from('time_entries').select('data');
            if (currentUser.role !== 'admin') entryQuery.eq('user_id', currentUser.id);
            
            const { data: entryData } = await entryQuery;
            if (entryData) setEntries(entryData.map((r: any) => r.data));

            // 3. Leave Requests
            const leaveQuery = supabase.from('leave_requests').select('data');
            if (currentUser.role !== 'admin') leaveQuery.eq('user_id', currentUser.id);
            
            const { data: leaveData } = await leaveQuery;
            if (leaveData) setLeaveRequests(leaveData.map((r: any) => r.data));

            // 4. Weekly Timesheets
            const weekQuery = supabase.from('weekly_timesheets').select('data');
            if (currentUser.role !== 'admin') weekQuery.eq('user_id', currentUser.id);
            
            const { data: weekData } = await weekQuery;
            if (weekData) setWeeklySubmissions(weekData.map((r: any) => r.data));

            // 5. Salaries (Admin only or read-only)
            const { data: salaryData } = await supabase.from('salary_configs').select('data');
            if (salaryData) setUserSalaries(salaryData.map((r: any) => r.data));

        } catch (error) {
            console.error("Error fetching time tracking data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentUser, activeTab]); // Refresh when switching tabs to ensure fresh data

    // --- Helpers for Database Updates ---

    const saveTimeEntry = async (entry: TimeEntry) => {
        setEntries(prev => {
            const exists = prev.find(e => e.id === entry.id);
            if (exists) return prev.map(e => e.id === entry.id ? entry : e);
            return [entry, ...prev];
        });
        await supabase.from('time_entries').upsert({ id: entry.id, user_id: entry.userId, data: entry });
    };

    const saveWeeklySubmission = async (sub: WeeklyTimesheet) => {
        setWeeklySubmissions(prev => {
            const filtered = prev.filter(s => s.id !== sub.id);
            return [...filtered, sub];
        });
        await supabase.from('weekly_timesheets').upsert({ id: sub.id, user_id: sub.userId, data: sub });
    };

    const saveLeaveRequest = async (req: TimeOffRequest) => {
        setLeaveRequests(prev => [req, ...prev]);
        await supabase.from('leave_requests').upsert({ id: req.id, user_id: req.userId, data: req });
    };
    
    const updateLeaveRequestStatus = async (req: TimeOffRequest) => {
        setLeaveRequests(prev => prev.map(r => r.id === req.id ? req : r));
        await supabase.from('leave_requests').upsert({ id: req.id, user_id: req.userId, data: req });
    };

    const saveSettings = async (settings: TimeAdminSettings) => {
        setAdminSettings(settings);
        await supabase.from('app_settings').upsert({ id: 'time_tracking_config', data: settings });
    };

    const saveSalaryConfig = async (config: SalaryConfig) => {
        setUserSalaries(prev => {
             const filtered = prev.filter(s => s.userId !== config.userId);
             return [...filtered, config];
        });
        await supabase.from('salary_configs').upsert({ user_id: config.userId, data: config });
    };

    // --- Logic: Tracker ---
    
    useEffect(() => {
        if (activeEntryId) {
            timerRef.current = setInterval(() => {
                const entry = entries.find(e => e.id === activeEntryId);
                if (entry) setElapsedTime(Date.now() - new Date(entry.startTime).getTime());
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setElapsedTime(0);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [activeEntryId, entries]);

    useEffect(() => {
        const active = entries.find(e => e.userId === currentUser?.id && e.endTime === null);
        if (active) {
            setActiveEntryId(active.id);
            setTaskName(active.taskName);
            setSelectedProject(active.projectId);
        }
    }, [entries, currentUser]);

    const handleStartTimer = async (isBreak: boolean = false) => {
        if (!currentUser) return;
        if (activeEntryId) await handleStopTimer();

        const newEntry: TimeEntry = {
            id: `entry-${Date.now()}`,
            userId: currentUser.id,
            projectId: isBreak ? 'break' : selectedProject,
            taskName: isBreak ? 'Break' : (taskName || 'Untitled Task'),
            startTime: new Date().toISOString(),
            endTime: null,
            type: isBreak ? 'break' : 'work',
            status: 'draft'
        };

        await saveTimeEntry(newEntry);
        setActiveEntryId(newEntry.id);
    };

    const handleStopTimer = async () => {
        if (!activeEntryId) return;
        const entry = entries.find(e => e.id === activeEntryId);
        if (entry) {
            const updatedEntry = { ...entry, endTime: new Date().toISOString() };
            await saveTimeEntry(updatedEntry);
        }
        setActiveEntryId(null);
        setElapsedTime(0);
        setTaskName('');
    };

    // --- Logic: Weekly Timesheets ---

    const getWeekSubmission = (userId: string, date: Date) => {
        const monday = formatDateISO(getMonday(date));
        return weeklySubmissions.find(w => w.userId === userId && w.weekStartDate === monday);
    };

    const getEntriesForWeek = (userId: string, startOfWeek: Date) => {
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);
        
        return entries.filter(e => {
            const entryTime = new Date(e.startTime);
            return e.userId === userId && entryTime >= startOfWeek && entryTime < endOfWeek;
        });
    };

    const calculateWeeklyHours = (weekEntries: TimeEntry[]) => {
        const totalMs = weekEntries.reduce((acc, curr) => {
            if (curr.type === 'break') return acc; // Exclude breaks from worked hours
            const end = curr.endTime ? new Date(curr.endTime).getTime() : Date.now();
            return acc + (end - new Date(curr.startTime).getTime());
        }, 0);
        return totalMs / (1000 * 60 * 60);
    };

    const handleSubmitWeek = async () => {
        if (!currentUser) return;
        const mondayStr = formatDateISO(viewWeekStart);
        const weekEntries = getEntriesForWeek(currentUser.id, viewWeekStart);
        const hours = calculateWeeklyHours(weekEntries);

        if (hours < adminSettings.minWeeklyHours) {
            alert(`Cannot submit! You have logged ${hours.toFixed(1)} hours. Minimum required is ${adminSettings.minWeeklyHours} hours.`);
            return;
        }

        const submission: WeeklyTimesheet = {
            id: `${currentUser.id}-${mondayStr}`,
            userId: currentUser.id,
            weekStartDate: mondayStr,
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            totalHours: hours
        };

        await saveWeeklySubmission(submission);
        
        // Also update individual entries to 'submitted' for visual consistency (batch update)
        const updates = weekEntries.map(e => ({ ...e, status: 'submitted' as const }));
        for (const up of updates) {
            await saveTimeEntry(up);
        }
    };

    const handleReviewWeek = async (submissionId: string, action: 'approve' | 'reject') => {
        const sub = weeklySubmissions.find(s => s.id === submissionId);
        if (sub) {
            await saveWeeklySubmission({ ...sub, status: action === 'approve' ? 'approved' : 'rejected', approvedAt: new Date().toISOString() });
        }
    };

    // --- Logic: Time Off ---
    const [leaveForm, setLeaveForm] = useState({ type: 'Casual' as LeaveType, startDate: '', endDate: '', reason: '' });

    const calculateBalance = (userId: string, type: LeaveType) => {
        if (type === 'Unpaid') return '∞'; // Unpaid has no limit
        const totalAllowed = adminSettings.leaveBalances[type] || 0;
        const used = leaveRequests
            .filter(r => r.userId === userId && r.type === type && r.status === 'approved')
            .reduce((acc, req) => {
                const start = new Date(req.startDate);
                const end = new Date(req.endDate);
                const days = (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;
                return acc + days;
            }, 0);
        return Math.max(0, totalAllowed - used);
    };

    const handleBookLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        const newRequest: TimeOffRequest = {
            id: `leave-${Date.now()}`,
            userId: currentUser.id,
            type: leaveForm.type,
            startDate: leaveForm.startDate,
            endDate: leaveForm.endDate,
            reason: leaveForm.reason,
            status: 'pending'
        };
        await saveLeaveRequest(newRequest);
        setLeaveForm({ type: 'Casual', startDate: '', endDate: '', reason: '' });
        alert('Leave request submitted!');
    };
    
    const handleLeaveAction = async (id: string, action: 'approve' | 'reject') => {
         const req = leaveRequests.find(r => r.id === id);
         if (req) {
             await updateLeaveRequestStatus({ ...req, status: action === 'approve' ? 'approved' : 'rejected' });
         }
    };


    // --- Logic: Payroll ---
    const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

    const calculatePayroll = (userId: string) => {
        const userConfig = userSalaries.find(s => s.userId === userId);
        if (!userConfig) return null;

        const [year, month] = salaryMonth.split('-').map(Number);
        const totalDays = getDaysInMonth(year, month);
        
        // Calculate LOP days: Approved 'Unpaid' leaves in this month
        const lopDays = leaveRequests
            .filter(r => {
                const d = new Date(r.startDate);
                return r.userId === userId && r.status === 'approved' && r.type === 'Unpaid' && 
                       d.getMonth() + 1 === month && d.getFullYear() === year;
            })
            .reduce((acc, req) => {
                 const start = new Date(req.startDate);
                 const end = new Date(req.endDate);
                 return acc + ((end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1);
            }, 0);

        const dailyRate = userConfig.baseSalary / totalDays;
        const deduction = dailyRate * lopDays;
        const netSalary = userConfig.baseSalary - deduction;

        return {
            base: userConfig.baseSalary,
            currency: userConfig.currency,
            lopDays,
            deduction,
            netSalary
        };
    };

    const handleUpdateSalaryConfig = async (userId: string, field: keyof SalaryConfig, value: string | number) => {
        const existing = userSalaries.find(s => s.userId === userId);
        const base = existing || { userId, baseSalary: 0, currency: '$' };
        const newConfig = { ...base, [field]: value };
        await saveSalaryConfig(newConfig);
    };

    // --- Render Helpers ---
    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'approved': return <span className="bg-green-900/50 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/30">Approved</span>;
            case 'rejected': return <span className="bg-red-900/50 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/30">Rejected</span>;
            case 'submitted': return <span className="bg-blue-900/50 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/30">Submitted</span>;
            default: return <span className="bg-gray-700 text-gray-400 px-2 py-1 rounded text-xs font-bold border border-gray-600">Draft</span>;
        }
    };

    const changeWeek = (dir: number) => {
        const newDate = new Date(viewWeekStart);
        newDate.setDate(newDate.getDate() + (dir * 7));
        setViewWeekStart(newDate);
    };

    return (
        <div className="space-y-6">
            {/* Header Tabs */}
            <div className="flex flex-wrap gap-2 bg-base-200/50 p-1 rounded-xl border border-white/5">
                <button onClick={() => setActiveTab('tracker')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'tracker' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                    <ClockIcon className="mr-2 h-4 w-4" /> Tracker
                </button>
                <button onClick={() => setActiveTab('timesheet')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'timesheet' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                    <CalendarCheckIcon className="mr-2 h-4 w-4" /> Timesheets
                </button>
                <button onClick={() => setActiveTab('timeoff')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'timeoff' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                    <span className="mr-2">🏖️</span> Time Off
                </button>
                {currentUser?.role === 'admin' && (
                    <>
                        <button onClick={() => setActiveTab('payroll')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'payroll' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                            <CurrencyIcon className="mr-2 h-4 w-4" /> Payroll
                        </button>
                        <button onClick={() => setActiveTab('admin')} className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-brand-primary text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                            <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                        </button>
                    </>
                )}
                 <button onClick={fetchData} className="ml-auto text-gray-400 hover:text-white p-2" title="Refresh Data">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* --- TRACKER TAB --- */}
            {activeTab === 'tracker' && (
                <div className="animate-fadeIn space-y-6">
                    <div className="glass-panel p-8 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                        {activeEntryId && <div className="absolute inset-0 bg-brand-primary/5 animate-pulse pointer-events-none"></div>}
                        
                        <div className="w-full md:w-auto flex-grow space-y-4 relative z-10">
                            <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Current Activity</h2>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <input 
                                    type="text" 
                                    value={taskName}
                                    onChange={e => setTaskName(e.target.value)}
                                    placeholder="What are you working on?"
                                    className="flex-grow bg-base-300/50 border border-gray-600 rounded-xl px-4 py-3 text-white text-lg focus:ring-2 focus:ring-brand-primary disabled:opacity-60"
                                    disabled={!!activeEntryId && activeEntryId.includes('break')}
                                />
                                <select 
                                    value={selectedProject}
                                    onChange={e => setSelectedProject(e.target.value)}
                                    className="bg-base-300/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-primary disabled:opacity-60"
                                    disabled={!!activeEntryId}
                                >
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 relative z-10">
                            <div className="text-4xl md:text-5xl font-mono font-bold text-white tracking-wider tabular-nums">
                                {formatDuration(elapsedTime)}
                            </div>
                            {!activeEntryId ? (
                                <div className="flex gap-2">
                                    <button onClick={() => handleStartTimer(false)} className="bg-green-600 hover:bg-green-500 text-white p-4 rounded-full shadow-lg shadow-green-900/30 transition-transform transform active:scale-95">
                                        <PlayIcon className="h-8 w-8" />
                                    </button>
                                    <button onClick={() => handleStartTimer(true)} className="bg-yellow-600 hover:bg-yellow-500 text-white p-4 rounded-full shadow-lg shadow-yellow-900/30 transition-transform transform active:scale-95" title="Start Break">
                                        <span className="text-xl font-bold">☕</span>
                                    </button>
                                </div>
                            ) : (
                                <button onClick={handleStopTimer} className="bg-red-600 hover:bg-red-500 text-white p-4 rounded-full shadow-lg shadow-red-900/30 transition-transform transform active:scale-95 animate-bounce-slow">
                                    <StopIcon className="h-8 w-8" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- TIMESHEET TAB --- */}
            {activeTab === 'timesheet' && (
                <div className="animate-fadeIn space-y-6">
                     {/* User View: Weekly Submission */}
                     {currentUser?.role === 'user' && (
                        <div className="glass-panel p-6 rounded-xl border border-white/10">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">Weekly Timesheet</h2>
                                <div className="flex items-center gap-4 bg-base-300/50 p-1 rounded-lg border border-white/5">
                                    <button onClick={() => changeWeek(-1)} className="p-2 hover:text-white text-gray-400"><ChevronLeftIcon /></button>
                                    <span className="font-mono text-sm font-bold text-brand-primary">
                                        {formatDateISO(viewWeekStart)}
                                    </span>
                                    <button onClick={() => changeWeek(1)} className="p-2 hover:text-white text-gray-400"><ChevronRightIcon /></button>
                                </div>
                            </div>

                            {(() => {
                                const currentWeekEntries = getEntriesForWeek(currentUser.id, viewWeekStart);
                                const totalHours = calculateWeeklyHours(currentWeekEntries);
                                const submission = getWeekSubmission(currentUser.id, viewWeekStart);
                                const isSubmitted = !!submission;

                                return (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="bg-base-300/30 p-4 rounded-lg border border-white/5 text-center">
                                                <p className="text-gray-400 text-xs uppercase font-bold">Total Hours</p>
                                                <p className={`text-2xl font-bold ${totalHours < adminSettings.minWeeklyHours ? 'text-yellow-400' : 'text-white'}`}>
                                                    {totalHours.toFixed(2)}
                                                </p>
                                            </div>
                                            <div className="bg-base-300/30 p-4 rounded-lg border border-white/5 text-center">
                                                <p className="text-gray-400 text-xs uppercase font-bold">Required</p>
                                                <p className="text-2xl font-bold text-gray-300">{adminSettings.minWeeklyHours}</p>
                                            </div>
                                            <div className="bg-base-300/30 p-4 rounded-lg border border-white/5 text-center flex flex-col items-center justify-center">
                                                <p className="text-gray-400 text-xs uppercase font-bold mb-1">Status</p>
                                                {getStatusBadge(submission?.status || 'draft')}
                                            </div>
                                        </div>

                                        {/* List Entries */}
                                        <div className="border-t border-white/10 pt-4">
                                             <h3 className="text-sm font-bold text-gray-400 mb-3">Logged Items</h3>
                                             <ul className="space-y-2">
                                                 {currentWeekEntries.map(e => (
                                                     <li key={e.id} className="flex justify-between text-sm p-2 hover:bg-white/5 rounded">
                                                         <span className="text-gray-300">{e.taskName} ({new Date(e.startTime).toLocaleDateString()})</span>
                                                         <span className="text-white font-mono">{formatDuration(e.endTime ? new Date(e.endTime).getTime() - new Date(e.startTime).getTime() : 0)}</span>
                                                     </li>
                                                 ))}
                                                 {currentWeekEntries.length === 0 && <li className="text-gray-500 text-sm italic">No entries this week.</li>}
                                             </ul>
                                        </div>

                                        <div className="flex justify-end pt-4 border-t border-white/10">
                                            <button 
                                                onClick={handleSubmitWeek}
                                                disabled={isSubmitted || totalHours < adminSettings.minWeeklyHours}
                                                className="bg-brand-primary hover:bg-brand-secondary disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center"
                                            >
                                                {isSubmitted ? 'Already Submitted' : 'Submit Week for Approval'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                     )}

                     {/* Admin View: Pending Approvals */}
                     {currentUser?.role === 'admin' && (
                         <div className="glass-panel p-6 rounded-xl border border-white/10">
                             <h2 className="text-xl font-bold text-white mb-4">Pending Weekly Approvals</h2>
                             <div className="space-y-4">
                                 {weeklySubmissions.filter(s => s.status === 'submitted').length === 0 && <p className="text-gray-500 italic">No pending submissions.</p>}
                                 
                                 {weeklySubmissions.filter(s => s.status === 'submitted').map(sub => {
                                     const user = users.find(u => u.id === sub.userId);
                                     return (
                                         <div key={sub.id} className="bg-base-300/30 p-4 rounded-lg border border-white/5 flex justify-between items-center">
                                             <div>
                                                 <p className="text-white font-bold text-lg">{user?.username}</p>
                                                 <p className="text-sm text-brand-primary">Week of {sub.weekStartDate}</p>
                                                 <p className="text-xs text-gray-400">Total Hours: {sub.totalHours.toFixed(2)}</p>
                                             </div>
                                             <div className="flex gap-3">
                                                 <button onClick={() => handleReviewWeek(sub.id, 'approve')} className="bg-green-900/40 hover:bg-green-900/60 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg font-bold transition-all flex items-center">
                                                     <CheckIcon className="mr-2 h-4 w-4" /> Approve
                                                 </button>
                                                 <button onClick={() => handleReviewWeek(sub.id, 'reject')} className="bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg font-bold transition-all flex items-center">
                                                     <CancelIcon className="mr-2 h-4 w-4" /> Reject
                                                 </button>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                             
                             <h3 className="text-lg font-bold text-gray-400 mt-8 mb-4">History</h3>
                             <div className="opacity-60">
                                 {weeklySubmissions.filter(s => s.status !== 'submitted').map(sub => (
                                      <div key={sub.id} className="flex justify-between items-center p-2 border-b border-white/5">
                                          <span className="text-sm text-gray-300">{users.find(u => u.id === sub.userId)?.username} - {sub.weekStartDate}</span>
                                          <span>{getStatusBadge(sub.status)}</span>
                                      </div>
                                 ))}
                             </div>
                         </div>
                     )}
                </div>
            )}

            {/* --- PAYROLL TAB (Admin Only) --- */}
            {activeTab === 'payroll' && currentUser?.role === 'admin' && (
                <div className="animate-fadeIn space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         {/* Salary Config */}
                         <div className="lg:col-span-1 glass-panel p-6 rounded-xl border border-white/10">
                             <h3 className="text-lg font-bold text-white mb-4 flex items-center"><SettingsIcon className="mr-2 h-5 w-5 text-brand-secondary"/> Salary Configuration</h3>
                             <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                 {users.map(user => {
                                     const config = userSalaries.find(s => s.userId === user.id);
                                     const salary = config?.baseSalary || 0;
                                     const currency = config?.currency || '$';
                                     return (
                                         <div key={user.id} className="bg-base-300/30 p-3 rounded-lg border border-white/5">
                                             <p className="text-sm font-bold text-white mb-1">{user.username}</p>
                                             <div className="flex items-center gap-2">
                                                 <select 
                                                    value={currency}
                                                    onChange={e => handleUpdateSalaryConfig(user.id, 'currency', e.target.value)}
                                                    className="bg-base-200 border border-gray-600 rounded px-2 py-2 text-white text-sm w-24 focus:ring-1 focus:ring-brand-primary"
                                                 >
                                                    {CURRENCIES.map(c => (
                                                        <option key={c.symbol} value={c.symbol}>{c.label}</option>
                                                    ))}
                                                 </select>
                                                 <input 
                                                    type="number" 
                                                    value={salary} 
                                                    onChange={e => handleUpdateSalaryConfig(user.id, 'baseSalary', parseFloat(e.target.value))}
                                                    className="bg-base-200 border border-gray-600 rounded px-3 py-2 text-white text-sm w-full focus:ring-1 focus:ring-brand-primary"
                                                    placeholder="Monthly Base"
                                                 />
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>

                         {/* Monthly Report */}
                         <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-white/10">
                             <div className="flex justify-between items-center mb-6">
                                 <h3 className="text-lg font-bold text-white flex items-center"><ChartIcon className="mr-2 h-5 w-5 text-green-400"/> Monthly Payroll Report</h3>
                                 <input 
                                    type="month" 
                                    value={salaryMonth}
                                    onChange={e => setSalaryMonth(e.target.value)}
                                    className="bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                                 />
                             </div>
                             
                             <div className="overflow-x-auto">
                                 <table className="w-full text-left text-sm">
                                     <thead className="bg-base-300/50 text-xs font-bold text-gray-400 uppercase">
                                         <tr>
                                             <th className="p-3">User</th>
                                             <th className="p-3">Base Salary</th>
                                             <th className="p-3">LOP Days</th>
                                             <th className="p-3">Deduction</th>
                                             <th className="p-3">Net Payable</th>
                                         </tr>
                                     </thead>
                                     <tbody className="divide-y divide-gray-800">
                                         {users.map(user => {
                                             const payroll = calculatePayroll(user.id);
                                             if (!payroll) return null;
                                             return (
                                                 <tr key={user.id} className="hover:bg-white/5">
                                                     <td className="p-3 font-medium text-white">{user.username}</td>
                                                     <td className="p-3 text-gray-300">{payroll.currency}{payroll.base.toLocaleString()}</td>
                                                     <td className="p-3 text-red-400">{payroll.lopDays}</td>
                                                     <td className="p-3 text-red-400">-{payroll.currency}{payroll.deduction.toFixed(2)}</td>
                                                     <td className="p-3 font-bold text-green-400">{payroll.currency}{payroll.netSalary.toFixed(2)}</td>
                                                 </tr>
                                             );
                                         })}
                                     </tbody>
                                 </table>
                             </div>
                             <p className="text-xs text-gray-500 mt-4">* LOP (Loss of Pay) is calculated based on approved 'Unpaid' leave requests for the selected month.</p>
                         </div>
                    </div>
                </div>
            )}

            {/* --- TIME OFF TAB --- */}
            {activeTab === 'timeoff' && (
                <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-5 gap-4">
                        {(['Emergency', 'Casual', 'Festival', 'Sick', 'Unpaid'] as LeaveType[]).map(type => (
                            <div key={type} className="glass-panel p-4 rounded-xl border border-white/5 text-center">
                                <h4 className="text-gray-400 text-xs font-bold uppercase mb-1">{type}</h4>
                                <p className="text-3xl font-bold text-white">{calculateBalance(currentUser?.id || '', type)}</p>
                                <p className="text-xs text-gray-500">Days Remaining</p>
                            </div>
                        ))}
                    </div>
                    
                    <div className="lg:col-span-1 glass-panel p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-4">Book Time Off</h3>
                        <form onSubmit={handleBookLeave} className="space-y-4">
                            <div>
                                <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Type</label>
                                <select 
                                    value={leaveForm.type}
                                    onChange={e => setLeaveForm({...leaveForm, type: e.target.value as LeaveType})}
                                    className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                >
                                    {Object.keys(adminSettings.leaveBalances).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Start</label>
                                    <input type="date" required value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 font-bold uppercase mb-1">End</label>
                                    <input type="date" required value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 font-bold uppercase mb-1">Reason</label>
                                <textarea required value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" rows={3}></textarea>
                            </div>
                            <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2.5 rounded-lg transition-all shadow-lg">Submit Request</button>
                        </form>
                    </div>

                    <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-white/10 overflow-hidden">
                        <h3 className="text-lg font-bold text-white mb-4">Request History</h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            {leaveRequests
                                .filter(r => currentUser?.role === 'admin' ? true : r.userId === currentUser?.id)
                                .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
                                .map(req => {
                                    const reqUser = users.find(u => u.id === req.userId);
                                    return (
                                        <div key={req.id} className="bg-base-300/30 p-4 rounded-lg border border-white/5 flex justify-between items-center">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-white">{req.type}</span>
                                                    {currentUser?.role === 'admin' && <span className="text-xs text-gray-400">({reqUser?.username})</span>}
                                                </div>
                                                <p className="text-sm text-gray-300">{req.startDate} to {req.endDate}</p>
                                                <p className="text-xs text-gray-500 italic">"{req.reason}"</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {getStatusBadge(req.status)}
                                                {currentUser?.role === 'admin' && req.status === 'pending' && (
                                                    <div className="flex gap-2 mt-1">
                                                        <button onClick={() => handleLeaveAction(req.id, 'approve')} className="text-green-400 hover:text-green-300 text-xs font-bold">Approve</button>
                                                        <button onClick={() => handleLeaveAction(req.id, 'reject')} className="text-red-400 hover:text-red-300 text-xs font-bold">Reject</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                             {leaveRequests.length === 0 && <p className="text-gray-500 italic text-center py-8">No requests found.</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* --- ADMIN SETTINGS TAB --- */}
            {activeTab === 'admin' && currentUser?.role === 'admin' && (
                <div className="animate-fadeIn glass-panel p-6 rounded-xl border border-white/10 max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <SettingsIcon /> Configuration
                        <button onClick={() => saveSettings(adminSettings)} className="ml-auto text-xs bg-brand-primary px-3 py-1 rounded hover:bg-brand-secondary">Save Config</button>
                    </h2>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-brand-secondary font-bold uppercase text-xs tracking-wider mb-4 border-b border-white/10 pb-2">Work Hours Requirements</h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Min Login Time (Daily)</label>
                                    <div className="flex items-center">
                                        <input 
                                            type="number" 
                                            value={adminSettings.minDailyHours}
                                            onChange={e => setAdminSettings({...adminSettings, minDailyHours: parseInt(e.target.value)})}
                                            className="bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white w-24 text-center"
                                        />
                                        <span className="ml-2 text-gray-500">hours</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Min Login Time (Weekly)</label>
                                    <div className="flex items-center">
                                        <input 
                                            type="number" 
                                            value={adminSettings.minWeeklyHours}
                                            onChange={e => setAdminSettings({...adminSettings, minWeeklyHours: parseInt(e.target.value)})}
                                            className="bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white w-24 text-center"
                                        />
                                        <span className="ml-2 text-gray-500">hours</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Users cannot submit weekly timesheets if they fall below the weekly minimum.</p>
                        </div>

                        <div>
                            <h3 className="text-brand-secondary font-bold uppercase text-xs tracking-wider mb-4 border-b border-white/10 pb-2">Leave Balances (Days per Year)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(adminSettings.leaveBalances).map(([type, days]) => (
                                    <div key={type}>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">{type} Leave</label>
                                        <input 
                                            type="number" 
                                            value={days}
                                            disabled={type === 'Unpaid'}
                                            onChange={e => setAdminSettings({
                                                ...adminSettings, 
                                                leaveBalances: { ...adminSettings.leaveBalances, [type]: parseInt(e.target.value) }
                                            })}
                                            className="bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white w-full disabled:opacity-50"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
