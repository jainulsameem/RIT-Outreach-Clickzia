
import React, { useState, useEffect, useRef } from 'react';
import type { TimeEntry, Project, LeaveType, TimeOffRequest, TimeAdminSettings, WeeklyTimesheet, SalaryConfig } from '../types';
import { PlayIcon, StopIcon, ClockIcon, CalendarCheckIcon, CheckIcon, CancelIcon, SettingsIcon, CurrencyIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, EditIcon } from './icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

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

const getTimeString = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const combineDateAndTime = (dateIso: string, timeStr: string) => {
    // dateIso is YYYY-MM-DD, timeStr is HH:mm
    return new Date(`${dateIso}T${timeStr}`).toISOString();
};

// --- Components ---

export const TimeTrackingPage: React.FC = () => {
    const { currentUser, users } = useAuth();
    const [activeTab, setActiveTab] = useState<'tracker' | 'timesheet' | 'timeoff' | 'payroll' | 'admin'>('tracker');
    const [isLoading, setIsLoading] = useState(true);
    
    // State
    const [projects, setProjects] = useState<Project[]>([]);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<TimeOffRequest[]>([]);
    const [adminSettings, setAdminSettings] = useState<TimeAdminSettings>(DEFAULT_SETTINGS);
    const [weeklySubmissions, setWeeklySubmissions] = useState<WeeklyTimesheet[]>([]);
    const [userSalaries, setUserSalaries] = useState<SalaryConfig[]>([]);

    // Tracker State
    const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [selectedProject, setSelectedProject] = useState<string>('');
    const [taskName, setTaskName] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Project Modal State
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectColor, setNewProjectColor] = useState('#6366f1');

    // Timesheet View State
    const [viewWeekStart, setViewWeekStart] = useState<Date>(getMonday(new Date()));

    // Admin Timesheet Management State
    const [adminSelectedUserId, setAdminSelectedUserId] = useState<string>('');
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [manualEntryForm, setManualEntryForm] = useState({
        id: '',
        date: '',
        startTime: '',
        endTime: '',
        projectId: '',
        taskName: '',
        userId: ''
    });

    // --- Supabase Data Loading ---
    const fetchData = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            // 1. Projects (fetch all, filter in memory for simplicity)
            const { data: projData } = await supabase.from('projects').select('data');
            if (projData) {
                const allProjs = projData.map((r: any) => r.data);
                setProjects(allProjs);
                // Set default project if none selected
                if (!selectedProject && allProjs.length > 0) {
                    const defaultProj = allProjs.find((p: Project) => p.scope === 'global') || allProjs[0];
                    if (defaultProj) setSelectedProject(defaultProj.id);
                }
            }

            // 2. Settings
            const { data: settingsData } = await supabase.from('app_settings').select('data').eq('id', 'time_tracking_config').single();
            if (settingsData?.data) setAdminSettings(settingsData.data);

            // 3. Time Entries
            const entryQuery = supabase.from('time_entries').select('data');
            if (currentUser.role !== 'admin') entryQuery.eq('user_id', currentUser.id);
            
            const { data: entryData } = await entryQuery;
            if (entryData) setEntries(entryData.map((r: any) => r.data));

            // 4. Leave Requests
            const leaveQuery = supabase.from('leave_requests').select('data');
            if (currentUser.role !== 'admin') leaveQuery.eq('user_id', currentUser.id);
            
            const { data: leaveData } = await leaveQuery;
            if (leaveData) setLeaveRequests(leaveData.map((r: any) => r.data));

            // 5. Weekly Timesheets
            const weekQuery = supabase.from('weekly_timesheets').select('data');
            if (currentUser.role !== 'admin') weekQuery.eq('user_id', currentUser.id);
            
            const { data: weekData } = await weekQuery;
            if (weekData) setWeeklySubmissions(weekData.map((r: any) => r.data));

            // 6. Salaries (Admin only or read-only)
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
    }, [currentUser, activeTab]);

    useEffect(() => {
        // Set default admin user selection if not set
        if (currentUser?.role === 'admin' && !adminSelectedUserId && users.length > 0) {
            setAdminSelectedUserId(users[0].id);
        }
    }, [users, currentUser, adminSelectedUserId]);

    // --- Helpers for Database Updates ---

    const saveTimeEntry = async (entry: TimeEntry) => {
        setEntries(prev => {
            const exists = prev.find(e => e.id === entry.id);
            if (exists) return prev.map(e => e.id === entry.id ? entry : e);
            return [entry, ...prev];
        });
        await supabase.from('time_entries').upsert({ id: entry.id, user_id: entry.userId, data: entry });
    };

    const deleteTimeEntry = async (entryId: string) => {
        setEntries(prev => prev.filter(e => e.id !== entryId));
        await supabase.from('time_entries').delete().eq('id', entryId);
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

    const handleCreateProject = async () => {
        if (!currentUser || !newProjectName.trim()) return;
        
        const newProj: Project = {
            id: `proj-${Date.now()}`,
            name: newProjectName.trim(),
            color: newProjectColor,
            scope: currentUser.role === 'admin' ? 'global' : 'personal',
            createdBy: currentUser.id
        };

        setProjects(prev => [...prev, newProj]);
        await supabase.from('projects').upsert({ id: newProj.id, user_id: currentUser.id, data: newProj });
        
        setSelectedProject(newProj.id);
        setNewProjectName('');
        setIsProjectModalOpen(false);
    };

    const handleDeleteProject = async (projId: string) => {
        setProjects(prev => prev.filter(p => p.id !== projId));
        await supabase.from('projects').delete().eq('id', projId);
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
        if (!selectedProject && !isBreak) {
            alert("Please select or create a project first.");
            return;
        }
        
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

    // --- Logic: Manual Entry (Admin) ---

    const openEntryModal = (entry?: TimeEntry, userId?: string) => {
        if (entry) {
            setManualEntryForm({
                id: entry.id,
                userId: entry.userId,
                date: formatDateISO(new Date(entry.startTime)),
                startTime: getTimeString(entry.startTime),
                endTime: entry.endTime ? getTimeString(entry.endTime) : '',
                projectId: entry.projectId,
                taskName: entry.taskName
            });
        } else {
            const now = new Date();
            setManualEntryForm({
                id: '',
                userId: userId || currentUser?.id || '',
                date: formatDateISO(now),
                startTime: '09:00',
                endTime: '17:00',
                projectId: globalProjects[0]?.id || '',
                taskName: ''
            });
        }
        setIsEntryModalOpen(true);
    };

    const handleSaveManualEntry = async () => {
        const { id, userId, date, startTime, endTime, projectId, taskName } = manualEntryForm;
        
        if (!date || !startTime || !projectId || !userId) {
            alert("Please fill in all required fields.");
            return;
        }

        const startIso = combineDateAndTime(date, startTime);
        let endIso: string | null = null;
        
        if (endTime) {
            endIso = combineDateAndTime(date, endTime);
            if (new Date(endIso) <= new Date(startIso)) {
                alert("End time must be after start time.");
                return;
            }
        }

        const isBreak = projectId === 'break';
        const entry: TimeEntry = {
            id: id || `manual-${Date.now()}`,
            userId,
            projectId,
            taskName: isBreak ? 'Break' : (taskName || 'Manual Entry'),
            startTime: startIso,
            endTime: endIso,
            type: isBreak ? 'break' : 'work',
            status: 'approved' // Admin edits are auto-approved
        };

        await saveTimeEntry(entry);
        setIsEntryModalOpen(false);
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

    const getLeaveHoursForWeek = (userId: string, startOfWeek: Date) => {
        let leaveHours = 0;
        
        // Iterate through each day of the week
        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(currentDay.getDate() + i);
            const currentDayStr = formatDateISO(currentDay);

            // Logic: Approved leave (except Unpaid) counts as 8 hours
            const hasApprovedLeave = leaveRequests.some(req => 
                req.userId === userId &&
                req.status === 'approved' &&
                req.type !== 'Unpaid' && 
                req.startDate <= currentDayStr &&
                req.endDate >= currentDayStr
            );

            if (hasApprovedLeave) {
                leaveHours += 8;
            }
        }
        return leaveHours;
    };

    const calculateWeeklyHours = (weekEntries: TimeEntry[]) => {
        const totalMs = weekEntries.reduce((acc, curr) => {
            if (curr.type === 'break') return acc;
            const end = curr.endTime ? new Date(curr.endTime).getTime() : Date.now();
            return acc + (end - new Date(curr.startTime).getTime());
        }, 0);
        return totalMs / (1000 * 60 * 60);
    };

    const handleSubmitWeek = async (targetDate: Date = viewWeekStart) => {
        if (!currentUser) return;
        const mondayStr = formatDateISO(targetDate);
        const weekEntries = getEntriesForWeek(currentUser.id, targetDate);
        const workedHours = calculateWeeklyHours(weekEntries);
        const leaveCreditHours = getLeaveHoursForWeek(currentUser.id, targetDate);
        
        const totalEffectiveHours = workedHours + leaveCreditHours;

        if (totalEffectiveHours < adminSettings.minWeeklyHours) {
            alert(
                `Submission Failed: Minimum Hours Not Met\n\n` +
                `Required: ${adminSettings.minWeeklyHours} hours/week\n` +
                `Your Total: ${totalEffectiveHours.toFixed(2)} hours\n` +
                `-----------------------------\n` +
                `Logged Work: ${workedHours.toFixed(2)} hrs\n` +
                `Leave Credits: ${leaveCreditHours} hrs (8hr per approved day)\n\n` +
                `Please log more time or wait for leave request approval.`
            );
            return;
        }

        const submission: WeeklyTimesheet = {
            id: `${currentUser.id}-${mondayStr}`,
            userId: currentUser.id,
            weekStartDate: mondayStr,
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            totalHours: totalEffectiveHours
        };

        await saveWeeklySubmission(submission);
        
        const updates = weekEntries.map(e => ({ ...e, status: 'submitted' as const }));
        for (const up of updates) {
            await saveTimeEntry(up);
        }
        alert("Timesheet submitted successfully!");
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
        if (type === 'Unpaid') return '∞';
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

    // --- Helper for Today's Activity List ---
    const getTodayEntries = () => {
        if (!currentUser) return [];
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        return entries.filter(e => {
            if (e.userId !== currentUser.id) return false;
            const entryTime = new Date(e.startTime);
            return entryTime >= startOfDay;
        }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
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

    const currentWeekStart = getMonday(new Date());
    const currentWeekEntries = getEntriesForWeek(currentUser?.id || '', currentWeekStart);
    const currentWeekWorked = calculateWeeklyHours(currentWeekEntries);
    const currentWeekLeaves = getLeaveHoursForWeek(currentUser?.id || '', currentWeekStart);
    const currentWeekTotal = currentWeekWorked + currentWeekLeaves;
    const currentWeekSubmission = getWeekSubmission(currentUser?.id || '', currentWeekStart);

    const todayEntries = getTodayEntries();
    const todayTotalHours = calculateWeeklyHours(todayEntries);

    const visibleProjects = projects.filter(p => p.scope === 'global' || p.createdBy === currentUser?.id);
    const globalProjects = visibleProjects.filter(p => p.scope === 'global');
    const personalProjects = visibleProjects.filter(p => p.scope === 'personal');

    return (
        <div className="space-y-6 relative">
             {/* Project Creation Modal */}
            {isProjectModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-base-200 p-6 rounded-xl border border-white/10 w-full max-w-sm">
                        <h3 className="text-lg font-bold text-white mb-4">Create New Project</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Project Name</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    placeholder="e.g. Mobile App Design"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Color Tag</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewProjectColor(color)}
                                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${newProjectColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            {currentUser?.role === 'admin' && (
                                <p className="text-xs text-brand-secondary mt-2">* As Admin, this will be a Global Project visible to all users.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleCreateProject} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Create Project</button>
                        </div>
                    </div>
                </div>
            )}

             {/* Manual Entry Modal (Admin) */}
             {isEntryModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-base-200 p-6 rounded-xl border border-white/10 w-full max-w-md">
                        <h3 className="text-lg font-bold text-white mb-4">{manualEntryForm.id ? 'Edit Entry' : 'Add Manual Entry'}</h3>
                        <div className="space-y-4">
                             <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Project</label>
                                <select 
                                    value={manualEntryForm.projectId}
                                    onChange={e => setManualEntryForm({...manualEntryForm, projectId: e.target.value})}
                                    className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                >
                                    <option value="" disabled>Select Project</option>
                                    <option value="break">-- BREAK --</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            {manualEntryForm.projectId !== 'break' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Task</label>
                                    <input 
                                        type="text" 
                                        value={manualEntryForm.taskName}
                                        onChange={e => setManualEntryForm({...manualEntryForm, taskName: e.target.value})}
                                        className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                            )}
                             <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Date</label>
                                <input 
                                    type="date" 
                                    value={manualEntryForm.date}
                                    onChange={e => setManualEntryForm({...manualEntryForm, date: e.target.value})}
                                    className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={manualEntryForm.startTime}
                                        onChange={e => setManualEntryForm({...manualEntryForm, startTime: e.target.value})}
                                        className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-1">End Time</label>
                                    <input 
                                        type="time" 
                                        value={manualEntryForm.endTime}
                                        onChange={e => setManualEntryForm({...manualEntryForm, endTime: e.target.value})}
                                        className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                    />
                                </div>
                             </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsEntryModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handleSaveManualEntry} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg">Save Entry</button>
                        </div>
                    </div>
                </div>
            )}


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
                                <div className="flex gap-2">
                                    <select 
                                        value={selectedProject}
                                        onChange={e => setSelectedProject(e.target.value)}
                                        className="bg-base-300/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-brand-primary disabled:opacity-60 min-w-[180px]"
                                        disabled={!!activeEntryId}
                                    >
                                        <option value="" disabled>Select Project</option>
                                        {globalProjects.length > 0 && (
                                            <optgroup label="Global Projects">
                                                {globalProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </optgroup>
                                        )}
                                        {personalProjects.length > 0 && (
                                            <optgroup label="My Projects">
                                                {personalProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </optgroup>
                                        )}
                                    </select>
                                    <button 
                                        onClick={() => setIsProjectModalOpen(true)}
                                        disabled={!!activeEntryId}
                                        className="bg-base-300/50 hover:bg-base-200 border border-gray-600 rounded-xl px-3 text-white disabled:opacity-50"
                                        title="Create New Project"
                                    >
                                        <PlusIcon className="h-5 w-5" />
                                    </button>
                                </div>
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

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* --- TODAY'S ACTIVITY LIST --- */}
                        <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-white">Today's Activity</h3>
                                <span className="text-sm font-mono text-brand-primary bg-brand-primary/10 px-2 py-1 rounded border border-brand-primary/20">
                                    Total: {todayTotalHours.toFixed(2)} hrs
                                </span>
                            </div>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {todayEntries.length === 0 && <p className="text-gray-500 italic text-sm text-center py-4">No activity recorded today.</p>}
                                {todayEntries.map(entry => {
                                    const project = projects.find(p => p.id === entry.projectId);
                                    const start = new Date(entry.startTime);
                                    const end = entry.endTime ? new Date(entry.endTime) : null;
                                    const duration = (end ? end.getTime() : Date.now()) - start.getTime();
                                    const isActive = !entry.endTime;
                                    
                                    return (
                                        <div key={entry.id} className={`flex items-center justify-between bg-base-300/30 p-3 rounded-lg border ${isActive ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-white/5'}`}>
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${entry.type === 'break' ? 'bg-yellow-500' : ''} ${isActive ? 'animate-pulse' : ''}`} style={{ backgroundColor: entry.type === 'work' ? project?.color : undefined }}></div>
                                                <div className="min-w-0">
                                                    <p className="text-white font-medium truncate text-sm">{entry.taskName}</p>
                                                    <p className="text-xs text-gray-400 truncate">
                                                        {project?.name || (entry.type === 'break' ? 'Break' : 'Unknown Project')} • {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-white font-mono text-sm font-bold whitespace-nowrap ml-4">
                                                {formatDuration(duration)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* --- CURRENT WEEK STATUS --- */}
                        <div className="lg:col-span-1 glass-panel p-6 rounded-xl border border-white/10 flex flex-col">
                            <h3 className="text-lg font-bold text-white mb-4">Current Week Status</h3>
                            <div className="flex-grow flex flex-col justify-center space-y-4">
                                <div className="flex justify-between items-end">
                                     <span className="text-gray-400 text-sm">Worked</span>
                                     <span className="text-xl font-bold text-white">{currentWeekWorked.toFixed(2)}h</span>
                                </div>
                                <div className="flex justify-between items-end">
                                     <span className="text-gray-400 text-sm">Leave Credit</span>
                                     <span className="text-xl font-bold text-brand-light">{currentWeekLeaves}h</span>
                                </div>
                                <div className="h-px bg-white/10 my-2"></div>
                                <div className="flex justify-between items-end">
                                     <span className="text-gray-300 font-bold text-sm">Total</span>
                                     <span className={`text-2xl font-bold ${currentWeekTotal >= adminSettings.minWeeklyHours ? 'text-green-400' : 'text-yellow-400'}`}>
                                         {currentWeekTotal.toFixed(2)}h
                                     </span>
                                </div>
                                <p className="text-xs text-gray-500 text-right">Target: {adminSettings.minWeeklyHours}h / week</p>
                            </div>
                            
                            <button 
                                onClick={() => handleSubmitWeek(currentWeekStart)}
                                disabled={!!currentWeekSubmission}
                                className={`mt-6 w-full py-3 rounded-xl font-bold flex items-center justify-center transition-all ${currentWeekSubmission ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-brand-primary hover:bg-brand-secondary text-white shadow-lg'}`}
                            >
                                <CheckIcon className="mr-2 h-4 w-4" />
                                {currentWeekSubmission ? 'Week Submitted' : 'Submit Timesheet'}
                            </button>
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
                                const workedHours = calculateWeeklyHours(currentWeekEntries);
                                const leaveCredits = getLeaveHoursForWeek(currentUser.id, viewWeekStart);
                                const totalEffective = workedHours + leaveCredits;
                                
                                const submission = getWeekSubmission(currentUser.id, viewWeekStart);
                                const isSubmitted = !!submission;
                                const meetsRequirement = totalEffective >= adminSettings.minWeeklyHours;

                                return (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="bg-base-300/30 p-4 rounded-lg border border-white/5 text-center">
                                                <p className="text-gray-400 text-xs uppercase font-bold">Worked</p>
                                                <p className="text-2xl font-bold text-white">{workedHours.toFixed(2)}</p>
                                            </div>
                                             <div className="bg-base-300/30 p-4 rounded-lg border border-white/5 text-center">
                                                <p className="text-gray-400 text-xs uppercase font-bold">Leave Credit</p>
                                                <p className="text-2xl font-bold text-brand-light">{leaveCredits}</p>
                                                <p className="text-[10px] text-gray-500">Approved Paid Leave (8h/day)</p>
                                            </div>
                                            <div className="bg-base-300/30 p-4 rounded-lg border border-white/5 text-center relative overflow-hidden">
                                                {meetsRequirement && <div className="absolute inset-0 bg-green-500/10"></div>}
                                                <p className="text-gray-400 text-xs uppercase font-bold relative z-10">Total Effective</p>
                                                <p className={`text-2xl font-bold relative z-10 ${!meetsRequirement ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {totalEffective.toFixed(2)}
                                                </p>
                                                <p className="text-[10px] text-gray-500 relative z-10">Min: {adminSettings.minWeeklyHours}</p>
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
                                                onClick={() => handleSubmitWeek(viewWeekStart)}
                                                disabled={isSubmitted}
                                                className={`font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center ${isSubmitted ? 'bg-gray-700 cursor-not-allowed text-gray-400' : 'bg-brand-primary hover:bg-brand-secondary text-white'}`}
                                            >
                                                <CheckIcon className="mr-2 h-5 w-5" />
                                                {isSubmitted ? 'Already Submitted' : 'Submit Week for Approval'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                     )}

                     {/* Admin View */}
                     {currentUser?.role === 'admin' && (
                         <>
                            {/* Pending Approvals Section */}
                             <div className="glass-panel p-6 rounded-xl border border-white/10 mb-8">
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
                             </div>

                             {/* Manage User Timesheets Section */}
                             <div className="glass-panel p-6 rounded-xl border border-white/10">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                    <h2 className="text-xl font-bold text-white">Manage User Timesheets</h2>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <select 
                                            value={adminSelectedUserId} 
                                            onChange={e => setAdminSelectedUserId(e.target.value)}
                                            className="bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                                        >
                                            <option value="" disabled>Select User</option>
                                            {users.filter(u => u.role !== 'admin').map(u => (
                                                <option key={u.id} value={u.id}>{u.username}</option>
                                            ))}
                                        </select>

                                        <div className="flex items-center gap-2 bg-base-300/50 p-1 rounded-lg border border-white/5">
                                            <button onClick={() => changeWeek(-1)} className="p-2 hover:text-white text-gray-400"><ChevronLeftIcon /></button>
                                            <span className="font-mono text-sm font-bold text-brand-primary px-2">
                                                {formatDateISO(viewWeekStart)}
                                            </span>
                                            <button onClick={() => changeWeek(1)} className="p-2 hover:text-white text-gray-400"><ChevronRightIcon /></button>
                                        </div>
                                    </div>
                                </div>
                                
                                {adminSelectedUserId ? (() => {
                                    const userEntries = getEntriesForWeek(adminSelectedUserId, viewWeekStart);
                                    const workedHours = calculateWeeklyHours(userEntries);
                                    const leaveCredits = getLeaveHoursForWeek(adminSelectedUserId, viewWeekStart);
                                    const totalEffective = workedHours + leaveCredits;
                                    const submission = getWeekSubmission(adminSelectedUserId, viewWeekStart);

                                    return (
                                        <div className="space-y-6">
                                            {/* Weekly Stats Summary */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                                <div className="bg-base-300/20 p-3 rounded border border-white/5 flex justify-between">
                                                    <span className="text-gray-400 text-sm">Worked:</span>
                                                    <span className="text-white font-bold">{workedHours.toFixed(2)}h</span>
                                                </div>
                                                <div className="bg-base-300/20 p-3 rounded border border-white/5 flex justify-between">
                                                    <span className="text-gray-400 text-sm">Leave:</span>
                                                    <span className="text-white font-bold">{leaveCredits}h</span>
                                                </div>
                                                <div className="bg-base-300/20 p-3 rounded border border-white/5 flex justify-between">
                                                    <span className="text-gray-400 text-sm">Status:</span>
                                                    <span>{getStatusBadge(submission?.status || 'draft')}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                 <h3 className="text-sm font-bold text-gray-400">Logged Entries</h3>
                                                 <button 
                                                    onClick={() => openEntryModal(undefined, adminSelectedUserId)}
                                                    className="text-xs bg-brand-primary hover:bg-brand-secondary text-white px-3 py-1.5 rounded-lg flex items-center"
                                                 >
                                                     <PlusIcon className="h-3 w-3 mr-1" /> Add Manual Entry
                                                 </button>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead>
                                                        <tr className="text-gray-500 border-b border-white/10">
                                                            <th className="pb-2 font-normal">Date</th>
                                                            <th className="pb-2 font-normal">Task / Project</th>
                                                            <th className="pb-2 font-normal">Time</th>
                                                            <th className="pb-2 font-normal">Duration</th>
                                                            <th className="pb-2 font-normal text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {userEntries.map(e => {
                                                            const duration = e.endTime ? new Date(e.endTime).getTime() - new Date(e.startTime).getTime() : 0;
                                                            const projName = projects.find(p => p.id === e.projectId)?.name || (e.type === 'break' ? 'Break' : 'Unknown');
                                                            return (
                                                                <tr key={e.id} className="hover:bg-white/5">
                                                                    <td className="py-3 text-gray-300">{new Date(e.startTime).toLocaleDateString()}</td>
                                                                    <td className="py-3">
                                                                        <div className="text-white">{e.taskName}</div>
                                                                        <div className="text-xs text-gray-500">{projName}</div>
                                                                    </td>
                                                                    <td className="py-3 text-gray-400 text-xs">
                                                                        {new Date(e.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                                                        {e.endTime ? new Date(e.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}
                                                                    </td>
                                                                    <td className="py-3 font-mono text-gray-300">{formatDuration(duration)}</td>
                                                                    <td className="py-3 text-right">
                                                                        <div className="flex justify-end gap-2">
                                                                            <button onClick={() => openEntryModal(e, adminSelectedUserId)} className="p-1.5 text-gray-400 hover:text-white bg-base-300 hover:bg-base-200 rounded"><EditIcon className="h-3 w-3"/></button>
                                                                            <button onClick={() => deleteTimeEntry(e.id)} className="p-1.5 text-red-400 hover:text-white bg-red-900/20 hover:bg-red-600 rounded"><TrashIcon className="h-3 w-3"/></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {userEntries.length === 0 && (
                                                            <tr>
                                                                <td colSpan={5} className="py-4 text-center text-gray-500 italic">No entries recorded for this week.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <p className="text-gray-500 text-center py-8 italic">Select a user to view and edit their timesheet.</p>
                                )}
                             </div>
                         </>
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
                             <div className="space-y-4">
                                 {users.filter(u => u.role !== 'admin').map(user => {
                                     const config = userSalaries.find(s => s.userId === user.id) || { userId: user.id, baseSalary: 0, currency: '$' };
                                     return (
                                         <div key={user.id} className="bg-base-300/30 p-4 rounded-lg border border-white/5">
                                             <p className="text-white font-bold mb-2">{user.username}</p>
                                             <div className="flex gap-2">
                                                 <input 
                                                    type="number" 
                                                    value={config.baseSalary} 
                                                    onChange={e => handleUpdateSalaryConfig(user.id, 'baseSalary', parseFloat(e.target.value))}
                                                    className="w-24 bg-base-300 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                    placeholder="Salary"
                                                 />
                                                 <select 
                                                    value={config.currency}
                                                    onChange={e => handleUpdateSalaryConfig(user.id, 'currency', e.target.value)}
                                                    className="w-20 bg-base-300 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                                 >
                                                     {CURRENCIES.map(c => <option key={c.symbol} value={c.symbol}>{c.symbol}</option>)}
                                                 </select>
                                                 <span className="text-gray-500 text-sm flex items-center">/ month</span>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>

                         {/* Payroll Report */}
                         <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-white/10">
                             <div className="flex justify-between items-center mb-6">
                                 <h3 className="text-lg font-bold text-white">Monthly Payroll Report</h3>
                                 <input 
                                    type="month" 
                                    value={salaryMonth}
                                    onChange={e => setSalaryMonth(e.target.value)}
                                    className="bg-base-300/50 border border-gray-600 rounded-lg px-3 py-1 text-white"
                                 />
                             </div>
                             
                             <div className="overflow-x-auto">
                                 <table className="w-full text-left">
                                     <thead>
                                         <tr className="text-gray-400 text-xs uppercase font-bold border-b border-gray-700">
                                             <th className="p-3">User</th>
                                             <th className="p-3">Base Salary</th>
                                             <th className="p-3">LOP Days</th>
                                             <th className="p-3">Deduction</th>
                                             <th className="p-3 text-right">Net Salary</th>
                                         </tr>
                                     </thead>
                                     <tbody className="text-sm">
                                         {users.filter(u => u.role !== 'admin').map(user => {
                                             const payroll = calculatePayroll(user.id);
                                             if (!payroll) return null;
                                             return (
                                                 <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                                                     <td className="p-3 text-white font-medium">{user.username}</td>
                                                     <td className="p-3 text-gray-300">{payroll.currency}{payroll.base.toLocaleString()}</td>
                                                     <td className="p-3 text-red-300">{payroll.lopDays} days</td>
                                                     <td className="p-3 text-red-400">-{payroll.currency}{payroll.deduction.toFixed(2)}</td>
                                                     <td className="p-3 text-right font-bold text-green-400">{payroll.currency}{payroll.netSalary.toFixed(2)}</td>
                                                 </tr>
                                             );
                                         })}
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {/* --- TIME OFF TAB --- */}
            {activeTab === 'timeoff' && (
                <div className="animate-fadeIn space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         {/* Request Form */}
                         {currentUser?.role === 'user' && (
                             <div className="lg:col-span-1 glass-panel p-6 rounded-xl border border-white/10">
                                 <h3 className="text-lg font-bold text-white mb-4">Request Time Off</h3>
                                 <form onSubmit={handleBookLeave} className="space-y-4">
                                     <div>
                                         <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Type</label>
                                         <select 
                                            value={leaveForm.type}
                                            onChange={e => setLeaveForm({...leaveForm, type: e.target.value as LeaveType})}
                                            className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                                         >
                                             {Object.keys(adminSettings.leaveBalances).map(type => (
                                                 <option key={type} value={type}>{type} (Bal: {calculateBalance(currentUser.id, type as LeaveType)})</option>
                                             ))}
                                         </select>
                                     </div>
                                     <div className="grid grid-cols-2 gap-3">
                                         <div>
                                             <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Start</label>
                                             <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white" required />
                                         </div>
                                         <div>
                                             <label className="text-xs font-bold text-gray-400 uppercase block mb-1">End</label>
                                             <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white" required />
                                         </div>
                                     </div>
                                     <div>
                                         <label className="text-xs font-bold text-gray-400 uppercase block mb-1">Reason</label>
                                         <textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white" rows={3}></textarea>
                                     </div>
                                     <button type="submit" className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 rounded-lg">Submit Request</button>
                                 </form>
                             </div>
                         )}

                         {/* Leave History / Approvals */}
                         <div className={`${currentUser?.role === 'user' ? 'lg:col-span-2' : 'lg:col-span-3'} glass-panel p-6 rounded-xl border border-white/10`}>
                             <h3 className="text-lg font-bold text-white mb-4">{currentUser?.role === 'admin' ? 'Pending Requests' : 'My Requests'}</h3>
                             <div className="space-y-3">
                                 {leaveRequests.length === 0 && <p className="text-gray-500 italic">No leave records found.</p>}
                                 
                                 {leaveRequests.map(req => (
                                     <div key={req.id} className="bg-base-300/30 p-4 rounded-lg border border-white/5 flex justify-between items-center">
                                         <div>
                                             <p className="text-white font-bold">{currentUser?.role === 'admin' ? users.find(u => u.id === req.userId)?.username : req.type} <span className="text-xs font-normal text-gray-400">({req.startDate} to {req.endDate})</span></p>
                                             <p className="text-sm text-gray-300">{req.reason}</p>
                                         </div>
                                         <div className="flex items-center gap-3">
                                             {currentUser?.role === 'admin' && req.status === 'pending' ? (
                                                 <>
                                                     <button onClick={() => handleLeaveAction(req.id, 'approve')} className="text-green-400 hover:text-green-300 text-sm font-bold">Approve</button>
                                                     <button onClick={() => handleLeaveAction(req.id, 'reject')} className="text-red-400 hover:text-red-300 text-sm font-bold">Reject</button>
                                                 </>
                                             ) : (
                                                 getStatusBadge(req.status)
                                             )}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                    </div>
                </div>
            )}

            {/* --- ADMIN SETTINGS TAB --- */}
            {activeTab === 'admin' && currentUser?.role === 'admin' && (
                <div className="animate-fadeIn glass-panel p-6 rounded-xl border border-white/10 max-w-2xl mx-auto">
                    <h3 className="text-xl font-bold text-white mb-6">General Settings</h3>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Minimum Weekly Hours</label>
                            <input 
                                type="number" 
                                value={adminSettings.minWeeklyHours}
                                onChange={e => saveSettings({...adminSettings, minWeeklyHours: parseInt(e.target.value)})}
                                className="w-full bg-base-300 border border-gray-600 rounded px-3 py-2 text-white"
                            />
                        </div>
                        
                        <div className="border-t border-white/10 pt-4">
                            <h4 className="text-lg font-bold text-white mb-3">Leave Balances (Days/Year)</h4>
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(adminSettings.leaveBalances).map(([type, days]) => (
                                    <div key={type}>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{type}</label>
                                        <input 
                                            type="number" 
                                            value={days}
                                            onChange={e => {
                                                const newBalances = { ...adminSettings.leaveBalances, [type]: parseInt(e.target.value) };
                                                saveSettings({ ...adminSettings, leaveBalances: newBalances });
                                            }}
                                            className="w-full bg-base-300 border border-gray-600 rounded px-3 py-2 text-white"
                                            disabled={type === 'Unpaid'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                         {/* Project Management */}
                         <div className="border-t border-white/10 pt-6 mt-6">
                            <h4 className="text-lg font-bold text-white mb-3">Global Projects</h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                                {projects.filter(p => p.scope === 'global').map(p => (
                                    <div key={p.id} className="flex justify-between items-center bg-base-300/50 p-3 rounded border border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                                            <span className="text-white">{p.name}</span>
                                        </div>
                                        <button onClick={() => handleDeleteProject(p.id)} className="text-red-400 hover:text-red-300 p-1"><TrashIcon /></button>
                                    </div>
                                ))}
                                <button onClick={() => setIsProjectModalOpen(true)} className="w-full py-2 border-2 border-dashed border-gray-600 rounded text-gray-400 hover:text-white hover:border-gray-400 mt-2">
                                    + Add Global Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
