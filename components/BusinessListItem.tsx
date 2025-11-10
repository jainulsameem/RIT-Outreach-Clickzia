import React from 'react';
import type { Business } from '../types';
import { EmailIcon, PhoneIcon, WebsiteIcon, LocationIcon, WhatsAppIcon, AddToCrmIcon, FacebookIcon } from './icons';

interface BusinessListItemProps {
    business: Business;
    onComposeEmail: (business: Business) => void;
    hasBeenEmailed: boolean;
    onAddToCrm: (business: Business) => void;
    isInCrm: boolean;
}

const ProfileStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
    if (!status || status === 'unknown') {
        return <span className="ml-2 text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-gray-300 bg-gray-600 last:mr-0 mr-1">Unknown</span>;
    }
    
    const isClaimed = status === 'claimed';
    const colorClasses = isClaimed 
        ? 'text-green-200 bg-green-800'
        : 'text-yellow-200 bg-yellow-800';

    return <span className={`ml-2 text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${colorClasses} last:mr-0 mr-1`}>{status}</span>;
}

export const BusinessListItem: React.FC<BusinessListItemProps> = ({ business, onComposeEmail, hasBeenEmailed, onAddToCrm, isInCrm }) => {
    const sanitizedPhone = business.phone ? business.phone.replace(/[^0-9+]/g, '') : '';
    
    return (
        <li className="bg-base-200 p-4 rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:gap-4">
            <div className="flex-grow">
                <div className="flex items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {business.name}
                        {business.source === 'facebook' && <FacebookIcon className="h-4 w-4 text-blue-400" />}
                    </h3>
                    {business.source !== 'facebook' && <ProfileStatusBadge status={business.profileStatus} />}
                </div>
                {business.address && (
                    <p className="text-gray-400 mt-1 flex items-center">
                        <LocationIcon /> <span className="ml-2">{business.address}</span>
                    </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm">
                    {business.phone && (
                        <p className="text-gray-300 flex items-center">
                            <PhoneIcon /> <span className="ml-2">{business.phone}</span>
                        </p>
                    )}
                    {business.website && (
                        <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:text-white hover:underline flex items-center">
                            <WebsiteIcon /> <span className="ml-2">Visit Website</span>
                        </a>
                    )}
                </div>
            </div>
            <div className="flex-shrink-0 w-full sm:w-auto flex flex-col sm:flex-row sm:items-center gap-2">
                 <button
                    onClick={() => onAddToCrm(business)}
                    disabled={isInCrm}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label={isInCrm ? `${business.name} is in CRM` : `Add ${business.name} to CRM`}
                >
                    <AddToCrmIcon /> <span className="ml-2">{isInCrm ? 'In CRM' : 'Add to CRM'}</span>
                </button>
                <button
                    onClick={() => onComposeEmail(business)}
                    disabled={!business.email || hasBeenEmailed}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <EmailIcon /> <span className="ml-2">{hasBeenEmailed ? 'Emailed' : 'Email'}</span>
                </button>
            </div>
        </li>
    );
};
