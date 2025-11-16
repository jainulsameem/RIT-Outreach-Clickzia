
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
        setIsExpanded(true); // Ensure expanded to see form
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

    return (
        <li className="bg-base-200 rounded-lg shadow-md transition-all duration-300">
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:gap-4 cursor-pointer" onClick={() => !isEditing && setIsExpanded(!isExpanded)}>
                <div className="flex-grow w-full">
                    <div className="flex items-center flex-wrap">
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={formData.name} 
                                onChange={e => handleInputChange('name', e.target.value)}
                                className="text-xl font-bold text-white bg-base-300 border border-gray-600 rounded px-2 py-1 mr-2 w-full sm:w-auto"
                                onClick={e => e.stopPropagation()}
                            />
                        ) : (
                            <h3 className="text-xl font-bold text-white mr-2">{contact.name}</h3>
                        )}
                        {!isEditing && <LeadStatusBadge status={contact.status} />}
                    </div>
                     <div className="flex items-center text-sm text-gray-400 mt-1">
                        <UserIcon className="h-4 w-4 mr-1" />
                        <span>{assignedUser ? `Assigned to ${assignedUser.username}` : 'Unassigned'}</span>
                    </div>
                </div>
                 <div className="flex items-center text-gray-400">
                    <span>{isExpanded ? 'Less' : 'Details'}</span>
                    {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </div>
            </div>

            {isExpanded && (
                 <div className="p-4 border-t border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-lg font-semibold text-white">Contact Actions</h4>
                                {!isEditing && (
                                    <button onClick={handleEditClick} className="text-xs flex items-center text-brand-light hover:text-white bg-base-300 px-2 py-1 rounded">
                                        <EditIcon className="h-4 w-4 mr-1"/> Edit Info
                                    </button>
                                )}
                            </div>
                            
                            {isEditing ? (
                                <div className="flex flex-col gap-4 mt-4">
                                     <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center">
                                        <CheckIcon /> <span className="ml-2">Save Changes</span>
                                     </button>
                                     <button onClick={handleCancelEdit} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center">
                                        <CancelIcon /> <span className="ml-2">Cancel</span>
                                     </button>
                                </div>
                            ) : (
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
                            )}
                            
                            {!isEditing && (
                            <>
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
                            </>
                            )}
                        </div>
                        <div>
                           <h4 className="text-lg font-semibold text-white mb-2">Contact Info</h4>
                           {isEditing ? (
                               <div className="space-y-3 bg-base-300 p-3 rounded-md">
                                    <div>
                                        <label className="text-xs text-gray-400 block">Phone</label>
                                        <input type="text" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} className="w-full bg-base-200 border border-gray-600 rounded px-2 py-1 text-white"/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block">Email</label>
                                        <input type="text" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} className="w-full bg-base-200 border border-gray-600 rounded px-2 py-1 text-white"/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block">Website</label>
                                        <input type="text" value={formData.website} onChange={e => handleInputChange('website', e.target.value)} className="w-full bg-base-200 border border-gray-600 rounded px-2 py-1 text-white"/>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 block">Address</label>
                                        <input type="text" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} className="w-full bg-base-200 border border-gray-600 rounded px-2 py-1 text-white"/>
                                    </div>
                               </div>
                           ) : (
                               <div className="space-y-2 mb-4">
                                   {contact.phone && <p className="text-gray-300 flex items-center"><PhoneIcon className="h-4 w-4 mr-2"/> {contact.phone}</p>}
                                   {contact.email && <p className="text-gray-300 flex items-center"><EmailIcon className="h-4 w-4 mr-2"/> {contact.email}</p>}
                                   {contact.website && <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:text-white hover:underline flex items-center"><WebsiteIcon className="h-4 w-4 mr-2"/> Visit Website</a>}
                                   {contact.address && <p className="text-gray-300 flex items-start"><LocationIcon className="h-4 w-4 mr-2 mt-1"/> <span>{contact.address}</span></p>}
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
