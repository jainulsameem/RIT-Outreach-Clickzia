
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

// Use local date string to avoid timezone shifts when working with YYYY-MM-DD inputs
const toLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, -1);
    return localISOTime.split('T')[0];
};

const formatDateISO = (date: Date) => toLocalISOString(date);

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
    
    // Manual Entry State
    const [isManualProjectInput, setIsManualProjectInput] = useState(false);
    const [manualProjectName, setManualProjectName] = useState('');
    const [manualProjectColor, setManualProjectColor] = useState('#6366f1');
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
            // Default to first non-admin user if possible, else first user
            const firstUser = users.find(u => u.role !== 'admin') || users[0];
            if (firstUser) setAdminSelectedUserId(firstUser.id);
        }
    }, [users, currentUser, adminSelectedUserId]);

    // --- Helpers for Database Updates ---

    const saveTimeEntry = async (entry: TimeEntry) => {
        // Optimistic update
        setEntries(prev => {
            const exists = prev.find(e => e.id === entry.id);
            if (exists) return prev.map(e => e.id === entry.id ? entry : e);
            return [entry, ...prev];
        });
        
        // IMPORTANT: Explicitly map userId to user_id column for row-level security/filtering to work
        const { error } = await supabase.from('time_entries').upsert({ 
            id: entry.id, 
            user_id: entry.userId, 
            data: entry 
        });

        if (error) {
            console.error("Error saving time entry:", error);
            alert("Failed to save entry to database. Please try again.");
            // Revert optimistic update could go here, but simple reload is safer
            fetchData();
        } else {
            // Re-fetch to ensure sync, especially if we created for another user
             if (entry.userId !== currentUser?.id) {
                 // Small delay to ensure DB write propagation
                 setTimeout(fetchData, 200); 
             }
        }
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

    const openEntryModal = (entry?: TimeEntry, targetUserId?: string) => {
        setIsManualProjectInput(false);
        setManualProjectName('');
        setManualProjectColor('#6366f1');
        
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
            // CRITICAL FIX: Ensure correct User ID is selected.
            // Priority: Passed targetUserId -> adminSelectedUserId -> currentUser.id
            const effectiveUserId = targetUserId || adminSelectedUserId || currentUser?.id || '';
            
            setManualEntryForm({
                id: '',
                userId: effectiveUserId,
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
        if (!currentUser) return;

        const { id, userId, date, startTime, endTime, projectId, taskName } = manualEntryForm;
        
        if (!date || !startTime || !userId) {
            alert("Please fill in all required fields.");
            return;
        }

        // Handle dynamic project creation
        let finalProjectId = projectId;
        if (isManualProjectInput && projectId !== 'break') {
            if (!manualProjectName.trim()) {
                alert("Please enter a name for the new project.");
                return;
            }
            
            const newProjId = `proj-${Date.now()}`;
            const newProj: Project = {
                id: newProjId,
                name: manualProjectName.trim(),
                color: manualProjectColor,
                scope: currentUser.role === 'admin' ? 'global' : 'personal',
                createdBy: currentUser.id
            };

            // Save the new project first
            setProjects(prev => [...prev, newProj]);
            await supabase.from('projects').upsert({ id: newProj.id, user_id: currentUser.id, data: newProj });
            
            finalProjectId = newProjId;
        } else if (!projectId && !isManualProjectInput) {
             alert("Please select a project.");
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

        const isBreak = finalProjectId === 'break';
        const entry: TimeEntry = {
            id: id || `manual-${Date.now()}`,
            userId: userId, // Explicitly set the target user ID
            projectId: finalProjectId,
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
    const [payrollStart, setPayrollStart] = useState<string>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    });
    const [payrollEnd, setPayrollEnd] = useState<string>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    const calculatePayroll = (userId: string) => {
        const userConfig = userSalaries.find(s => s.userId === userId);
        if (!userConfig) return null;

        const start = new Date(payrollStart);
        const end = new Date(payrollEnd);
        
        // Basic validation
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

        // +1 to include the end date
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
        
        // Daily rate based on the exact number of days in the selected period
        const dailyRate = userConfig.baseSalary / totalDays;

        let lopDays = 0;
        let missedDays = 0;

        // Iterate through every day in the range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = toLocalISOString(d);
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sun=0, Sat=6

            // 1. Check for Approved Leave
            const approvedLeave = leaveRequests.find(r => 
                r.userId === userId && 
                r.status === 'approved' && 
                r.startDate <= dateStr && 
                r.endDate >= dateStr
            );

            if (approvedLeave) {
                if (approvedLeave.type === 'Unpaid') {
                    lopDays++;
                }
                // If paid leave (Casual, Sick, etc.), day is accounted for.
                continue;
            }

            // 2. Check for Time Entries if not on leave and not weekend
            if (!isWeekend) {
                const hasWork = entries.some(e => 
                    e.userId === userId && 
                    e.type === 'work' && 
                    e.startTime.startsWith(dateStr)
                );
                
                if (!hasWork) {
                    missedDays++;
                }
            }
        }

        const totalDeductionDays = lopDays + missedDays;
        const deduction = dailyRate * totalDeductionDays;
        const netSalary = userConfig.baseSalary - deduction;

        return {
            base: userConfig.baseSalary,
            currency: userConfig.currency,
            lopDays,
            missedDays,
            deduction,
            netSalary,
            totalDays
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
            case 'approved': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold border border-green-200">Approved</span>;
            case 'rejected': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold border border-red-200">Rejected</span>;
            case 'submitted': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold border border-blue-200">Submitted</span>;
            default: return <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-bold border border-gray-200">Draft</span>;
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
        // Bright Theme Container Override
        <div className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8 rounded-3xl text-gray-800 font-sans transition-colors duration-300 relative">
             
             {/* Project Creation Modal */}
            {isProjectModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm transform transition-all scale-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Project</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Project Name</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="e.g. Mobile App Design"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Color Tag</label>
                                <div className="flex gap-3 flex-wrap">
                                    {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewProjectColor(color)}
                                            className={`w-8 h-8 rounded-full shadow-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${newProjectColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            {currentUser?.role === 'admin' && (
                                <p className="text-xs text-indigo-600 mt-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">* As Admin, this will be a Global Project visible to all users.</p>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium transition-colors">Cancel</button>
                            <button onClick={handleCreateProject} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">Create Project</button>
                        </div>
                    </div>
                </div>
            )}

             {/* Manual Entry Modal (Admin) */}
             {isEntryModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md transform transition-all">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">{manualEntryForm.id ? 'Edit Entry' : 'Add Manual Entry'}</h3>
                        <div className="space-y-5">
                             {/* User Selection for Admins */}
                             {currentUser?.role === 'admin' && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">User</label>
                                    <select
                                        value={manualEntryForm.userId}
                                        onChange={e => setManualEntryForm({...manualEntryForm, userId: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        {users.map(u => (
                                            <option key={u.id} value={u.id}>{u.username}</option>
                                        ))}
                                    </select>
                                </div>
                             )}

                             <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Project</label>
                                    <button 
                                        onClick={() => setIsManualProjectInput(!isManualProjectInput)}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline"
                                    >
                                        {isManualProjectInput ? 'Select Existing' : '+ Create New Project'}
                                    </button>
                                </div>
                                
                                {isManualProjectInput ? (
                                    <div className="space-y-3">
                                        <input 
                                            type="text"
                                            value={manualProjectName}
                                            onChange={e => setManualProjectName(e.target.value)}
                                            placeholder="Enter new project name..."
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        {/* Project Color Picker for Manual Entry */}
                                        <div className="flex gap-2 flex-wrap pt-1">
                                            {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'].map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setManualProjectColor(color)}
                                                    className={`w-6 h-6 rounded-full shadow-sm transition-transform hover:scale-110 ${manualProjectColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <select 
                                            value={manualEntryForm.projectId}
                                            onChange={e => setManualEntryForm({...manualEntryForm, projectId: e.target.value})}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 appearance-none focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="" disabled>Select Project</option>
                                            <option value="break">-- BREAK --</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {(manualEntryForm.projectId !== 'break' && !isManualProjectInput || isManualProjectInput) && (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Task</label>
                                    <input 
                                        type="text" 
                                        value={manualEntryForm.taskName}
                                        onChange={e => setManualEntryForm({...manualEntryForm, taskName: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Task description"
                                    />
                                </div>
                            )}
                             <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Date</label>
                                <input 
                                    type="date" 
                                    value={manualEntryForm.date}
                                    onChange={e => setManualEntryForm({...manualEntryForm, date: e.target.value})}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Start Time</label>
                                    <input 
                                        type="time" 
                                        value={manualEntryForm.startTime}
                                        onChange={e => setManualEntryForm({...manualEntryForm, startTime: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">End Time</label>
                                    <input 
                                        type="time" 
                                        value={manualEntryForm.endTime}
                                        onChange={e => setManualEntryForm({...manualEntryForm, endTime: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                             </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setIsEntryModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium transition-colors">Cancel</button>
                            <button onClick={handleSaveManualEntry} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">Save Entry</button>
                        </div>
                    </div>
                </div>
            )}


            {/* Top Navigation Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                         <ClockIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Manage your hours</p>
                    </div>
                </div>
                
                 <button onClick={fetchData} className="text-gray-400 hover:text-indigo-600 p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:border-indigo-100 transition-all" title="Refresh Data">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Tabs Navigation */}
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 inline-flex flex-wrap gap-1 mb-8 w-full md:w-auto overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('tracker')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${activeTab === 'tracker' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <ClockIcon className="mr-2 h-4 w-4" /> Tracker
                </button>
                <button onClick={() => setActiveTab('timesheet')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${activeTab === 'timesheet' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <CalendarCheckIcon className="mr-2 h-4 w-4" /> Timesheets
                </button>
                <button onClick={() => setActiveTab('timeoff')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${activeTab === 'timeoff' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <span className="mr-2">🏖️</span> Time Off
                </button>
                {currentUser?.role === 'admin' && (
                    <>
                        <button onClick={() => setActiveTab('payroll')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${activeTab === 'payroll' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                            <CurrencyIcon className="mr-2 h-4 w-4" /> Payroll
                        </button>
                        <button onClick={() => setActiveTab('admin')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                            <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                        </button>
                    </>
                )}
            </div>

            {/* --- TRACKER TAB --- */}
            {activeTab === 'tracker' && (
                <div className="animate-fadeIn space-y-6">
                    {/* Hero Timer Card */}
                    <div className="bg-white p-6 md:p-10 rounded-3xl border border-gray-200 shadow-xl flex flex-col xl:flex-row items-center justify-between gap-8 relative overflow-hidden">
                        {activeEntryId && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse"></div>}
                        
                        <div className="w-full xl:w-auto flex-grow space-y-4 relative z-10">
                            <h2 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">What are you working on?</h2>
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-grow relative">
                                    <input 
                                        type="text" 
                                        value={taskName}
                                        onChange={e => setTaskName(e.target.value)}
                                        placeholder="Type task description..."
                                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-900 text-lg font-medium focus:ring-0 focus:border-indigo-500 transition-all disabled:bg-gray-100 disabled:text-gray-400 outline-none"
                                        disabled={!!activeEntryId && activeEntryId.includes('break')}
                                    />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <div className="relative w-full md:w-64">
                                        <select 
                                            value={selectedProject}
                                            onChange={e => setSelectedProject(e.target.value)}
                                            className="w-full h-full bg-gray-50 border-2 border-gray-200 rounded-2xl px-5 py-4 text-gray-900 font-medium appearance-none focus:ring-0 focus:border-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
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
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsProjectModalOpen(true)}
                                        disabled={!!activeEntryId}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-2 border-indigo-100 rounded-2xl px-4 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Create New Project"
                                    >
                                        <PlusIcon className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 w-full xl:w-auto justify-center">
                            <div className="text-6xl md:text-7xl font-mono font-bold text-gray-900 tracking-tighter tabular-nums drop-shadow-sm">
                                {formatDuration(elapsedTime)}
                            </div>
                            {!activeEntryId ? (
                                <div className="flex gap-3">
                                    <button onClick={() => handleStartTimer(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-20 w-20 rounded-full shadow-xl shadow-indigo-200 transition-all transform active:scale-95 flex items-center justify-center group">
                                        <PlayIcon className="h-10 w-10 ml-1 group-hover:scale-110 transition-transform" />
                                    </button>
                                    <button onClick={() => handleStartTimer(true)} className="bg-amber-400 hover:bg-amber-500 text-white h-20 w-20 rounded-full shadow-xl shadow-amber-200 transition-all transform active:scale-95 flex items-center justify-center group" title="Start Break">
                                        <span className="text-3xl group-hover:scale-110 transition-transform">☕</span>
                                    </button>
                                </div>
                            ) : (
                                <button onClick={handleStopTimer} className="bg-red-500 hover:bg-red-600 text-white h-20 w-20 rounded-full shadow-xl shadow-red-200 transition-all transform active:scale-95 flex items-center justify-center animate-pulse">
                                    <StopIcon className="h-8 w-8" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* --- TODAY'S ACTIVITY LIST --- */}
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-800">Today's Activity</h3>
                                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                                    Total: {todayTotalHours.toFixed(2)} hrs
                                </span>
                            </div>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {todayEntries.length === 0 && <p className="text-gray-400 italic text-sm text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">No activity recorded today. Start tracking!</p>}
                                {todayEntries.map(entry => {
                                    const project = projects.find(p => p.id === entry.projectId);
                                    const start = new Date(entry.startTime);
                                    const end = entry.endTime ? new Date(entry.endTime) : null;
                                    const duration = (end ? end.getTime() : Date.now()) - start.getTime();
                                    const isActive = !entry.endTime;
                                    
                                    return (
                                        <div key={entry.id} className={`group flex items-center justify-between p-4 rounded-xl border transition-all hover:shadow-md ${isActive ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0 ${entry.type === 'break' ? 'bg-amber-400' : ''} ${isActive ? 'animate-pulse' : ''}`} style={{ backgroundColor: entry.type === 'work' ? project?.color : undefined }}>
                                                    {entry.type === 'break' ? '☕' : (project?.name.charAt(0) || 'P')}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-gray-900 font-bold truncate text-base group-hover:text-indigo-600 transition-colors">{entry.taskName}</p>
                                                    <p className="text-xs text-gray-500 truncate font-medium">
                                                        {project?.name || (entry.type === 'break' ? 'Break' : 'Unknown')} • {start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {end ? end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Now'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-gray-700 font-mono text-lg font-bold whitespace-nowrap ml-4 bg-gray-100 px-3 py-1 rounded-lg">
                                                {formatDuration(duration)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* --- CURRENT WEEK STATUS --- */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                            <h3 className="text-lg font-bold text-gray-800 mb-6">Weekly Summary</h3>
                            <div className="flex-grow flex flex-col justify-center space-y-6">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Worked</span>
                                        <span className="text-2xl font-bold text-gray-900">{currentWeekWorked.toFixed(2)}<span className="text-sm text-gray-400 font-normal">h</span></span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (currentWeekWorked / adminSettings.minWeeklyHours) * 100)}%` }}></div>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-gray-500 text-xs font-bold uppercase">Leave Credit</span>
                                        <span className="text-2xl font-bold text-amber-500">{currentWeekLeaves}<span className="text-sm text-gray-400 font-normal">h</span></span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                                     <div className="flex flex-col">
                                         <span className="text-gray-400 text-xs font-bold uppercase">Total Effective</span>
                                         <span className={`text-3xl font-bold ${currentWeekTotal >= adminSettings.minWeeklyHours ? 'text-green-500' : 'text-gray-900'}`}>
                                             {currentWeekTotal.toFixed(2)}<span className="text-base text-gray-400 font-normal">h</span>
                                         </span>
                                     </div>
                                     <div className="text-right">
                                         <p className="text-xs text-gray-400 font-bold uppercase">Target</p>
                                         <p className="text-sm font-medium text-gray-600">{adminSettings.minWeeklyHours}h / week</p>
                                     </div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => handleSubmitWeek(currentWeekStart)}
                                disabled={!!currentWeekSubmission}
                                className={`mt-8 w-full py-4 rounded-xl font-bold flex items-center justify-center transition-all shadow-lg ${currentWeekSubmission ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 transform active:scale-95'}`}
                            >
                                <CheckIcon className="mr-2 h-5 w-5" />
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
                        <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                                <h2 className="text-xl font-bold text-gray-900">Weekly Timesheet</h2>
                                <div className="flex items-center gap-4 bg-gray-50 p-1.5 rounded-xl border border-gray-100 shadow-inner">
                                    <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all"><ChevronLeftIcon /></button>
                                    <span className="font-mono text-sm font-bold text-indigo-600 px-2">
                                        {formatDateISO(viewWeekStart)}
                                    </span>
                                    <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all"><ChevronRightIcon /></button>
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
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 text-center">
                                                <p className="text-indigo-400 text-xs uppercase font-bold mb-2">Worked</p>
                                                <p className="text-3xl font-bold text-indigo-900">{workedHours.toFixed(2)}</p>
                                            </div>
                                             <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 text-center">
                                                <p className="text-amber-400 text-xs uppercase font-bold mb-2">Leave Credit</p>
                                                <p className="text-3xl font-bold text-amber-700">{leaveCredits}</p>
                                                <p className="text-[10px] text-amber-600/60 mt-1">Approved Paid Leave (8h/day)</p>
                                            </div>
                                            <div className={`p-6 rounded-2xl border text-center relative overflow-hidden ${meetsRequirement ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                                <p className="text-gray-400 text-xs uppercase font-bold mb-2 relative z-10">Total Effective</p>
                                                <p className={`text-3xl font-bold relative z-10 ${!meetsRequirement ? 'text-gray-700' : 'text-green-700'}`}>
                                                    {totalEffective.toFixed(2)}
                                                </p>
                                                <p className="text-[10px] text-gray-400 relative z-10 mt-1">Min: {adminSettings.minWeeklyHours}</p>
                                            </div>
                                            <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center flex flex-col items-center justify-center shadow-sm">
                                                <p className="text-gray-400 text-xs uppercase font-bold mb-2">Status</p>
                                                {getStatusBadge(submission?.status || 'draft')}
                                            </div>
                                        </div>

                                        {/* List Entries */}
                                        <div className="border-t border-gray-100 pt-6">
                                             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Logged Items</h3>
                                             <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                                                 <ul className="divide-y divide-gray-200">
                                                     {currentWeekEntries.map(e => (
                                                         <li key={e.id} className="flex justify-between text-sm p-4 hover:bg-white transition-colors">
                                                             <div>
                                                                 <span className="font-bold text-gray-800 block">{e.taskName}</span>
                                                                 <span className="text-gray-500 text-xs">{new Date(e.startTime).toLocaleDateString()}</span>
                                                             </div>
                                                             <span className="text-gray-700 font-mono font-bold bg-white px-2 py-1 rounded border border-gray-200 h-fit">{formatDuration(e.endTime ? new Date(e.endTime).getTime() - new Date(e.startTime).getTime() : 0)}</span>
                                                         </li>
                                                     ))}
                                                     {currentWeekEntries.length === 0 && <li className="text-gray-400 text-sm italic p-6 text-center">No entries logged for this week.</li>}
                                                 </ul>
                                             </div>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <button 
                                                onClick={() => handleSubmitWeek(viewWeekStart)}
                                                disabled={isSubmitted}
                                                className={`font-bold py-3 px-8 rounded-xl shadow-lg transition-all flex items-center transform active:scale-95 ${isSubmitted ? 'bg-gray-100 cursor-not-allowed text-gray-400 shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}
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
                             <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm mb-8">
                                 <h2 className="text-xl font-bold text-gray-900 mb-6">Pending Weekly Approvals</h2>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {weeklySubmissions.filter(s => s.status === 'submitted').length === 0 && <p className="text-gray-400 italic col-span-2 text-center py-8">No pending submissions.</p>}
                                     
                                     {weeklySubmissions.filter(s => s.status === 'submitted').map(sub => {
                                         const user = users.find(u => u.id === sub.userId);
                                         return (
                                             <div key={sub.id} className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                                                 <div>
                                                     <p className="text-gray-900 font-bold text-lg">{user?.username}</p>
                                                     <p className="text-sm text-indigo-600 font-medium">Week of {sub.weekStartDate}</p>
                                                     <p className="text-xs text-gray-500 mt-1">Total Hours: {sub.totalHours.toFixed(2)}</p>
                                                 </div>
                                                 <div className="flex gap-2 w-full sm:w-auto">
                                                     <button onClick={() => handleReviewWeek(sub.id, 'approve')} className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 px-4 py-2 rounded-xl font-bold transition-all flex items-center justify-center text-sm">
                                                         <CheckIcon className="mr-1 h-4 w-4" /> Approve
                                                     </button>
                                                     <button onClick={() => handleReviewWeek(sub.id, 'reject')} className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 px-4 py-2 rounded-xl font-bold transition-all flex items-center justify-center text-sm">
                                                         <CancelIcon className="mr-1 h-4 w-4" /> Reject
                                                     </button>
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>

                             {/* Manage User Timesheets Section */}
                             <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                    <h2 className="text-xl font-bold text-gray-900">Manage User Timesheets</h2>
                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                                        <select 
                                            value={adminSelectedUserId} 
                                            onChange={e => setAdminSelectedUserId(e.target.value)}
                                            className="w-full sm:w-auto bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="" disabled>Select User</option>
                                            {users.filter(u => u.role !== 'admin').map(u => (
                                                <option key={u.id} value={u.id}>{u.username}</option>
                                            ))}
                                        </select>

                                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100 w-full sm:w-auto justify-between sm:justify-start">
                                            <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all"><ChevronLeftIcon /></button>
                                            <span className="font-mono text-sm font-bold text-indigo-600 px-2">
                                                {formatDateISO(viewWeekStart)}
                                            </span>
                                            <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-gray-500 transition-all"><ChevronRightIcon /></button>
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
                                        <div className="space-y-8">
                                            {/* Weekly Stats Summary */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                                                    <span className="text-gray-500 text-xs font-bold uppercase">Worked</span>
                                                    <span className="text-gray-900 font-bold text-xl">{workedHours.toFixed(2)}h</span>
                                                </div>
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                                                    <span className="text-gray-500 text-xs font-bold uppercase">Leave</span>
                                                    <span className="text-gray-900 font-bold text-xl">{leaveCredits}h</span>
                                                </div>
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                                                    <span className="text-gray-500 text-xs font-bold uppercase">Status</span>
                                                    <span>{getStatusBadge(submission?.status || 'draft')}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                 <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Logged Entries</h3>
                                                 <button 
                                                    onClick={() => openEntryModal(undefined, adminSelectedUserId)}
                                                    className="text-xs font-bold bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-xl flex items-center transition-colors"
                                                 >
                                                     <PlusIcon className="h-3 w-3 mr-1" /> Add Manual Entry
                                                 </button>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-gray-200">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-gray-50">
                                                        <tr className="text-gray-500 border-b border-gray-200">
                                                            <th className="p-4 font-medium text-xs uppercase tracking-wider">Date</th>
                                                            <th className="p-4 font-medium text-xs uppercase tracking-wider">Task / Project</th>
                                                            <th className="p-4 font-medium text-xs uppercase tracking-wider">Time</th>
                                                            <th className="p-4 font-medium text-xs uppercase tracking-wider">Duration</th>
                                                            <th className="p-4 font-medium text-xs uppercase tracking-wider text-right">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 bg-white">
                                                        {userEntries.map(e => {
                                                            const duration = e.endTime ? new Date(e.endTime).getTime() - new Date(e.startTime).getTime() : 0;
                                                            const projName = projects.find(p => p.id === e.projectId)?.name || (e.type === 'break' ? 'Break' : 'Unknown');
                                                            return (
                                                                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                                                                    <td className="p-4 text-gray-600 whitespace-nowrap">{new Date(e.startTime).toLocaleDateString()}</td>
                                                                    <td className="p-4">
                                                                        <div className="text-gray-900 font-medium">{e.taskName}</div>
                                                                        <div className="text-xs text-gray-500">{projName}</div>
                                                                    </td>
                                                                    <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                                                                        {new Date(e.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
                                                                        {e.endTime ? new Date(e.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}
                                                                    </td>
                                                                    <td className="p-4 font-mono text-gray-700 font-bold">{formatDuration(duration)}</td>
                                                                    <td className="p-4 text-right">
                                                                        <div className="flex justify-end gap-2">
                                                                            <button onClick={() => openEntryModal(e, adminSelectedUserId)} className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 rounded-lg transition-colors"><EditIcon className="h-4 w-4"/></button>
                                                                            <button onClick={() => deleteTimeEntry(e.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="h-4 w-4"/></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {userEntries.length === 0 && (
                                                            <tr>
                                                                <td colSpan={5} className="p-8 text-center text-gray-400 italic bg-gray-50">No entries recorded for this week.</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <div className="bg-gray-50 rounded-2xl p-10 text-center border border-dashed border-gray-200">
                                        <p className="text-gray-500 italic">Select a user above to view and edit their timesheet.</p>
                                    </div>
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
                         <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                             <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center"><SettingsIcon className="mr-2 h-5 w-5 text-indigo-600"/> Salary Configuration</h3>
                             <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                 {users.filter(u => u.role !== 'admin').map(user => {
                                     const config = userSalaries.find(s => s.userId === user.id) || { userId: user.id, baseSalary: 0, currency: '$' };
                                     return (
                                         <div key={user.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-indigo-100 transition-colors">
                                             <p className="text-gray-800 font-bold mb-3">{user.username}</p>
                                             <div className="flex gap-2 items-center">
                                                 <input 
                                                    type="number" 
                                                    value={config.baseSalary} 
                                                    onChange={e => handleUpdateSalaryConfig(user.id, 'baseSalary', parseFloat(e.target.value))}
                                                    className="flex-grow bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    placeholder="Salary"
                                                 />
                                                 <select 
                                                    value={config.currency}
                                                    onChange={e => handleUpdateSalaryConfig(user.id, 'currency', e.target.value)}
                                                    className="w-24 bg-white border border-gray-200 rounded-lg px-2 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                 >
                                                     {CURRENCIES.map(c => <option key={c.symbol} value={c.symbol}>{c.symbol}</option>)}
                                                 </select>
                                                 <span className="text-gray-400 text-xs whitespace-nowrap">/ mo</span>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                         </div>

                         {/* Payroll Report */}
                         <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm">
                             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                 <h3 className="text-lg font-bold text-gray-900">Payroll Report</h3>
                                 <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-gray-400 uppercase font-bold px-1">Start</label>
                                        <input 
                                            type="date" 
                                            value={payrollStart}
                                            onChange={e => setPayrollStart(e.target.value)}
                                            className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    <span className="text-gray-300 mt-4">-</span>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-gray-400 uppercase font-bold px-1">End</label>
                                        <input 
                                            type="date" 
                                            value={payrollEnd}
                                            onChange={e => setPayrollEnd(e.target.value)}
                                            className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-900 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                 </div>
                             </div>
                             
                             <div className="overflow-x-auto rounded-xl border border-gray-200">
                                 <table className="w-full text-left">
                                     <thead className="bg-gray-50">
                                         <tr className="text-gray-500 text-xs uppercase font-bold border-b border-gray-200">
                                             <th className="p-4">User</th>
                                             <th className="p-4">Base Salary</th>
                                             <th className="p-4 text-center">Missed Days</th>
                                             <th className="p-4 text-center">LOP Days</th>
                                             <th className="p-4">Deduction</th>
                                             <th className="p-4 text-right">Net Salary</th>
                                         </tr>
                                     </thead>
                                     <tbody className="text-sm bg-white divide-y divide-gray-100">
                                         {users.filter(u => u.role !== 'admin').map(user => {
                                             const payroll = calculatePayroll(user.id);
                                             if (!payroll) return (
                                                 <tr key={user.id}>
                                                     <td colSpan={6} className="p-4 text-gray-400 text-center italic">Invalid date range or config missing</td>
                                                 </tr>
                                             );
                                             return (
                                                 <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                     <td className="p-4 text-gray-900 font-medium">
                                                         {user.username}
                                                         <span className="block text-[10px] text-gray-400 font-normal">Period: {payroll.totalDays} days</span>
                                                     </td>
                                                     <td className="p-4 text-gray-600">{payroll.currency}{payroll.base.toLocaleString()}</td>
                                                     <td className="p-4 text-center">
                                                         {payroll.missedDays > 0 ? <span className="text-amber-500 font-bold bg-amber-50 px-2 py-1 rounded-md">{payroll.missedDays}</span> : <span className="text-gray-300">-</span>}
                                                     </td>
                                                     <td className="p-4 text-center">
                                                         {payroll.lopDays > 0 ? <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded-md">{payroll.lopDays}</span> : <span className="text-gray-300">-</span>}
                                                     </td>
                                                     <td className="p-4 text-red-500">
                                                         {payroll.deduction > 0 ? `-${payroll.currency}${payroll.deduction.toFixed(2)}` : '-'}
                                                     </td>
                                                     <td className="p-4 text-right font-bold text-green-600 text-base">{payroll.currency}{payroll.netSalary.toFixed(2)}</td>
                                                 </tr>
                                             );
                                         })}
                                     </tbody>
                                 </table>
                             </div>
                             <p className="text-xs text-gray-400 mt-4 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-2">
                                 <span className="text-blue-500 font-bold">ℹ️</span> 
                                 Missed Days are weekdays with no logged time and no approved leave. LOP are Approved 'Unpaid' leave days.
                             </p>
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
                             <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                                 <h3 className="text-lg font-bold text-gray-900 mb-6">Request Time Off</h3>
                                 <form onSubmit={handleBookLeave} className="space-y-5">
                                     <div>
                                         <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Type</label>
                                         <select 
                                            value={leaveForm.type}
                                            onChange={e => setLeaveForm({...leaveForm, type: e.target.value as LeaveType})}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                         >
                                             {Object.keys(adminSettings.leaveBalances).map(type => (
                                                 <option key={type} value={type}>{type} (Bal: {calculateBalance(currentUser.id, type as LeaveType)})</option>
                                             ))}
                                         </select>
                                     </div>
                                     <div className="grid grid-cols-2 gap-4">
                                         <div>
                                             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Start</label>
                                             <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                         </div>
                                         <div>
                                             <label className="text-xs font-bold text-gray-500 uppercase block mb-1">End</label>
                                             <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                         </div>
                                     </div>
                                     <div>
                                         <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Reason</label>
                                         <textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} placeholder="Why are you requesting off?"></textarea>
                                     </div>
                                     <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">Submit Request</button>
                                 </form>
                             </div>
                         )}

                         {/* Leave History / Approvals */}
                         <div className={`${currentUser?.role === 'user' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white p-6 rounded-3xl border border-gray-200 shadow-sm`}>
                             <h3 className="text-lg font-bold text-gray-900 mb-6">{currentUser?.role === 'admin' ? 'Pending Requests' : 'My Requests'}</h3>
                             <div className="space-y-4">
                                 {leaveRequests.length === 0 && <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400 italic">No leave records found.</div>}
                                 
                                 {leaveRequests.map(req => (
                                     <div key={req.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md">
                                         <div>
                                             <p className="text-gray-900 font-bold text-lg">{currentUser?.role === 'admin' ? users.find(u => u.id === req.userId)?.username : req.type} <span className="text-sm font-normal text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 ml-2">{req.startDate} to {req.endDate}</span></p>
                                             <p className="text-sm text-gray-600 mt-1 italic">"{req.reason}"</p>
                                         </div>
                                         <div className="flex items-center gap-3 w-full sm:w-auto">
                                             {currentUser?.role === 'admin' && req.status === 'pending' ? (
                                                 <>
                                                     <button onClick={() => handleLeaveAction(req.id, 'approve')} className="flex-1 sm:flex-none bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors">Approve</button>
                                                     <button onClick={() => handleLeaveAction(req.id, 'reject')} className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors">Reject</button>
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
                <div className="animate-fadeIn bg-white p-8 rounded-3xl border border-gray-200 shadow-sm max-w-3xl mx-auto">
                    <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center"><SettingsIcon className="mr-3 h-6 w-6 text-indigo-600"/> Admin Configuration</h3>
                    <div className="space-y-8">
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Minimum Weekly Hours</label>
                            <p className="text-xs text-gray-500 mb-3">Users cannot submit timesheets below this threshold.</p>
                            <input 
                                type="number" 
                                value={adminSettings.minWeeklyHours}
                                onChange={e => saveSettings({...adminSettings, minWeeklyHours: parseInt(e.target.value)})}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        
                        <div className="pt-2">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Leave Balances (Days/Year)</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {Object.entries(adminSettings.leaveBalances).map(([type, days]) => (
                                    <div key={type} className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{type}</label>
                                        <input 
                                            type="number" 
                                            value={days}
                                            onChange={e => {
                                                const newBalances = { ...adminSettings.leaveBalances, [type]: parseInt(e.target.value) };
                                                saveSettings({ ...adminSettings, leaveBalances: newBalances });
                                            }}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                            disabled={type === 'Unpaid'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                         {/* Project Management */}
                         <div className="border-t border-gray-100 pt-8 mt-4">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Global Projects</h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                {projects.filter(p => p.scope === 'global').map(p => (
                                    <div key={p.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: p.color }}></div>
                                            <span className="text-gray-900 font-medium">{p.name}</span>
                                        </div>
                                        <button onClick={() => handleDeleteProject(p.id)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                ))}
                                {projects.filter(p => p.scope === 'global').length === 0 && <p className="text-center text-gray-400 text-sm py-2">No global projects defined.</p>}
                                
                                <button onClick={() => setIsProjectModalOpen(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 mt-4 font-bold transition-all">
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
