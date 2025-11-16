
import React from 'react';
import type { CrmContact, LeadStatus, User, SearchSource } from '../types';
import { PhoneIcon, EmailIcon, UserIcon, LocationIcon, LinkedInIcon, FacebookIcon, CustomSourceIcon } from './icons';

interface CrmListItemProps {
    contact: CrmContact;
    onViewDetails: (contactId: string) => void;
    currentUser: User | null;
    users: User[];
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
    <span className={`text-[10px] font-bold tracking-wider py-1 px-2.5 uppercase rounded-full border ${statusColors[status]}`}>{status}</span>
);

const SourceBadge: React.FC<{ source?: SearchSource }> = ({ source }) => {
    if (!source) return null;
    switch(source) {
        case 'facebook': 
            return <span className="bg-blue-600/20 text-blue-400 p-1 rounded border border-blue-600/30" title="Source: Facebook"><FacebookIcon className="h-3 w-3" /></span>;
        case 'linkedin':
            return <span className="bg-[#0a66c2]/20 text-[#0a66c2] p-1 rounded border border-[#0a66c2]/30" title="Source: LinkedIn"><LinkedInIcon className="h-3 w-3" /></span>;
        case 'custom':
             return <span className="bg-purple-600/20 text-purple-400 p-1 rounded border border-purple-600/30" title="Source: Manual"><CustomSourceIcon className="h-3 w-3" /></span>;
        case 'google':
        default:
             return <span className="bg-green-600/20 text-green-400 p-1 rounded border border-green-600/30" title="Source: Google Maps"><LocationIcon className="h-3 w-3" /></span>;
    }
};

export const CrmListItem: React.FC<CrmListItemProps> = ({ contact, onViewDetails, users }) => {
    const assignedUser = users.find(u => u.id === contact.assignedTo);

    return (
        <div 
            onClick={() => onViewDetails(contact.id)}
            className="glass-panel border border-white/5 rounded-xl p-5 hover:border-brand-primary/40 hover:shadow-lg hover:shadow-brand-primary/10 transition-all duration-300 cursor-pointer group flex flex-col h-full relative overflow-hidden"
        >
            {/* Hover Effect Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

            <div className="flex justify-between items-start mb-3 relative z-10">
                <div className="flex items-center gap-2 overflow-hidden">
                    <SourceBadge source={contact.source || 'google'} />
                    <h3 className="text-lg font-bold text-white group-hover:text-brand-light transition-colors truncate">{contact.name}</h3>
                </div>
                <LeadStatusBadge status={contact.status} />
            </div>

            <div className="space-y-2 mb-4 flex-grow relative z-10">
                 {contact.contactName && (
                    <p className="text-sm text-brand-light font-medium flex items-center">
                        👤 {contact.contactName} 
                    </p>
                )}
                {contact.address && (
                    <p className="text-xs text-gray-400 flex items-start truncate">
                         <LocationIcon className="h-3 w-3 mr-1.5 mt-0.5 flex-shrink-0" /> <span className="truncate">{contact.address}</span>
                    </p>
                )}
                <div className="flex gap-3 mt-1">
                    {contact.phone ? <PhoneIcon className="h-4 w-4 text-gray-500" /> : <PhoneIcon className="h-4 w-4 text-gray-700 opacity-50" />}
                    {contact.email ? <EmailIcon className="h-4 w-4 text-gray-500" /> : <EmailIcon className="h-4 w-4 text-gray-700 opacity-50" />}
                    {contact.linkedinUrl ? <LinkedInIcon className="h-4 w-4 text-[#0a66c2]" /> : <LinkedInIcon className="h-4 w-4 text-gray-700 opacity-50" />}
                </div>
            </div>

            <div className="pt-3 border-t border-white/5 flex justify-between items-center relative z-10">
                 <div className="flex items-center text-xs text-gray-500">
                    <UserIcon className="h-3 w-3 mr-1.5" />
                    <span>{assignedUser ? assignedUser.username : 'Unassigned'}</span>
                </div>
                <span className="text-xs font-semibold text-brand-primary group-hover:translate-x-1 transition-transform">
                    View Details &rarr;
                </span>
            </div>
        </div>
    );
};
