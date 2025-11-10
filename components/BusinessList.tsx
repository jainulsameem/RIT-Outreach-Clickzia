import React from 'react';
import type { Business } from '../types';
import { BusinessListItem } from './BusinessListItem';

interface BusinessListProps {
    businesses: Business[];
    onComposeEmail: (business: Business) => void;
    emailedBusinessIds: string[];
    onAddToCrm: (business: Business) => void;
    crmContactIds: string[];
}

export const BusinessList: React.FC<BusinessListProps> = ({ businesses, onComposeEmail, emailedBusinessIds, onAddToCrm, crmContactIds }) => {
    if (businesses.length === 0) {
        return (
            <div className="text-center py-10 px-4">
                <h2 className="text-2xl font-semibold text-white">Ready to Find Prospects?</h2>
                <p className="text-gray-400 mt-2">Use the search bar above to find local businesses to reach out to.</p>
            </div>
        );
    }
    return (
        <ul className="space-y-4">
            {businesses.map(business => (
                <BusinessListItem
                    key={business.id}
                    business={business}
                    onComposeEmail={onComposeEmail}
                    hasBeenEmailed={emailedBusinessIds.includes(business.id)}
                    onAddToCrm={onAddToCrm}
                    isInCrm={crmContactIds.includes(business.id)}
                />
            ))}
        </ul>
    );
};
