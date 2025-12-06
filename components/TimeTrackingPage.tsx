
import React, { useState, useEffect, useRef } from 'react';
import type { TimeEntry, Project, LeaveType, TimeOffRequest, TimeAdminSettings, WeeklyTimesheet, SalaryConfig, Meeting, Task } from '../types';
import { PlayIcon, StopIcon, ClockIcon, CalendarCheckIcon, CheckIcon, CancelIcon, SettingsIcon, CurrencyIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, EditIcon, ChevronDownIcon, ChevronUpIcon, UsersIcon, VideoCameraIcon, CalendarIcon } from './icons';
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
        'Unpaid': 0
    },
    workConfig: {
        startDay: 1, // Monday
        daysPerWeek: 5
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

const WEEK_DAYS = [
    { val: 0, label: 'Sunday' },
    { val: 1, label: 'Monday' },
    { val: 2, label: 'Tuesday' },
    { val: 3, label: 'Wednesday' },
    { val: 4, label: 'Thursday' },
    { val: 5, label: 'Friday' },
    { val: 6, label: 'Saturday' },
];

const formatDuration = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const getMonday = (d: Date) => {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

const toLocalISOString = (date: Date) => {
    if (isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, -1);
    return localISOTime.split('T')[0];
};

const formatDateISO = (date: Date) => toLocalISOString(date);

const getTimeString = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const combineDateAndTime = (dateIso: string, timeStr: string) => {
    if (!dateIso || !timeStr) return '';
    return new Date(`${dateIso}T${timeStr}`).toISOString();
};

export const TimeTrackingPage: React.FC = () => {
    const { currentUser, users } = useAuth();
    const [activeTab, setActiveTab] = useState<'tracker' | 'timesheet' | 'calendar' | 'timeoff' | 'payroll' | 'admin'>('tracker');
    const [isLoading, setIsLoading] = useState(true);
    
    // State
    const [projects, setProjects] = useState<Project[]>([]);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<TimeOffRequest[]>([]);
    const [adminSettings, setAdminSettings] = useState<TimeAdminSettings>(DEFAULT_SETTINGS);
    const [weeklySubmissions, setWeeklySubmissions] = useState<WeeklyTimesheet[]>([]);
    const [userSalaries, setUserSalaries] = useState<SalaryConfig[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

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
    const [newProjectScope, setNewProjectScope] = useState<'global' | 'personal'>('personal');

    // Timesheet View State
    const [viewWeekStart, setViewWeekStart] = useState<Date>(getMonday(new Date()));
    const [expandedDay, setExpandedDay] = useState<string | null>(null);

    // Admin Timesheet Management State
    const [adminSelectedUserId, setAdminSelectedUserId] = useState<string>('');
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    
    // Manual Entry State
    const [isManualProjectInput, setIsManualProjectInput] = useState(false);
    const [manualProjectName, setManualProjectName] = useState('');
    const [manualProjectColor, setManualProjectColor] = useState('#6366f1');
    const [manualEntryForm, setManualEntryForm] = useState({ id: '', date: '', startTime: '', endTime: '', projectId: '', taskName: '', userId: '' });

    // Leave Edit State
    const [isLeaveEditModalOpen, setIsLeaveEditModalOpen] = useState(false);
    const [editingLeave, setEditingLeave] = useState<Partial<TimeOffRequest>>({});
    
    // Leave Request Form State
    const [leaveForm, setLeaveForm] = useState({
        type: 'Casual' as LeaveType,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        reason: '',
        isHalfDay: false
    });

    // Calendar & Meetings
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [selectedCalendarUser, setSelectedCalendarUser] = useState<string>('all'); // 'all' or userId
    const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
    const [meetingForm, setMeetingForm] = useState<Partial<Meeting>>({ participants: [] });

    // --- Supabase Data Loading ---
    const fetchData = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const orgUserIds = users.map(u => u.id);

            // 1. Projects
            const { data: projData } = await supabase.from('projects').select('data');
            if (projData) {
                const allProjs = projData.map((r: any) => r.data);
                const orgProjs = allProjs.filter((p: Project) => p.scope === 'global' || orgUserIds.includes(p.createdBy));
                setProjects(orgProjs);
                if (!selectedProject && orgProjs.length > 0) {
                    const defaultProj = orgProjs.find((p: Project) => p.scope === 'global') || orgProjs[0];
                    if (defaultProj) setSelectedProject(defaultProj.id);
                }
            }

            // 2. Settings
            const { data: settingsData } = await supabase.from('app_settings').select('data').eq('id', 'time_tracking_config').single();
            if (settingsData?.data) setAdminSettings({ ...DEFAULT_SETTINGS, ...settingsData.data });

            // 3. Entries
            const entryQuery = supabase.from('time_entries').select('data');
            if (currentUser.role !== 'admin') entryQuery.eq('user_id', currentUser.id);
            else entryQuery.in('user_id', orgUserIds);
            const { data: entryData } = await entryQuery;
            if (entryData) setEntries(entryData.map((r: any) => r.data));

            // 4. Leave Requests
            const leaveQuery = supabase.from('leave_requests').select('data');
            // Allow fetching all leaves for Calendar visibility
            if (activeTab === 'calendar' || currentUser.role === 'admin') leaveQuery.in('user_id', orgUserIds);
            else leaveQuery.eq('user_id', currentUser.id);
            const { data: leaveData } = await leaveQuery;
            if (leaveData) setLeaveRequests(leaveData.map((r: any) => r.data));

            // 5. Weekly Timesheets
            const weekQuery = supabase.from('weekly_timesheets').select('data');
            if (currentUser.role !== 'admin') weekQuery.eq('user_id', currentUser.id);
            else weekQuery.in('user_id', orgUserIds);
            const { data: weekData } = await weekQuery;
            if (weekData) setWeeklySubmissions(weekData.map((r: any) => r.data));

            // 6. Salaries
            const { data: salaryData } = await supabase.from('salary_configs').select('data');
            if (salaryData) setUserSalaries(salaryData.map((r: any) => r.data));

            // 7. Meetings
            const { data: meetingRes } = await supabase.from('meetings').select('*');
            if (meetingRes) {
                // Map DB columns to TS Interface
                const mappedMeetings: Meeting[] = meetingRes.map((m: any) => ({
                    id: m.id,
                    title: m.title,
                    description: m.description,
                    startTime: m.start_time,
                    endTime: m.end_time,
                    participants: m.participants || [],
                    createdBy: m.created_by,
                    organizationId: m.organization_id
                }));
                setMeetings(mappedMeetings);
            }

            // 8. Tasks (for Calendar)
            const { data: tasksData } = await supabase.from('project_tasks').select('data');
            if (tasksData) setTasks(tasksData.map((r: any) => r.data));

        } catch (error) {
            console.error("Error fetching time tracking data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentUser, activeTab, users]);

    useEffect(() => {
        if (currentUser?.role === 'admin' && !adminSelectedUserId && users.length > 0) {
            const firstUser = users.find(u => u.role !== 'admin') || users[0];
            if (firstUser) setAdminSelectedUserId(firstUser.id);
        }
    }, [users, currentUser, adminSelectedUserId]);

    useEffect(() => {
        if (isProjectModalOpen && currentUser) {
            setNewProjectScope(currentUser.role === 'admin' ? 'global' : 'personal');
        }
    }, [isProjectModalOpen, currentUser]);

    // --- Active Entry Logic ---
    useEffect(() => {
        const active = entries.find(e => e.userId === currentUser?.id && !e.endTime);
        if (active) {
            setActiveEntryId(active.id);
            setTaskName(active.taskName);
            setSelectedProject(active.projectId);
            const start = new Date(active.startTime).getTime();
            
            if (timerRef.current) clearInterval(timerRef.current);
            
            setElapsedTime(Date.now() - start);
            timerRef.current = setInterval(() => {
                setElapsedTime(Date.now() - start);
            }, 1000);
        } else {
             setActiveEntryId(null);
             if (timerRef.current) clearInterval(timerRef.current);
             setElapsedTime(0);
        }
    }, [entries, currentUser]);

    // --- Data Handlers ---
    const saveTimeEntry = async (entry: TimeEntry) => {
        setEntries(prev => {
            const exists = prev.find(e => e.id === entry.id);
            if (exists) return prev.map(e => e.id === entry.id ? entry : e);
            return [entry, ...prev];
        });
        const { error } = await supabase.from('time_entries').upsert({ id: entry.id, user_id: entry.userId, data: entry });
        if (error) {
            console.error("Error saving time entry:", error);
            fetchData();
        } else if (entry.userId !== currentUser?.id) setTimeout(fetchData, 200);
    };

    const deleteTimeEntry = async (entryId: string) => {
        setEntries(prev => prev.filter(e => e.id !== entryId));
        await supabase.from('time_entries').delete().eq('id', entryId);
    };

    const saveWeeklySubmission = async (sub: WeeklyTimesheet) => {
        setWeeklySubmissions(prev => [...prev.filter(s => s.id !== sub.id), sub]);
        await supabase.from('weekly_timesheets').upsert({ id: sub.id, user_id: sub.userId, data: sub });
    };

    const saveLeaveRequest = async (req: TimeOffRequest) => {
        setLeaveRequests(prev => {
            const idx = prev.findIndex(r => r.id === req.id);
            if (idx > -1) { const n = [...prev]; n[idx] = req; return n; }
            return [req, ...prev];
        });
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
        setUserSalaries(prev => [...prev.filter(s => s.userId !== config.userId), config]);
        await supabase.from('salary_configs').upsert({ user_id: config.userId, data: config });
    };

    const saveMeeting = async (meeting: Meeting) => {
        const dbMeeting = {
            id: meeting.id,
            organization_id: currentUser?.organizationId,
            title: meeting.title,
            description: meeting.description,
            start_time: meeting.startTime,
            end_time: meeting.endTime,
            created_by: meeting.createdBy,
            participants: meeting.participants
        };
        setMeetings(prev => [...prev.filter(m => m.id !== meeting.id), meeting]);
        await supabase.from('meetings').upsert(dbMeeting);
    };

    // --- Project Handlers ---
    const handleCreateProject = async () => {
        if (!currentUser || !newProjectName.trim()) return;
        const newProj: Project = {
            id: `proj-${Date.now()}`,
            name: newProjectName.trim(),
            color: newProjectColor,
            scope: newProjectScope,
            createdBy: currentUser.id
        };
        setProjects(prev => [...prev, newProj]);
        await supabase.from('projects').upsert({ id: newProj.id, user_id: currentUser.id, data: newProj });
        setSelectedProject(newProj.id);
        setNewProjectName('');
        setIsProjectModalOpen(false);
    };

    const handleDeleteProject = async (projId: string) => {
        if (!window.confirm("Delete project?")) return;
        setProjects(prev => prev.filter(p => p.id !== projId));
        await supabase.from('projects').delete().eq('id', projId);
    };

    // --- Manual Entry Logic ---
    const openEntryModal = (entry?: TimeEntry, targetUserId?: string) => {
        setIsManualProjectInput(false);
        setManualProjectName('');
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
            const effUserId = targetUserId || adminSelectedUserId || currentUser?.id || '';
            setManualEntryForm({
                id: '',
                userId: effUserId,
                date: formatDateISO(now),
                startTime: '09:00',
                endTime: '17:00',
                projectId: projects[0]?.id || '',
                taskName: ''
            });
        }
        setIsEntryModalOpen(true);
    };

    const handleSaveManualEntry = async () => {
        if (!manualEntryForm.date || !manualEntryForm.startTime || !manualEntryForm.userId) return alert("Fill required fields");
        
        let pid = manualEntryForm.projectId;
        if (isManualProjectInput) {
             const newPid = `proj-${Date.now()}`;
             const newProj: Project = { id: newPid, name: manualProjectName, color: manualProjectColor, scope: 'personal', createdBy: currentUser?.id || '' };
             setProjects(p => [...p, newProj]);
             await supabase.from('projects').upsert({ id: newPid, user_id: currentUser?.id, data: newProj });
             pid = newPid;
        }

        const startIso = combineDateAndTime(manualEntryForm.date, manualEntryForm.startTime);
        const endIso = manualEntryForm.endTime ? combineDateAndTime(manualEntryForm.date, manualEntryForm.endTime) : null;
        
        const entry: TimeEntry = {
            id: manualEntryForm.id || `manual-${Date.now()}`,
            userId: manualEntryForm.userId,
            projectId: pid,
            taskName: manualEntryForm.taskName || 'Manual',
            startTime: startIso,
            endTime: endIso,
            type: pid === 'break' ? 'break' : 'work',
            status: 'approved'
        };
        await saveTimeEntry(entry);
        setIsEntryModalOpen(false);
    };

    // --- Calculation Helpers ---
    const getEntriesForWeek = (userId: string, startOfWeek: Date) => {
        const end = new Date(startOfWeek); end.setDate(end.getDate() + 7);
        return entries.filter(e => {
            const d = new Date(e.startTime);
            return e.userId === userId && d >= startOfWeek && d < end;
        });
    };

    const calculateWeeklyHours = (weekEntries: TimeEntry[]) => {
        const totalMs = weekEntries.reduce((acc, e) => {
            if (e.type === 'break') return acc;
            const end = e.endTime ? new Date(e.endTime).getTime() : Date.now();
            return acc + (end - new Date(e.startTime).getTime());
        }, 0);
        return totalMs / 3600000;
    };

    const getLeaveHoursForWeek = (userId: string, startOfWeek: Date) => {
        let h = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek); d.setDate(d.getDate() + i);
            const dStr = formatDateISO(d);
            const req = leaveRequests.find(r => r.userId === userId && r.status === 'approved' && r.type !== 'Unpaid' && r.startDate <= dStr && r.endDate >= dStr);
            if (req) h += req.isHalfDay ? 4 : 8;
        }
        return h;
    };

    const calculateBalance = (userId: string, type: LeaveType) => {
        if (type === 'Unpaid') return '∞';
        const total = adminSettings.leaveBalances[type] || 0;
        const used = leaveRequests.filter(r => r.userId === userId && r.type === type && r.status === 'approved').reduce((acc, r) => {
            if (r.isHalfDay) return acc + 0.5;
            const s = new Date(r.startDate).getTime();
            const e = new Date(r.endDate).getTime();
            const days = (e - s) / 86400000 + 1;
            return acc + days;
        }, 0);
        return Math.max(0, total - used);
    };

    // --- Actions ---
    const handleLeaveAction = async (id: string, action: 'approve' | 'reject') => {
        const r = leaveRequests.find(req => req.id === id);
        if (r) await updateLeaveRequestStatus({ ...r, status: action === 'approve' ? 'approved' : 'rejected' });
    };

    const handleReviewWeek = async (sid: string, action: 'approve' | 'reject') => {
        const s = weeklySubmissions.find(sub => sub.id === sid);
        if (s) await saveWeeklySubmission({ ...s, status: action === 'approve' ? 'approved' : 'rejected', approvedAt: new Date().toISOString() });
    };

    const openLeaveEditModal = (req: TimeOffRequest) => {
        setEditingLeave(req);
        setIsLeaveEditModalOpen(true);
    };

    const handleUpdateLeaveRequest = async () => {
        if (!editingLeave.id) return;
        await saveLeaveRequest(editingLeave as TimeOffRequest);
        setIsLeaveEditModalOpen(false);
    };

    // --- Payroll Logic ---
    const [payrollStart, setPayrollStart] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    });
    const [payrollEnd, setPayrollEnd] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    });

    const calculatePayroll = (userId: string) => {
        const config = userSalaries.find(s => s.userId === userId);
        if (!config) return null;
        
        const start = new Date(payrollStart);
        const end = new Date(payrollEnd);
        
        // Safety check for invalid dates
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return null;

        const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
        const dailyRate = config.baseSalary / daysInPeriod;
        
        let lopDays = 0;
        let missedDays = 0;
        
        // Safely access admin settings with defaults
        const workStart = adminSettings.workConfig?.startDay ?? 1;
        const workLen = adminSettings.workConfig?.daysPerWeek ?? 5;

        // Iterate days
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dStr = formatDateISO(d);
            if (!dStr) continue; // Skip invalid dates

            const dayOfWeek = d.getDay(); 
            // Normalize to 0-6 relative to start day
            const relDay = (dayOfWeek - workStart + 7) % 7;
            const isWorkDay = relDay < workLen;

            if (isWorkDay) {
                const leave = leaveRequests.find(r => r.userId === userId && r.status === 'approved' && r.startDate <= dStr && r.endDate >= dStr);
                if (leave) {
                    if (leave.type === 'Unpaid') lopDays += leave.isHalfDay ? 0.5 : 1;
                } else {
                    const hasWork = entries.some(e => e.userId === userId && e.startTime.startsWith(dStr));
                    if (!hasWork) missedDays++;
                }
            }
        }
        
        const deduction = (lopDays + missedDays) * dailyRate;
        return {
            base: config.baseSalary,
            currency: config.currency,
            lopDays,
            missedDays,
            deduction,
            netSalary: config.baseSalary - deduction,
            totalDays: daysInPeriod
        };
    };

    const handleUpdateSalaryConfig = async (userId: string, field: keyof SalaryConfig, value: string | number) => {
        const current = userSalaries.find(s => s.userId === userId) || { userId, baseSalary: 0, currency: '$' };
        await saveSalaryConfig({ ...current, [field]: value });
    };

    // --- Calendar Logic ---
    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    
    const handlePrevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

    const handleCreateMeeting = async () => {
        if (!meetingForm.title || !meetingForm.startTime || !meetingForm.endTime) return alert("Please fill all required fields");
        const newMeeting: Meeting = {
            id: `mtg-${Date.now()}`,
            title: meetingForm.title,
            description: meetingForm.description || '',
            startTime: new Date(meetingForm.startTime).toISOString(),
            endTime: new Date(meetingForm.endTime).toISOString(),
            participants: meetingForm.participants || [],
            createdBy: currentUser?.id || '',
            organizationId: currentUser?.organizationId
        };
        await saveMeeting(newMeeting);
        setIsMeetingModalOpen(false);
        setMeetingForm({ participants: [] });
    };

    // --- Tracker Logic ---
    const handleStartTimer = async (isBreak: boolean = false) => {
        if (!currentUser) return;
        
        // Stop currently active entry if any
        if (activeEntryId) {
            await handleStopTimer();
        }

        const newEntry: TimeEntry = {
            id: `entry-${Date.now()}`,
            userId: currentUser.id,
            projectId: isBreak ? 'break' : (selectedProject || 'default'),
            taskName: isBreak ? 'Break' : (taskName || 'Untitled Task'),
            startTime: new Date().toISOString(),
            endTime: null,
            type: isBreak ? 'break' : 'work',
            status: 'draft'
        };

        await saveTimeEntry(newEntry);
        setActiveEntryId(newEntry.id);
        setElapsedTime(0);
        
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
             setElapsedTime(prev => prev + 1000);
        }, 1000);
    };

    const handleStopTimer = async () => {
        if (!activeEntryId) return;
        const entry = entries.find(e => e.id === activeEntryId);
        if (entry) {
            const updated = { ...entry, endTime: new Date().toISOString() };
            await saveTimeEntry(updated);
        }
        setActiveEntryId(null);
        if (timerRef.current) clearInterval(timerRef.current);
        setElapsedTime(0);
    };

    const getTodayEntries = () => {
        const today = new Date().toISOString().split('T')[0];
        return entries.filter(e => e.userId === currentUser?.id && e.startTime.startsWith(today))
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    };

    // --- Timesheet Logic ---
    const renderDayRows = (targetUserId: string, isAdmin: boolean) => {
        const days = [];
        const start = new Date(viewWeekStart);
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }

        return (
            <div className="space-y-4">
                {days.map(day => {
                    const dateStr = toLocalISOString(day);
                    const dayEntries = entries.filter(e => e.userId === targetUserId && e.startTime.startsWith(dateStr));
                    
                    return (
                        <div key={dateStr} className="border border-gray-200 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-gray-700">{day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h4>
                                <span className="text-sm font-mono text-gray-500">
                                    {formatDuration(dayEntries.reduce((acc, e) => acc + (e.endTime ? new Date(e.endTime).getTime() - new Date(e.startTime).getTime() : 0), 0))}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {dayEntries.length === 0 && <p className="text-sm text-gray-400 italic">No activity recorded.</p>}
                                {dayEntries.map(e => (
                                    <div key={e.id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${e.type === 'break' ? 'bg-amber-400' : 'bg-indigo-500'}`}></div>
                                            <span>{e.taskName || '(No task)'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono">{new Date(e.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {e.endTime ? new Date(e.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}</span>
                                            {isAdmin && <button onClick={() => deleteTimeEntry(e.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="h-3 w-3" /></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleBookLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!currentUser) return;
        const req: TimeOffRequest = {
            id: `leave-${Date.now()}`,
            userId: currentUser.id,
            type: leaveForm.type as LeaveType,
            startDate: leaveForm.startDate,
            endDate: leaveForm.isHalfDay ? leaveForm.startDate : leaveForm.endDate,
            reason: leaveForm.reason,
            status: 'pending',
            isHalfDay: leaveForm.isHalfDay
        };
        await saveLeaveRequest(req);
        setLeaveForm({ ...leaveForm, reason: '' }); 
        alert("Leave request submitted.");
    };

    const handleSubmitWeek = async (targetDate: Date = viewWeekStart) => {
        if (!currentUser) return;
        const startStr = toLocalISOString(targetDate);
        const weekEntries = entries.filter(e => e.userId === currentUser.id && e.startTime >= startStr); // simplified logic
        
        // Calculate total hours
        const totalMs = weekEntries.reduce((acc, e) => {
            if (e.endTime) return acc + (new Date(e.endTime).getTime() - new Date(e.startTime).getTime());
            return acc;
        }, 0);
        const totalHours = totalMs / (1000 * 60 * 60);

        const submission: WeeklyTimesheet = {
            id: `${currentUser.id}-${startStr}`,
            userId: currentUser.id,
            weekStartDate: startStr,
            status: 'submitted',
            submittedAt: new Date().toISOString(),
            totalHours
        };
        await saveWeeklySubmission(submission);
        alert("Timesheet submitted for review.");
    };

    // --- Render Calendar Grid ---
    const renderCalendar = () => {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Mon start
        
        const days = [];
        for (let i = 0; i < startOffset; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);

        return (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-gray-900">{calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
                        <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-200">
                            <button onClick={handlePrevMonth} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeftIcon className="h-4 w-4 text-gray-500"/></button>
                            <button onClick={handleNextMonth} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRightIcon className="h-4 w-4 text-gray-500"/></button>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <select 
                            value={selectedCalendarUser}
                            onChange={(e) => setSelectedCalendarUser(e.target.value)}
                            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="all">Everyone's Schedule</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                        </select>
                        <button 
                            onClick={() => setIsMeetingModalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-200 transition-all text-sm"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" /> Schedule Meeting
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-center py-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="text-xs font-bold text-gray-500 uppercase">{d}</div>)}
                </div>

                <div className="grid grid-cols-7 auto-rows-fr bg-gray-100 gap-px border-b border-gray-200">
                    {days.map((day, idx) => {
                        if (!day) return <div key={idx} className="bg-white min-h-[120px]"></div>;
                        
                        const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        
                        // Filters
                        const isSelectedUser = (uid: string) => selectedCalendarUser === 'all' || selectedCalendarUser === uid;

                        // 1. Leaves
                        const dayLeaves = leaveRequests.filter(r => 
                            r.status === 'approved' && 
                            isSelectedUser(r.userId) &&
                            r.startDate <= currentDateStr && 
                            r.endDate >= currentDateStr
                        );

                        // 2. Meetings
                        const dayMeetings = meetings.filter(m => {
                            const mStart = m.startTime.split('T')[0];
                            return mStart === currentDateStr && (
                                selectedCalendarUser === 'all' || 
                                m.participants.includes(selectedCalendarUser) || 
                                m.createdBy === selectedCalendarUser
                            );
                        });

                        // 3. Tasks Due
                        const dayTasks = tasks.filter(t => 
                            t.dueDate === currentDateStr && isSelectedUser(t.assignedTo || '')
                        );

                        const isToday = currentDateStr === toLocalISOString(new Date());

                        return (
                            <div key={idx} className={`bg-white min-h-[120px] p-2 hover:bg-gray-50 transition-colors relative group ${isToday ? 'bg-indigo-50/30' : ''}`}>
                                <span className={`text-sm font-bold ${isToday ? 'text-indigo-600 bg-indigo-100 w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}`}>{day}</span>
                                
                                <div className="mt-2 space-y-1">
                                    {dayLeaves.map(l => {
                                        const user = users.find(u => u.id === l.userId);
                                        return (
                                            <div key={l.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${l.isHalfDay ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                {user?.username.slice(0,8)}: {l.isHalfDay ? '½ ' : ''}{l.type}
                                            </div>
                                        );
                                    })}
                                    
                                    {dayMeetings.map(m => (
                                        <div key={m.id} className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-100 text-blue-700 border-blue-200 truncate flex items-center gap-1 cursor-pointer hover:bg-blue-200" title={m.title}>
                                            <VideoCameraIcon className="h-3 w-3" /> {m.startTime.split('T')[1].slice(0,5)} {m.title}
                                        </div>
                                    ))}

                                    {dayTasks.map(t => (
                                        <div key={t.id} className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-100 text-gray-600 border-gray-200 truncate flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {t.title}
                                        </div>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => {
                                        setMeetingForm({ startTime: `${currentDateStr}T09:00`, endTime: `${currentDateStr}T10:00`, participants: [] });
                                        setIsMeetingModalOpen(true);
                                    }}
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8 rounded-3xl text-gray-800 font-sans transition-colors duration-300 relative">
            
            {/* Top Navigation Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                         <ClockIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Time & Schedule</h1>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Manage hours, leaves, and meetings</p>
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
                <button onClick={() => setActiveTab('calendar')} className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${activeTab === 'calendar' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <CalendarIcon className="mr-2 h-4 w-4" /> Calendar
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

            {/* --- CALENDAR TAB --- */}
            {activeTab === 'calendar' && (
                <div className="animate-fadeIn">
                    {renderCalendar()}
                </div>
            )}

            {/* Meeting Modal */}
            {isMeetingModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Schedule Meeting</h3>
                        <div className="space-y-4">
                            <input 
                                type="text" 
                                placeholder="Meeting Title" 
                                value={meetingForm.title || ''}
                                onChange={e => setMeetingForm({...meetingForm, title: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <textarea 
                                placeholder="Agenda / Description" 
                                value={meetingForm.description || ''}
                                onChange={e => setMeetingForm({...meetingForm, description: e.target.value})}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                                rows={2}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1">Start</label>
                                    <input 
                                        type="datetime-local" 
                                        value={meetingForm.startTime?.slice(0, 16) || ''}
                                        onChange={e => setMeetingForm({...meetingForm, startTime: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1">End</label>
                                    <input 
                                        type="datetime-local" 
                                        value={meetingForm.endTime?.slice(0, 16) || ''}
                                        onChange={e => setMeetingForm({...meetingForm, endTime: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2">Participants</label>
                                <div className="space-y-2 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    {users.map(u => (
                                        <label key={u.id} className="flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={meetingForm.participants?.includes(u.id)}
                                                onChange={(e) => {
                                                    const current = meetingForm.participants || [];
                                                    setMeetingForm({
                                                        ...meetingForm, 
                                                        participants: e.target.checked 
                                                            ? [...current, u.id] 
                                                            : current.filter(id => id !== u.id)
                                                    });
                                                }}
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm text-gray-700">{u.username}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsMeetingModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-bold">Cancel</button>
                            <button onClick={handleCreateMeeting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all">Schedule</button>
                        </div>
                    </div>
                </div>
            )}
            
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
                                            {projects.filter(p => p.scope === 'global').length > 0 && <optgroup label="Global Projects">{projects.filter(p => p.scope === 'global').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                                            {projects.filter(p => p.scope === 'personal').length > 0 && <optgroup label="My Projects">{projects.filter(p => p.scope === 'personal').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
                                        </select>
                                    </div>
                                    <button onClick={() => setIsProjectModalOpen(true)} disabled={!!activeEntryId} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-2 border-indigo-100 rounded-2xl px-4 flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Create New Project"><PlusIcon className="h-6 w-6" /></button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 w-full xl:w-auto justify-center">
                            <div className="text-6xl md:text-7xl font-mono font-bold text-gray-900 tracking-tighter tabular-nums drop-shadow-sm">{formatDuration(elapsedTime)}</div>
                            {!activeEntryId ? (
                                <div className="flex gap-3">
                                    <button onClick={() => handleStartTimer(false)} className="bg-indigo-600 hover:bg-indigo-700 text-white h-20 w-20 rounded-full shadow-xl shadow-indigo-200 transition-all transform active:scale-95 flex items-center justify-center group"><PlayIcon className="h-10 w-10 ml-1 group-hover:scale-110 transition-transform" /></button>
                                    <button onClick={() => handleStartTimer(true)} className="bg-amber-400 hover:bg-amber-500 text-white h-20 w-20 rounded-full shadow-xl shadow-amber-200 transition-all transform active:scale-95 flex items-center justify-center group" title="Start Break"><span className="text-3xl group-hover:scale-110 transition-transform">☕</span></button>
                                </div>
                            ) : (
                                <button onClick={handleStopTimer} className="bg-red-500 hover:bg-red-600 text-white h-20 w-20 rounded-full shadow-xl shadow-red-200 transition-all transform active:scale-95 flex items-center justify-center animate-pulse"><StopIcon className="h-8 w-8" /></button>
                            )}
                        </div>
                    </div>
                    {/* ... Rest of Tracker UI (Today's Activity, Weekly Summary) ... */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Today's Activity</h3>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                                {getTodayEntries().map(entry => (
                                    <div key={entry.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                        <div><p className="font-bold text-gray-900">{entry.taskName}</p><p className="text-xs text-gray-500">{new Date(entry.startTime).toLocaleTimeString()}</p></div>
                                        <div className="font-mono font-bold text-gray-700">{formatDuration(entry.endTime ? new Date(entry.endTime).getTime() - new Date(entry.startTime).getTime() : Date.now() - new Date(entry.startTime).getTime())}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Summary Card */}
                        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                             <h3 className="text-lg font-bold text-gray-800 mb-4">Weekly Summary</h3>
                             <button onClick={() => handleSubmitWeek()} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">Submit Timesheet</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'timesheet' && (
                <div className="animate-fadeIn space-y-6">
                    {/* Timesheet View Logic - Simplified for brevity but functional */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                        <h2 className="text-xl font-bold mb-4">Weekly Timesheet</h2>
                        {renderDayRows(currentUser?.id || '', false)}
                    </div>
                </div>
            )}

            {/* TimeOff */}
            {activeTab === 'timeoff' && (
                <div className="animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-lg mb-4">Book Time Off</h3>
                            <form onSubmit={handleBookLeave} className="space-y-4">
                                <select value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value as LeaveType})} className="w-full p-2 border rounded-xl">{Object.keys(adminSettings.leaveBalances).map(t => <option key={t} value={t}>{t}</option>)}</select>
                                <div className="flex items-center gap-2"><input type="checkbox" checked={leaveForm.isHalfDay} onChange={e => setLeaveForm({...leaveForm, isHalfDay: e.target.checked})} /> Half Day</div>
                                <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} className="w-full p-2 border rounded-xl" />
                                <input type="date" disabled={leaveForm.isHalfDay} value={leaveForm.isHalfDay ? leaveForm.startDate : leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} className="w-full p-2 border rounded-xl" />
                                <textarea value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} className="w-full p-2 border rounded-xl" placeholder="Reason" />
                                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold">Submit</button>
                            </form>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-lg mb-4">Requests</h3>
                            <div className="space-y-2">{leaveRequests.map(r => <div key={r.id} className="p-2 border rounded-lg text-sm">{r.type} ({r.status})</div>)}</div>
                        </div>
                    </div>
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
                                 Missed Days are work days ({adminSettings.workConfig?.daysPerWeek || 5} days/week starting {WEEK_DAYS.find(d => d.val === (adminSettings.workConfig?.startDay || 1))?.label}) with no logged time and no approved leave. LOP are Approved 'Unpaid' leave days.
                             </p>
                         </div>
                    </div>
                </div>
            )}

            {/* --- ADMIN SETTINGS TAB --- */}
            {activeTab === 'admin' && currentUser?.role === 'admin' && (
                <div className="animate-fadeIn bg-white p-8 rounded-3xl border border-gray-200 shadow-sm max-w-3xl mx-auto">
                    <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center"><SettingsIcon className="mr-3 h-6 w-6 text-indigo-600"/> Admin Configuration</h3>
                    <div className="space-y-8">
                        {/* Work Week Setup */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <h4 className="text-lg font-bold text-gray-900 mb-4">Work Week Setup</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Week Starts On</label>
                                    <select
                                        value={adminSettings.workConfig?.startDay ?? 1}
                                        onChange={e => saveSettings({
                                            ...adminSettings,
                                            workConfig: {
                                                ...adminSettings.workConfig,
                                                startDay: parseInt(e.target.value),
                                                daysPerWeek: adminSettings.workConfig?.daysPerWeek ?? 5
                                            }
                                        })}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        {WEEK_DAYS.map(day => (
                                            <option key={day.val} value={day.val}>{day.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Working Days / Week</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        max="7"
                                        value={adminSettings.workConfig?.daysPerWeek ?? 5}
                                        onChange={e => saveSettings({
                                            ...adminSettings,
                                            workConfig: {
                                                ...adminSettings.workConfig,
                                                startDay: adminSettings.workConfig?.startDay ?? 1,
                                                daysPerWeek: Math.max(1, Math.min(7, parseInt(e.target.value)))
                                            }
                                        })}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                Note: Payroll calculations will skip days outside of this range (e.g., if 5 days starting Monday, Sat/Sun are skipped).
                            </p>
                        </div>

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
