
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
            // If switching to custom without existing dates, set default to today to avoid empty state issues
            if (!filters.date.startDate) {
                 const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
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
        <div className="bg-base-200 p-4 rounded-xl mb-6 shadow-md border border-white/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label htmlFor="status-filter" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Status</label>
                    <select id="status-filter" value={filters.status} onChange={e => onFiltersChange({ ...filters, status: e.target.value as LeadStatus | 'All' })} className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary appearance-none">
                        <option value="All">All Statuses</option>
                        {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="assignee-filter" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assigned To</label>
                    <select id="assignee-filter" value={filters.assignee} onChange={e => onFiltersChange({ ...filters, assignee: e.target.value })} className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary appearance-none">
                        <option value="all">All Users</option>
                        <option value="me">Assigned to Me</option>
                        <option value="unassigned">Unassigned</option>
                        {currentUser?.role === 'admin' && users.filter(u => u.id !== currentUser.id).map(user => (
                            <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                    </select>
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center"><CalendarIcon className="h-3 w-3 mr-1.5" /> Date Added</label>
                    <div className="flex bg-base-300/50 rounded-lg border border-gray-600 p-1">
                        {(['any', 'today', 'week', 'month', 'custom'] as const).map(d => (
                            <button key={d} onClick={() => handleDateTypeChange(d)} className={`flex-1 text-xs font-medium py-1.5 px-2 rounded transition-all ${filters.date.type === d ? 'bg-brand-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{d === 'any' ? 'All' : d}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="sort-order" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sort By</label>
                    <select id="sort-order" value={filters.sortOrder} onChange={e => onFiltersChange({ ...filters, sortOrder: e.target.value as 'newest' | 'oldest'})} className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary appearance-none">
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>
            
            {filters.date.type === 'custom' && (
                <div className="mt-4 pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center gap-4 animate-fadeIn">
                    <span className="text-sm text-brand-secondary font-semibold">Custom Range:</span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1">
                            <input 
                                type="date" 
                                id="start-date" 
                                value={customStartDate} 
                                onChange={e => handleCustomDateChange('startDate', e.target.value)} 
                                className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            />
                        </div>
                        <span className="text-gray-400">to</span>
                        <div className="relative flex-1">
                            <input 
                                type="date" 
                                id="end-date" 
                                value={customEndDate} 
                                onChange={e => handleCustomDateChange('endDate', e.target.value)} 
                                className="w-full bg-base-300/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
