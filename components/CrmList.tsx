
import React, { useState } from 'react';
import type { CrmContact, LeadStatus, User, SearchSource } from '../types';
import { PhoneIcon, EmailIcon, UserIcon, LocationIcon, LinkedInIcon, FacebookIcon, CustomSourceIcon, ChevronLeftIcon, ChevronRightIcon, WebsiteIcon } from './icons';

interface CrmListProps {
    contacts: CrmContact[];
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

const SourceIcon: React.FC<{ source?: SearchSource }> = ({ source }) => {
    if (!source) return <LocationIcon className="h-4 w-4 text-green-400" title="Google Maps" />;
    switch(source) {
        case 'facebook': 
            return <FacebookIcon className="h-4 w-4 text-blue-400" title="Facebook" />;
        case 'linkedin':
            return <LinkedInIcon className="h-4 w-4 text-[#0a66c2]" title="LinkedIn" />;
        case 'custom':
             return <CustomSourceIcon className="h-4 w-4 text-purple-400" title="Manual" />;
        case 'google':
        default:
             return <LocationIcon className="h-4 w-4 text-green-400" title="Google Maps" />;
    }
};

export const CrmList: React.FC<CrmListProps> = ({ contacts, onViewDetails, users }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    if (contacts.length === 0) {
        return (
            <div className="text-center py-10 px-4 glass-panel rounded-xl border border-white/10">
                <h2 className="text-2xl font-semibold text-white">No Matching Contacts</h2>
                <p className="text-gray-400 mt-2">Try adjusting your filters or add new prospects from search results.</p>
            </div>
        );
    }

    // Pagination Logic
    const totalPages = Math.ceil(contacts.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = contacts.slice(startIndex, endIndex);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1); // Reset to first page
    };

    const getExternalUrl = (url: string) => {
        if (!url) return '';
        return url.startsWith('http') ? url : `https://${url}`;
    };

    return (
        <div className="space-y-4">
            <div className="glass-panel rounded-xl border border-white/5 overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-base-300/50 text-gray-400 text-xs uppercase tracking-wider font-semibold border-b border-gray-700">
                                <th className="p-4">Business / Source</th>
                                <th className="p-4">Contact Person</th>
                                <th className="p-4">Details</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Assigned To</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-800">
                            {currentItems.map(contact => {
                                const assignedUser = users.find(u => u.id === contact.assignedTo);
                                return (
                                    <tr 
                                        key={contact.id} 
                                        onClick={() => onViewDetails(contact.id)}
                                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-base-300/50 border border-white/5">
                                                    <SourceIcon source={contact.source} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white text-base truncate max-w-[180px]" title={contact.name}>{contact.name}</p>
                                                    <p className="text-xs text-gray-500 truncate max-w-[180px]">{contact.address || 'No address'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {contact.contactName ? (
                                                <div>
                                                    <p className="text-brand-light font-medium">{contact.contactName}</p>
                                                    <p className="text-xs text-gray-500">{contact.contactRole || 'Unknown Role'}</p>
                                                </div>
                                            ) : (
                                                <span className="text-gray-600 text-xs italic">Not specified</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                {contact.email && (
                                                    <div className="flex items-center text-gray-400 text-xs">
                                                        <EmailIcon className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                                        <span className="truncate max-w-[150px]" title={contact.email}>{contact.email}</span>
                                                    </div>
                                                )}
                                                {contact.phone && (
                                                    <div className="flex items-center text-gray-400 text-xs">
                                                        <PhoneIcon className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                                        <span className="truncate max-w-[150px]">{contact.phone}</span>
                                                    </div>
                                                )}
                                                 {contact.website && (
                                                    <div className="flex items-center text-gray-400 text-xs">
                                                        <WebsiteIcon className="h-3 w-3 mr-1.5 flex-shrink-0" />
                                                         <a 
                                                            href={getExternalUrl(contact.website)} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="truncate max-w-[150px] hover:text-brand-light hover:underline"
                                                         >
                                                            Website
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[10px] font-bold tracking-wider py-1 px-2.5 uppercase rounded-full border ${statusColors[contact.status]}`}>
                                                {contact.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center text-gray-400">
                                                <UserIcon className="h-3 w-3 mr-2" />
                                                <span>{assignedUser ? assignedUser.username : 'Unassigned'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                             <span className="text-xs font-semibold text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                                View &rarr;
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-base-200 p-4 rounded-xl shadow-md">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">Rows per page:</span>
                    <select 
                        value={itemsPerPage} 
                        onChange={handleItemsPerPageChange} 
                        className="bg-base-300 border border-gray-600 rounded-lg px-2 py-1 text-sm text-white focus:ring-2 focus:ring-brand-primary"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
                
                <div className="text-sm text-gray-400">
                    Showing <span className="text-white font-medium">{startIndex + 1}</span> to <span className="text-white font-medium">{Math.min(endIndex, contacts.length)}</span> of <span className="text-white font-medium">{contacts.length}</span> entries
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handlePageChange(currentPage - 1)} 
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-base-300 border border-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-base-100 hover:border-gray-500 transition-all"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium text-white px-2">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        onClick={() => handlePageChange(currentPage + 1)} 
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-base-300 border border-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-base-100 hover:border-gray-500 transition-all"
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
