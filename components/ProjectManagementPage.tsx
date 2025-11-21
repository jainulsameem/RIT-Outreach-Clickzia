
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
    BoardIcon, ListIcon, PlusIcon, TrashIcon, EditIcon, 
    ClockIcon, UserIcon, FlagIcon, ClipboardIcon, CheckIcon, CancelIcon, SettingsIcon 
} from './icons';
import type { Project, Task, TaskStatus, TaskPriority, TimeEntry } from '../types';

const STATUSES: { id: TaskStatus, label: string, color: string }[] = [
    { id: 'todo', label: 'To Do', color: 'bg-gray-100 text-gray-600' },
    { id: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    { id: 'review', label: 'Review', color: 'bg-purple-100 text-purple-700' },
    { id: 'done', label: 'Done', color: 'bg-green-100 text-green-700' }
];

const PRIORITIES: { id: TaskPriority, label: string, color: string }[] = [
    { id: 'low', label: 'Low', color: 'bg-blue-50 text-blue-600' },
    { id: 'medium', label: 'Medium', color: 'bg-yellow-50 text-yellow-600' },
    { id: 'high', label: 'High', color: 'bg-red-50 text-red-600' }
];

const PROJECT_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'];

export const ProjectManagementPage: React.FC = () => {
    const { currentUser, users } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    // Task Modal State
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [taskForm, setTaskForm] = useState<Partial<Task>>({ status: 'todo', priority: 'medium' });

    // Project Modal State
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [projectForm, setProjectForm] = useState<Partial<Project>>({ color: '#6366f1', scope: 'personal', status: 'active' });

    const fetchData = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const { data: projData } = await supabase.from('projects').select('data');
            if (projData) {
                const allProjs = projData.map((r: any) => r.data);
                // Filter accessible projects
                const visibleProjs = allProjs.filter((p: Project) => p.scope === 'global' || p.createdBy === currentUser.id);
                setProjects(visibleProjs);
                
                // If selected project was deleted or not set, select first available
                if ((!selectedProjectId && visibleProjs.length > 0) || (selectedProjectId && !visibleProjs.find((p: Project) => p.id === selectedProjectId))) {
                    setSelectedProjectId(visibleProjs.length > 0 ? visibleProjs[0].id : null);
                }
            }

            const { data: taskData } = await supabase.from('project_tasks').select('data');
            if (taskData) {
                setTasks(taskData.map((r: any) => r.data));
            }
        } catch (error) {
            console.error("Error fetching PM data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentUser]);

    // --- Project Actions ---

    const handleOpenProjectModal = (project?: Project) => {
        if (project) {
            setProjectForm(project);
        } else {
            setProjectForm({ 
                color: '#6366f1', 
                scope: currentUser?.role === 'admin' ? 'global' : 'personal', 
                status: 'active',
                createdBy: currentUser?.id 
            });
        }
        setIsProjectModalOpen(true);
    };

    const handleSaveProject = async () => {
        if (!projectForm.name) return alert("Project Name required");
        
        const newProject: Project = {
            id: projectForm.id || `proj-${Date.now()}`,
            name: projectForm.name,
            description: projectForm.description || '',
            clientName: projectForm.clientName || '',
            color: projectForm.color || '#6366f1',
            scope: projectForm.scope || 'personal',
            status: projectForm.status || 'active',
            createdBy: projectForm.createdBy || currentUser?.id || ''
        };

        // Optimistic Update
        setProjects(prev => {
            const exists = prev.find(p => p.id === newProject.id);
            if (exists) return prev.map(p => p.id === newProject.id ? newProject : p);
            return [...prev, newProject];
        });

        if (!selectedProjectId) setSelectedProjectId(newProject.id);

        const { error } = await supabase.from('projects').upsert({ 
            id: newProject.id, 
            user_id: newProject.createdBy, 
            data: newProject 
        });

        if (error) {
            console.error("Error saving project:", error);
            alert("Failed to save project.");
            fetchData(); // Revert on error
        }

        setIsProjectModalOpen(false);
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!window.confirm("Are you sure you want to delete this project? This will also delete all associated tasks.")) return;
        
        const nextProject = projects.find(p => p.id !== projectId);
        setSelectedProjectId(nextProject ? nextProject.id : null);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setTasks(prev => prev.filter(t => t.projectId !== projectId)); // Optimistic task cleanup

        await supabase.from('projects').delete().eq('id', projectId);
    };

    // --- Task Actions ---

    const handleSaveTask = async () => {
        if (!selectedProjectId || !taskForm.title) return alert("Title required");
        
        const newTask: Task = {
            id: taskForm.id || `task-${Date.now()}`,
            projectId: selectedProjectId,
            title: taskForm.title,
            description: taskForm.description,
            status: taskForm.status || 'todo',
            priority: taskForm.priority || 'medium',
            assignedTo: taskForm.assignedTo,
            dueDate: taskForm.dueDate,
            createdAt: taskForm.createdAt || new Date().toISOString()
        };

        setTasks(prev => {
            const exists = prev.find(t => t.id === newTask.id);
            if (exists) return prev.map(t => t.id === newTask.id ? newTask : t);
            return [...prev, newTask];
        });

        await supabase.from('project_tasks').upsert({ 
            id: newTask.id, 
            project_id: selectedProjectId, 
            assigned_to: newTask.assignedTo, 
            status: newTask.status,
            data: newTask 
        });

        setIsTaskModalOpen(false);
        setTaskForm({ status: 'todo', priority: 'medium' });
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        
        // Optimistic delete
        setTasks(prev => prev.filter(t => t.id !== taskId));
        
        const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
        if (error) {
            console.error("Error deleting task:", error);
            alert("Failed to delete task from server: " + error.message);
            fetchData(); // Revert
        }
    };

    const handleUpdateStatus = async (taskId: string, newStatus: TaskStatus) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            const updatedTask = { ...task, status: newStatus };
            setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
            await supabase.from('project_tasks').upsert({
                id: task.id,
                project_id: task.projectId,
                assigned_to: task.assignedTo,
                status: newStatus,
                data: updatedTask
            });
        }
    };

    const handleStartTimer = async (task: Task, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        
        if (!currentUser) return;
        
        try {
            // 1. Get all entries for user to find active one
            const { data: entriesData, error: fetchError } = await supabase
                .from('time_entries')
                .select('*')
                .eq('user_id', currentUser.id);
                
            if (fetchError) throw fetchError;

            // Filter active entries in JS to avoid complex JSONB queries
            const activeEntries = entriesData
                .map((row: any) => row.data as TimeEntry)
                .filter(entry => entry.endTime === null);

            // 2. Stop them
            for (const entry of activeEntries) {
                const updatedEntry = { ...entry, endTime: new Date().toISOString() };
                await supabase.from('time_entries').upsert({
                    id: entry.id,
                    user_id: currentUser.id,
                    data: updatedEntry
                });
            }

            // 3. Start new timer linked to this task
            const newEntry: TimeEntry = {
                id: `entry-${Date.now()}`,
                userId: currentUser.id,
                projectId: task.projectId,
                taskName: task.title,
                taskId: task.id,
                startTime: new Date().toISOString(),
                endTime: null,
                type: 'work',
                status: 'draft'
            };

            const { error: insertError } = await supabase.from('time_entries').insert({
                id: newEntry.id,
                user_id: currentUser.id,
                data: newEntry
            });

            if (insertError) throw insertError;

            alert(`Timer started for: "${task.title}"`);
        } catch (err: any) {
            console.error("Error starting timer:", err);
            alert("Failed to start timer: " + err.message);
        }
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const projectTasks = tasks.filter(t => t.projectId === selectedProjectId);

    // Stats
    const totalTasks = projectTasks.length;
    const completedTasks = projectTasks.filter(t => t.status === 'done').length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8 rounded-3xl font-sans flex flex-col md:flex-row gap-6">
            
            {/* Sidebar: Project List */}
            <div className="w-full md:w-64 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex-shrink-0 h-fit">
                <div className="flex justify-between items-center mb-4 px-2">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Projects</h2>
                    <button onClick={() => handleOpenProjectModal()} className="p-1 hover:bg-gray-100 rounded text-indigo-600 transition-colors" title="New Project">
                        <PlusIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="space-y-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {projects.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedProjectId(p.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${selectedProjectId === p.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-gray-600 hover:bg-gray-50 border border-transparent'}`}
                        >
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }}></div>
                            <span className="truncate flex-grow">{p.name}</span>
                            {p.status === 'completed' && <CheckIcon className="h-3 w-3 text-green-500" />}
                        </button>
                    ))}
                    {projects.length === 0 && <p className="text-center text-gray-400 text-xs py-4">No projects found.</p>}
                </div>
            </div>

            {/* Main Board */}
            <div className="flex-grow overflow-hidden flex flex-col">
                {selectedProject ? (
                    <>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex-grow">
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-2xl font-bold text-gray-900">{selectedProject.name}</h1>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${selectedProject.status === 'completed' ? 'bg-green-100 text-green-700' : selectedProject.status === 'archived' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                                        {selectedProject.status}
                                    </span>
                                    <div className="flex gap-1 ml-2">
                                        <button onClick={() => handleOpenProjectModal(selectedProject)} className="text-gray-400 hover:text-indigo-600 p-1"><EditIcon className="h-4 w-4" /></button>
                                        <button onClick={() => handleDeleteProject(selectedProject.id)} className="text-gray-400 hover:text-red-600 p-1"><TrashIcon className="h-4 w-4" /></button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500 line-clamp-2">{selectedProject.description || 'No description provided.'}</p>
                                {selectedProject.clientName && <p className="text-xs text-indigo-600 font-medium mt-1">Client: {selectedProject.clientName}</p>}
                                
                                <div className="flex items-center gap-4 mt-3">
                                    <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <span className="text-xs text-gray-500 font-bold">{progress}% Complete</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setTaskForm({ projectId: selectedProjectId, status: 'todo', priority: 'medium' }); setIsTaskModalOpen(true); }}
                                className="mt-4 md:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center shadow-lg shadow-indigo-200 transition-all shrink-0"
                            >
                                <PlusIcon className="h-5 w-5 mr-2" /> New Task
                            </button>
                        </div>

                        {/* Kanban Board */}
                        <div className="flex overflow-x-auto pb-4 gap-4 h-full items-start">
                            {STATUSES.map(status => {
                                const colTasks = projectTasks.filter(t => t.status === status.id);
                                return (
                                    <div key={status.id} className="min-w-[280px] w-72 bg-gray-100/50 rounded-2xl p-3 flex flex-col max-h-full">
                                        <div className={`flex justify-between items-center px-3 py-2 mb-3 rounded-xl ${status.color} font-bold text-xs uppercase tracking-wider shadow-sm`}>
                                            {status.label}
                                            <span className="bg-white/50 px-2 py-0.5 rounded-md">{colTasks.length}</span>
                                        </div>
                                        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-3 pr-1">
                                            {colTasks.map(task => {
                                                const assignee = users.find(u => u.id === task.assignedTo);
                                                const priorityColor = PRIORITIES.find(p => p.id === task.priority)?.color || 'bg-gray-100';
                                                
                                                return (
                                                    <div key={task.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group relative">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${priorityColor}`}>
                                                                {task.priority}
                                                            </span>
                                                            {/* Action Buttons: Enhanced for Mobile Tap & Desktop Hover */}
                                                            <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity relative z-20">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setTaskForm(task); setIsTaskModalOpen(true); }} 
                                                                    className="p-2 text-gray-400 hover:text-indigo-600 bg-transparent hover:bg-gray-50 rounded-lg transition-colors"
                                                                    title="Edit Task"
                                                                >
                                                                    <EditIcon className="h-3 w-3" />
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteTask(task.id); }} 
                                                                    className="p-2 text-gray-400 hover:text-red-600 bg-transparent hover:bg-red-50 rounded-lg transition-colors"
                                                                    title="Delete Task"
                                                                >
                                                                    <TrashIcon className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <h4 className="font-bold text-gray-800 text-sm mb-1">{task.title}</h4>
                                                        {task.dueDate && <p className="text-xs text-gray-400 mb-3">Due: {task.dueDate}</p>}
                                                        
                                                        <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                                            <div className="flex items-center" title={assignee?.username || 'Unassigned'}>
                                                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 border border-white ring-1 ring-gray-100">
                                                                    {assignee ? assignee.username.charAt(0).toUpperCase() : '?'}
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-2 relative z-20">
                                                                <select 
                                                                    value={task.status}
                                                                    onChange={(e) => handleUpdateStatus(task.id, e.target.value as TaskStatus)}
                                                                    className="text-[10px] bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none cursor-pointer"
                                                                >
                                                                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                                                </select>
                                                                <button 
                                                                    onClick={(e) => handleStartTimer(task, e)}
                                                                    className="text-gray-400 hover:text-indigo-600 transition-colors p-1.5 rounded-full hover:bg-indigo-50"
                                                                    title="Start Timer"
                                                                >
                                                                    <ClockIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <ClipboardIcon className="h-16 w-16 mb-4 opacity-20" />
                        <p>Select a project to view the task board.</p>
                        <button onClick={() => handleOpenProjectModal()} className="mt-4 text-indigo-600 font-bold hover:underline">Create New Project</button>
                    </div>
                )}
            </div>

            {/* Task Modal */}
            {isTaskModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg transform transition-all">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">{taskForm.id ? 'Edit Task' : 'New Task'}</h3>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            <input 
                                type="text" 
                                value={taskForm.title || ''} 
                                onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                                placeholder="Task Title" 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <textarea 
                                value={taskForm.description || ''} 
                                onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                                placeholder="Description..." 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <select 
                                        value={taskForm.status}
                                        onChange={e => setTaskForm({...taskForm, status: e.target.value as TaskStatus})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                    >
                                        {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Priority</label>
                                    <select 
                                        value={taskForm.priority}
                                        onChange={e => setTaskForm({...taskForm, priority: e.target.value as TaskPriority})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                    >
                                        {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assign To</label>
                                    <select 
                                        value={taskForm.assignedTo || ''}
                                        onChange={e => setTaskForm({...taskForm, assignedTo: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date</label>
                                    <input 
                                        type="date" 
                                        value={taskForm.dueDate || ''}
                                        onChange={e => setTaskForm({...taskForm, dueDate: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsTaskModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium transition-colors">Cancel</button>
                            <button onClick={handleSaveTask} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">Save Task</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Modal */}
            {isProjectModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg transform transition-all">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">{projectForm.id ? 'Edit Project' : 'New Project'}</h3>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            <input 
                                type="text" 
                                value={projectForm.name || ''} 
                                onChange={e => setProjectForm({...projectForm, name: e.target.value})}
                                placeholder="Project Name" 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <textarea 
                                value={projectForm.description || ''} 
                                onChange={e => setProjectForm({...projectForm, description: e.target.value})}
                                placeholder="Project Description..." 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-20 resize-none"
                            />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Client Name</label>
                                    <input 
                                        type="text" 
                                        value={projectForm.clientName || ''} 
                                        onChange={e => setProjectForm({...projectForm, clientName: e.target.value})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                        placeholder="Client/Company"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <select 
                                        value={projectForm.status || 'active'}
                                        onChange={e => setProjectForm({...projectForm, status: e.target.value as any})}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none"
                                    >
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Color Tag</label>
                                <div className="flex flex-wrap gap-2">
                                    {PROJECT_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setProjectForm({...projectForm, color})}
                                            className={`w-8 h-8 rounded-full shadow-sm transition-all ${projectForm.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {currentUser?.role === 'admin' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Scope</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input type="radio" checked={projectForm.scope === 'global'} onChange={() => setProjectForm({...projectForm, scope: 'global'})} className="text-indigo-600"/>
                                            <span className="ml-2 text-sm">Global (All Users)</span>
                                        </label>
                                        <label className="flex items-center cursor-pointer">
                                            <input type="radio" checked={projectForm.scope === 'personal'} onChange={() => setProjectForm({...projectForm, scope: 'personal'})} className="text-indigo-600"/>
                                            <span className="ml-2 text-sm">Personal</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                            <button onClick={() => setIsProjectModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-800 font-medium transition-colors">Cancel</button>
                            <button onClick={handleSaveProject} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95">Save Project</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
