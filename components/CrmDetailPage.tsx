
import React, { useState, useEffect } from 'react';
import type { CrmContact, LeadStatus, Activity, Business, User } from '../types';
import { leadStatuses } from '../types';
import { EmailIcon, PhoneIcon, WebsiteIcon, WhatsAppIcon, TrashIcon, NoteIcon, StatusChangeIcon, CreatedIcon, UserIcon, AssignUserIcon, EditIcon, CheckIcon, CancelIcon, LocationIcon, LinkedInIcon, ArrowLeftIcon, FacebookIcon, CustomSourceIcon } from './icons';

interface CrmDetailPageProps {
    contact: CrmContact;
    onBack: () => void;
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
                rows={3}
            />
            <div className="flex justify-end mt-2">
                <button type="submit" className="bg-brand-surface border border-gray-600 hover:bg-brand-primary hover:border-brand-primary text-white text-xs font-bold py-1.5 px-3 rounded transition-all disabled:opacity-50" disabled={!note.trim()}>
                    Save Note
                </button>
            </div>
        </form>
    );
};

export const CrmDetailPage: React.FC<CrmDetailPageProps> = ({ contact, onBack, onComposeEmail, hasBeenEmailed, onRemoveFromCrm, onUpdateStatus, onAddNote, users, currentUser, onAssignContact, onUpdateContactDetails }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: contact.name,
        phone: contact.phone || '',
        email: contact.email || '',
        website: contact.website || '',
        address: contact.address || '',
        contactName: contact.contactName || '',
        contactRole: contact.contactRole || '',
        linkedinUrl: contact.linkedinUrl || '',
        customSourceDetails: contact.customSourceDetails || ''
    });

    // Sync form data if contact changes externally
    useEffect(() => {
        setFormData({
            name: contact.name,
            phone: contact.phone || '',
            email: contact.email || '',
            website: contact.website || '',
            address: contact.address || '',
            contactName: contact.contactName || '',
            contactRole: contact.contactRole || '',
            linkedinUrl: contact.linkedinUrl || '',
            customSourceDetails: contact.customSourceDetails || ''
        });
    }, [contact]);

    const sanitizedPhone = contact.phone ? contact.phone.replace(/[^0-9+]/g, '') : '';
    const assignedUser = users.find(u => u.id === contact.assignedTo);

    const handleSaveEdit = () => {
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
    
    const getSourceIcon = (source: string = 'google') => {
         switch(source) {
             case 'facebook': return <FacebookIcon className="h-4 w-4 text-blue-400" />;
             case 'linkedin': return <LinkedInIcon className="h-4 w-4 text-[#0a66c2]" />;
             case 'custom': return <CustomSourceIcon className="h-4 w-4 text-purple-400" />;
             default: return <LocationIcon className="h-4 w-4 text-green-400" />;
         }
    };
    
    const getSourceLabel = (source: string = 'google') => {
         switch(source) {
             case 'facebook': return 'Facebook';
             case 'linkedin': return 'LinkedIn Search';
             case 'custom': return 'Manual Entry';
             default: return 'Google Maps';
         }
    };

    return (
        <div className="animate-fadeIn pb-10">
            <button onClick={onBack} className="mb-6 flex items-center text-gray-400 hover:text-white transition-colors group">
                <div className="bg-base-200 p-2 rounded-full mr-2 group-hover:bg-base-300 transition-colors">
                    <ArrowLeftIcon />
                </div>
                <span className="font-semibold">Back to List</span>
            </button>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main Info Column */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Header Card */}
                    <div className="glass-panel p-6 rounded-xl border border-white/10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                             <div className="flex-grow">
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        value={formData.name} 
                                        onChange={e => handleInputChange('name', e.target.value)}
                                        className="text-2xl font-bold text-white bg-base-300 border border-gray-500 rounded px-3 py-2 w-full"
                                    />
                                ) : (
                                    <h1 className="text-3xl font-bold text-white">{contact.name}</h1>
                                )}
                                {!isEditing && (
                                    <div className="flex flex-wrap items-center gap-3 mt-2">
                                         <span className={`text-xs font-bold tracking-wider py-1 px-2.5 uppercase rounded-full border ${statusColors[contact.status]}`}>{contact.status}</span>
                                         <span className="flex items-center gap-1.5 px-2 py-1 bg-base-300/50 rounded border border-white/5 text-xs text-gray-300">
                                            {getSourceIcon(contact.source)}
                                            {getSourceLabel(contact.source)}
                                         </span>
                                         <span className="text-sm text-gray-400 border-l border-gray-600 pl-3">Added {new Date(contact.activities[contact.activities.length - 1]?.timestamp).toLocaleDateString()}</span>
                                    </div>
                                )}
                             </div>
                             
                             <div className="flex gap-2 self-end md:self-center">
                                 {isEditing ? (
                                     <>
                                        <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all flex items-center">
                                            <CheckIcon /> <span className="ml-2">Save</span>
                                        </button>
                                        <button onClick={() => setIsEditing(false)} className="bg-base-300 hover:bg-base-200 border border-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center">
                                            <CancelIcon /> <span className="ml-2">Cancel</span>
                                        </button>
                                     </>
                                 ) : (
                                     <button onClick={() => setIsEditing(true)} className="bg-base-300/50 hover:bg-brand-primary/20 border border-white/10 text-white font-semibold py-2 px-4 rounded-lg transition-all flex items-center hover:border-brand-primary/50">
                                         <EditIcon /> <span className="ml-2">Edit Details</span>
                                     </button>
                                 )}
                             </div>
                        </div>

                        {/* Contact Details Grid */}
                        {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-300/30 p-4 rounded-lg border border-white/5">
                                <div>
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">Contact Name</label>
                                    <input type="text" value={formData.contactName} onChange={e => handleInputChange('contactName', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">Contact Role</label>
                                    <input type="text" value={formData.contactRole} onChange={e => handleInputChange('contactRole', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">Phone</label>
                                    <input type="text" value={formData.phone} onChange={e => handleInputChange('phone', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">Email</label>
                                    <input type="text" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">Address</label>
                                    <input type="text" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">Website</label>
                                    <input type="text" value={formData.website} onChange={e => handleInputChange('website', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">LinkedIn URL</label>
                                    <input type="text" value={formData.linkedinUrl} onChange={e => handleInputChange('linkedinUrl', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-gray-400 font-semibold block mb-1">Source Details (for Manual leads)</label>
                                    <input type="text" value={formData.customSourceDetails} onChange={e => handleInputChange('customSourceDetails', e.target.value)} className="w-full bg-base-100 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:ring-1 focus:ring-brand-primary"/>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    {contact.contactName && (
                                        <div className="bg-brand-primary/10 px-3 py-1.5 rounded-lg border border-brand-primary/20 flex items-center">
                                             <span className="text-sm font-medium text-brand-light">👤 {contact.contactName}</span>
                                             {contact.contactRole && <span className="ml-2 text-xs text-gray-400 border-l border-gray-600 pl-2">{contact.contactRole}</span>}
                                        </div>
                                    )}
                                    <div className="bg-base-300/30 px-3 py-1.5 rounded-lg border border-white/5 flex items-center text-gray-400 text-sm">
                                        <UserIcon className="h-3 w-3 mr-2" />
                                        Owner: {assignedUser ? assignedUser.username : 'Unassigned'}
                                    </div>
                                </div>
                                
                                {contact.customSourceDetails && (
                                     <div className="bg-purple-900/20 px-3 py-2 rounded-lg border border-purple-500/20 text-sm text-purple-200">
                                        <span className="font-bold text-xs uppercase text-purple-400 mr-2">Source Details:</span>
                                        {contact.customSourceDetails}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-300/20 p-5 rounded-lg border border-white/5">
                                    <div className="space-y-3">
                                        <p className="text-gray-400 text-xs uppercase tracking-wider font-bold">Contact Info</p>
                                        {contact.phone ? <p className="text-gray-200 flex items-center"><PhoneIcon className="h-4 w-4 mr-3 text-gray-500"/> {contact.phone}</p> : <p className="text-gray-600 italic text-sm flex items-center"><PhoneIcon className="h-4 w-4 mr-3 opacity-30"/> No phone</p>}
                                        {contact.email ? <p className="text-gray-200 flex items-center"><EmailIcon className="h-4 w-4 mr-3 text-gray-500"/> {contact.email}</p> : <p className="text-gray-600 italic text-sm flex items-center"><EmailIcon className="h-4 w-4 mr-3 opacity-30"/> No email</p>}
                                        {contact.address ? <p className="text-gray-200 flex items-start"><LocationIcon className="h-4 w-4 mr-3 text-gray-500 mt-0.5"/> {contact.address}</p> : <p className="text-gray-600 italic text-sm flex items-center"><LocationIcon className="h-4 w-4 mr-3 opacity-30"/> No address</p>}
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-gray-400 text-xs uppercase tracking-wider font-bold">Web Presence</p>
                                        {contact.website ? (
                                            <a href={getExternalUrl(contact.website)} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:text-white hover:underline flex items-center truncate">
                                                <WebsiteIcon className="h-4 w-4 mr-3 text-gray-500 flex-shrink-0"/> {contact.website}
                                            </a>
                                        ) : <p className="text-gray-600 italic text-sm flex items-center"><WebsiteIcon className="h-4 w-4 mr-3 opacity-30"/> No website</p>}
                                        
                                        {contact.linkedinUrl ? (
                                            <a href={getExternalUrl(contact.linkedinUrl)} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:text-white hover:underline flex items-center truncate">
                                                <LinkedInIcon className="h-4 w-4 mr-3 flex-shrink-0"/> LinkedIn Profile
                                            </a>
                                        ) : <p className="text-gray-600 italic text-sm flex items-center"><LinkedInIcon className="h-4 w-4 mr-3 opacity-30"/> No LinkedIn</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Activity Log */}
                    <div className="glass-panel p-6 rounded-xl border border-white/10 h-[500px] flex flex-col">
                         <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <NoteIcon className="text-brand-secondary" /> Activity History
                        </h3>
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-6">
                            {contact.activities.map((activity, index) => (
                                <div key={activity.id} className="relative pl-6 border-l border-gray-700">
                                     <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-base-200 border-2 border-brand-primary flex items-center justify-center">
                                        <div className="h-1.5 w-1.5 rounded-full bg-brand-primary"></div>
                                     </div>
                                     <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-400 uppercase">{activity.type.replace('_', ' ')}</span>
                                            <span className="text-[10px] text-gray-500 font-mono">{new Date(activity.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div className="bg-base-300/30 p-3 rounded-lg border border-white/5">
                                            <div className="flex items-start gap-2">
                                                <div className="mt-0.5 opacity-70"><ActivityIcon type={activity.type} /></div>
                                                <p className="text-sm text-gray-300 whitespace-pre-wrap">{activity.content}</p>
                                            </div>
                                        </div>
                                     </div>
                                </div>
                            ))}
                        </div>
                        <div className="pt-4 border-t border-white/10">
                             <AddNoteForm onAddNote={(note) => onAddNote(contact.id, note)} />
                        </div>
                    </div>
                </div>

                {/* Sidebar Actions */}
                <div className="space-y-6">
                    <div className="glass-panel p-6 rounded-xl border border-white/10 sticky top-24">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
                        
                        <div className="space-y-3">
                             <button onClick={() => onComposeEmail(contact)} disabled={!contact.email || hasBeenEmailed} className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-brand-primary/20 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                                <EmailIcon /> <span className="ml-2">{hasBeenEmailed ? 'Email Sent' : 'Send Email'}</span>
                            </button>
                            
                            {contact.phone && (
                                <div className="grid grid-cols-2 gap-3">
                                    <a href={`tel:${sanitizedPhone}`} className="bg-base-300 hover:bg-base-200 border border-white/10 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center">
                                        <PhoneIcon /> <span className="ml-2">Call</span>
                                    </a>
                                    <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" className="bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/30 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center">
                                        <WhatsAppIcon /> <span className="ml-2">Chat</span>
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 space-y-4">
                             <div>
                                <label htmlFor="status-select" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pipeline Status</label>
                                <div className="relative">
                                    <select
                                        id="status-select"
                                        value={contact.status}
                                        onChange={(e) => onUpdateStatus(contact.id, e.target.value as LeadStatus)}
                                        className="w-full bg-base-300 border border-gray-600 rounded-xl px-4 py-3 text-white appearance-none focus:ring-2 focus:ring-brand-primary cursor-pointer hover:bg-base-300/80 transition-all"
                                    >
                                        {leadStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                     <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            {currentUser?.role === 'admin' && (
                                <div>
                                    <label htmlFor="assignee-select" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Assigned Agent</label>
                                    <div className="relative">
                                        <select
                                            id="assignee-select"
                                            value={contact.assignedTo || 'unassigned'}
                                            onChange={(e) => onAssignContact(contact.id, e.target.value)}
                                            className="w-full bg-base-300 border border-gray-600 rounded-xl px-4 py-3 text-white appearance-none focus:ring-2 focus:ring-brand-primary cursor-pointer hover:bg-base-300/80 transition-all"
                                        >
                                            <option value="unassigned">-- Unassigned --</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/10">
                             <button onClick={() => onRemoveFromCrm(contact.id)} className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center">
                                <TrashIcon /> <span className="ml-2">Delete Contact</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
