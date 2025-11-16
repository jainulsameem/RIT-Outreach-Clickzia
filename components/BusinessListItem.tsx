
import React from 'react';
import type { Business } from '../types';
import { EmailIcon, PhoneIcon, WebsiteIcon, LocationIcon, AddToCrmIcon, FacebookIcon } from './icons';

interface BusinessListItemProps {
    business: Business;
    onComposeEmail: (business: Business) => void;
    hasBeenEmailed: boolean;
    onAddToCrm: (business: Business) => void;
    isInCrm: boolean;
}

const ProfileStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status || status === 'unknown') {
        return <span className="ml-3 text-[10px] font-bold tracking-wider py-0.5 px-2 uppercase rounded-full text-gray-400 bg-gray-800 border border-gray-600">Unknown</span>;
    }
    
    const isClaimed = status === 'claimed';
    const classes = isClaimed 
        ? 'text-green-300 bg-green-900/40 border-green-500/50'
        : 'text-yellow-300 bg-yellow-900/40 border-yellow-500/50';

    return <span className={`ml-3 text-[10px] font-bold tracking-wider py-0.5 px-2 uppercase rounded-full border ${classes}`}>{status}</span>;
}

export const BusinessListItem: React.FC<BusinessListItemProps> = ({ business, onComposeEmail, hasBeenEmailed, onAddToCrm, isInCrm }) => {
    const sanitizedPhone = business.phone ? business.phone.replace(/[^0-9+]/g, '') : '';
    
    const getExternalUrl = (url: string) => {
        if (!url) return '';
        return url.startsWith('http') ? url : `https://${url}`;
    };

    return (
        <li className="group bg-card-gradient border border-white/5 p-5 rounded-xl shadow-lg hover:shadow-brand-primary/10 transition-all duration-300 hover:border-brand-primary/30 relative overflow-hidden">
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/0 via-brand-primary/5 to-brand-secondary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:gap-6">
                <div className="flex-grow min-w-0">
                    <div className="flex items-center mb-1">
                        <h3 className="text-lg font-bold text-white truncate pr-2 flex items-center gap-2">
                            {business.name}
                             {business.source === 'facebook' && <FacebookIcon className="h-4 w-4 text-blue-400" />}
                        </h3>
                        {business.source !== 'facebook' && <ProfileStatusBadge status={business.profileStatus} />}
                    </div>
                    
                    {business.address && (
                        <p className="text-gray-400 text-sm flex items-center mb-3">
                            <LocationIcon /> <span className="ml-1.5 truncate">{business.address}</span>
                        </p>
                    )}
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mt-2">
                        {business.phone && (
                            <p className="text-gray-300 flex items-center bg-base-300/50 px-2 py-1 rounded-md border border-white/5">
                                <PhoneIcon /> <span className="ml-2 font-mono text-xs sm:text-sm">{business.phone}</span>
                            </p>
                        )}
                        {business.website && (
                            <a href={getExternalUrl(business.website)} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:text-white hover:underline flex items-center bg-brand-primary/10 px-2 py-1 rounded-md border border-brand-primary/20 transition-colors">
                                <WebsiteIcon /> <span className="ml-2">Website</span>
                            </a>
                        )}
                    </div>
                </div>
                
                <div className="flex-shrink-0 w-full sm:w-auto flex flex-row gap-2 pt-2 sm:pt-0">
                     <button
                        onClick={() => onAddToCrm(business)}
                        disabled={isInCrm}
                        className={`flex-1 sm:flex-none py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center shadow-lg ${isInCrm ? 'bg-gray-700 text-gray-400 cursor-default' : 'bg-brand-primary hover:bg-brand-secondary text-white shadow-brand-primary/20'}`}
                        aria-label={isInCrm ? `${business.name} is in CRM` : `Add ${business.name} to CRM`}
                    >
                        <AddToCrmIcon /> <span className="ml-2">{isInCrm ? 'Added' : 'Save'}</span>
                    </button>
                    <button
                        onClick={() => onComposeEmail(business)}
                        disabled={!business.email || hasBeenEmailed}
                        className="flex-1 sm:flex-none bg-base-200 hover:bg-base-300 border border-white/10 text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        <EmailIcon /> <span className="ml-2">{hasBeenEmailed ? 'Sent' : 'Email'}</span>
                    </button>
                </div>
            </div>
        </li>
    );
};
