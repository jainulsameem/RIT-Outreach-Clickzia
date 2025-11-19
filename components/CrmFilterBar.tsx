
import React, { useState, useEffect } from 'react';
import type { CrmFilters, User, LeadStatus, DateFilterType } from '../types';
import { leadStatuses } from '../types';
import { CalendarIcon } from './icons';

interface CrmFilterBarProps {
    filters: CrmFilters;
    onFiltersChange: (filters: CrmFilters) => void;
    users: User[];
    currentUser: User | null;
}

export const CrmFilterBar: React.FC<CrmFilterBarProps> = ({ filters, onFiltersChange, users, currentUser }) => {
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        if (filters.date.type === 'custom') {
            setCustomStartDate(filters.date.startDate || '');
            setCustomEndDate(filters.date.endDate || '');
        }
    }, [filters.date.type, filters.date.startDate, filters.date.endDate]);

    const handleDateTypeChange = (type: DateFilterType) => {
        if (type === 'custom') {
            if (!filters.date.startDate) {
                 const today = new Date().toLocaleDateString('en-CA');
                 setCustomStartDate(today);
                 setCustomEndDate(today);
                 onFiltersChange({ ...filters, date: { type, startDate: today, endDate: today } });
            } else {
                 onFiltersChange({ ...filters, date: { type, startDate: filters.date.startDate, endDate: filters.date.endDate } });
            }
        } else {
            onFiltersChange({ ...filters, date: { type } });
        }
    };
    
    const handleCustomDateChange = (field: 'startDate' | 'endDate', value: string) => {
        if (field === 'startDate') {
            setCustomStartDate(value);
            onFiltersChange({ ...filters, date: { ...filters.date, startDate: value }});
        } else {
            setCustomEndDate(value);
            onFiltersChange({ ...filters, date: { ...filters.date, endDate: value }});
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl mb-6 shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label htmlFor="status-filter" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                    <div className="relative">
                        <select id="status-filter" value={filters.status} onChange={e => onFiltersChange({ ...filters, status: e.target.value as LeadStatus | 'All' })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-gray-100 transition-colors">
                            <option value="All">All Statuses</option>
                            {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
                <div>
                    <label htmlFor="assignee-filter" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assigned To</label>
                    <div className="relative">
                        <select id="assignee-filter" value={filters.assignee} onChange={e => onFiltersChange({ ...filters, assignee: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-gray-100 transition-colors">
                            <option value="all">All Users</option>
                            <option value="me">Assigned to Me</option>
                            <option value="unassigned">Unassigned</option>
                            {currentUser?.role === 'admin' && users.filter(u => u.id !== currentUser.id).map(user => (
                                <option key={user.id} value={user.id}>{user.username}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center"><CalendarIcon className="h-3 w-3 mr-1.5 text-gray-400" /> Date Added</label>
                    <div className="flex bg-gray-50 rounded-xl border border-gray-200 p-1">
                        {(['any', 'today', 'week', 'month', 'custom'] as const).map(d => (
                            <button key={d} onClick={() => handleDateTypeChange(d)} className={`flex-1 text-xs font-bold py-2 px-2 rounded-lg transition-all capitalize ${filters.date.type === d ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>{d === 'any' ? 'All' : d}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="sort-order" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sort By</label>
                    <div className="relative">
                        <select id="sort-order" value={filters.sortOrder} onChange={e => onFiltersChange({ ...filters, sortOrder: e.target.value as 'newest' | 'oldest'})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-gray-100 transition-colors">
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                         <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
            </div>
            
            {filters.date.type === 'custom' && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-4 animate-fadeIn">
                    <span className="text-sm text-indigo-600 font-bold">Custom Range:</span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1">
                            <input 
                                type="date" 
                                id="start-date" 
                                value={customStartDate} 
                                onChange={e => handleCustomDateChange('startDate', e.target.value)} 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <span className="text-gray-400 font-medium">to</span>
                        <div className="relative flex-1">
                            <input 
                                type="date" 
                                id="end-date" 
                                value={customEndDate} 
                                onChange={e => handleCustomDateChange('endDate', e.target.value)} 
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
