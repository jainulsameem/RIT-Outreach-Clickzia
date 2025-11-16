import React from 'react';
import type { CrmContact, LeadStatus, User } from '../types';
import { CrmListItem } from './CrmListItem';

interface CrmListProps {
    contacts: CrmContact[];
    onComposeEmail: (business: CrmContact) => void;
    emailedBusinessIds: string[];
    onRemoveFromCrm: (businessId: string) => void;
    onUpdateStatus: (contactId: string, status: LeadStatus) => void;
    onAddNote: (contactId: string, note: string) => void;
    users: User[];
    currentUser: User | null;
    onAssignContact: (contactId: string, userId: string | 'unassigned') => void;
}

export const CrmList: React.FC<CrmListProps> = ({ contacts, onComposeEmail, emailedBusinessIds, onRemoveFromCrm, onUpdateStatus, onAddNote, users, currentUser, onAssignContact }) => {
    if (contacts.length === 0) {
        return (
            <div className="text-center py-10 px-4">
                <h2 className="text-2xl font-semibold text-white">No Matching Contacts</h2>
                <p className="text-gray-400 mt-2">Try adjusting your filters or add new prospects from search results.</p>
            </div>
        );
    }
    return (
        <ul className="space-y-4">
            {contacts.map(contact => (
                <CrmListItem
                    key={contact.id}
                    contact={{...contact, activities: contact.activities || []}}
                    onComposeEmail={onComposeEmail}
                    hasBeenEmailed={emailedBusinessIds.includes(contact.id)}
                    onRemoveFromCrm={onRemoveFromCrm}
                    onUpdateStatus={onUpdateStatus}
                    onAddNote={onAddNote}
                    users={users}
                    currentUser={currentUser}
                    onAssignContact={onAssignContact}
                />
            ))}
        </ul>
    );
};