import React, { useState, useEffect } from 'react';
import type { CrmFilters, User, LeadStatus, DateFilterType } from '../types';
import { leadStatuses } from '../types';

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
            const today = new Date().toISOString().split('T')[0];
            setCustomStartDate(today);
            setCustomEndDate(today);
            onFiltersChange({ ...filters, date: { type, startDate: today, endDate: today } });
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
        <div className="bg-base-200 p-4 rounded-lg mb-6 shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                    <select id="status-filter" value={filters.status} onChange={e => onFiltersChange({ ...filters, status: e.target.value as LeadStatus | 'All' })} className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary">
                        <option value="All">All Statuses</option>
                        {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="assignee-filter" className="block text-sm font-medium text-gray-400 mb-1">Assigned To</label>
                    <select id="assignee-filter" value={filters.assignee} onChange={e => onFiltersChange({ ...filters, assignee: e.target.value })} className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary">
                        <option value="all">All Users</option>
                        <option value="me">Assigned to Me</option>
                        <option value="unassigned">Unassigned</option>
                        {currentUser?.role === 'admin' && users.filter(u => u.id !== currentUser.id).map(user => (
                            <option key={user.id} value={user.id}>{user.username}</option>
                        ))}
                    </select>
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Date Added</label>
                    <div className="flex bg-base-300 rounded-md border border-gray-600 p-1">
                        {(['any', 'today', 'week', 'month', 'custom'] as const).map(d => (
                            <button key={d} onClick={() => handleDateTypeChange(d)} className={`flex-1 text-sm py-1 px-2 rounded capitalize transition-colors ${filters.date.type === d ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-base-100'}`}>{d === 'any' ? 'Any' : d}</button>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="sort-order" className="block text-sm font-medium text-gray-400 mb-1">Sort By</label>
                    <select id="sort-order" value={filters.sortOrder} onChange={e => onFiltersChange({ ...filters, sortOrder: e.target.value as 'newest' | 'oldest'})} className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary">
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                    </select>
                </div>
            </div>
            {filters.date.type === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-gray-400 mb-1">Start Date</label>
                        <input type="date" id="start-date" value={customStartDate} onChange={e => handleCustomDateChange('startDate', e.target.value)} className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"/>
                    </div>
                    <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-gray-400 mb-1">End Date</label>
                        <input type="date" id="end-date" value={customEndDate} onChange={e => handleCustomDateChange('endDate', e.target.value)} className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"/>
                    </div>
                </div>
            )}
        </div>
    );
};
