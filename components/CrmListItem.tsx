
import React, { useState } from 'react';
import type { CrmContact, LeadStatus, Activity, Business, User } from '../types';
import { leadStatuses } from '../types';
import { EmailIcon, PhoneIcon, WebsiteIcon, WhatsAppIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, NoteIcon, StatusChangeIcon, CreatedIcon, UserIcon, AssignUserIcon } from './icons';

interface CrmListItemProps {
    contact: CrmContact;
    onComposeEmail: (business: Business) => void;
    hasBeenEmailed: boolean;
    onRemoveFromCrm: (businessId: string) => void;
    onUpdateStatus: (contactId: string, status: LeadStatus) => void;
    onAddNote: (contactId: string, note: string) => void;
    users: User[];
    currentUser: User | null;
    onAssignContact: (contactId: string, userId: string | 'unassigned') => void;
}

const statusColors: Record<LeadStatus, string> = {
    'New': 'bg-blue-600 text-blue-100',
    'Contacted': 'bg-cyan-600 text-cyan-100',
    'Interested': 'bg-green-600 text-green-100',
    'Follow-up': 'bg-yellow-600 text-yellow-100',
    'Not Interested': 'bg-gray-500 text-gray-100',
    'Converted': 'bg-purple-600 text-purple-100',
};

const LeadStatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => (
    <span className={`ml-3 text-xs font-bold inline-block py-1 px-3 uppercase rounded-full ${statusColors[status]}`}>{status}</span>
);

const ActivityIcon: React.FC<{ type: Activity['type'] }> = ({ type }) => {
    const iconProps = { className: "h-5 w-5 text-gray-400" };
    switch (type) {
        case 'created': return <CreatedIcon {...iconProps} />;
        case 'note': return <NoteIcon {...iconProps} />;
        case 'email': return <EmailIcon {...iconProps} />;
        case 'status_change': return <StatusChangeIcon {...iconProps} />;
        case 'assignment': return <AssignUserIcon {...iconProps} />;
        default: return null;
    }
};

const ActivityLog: React.FC<{ activities: Activity[] }> = ({ activities }) => (
    <div className="mt-4">
        <h4 className="text-lg font-semibold text-white mb-2">Activity & History</h4>
        <div className="border-l-2 border-gray-700 pl-4 space-y-4 max-h-60 overflow-y-auto">
            {activities.map(activity => (
                <div key={activity.id} className="relative">
                     <div className="absolute -left-5 top-1 h-2 w-2 rounded-full bg-brand-primary"></div>
                     <div className="flex items-start space-x-3">
                        <ActivityIcon type={activity.type} />
                        <div className="flex-1">
                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{activity.content}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {new Date(activity.timestamp).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                })}
                            </p>
                        </div>
                     </div>
                </div>
            ))}
        </div>
    </div>
);

const AddNoteForm: React.FC<{ onAddNote: (note: string) => void }> = ({ onAddNote }) => {
    const [note, setNote] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (note.trim()) {
            onAddNote(note.trim());
            setNote('');
        }
    };
    return (
        <form onSubmit={handleSubmit} className="mt-4">
            <h4 className="text-lg font-semibold text-white mb-2">Add a Note</h4>
            <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add a note about this contact..."
                className="w-full bg-base-300 border border-gray-600 rounded-md p-2 text-white focus:ring-2 focus:ring-brand-primary resize-y"
                rows={3}
            />
            <button type="submit" className="mt-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-500" disabled={!note.trim()}>
                Add Note
            </button>
        </form>
    );
};

export const CrmListItem: React.FC<CrmListItemProps> = ({ contact, onComposeEmail, hasBeenEmailed, onRemoveFromCrm, onUpdateStatus, onAddNote, users, currentUser, onAssignContact }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const sanitizedPhone = contact.phone ? contact.phone.replace(/[^0-9+]/g, '') : '';
    const assignedUser = users.find(u => u.id === contact.assignedTo);
    
    return (
        <li className="bg-base-200 rounded-lg shadow-md transition-all duration-300">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:gap-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex-grow">
                    <div className="flex items-center flex-wrap">
                        <h3 className="text-xl font-bold text-white mr-2">{contact.name}</h3>
                        <LeadStatusBadge status={contact.status} />
                    </div>
                     <div className="flex items-center text-sm text-gray-400 mt-1">
                        <UserIcon className="h-4 w-4 mr-1" />
                        <span>{assignedUser ? `Assigned to ${assignedUser.username}` : 'Unassigned'}</span>
                    </div>
                </div>
                 <div className="flex items-center text-gray-400">
                    <span>Details</span>
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </div>
            </div>

            {isExpanded && (
                 <div className="p-4 border-t border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="text-lg font-semibold text-white mb-2">Contact Actions</h4>
                            <div className="flex flex-wrap gap-2">
                                {contact.phone && (
                                    <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-grow-0 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center text-sm" aria-label={`Message on WhatsApp`}>
                                        <WhatsAppIcon/> <span className="ml-2 hidden sm:inline">WhatsApp</span>
                                    </a>
                                )}
                                {contact.phone && (
                                    <a href={`tel:${sanitizedPhone}`} className="flex-1 sm:flex-grow-0 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center text-sm" aria-label={`Call`}>
                                        <PhoneIcon/> <span className="ml-2 hidden sm:inline">Call</span>
                                    </a>
                                )}
                                <button onClick={() => onComposeEmail(contact)} disabled={!contact.email || hasBeenEmailed} className="flex-1 sm:flex-grow-0 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center text-sm disabled:bg-gray-500">
                                    <EmailIcon className="h-4 w-4" /> <span className="ml-2 hidden sm:inline">{hasBeenEmailed ? 'Emailed' : 'Email'}</span>
                                </button>
                                <button onClick={() => onRemoveFromCrm(contact.id)} className="flex-1 sm:flex-grow-0 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center text-sm" aria-label={`Remove from CRM`}>
                                    <TrashIcon /> <span className="ml-2 hidden sm:inline">Remove</span>
                                </button>
                            </div>
                             <div className="mt-4">
                                <label htmlFor={`status-${contact.id}`} className="block text-sm font-medium text-base-content mb-1">Lead Status</label>
                                <select
                                    id={`status-${contact.id}`}
                                    value={contact.status}
                                    onChange={(e) => onUpdateStatus(contact.id, e.target.value as LeadStatus)}
                                    className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {currentUser?.role === 'admin' && (
                                <div className="mt-4">
                                <label htmlFor={`assign-${contact.id}`} className="block text-sm font-medium text-base-content mb-1">Assign To</label>
                                <select
                                    id={`assign-${contact.id}`}
                                    value={contact.assignedTo || 'unassigned'}
                                    onChange={(e) => onAssignContact(contact.id, e.target.value)}
                                    className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <option value="unassigned">-- Unassigned --</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                </select>
                                </div>
                            )}
                        </div>
                        <div>
                           {contact.website && <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:text-white hover:underline flex items-center mb-4"><WebsiteIcon /> <span className="ml-2">Visit Website</span></a>}
                           <AddNoteForm onAddNote={(note) => onAddNote(contact.id, note)} />
                        </div>
                    </div>
                    <ActivityLog activities={contact.activities} />
                </div>
            )}
        </li>
    );
};
