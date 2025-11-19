
import React from 'react';
import type { Business } from '../types';
import { EmailIcon, PhoneIcon, WebsiteIcon, LocationIcon, AddToCrmIcon, FacebookIcon, LinkedInIcon } from './icons';

interface BusinessListItemProps {
    business: Business;
    onComposeEmail: (business: Business) => void;
    hasBeenEmailed: boolean;
    onAddToCrm: (business: Business) => void;
    isInCrm: boolean;
}

const ProfileStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status || status === 'unknown') {
        return <span className="ml-3 text-[10px] font-bold tracking-wider py-0.5 px-2 uppercase rounded-full text-gray-500 bg-gray-100 border border-gray-200">Unknown</span>;
    }
    
    const isClaimed = status === 'claimed';
    const classes = isClaimed 
        ? 'text-green-700 bg-green-100 border-green-200'
        : 'text-amber-700 bg-amber-100 border-amber-200';

    return <span className={`ml-3 text-[10px] font-bold tracking-wider py-0.5 px-2 uppercase rounded-full border ${classes}`}>{status}</span>;
}

export const BusinessListItem: React.FC<BusinessListItemProps> = ({ business, onComposeEmail, hasBeenEmailed, onAddToCrm, isInCrm }) => {
    const sanitizedPhone = business.phone ? business.phone.replace(/[^0-9+]/g, '') : '';
    
    const getExternalUrl = (url: string) => {
        if (!url) return '';
        return url.startsWith('http') ? url : `https://${url}`;
    };

    return (
        <li className="group bg-white border border-gray-100 p-5 rounded-xl shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all duration-300 relative overflow-hidden">
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-white to-white opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none"></div>

            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:gap-6">
                <div className="flex-grow min-w-0">
                    <div className="flex items-center mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900 truncate pr-2 flex items-center gap-2">
                            {business.name}
                             {business.source === 'facebook' && <FacebookIcon className="h-4 w-4 text-blue-600" />}
                             {business.source === 'linkedin' && <LinkedInIcon className="h-4 w-4 text-[#0a66c2]" />}
                        </h3>
                        {business.source !== 'facebook' && business.source !== 'linkedin' && <ProfileStatusBadge status={business.profileStatus} />}
                    </div>
                    
                    {/* Decision Maker Info */}
                    {business.contactName && (
                        <div className="mb-3 flex items-center space-x-2 text-indigo-700 font-medium bg-indigo-50 w-fit px-2 py-1 rounded border border-indigo-100">
                            <span className="text-sm">👤 {business.contactName}</span>
                            {business.contactRole && <span className="text-xs text-gray-500">• {business.contactRole}</span>}
                        </div>
                    )}

                    {business.address && (
                        <p className="text-gray-500 text-sm flex items-center mb-3">
                            <LocationIcon className="text-gray-400" /> <span className="ml-1.5 truncate">{business.address}</span>
                        </p>
                    )}
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-2">
                        {business.phone && (
                            <p className="text-gray-600 flex items-center bg-gray-50 px-2 py-1 rounded-md border border-gray-200">
                                <PhoneIcon className="text-gray-400" /> <span className="ml-2 font-mono text-xs sm:text-sm">{business.phone}</span>
                            </p>
                        )}
                        {business.website && (
                            <a href={getExternalUrl(business.website)} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 transition-colors">
                                <WebsiteIcon /> <span className="ml-2">Website</span>
                            </a>
                        )}
                        {business.linkedinUrl && (
                             <a href={getExternalUrl(business.linkedinUrl)} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:text-[#004182] hover:underline flex items-center bg-[#0a66c2]/10 px-2 py-1 rounded-md border border-[#0a66c2]/20 transition-colors">
                                <LinkedInIcon className="h-4 w-4" /> <span className="ml-2">LinkedIn</span>
                            </a>
                        )}
                    </div>
                </div>
                
                <div className="flex-shrink-0 w-full sm:w-auto flex flex-row gap-2 pt-2 sm:pt-0">
                     <button
                        onClick={() => onAddToCrm(business)}
                        disabled={isInCrm}
                        className={`flex-1 sm:flex-none py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center shadow-sm ${isInCrm ? 'bg-gray-100 text-gray-400 cursor-default border border-gray-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}
                        aria-label={isInCrm ? `${business.name} is in CRM` : `Add ${business.name} to CRM`}
                    >
                        <AddToCrmIcon /> <span className="ml-2">{isInCrm ? 'Added' : 'Save'}</span>
                    </button>
                    <button
                        onClick={() => onComposeEmail(business)}
                        disabled={!business.email || hasBeenEmailed}
                        className="flex-1 sm:flex-none bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center hover:shadow-sm"
                    >
                        <EmailIcon /> <span className="ml-2">{hasBeenEmailed ? 'Sent' : 'Email'}</span>
                    </button>
                </div>
            </div>
        </li>
    );
};
