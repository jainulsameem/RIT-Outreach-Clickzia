
import React, { useState } from 'react';
import type { CrmContact, LeadStatus, Activity, Business, User } from '../types';
import { leadStatuses } from '../types';
import { EmailIcon, PhoneIcon, WebsiteIcon, WhatsAppIcon, TrashIcon, ChevronDownIcon, ChevronUpIcon, NoteIcon, StatusChangeIcon, CreatedIcon, UserIcon, AssignUserIcon, EditIcon, CheckIcon, CancelIcon, LocationIcon } from './icons';

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
    onUpdateContactDetails: (contactId: string, updates: Partial<CrmContact>) => void;
}

const statusColors: Record<LeadStatus, string> = {
    'New': 'bg-blue-900/50 text-blue-200 border-blue-500/30',
    'Contacted': 'bg-cyan-900/50 text-cyan-200 border-cyan-500/30',
    'Interested': 'bg-green-900/50 text-green-200 border-green-500/30',
    'Follow-up': 'bg-yellow-900/50 text-yellow-200 border-yellow-500/30',
    'Not Interested': 'bg-gray-700/50 text-gray-400 border-gray-500/30',
    'Converted': 'bg-purple-900/50 text-purple-200 border-purple-500/30',
};

const LeadStatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => (
    <span className={`ml-3 text-[10px] font-bold tracking-wider py-1 px-2.5 uppercase rounded-full border ${statusColors[status]}`}>{status}</span>
);

const ActivityIcon: React.FC<{ type: Activity['type'] }> = ({ type }) => {
    const iconProps = { className: "h-4 w-4 text-gray-400" };
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
    <div className="mt-6 pt-4 border-t border-white/5">
        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">History</h4>
        <div className="border-l border-gray-700 pl-4 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
            {activities.map(activity => (
                <div key={activity.id} className="relative">
                     <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-surface border border-brand-primary/50 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                     <div className="flex items-start space-x-3">
                        <div className="mt-0.5"><ActivityIcon type={activity.type} /></div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{activity.content}</p>
                            <p className="text-[10px] text-gray-500 mt-1 font-mono">
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
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Add Note</h4>
            <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Type details here..."
                className="w-full bg-base-300/50 border border-gray-600 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-brand-primary focus:border-brand-primary resize-y transition-all"
                rows={2}
            />
            <div className="flex justify-end mt-2">
                <button type="submit" className="bg-brand-surface border border-gray-600 hover:bg-brand-primary hover:border-brand-primary text-white text-xs font-bold py-1.5 px-3 rounded transition-all disabled:opacity-50" disabled={!note.trim()}>
                    Save Note
                </button>
            </div>
        </form>
    );
};

export const CrmListItem: React.FC<CrmListItemProps> = ({ contact, onComposeEmail, hasBeenEmailed, onRemoveFromCrm, onUpdateStatus, onAddNote, users, currentUser, onAssignContact, onUpdateContactDetails }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: contact.name,
        phone: contact.phone || '',
        email: contact.email || '',
        website: contact.website || '',
        address: contact.address || ''
    });

    const sanitizedPhone = contact.phone ? contact.phone.replace(/[^0-9+]/g, '') : '';
    const assignedUser = users.find(u => u.id === contact.assignedTo);
    
    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setFormData({
            name: contact.name,
            phone: contact.phone || '',
            email: contact.email || '',
            website: contact.website || '',
            address: contact.address || ''
        });
        setIsEditing(true);
        setIsExpanded(true);
    };

    const handleCancelEdit = (e: React.MouseEvent) => {
         e.stopPropagation();
         setIsEditing(false);
    };

    const handleSaveEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onUpdateContactDetails(contact.id, formData);
        setIsEditing(false);
    };

    const handleInputChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const getExternalUrl = (url: string) => {
        if (!url) return '';
        return url.startsWith('http') ? url : `https://${url}`;
    };

    return (
        <li className={`glass-panel border border-white/5 rounded-xl shadow-lg transition-all duration-300 overflow-hidden ${isExpanded ? 'ring-1 ring-brand-primary/30' : 'hover:border-brand-primary/30'}`}>
            <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:gap-4 cursor-pointer group" onClick={() => !isEditing && setIsExpanded(!isExpanded)}>
                <div className="flex-grow w-full">
                    <div className="flex items-center flex-wrap gap-2">
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={formData.name} 
                                onChange={e => handleInputChange('name', e.target.value)}
                                className="text-lg font-bold text-white bg-base-300 border border-gray-500 rounded px-2 py-1 w-full sm:w-auto"
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <h3 className="text-lg font-bold text-white group-hover:text-brand-light transition-colors">{contact.name}</h3>
                        )}
                        {!isEditing && <LeadStatusBadge status={contact.status} />}
                    </div>
                     <div className="flex items-center text-xs text-gray-400 mt-1.5">
                        <UserIcon className="h-3 w-3 mr-1.5" />
                        <span className="font-medium">{assignedUser ? `Owner: ${assignedUser.username}` : 'Unassigned'}</span>
                    </div>
                </div>
                 <div className="flex items-center text-gray-400 bg-base-300/30 px-3 py-1.5 rounded-lg border border-white/5 group-hover:bg-base-300/60 transition-colors">
                    <span className="text-xs font-semibold mr-2">{isExpanded ? 'Hide' : 'View'}</span>
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </div>
            </div>

            {isExpanded && (
                 <div className="p-5 border-t border-white/5 bg-base-300/10 backdrop-blur-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            {/* Action Buttons Area */}
                             <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-4">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Actions</h4>
                                {!isEditing && (
                                    <button onClick={handleEditClick} className="text-xs flex items-center text-brand-light hover:text-white bg-base-300/50 px-2 py-1 rounded border border-white/5 transition-all">
                                        <EditIcon className="h-3 w-3 mr-1"/> Edit
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="flex gap-3">
                                     <button onClick={handleSaveEdit} className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 px-3 rounded-lg shadow-lg transition-colors flex items-center justify-center">
                                        <CheckIcon /> <span className="ml-2">Save</span>
                                     </button>
                                     <button onClick={handleCancelEdit} className="flex-1 bg-base-300 hover:bg-base-200 border border-gray-600 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center">
                                        <CancelIcon /> <span className="ml-2">Cancel</span>
                                     </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {contact.phone && (
                                        <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" className="bg-green-600/90 hover:bg-green-600 text-white font-semibold py-2 px-2 rounded-lg transition-all flex items-center justify-center text-xs shadow-md border border-white/5">
                                            <WhatsAppIcon/> <span className="ml-1.5 hidden sm:inline">WhatsApp</span>
                                        </a>
                                    )}
                                    {contact.phone && (
                                        <a href={`tel:${sanitizedPhone}`} className="bg-blue-600/90 hover:bg-blue-600 text-white font-semibold py-2 px-2 rounded-lg transition-all flex items-center justify-center text-xs shadow-md border border-white/5">
                                            <PhoneIcon/> <span className="ml-1.5 hidden sm:inline">Call</span>
                                        </a>
                                    )}
                                    <button onClick={() => onComposeEmail(contact)} disabled={!contact.email || hasBeenEmailed} className="bg-brand-primary/90 hover:bg-brand-primary text-white font-semibold py-2 px-2 rounded-lg transition-all flex items-center justify-center text-xs shadow-md border border-white/5 disabled:opacity-50 disabled:cursor-not-allowed">
                                        <EmailIcon className="h-4 w-4" /> <span className="ml-1.5 hidden sm:inline">{hasBeenEmailed ? 'Sent' : 'Email'}</span>
                                    </button>
                                    <button onClick={() => onRemoveFromCrm(contact.id)} className="bg-red-600/80 hover:bg-red-600 text-white font-semibold py-2 px-2 rounded-lg transition-all flex items-center justify-center text-xs shadow-md border border-white/5">
                                        <TrashIcon /> <span className="ml-1.5 hidden sm:inline">Delete</span>
                                    </button>
                                </div>
                            )}
                            
                            {!isEditing && (
                            <div className="bg-base-300/30 p-4 rounded-lg border border-white/5 space-y-4">
                                 <div>
                                    <label htmlFor={`status-${contact.id}`} className="block text-xs font-semibold text-gray-400 mb-1.5">Current Status</label>
                                    <select
                                        id={`status-${contact.id}`}
                                        value={contact.status}
                                        onChange={(e) => onUpdateStatus(contact.id, e.target.value as LeadStatus)}
                                        className="w-full bg-base-100 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary cursor-pointer"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                {currentUser?.role === 'admin' && (
                                    <div>
                                    <label htmlFor={`assign-${contact.id}`} className="block text-xs font-semibold text-gray-400 mb-1.5">Assign To User</label>
                                    <select
                                        id={`assign-${contact.id}`}
                                        value={contact.assignedTo || 'unassigned'}
                                        onChange={(e) => onAssignContact(contact.id, e.target.value)}
                                        className="w-full bg-base-100 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary cursor-pointer"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <option value="unassigned">-- Unassigned --</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                    </select>
                                    </div>
                                )}
                            </div>
                            )}
                        </div>

                        <div className="flex flex-col h-full">
                           <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-white/5 pb-2">Details</h4>
                           {isEditing ? (
                               <div className="space-y-3 bg-base-300/50 p-4 rounded-lg border border-white/5">
                                    <div>
                                        <label className="text-xs text-gray-400 font-semibold block mb-1">Phone</label>
                                        <input type="text" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 font-semibold block mb-1">Email</label>
                                        <input type="text" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 font-semibold block mb-1">Website</label>
                                        <input type="text" value={formData.website} onChange={e => handleInputChange('website', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 font-semibold block mb-1">Address</label>
                                        <input type="text" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                    </div>
                               </div>
                           ) : (
                               <div className="space-y-3 mb-6 bg-base-300/20 p-4 rounded-lg border border-white/5">
                                   {contact.phone ? <p className="text-gray-300 flex items-center text-sm"><PhoneIcon className="h-4 w-4 mr-3 text-gray-500"/> {contact.phone}</p> : <p className="text-gray-600 italic text-sm ml-7">No phone</p>}
                                   {contact.email ? <p className="text-gray-300 flex items-center text-sm"><EmailIcon className="h-4 w-4 mr-3 text-gray-500"/> {contact.email}</p> : <p className="text-gray-600 italic text-sm ml-7">No email</p>}
                                   {contact.website ? <a href={getExternalUrl(contact.website)} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:text-white hover:underline flex items-center text-sm"><WebsiteIcon className="h-4 w-4 mr-3 text-gray-500"/> {contact.website}</a> : <p className="text-gray-600 italic text-sm ml-7">No website</p>}
                                   {contact.address ? <p className="text-gray-300 flex items-start text-sm"><LocationIcon className="h-4 w-4 mr-3 text-gray-500 mt-0.5"/> <span>{contact.address}</span></p> : <p className="text-gray-600 italic text-sm ml-7">No address</p>}
                               </div>
                           )}

                           <AddNoteForm onAddNote={(note) => onAddNote(contact.id, note)} />
                        </div>
                    </div>
                    <ActivityLog activities={contact.activities} />
                </div>
            )}
        </li>
    );
};
