import React from 'react';
import type { User, CrmContact } from '../types';
import { UserIcon, EditIcon, TrashIcon } from './icons';
import { useAuth } from '../context/AuthContext';


interface UserManagementProps {
    crmContacts: CrmContact[];
    onAddUser: () => void;
    onEditUser: (user: User) => void;
    onRemoveUser: (userId: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ crmContacts, onAddUser, onEditUser, onRemoveUser }) => {
    const { users } = useAuth();

    const getAssignedCount = (userId: string) => {
        return crmContacts.filter(c => c.assignedTo === userId).length;
    };

    return (
        <div className="bg-base-200 p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Manage Users</h2>
                <button
                    onClick={onAddUser}
                    className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center"
                >
                    <UserIcon className="mr-2" /> Add New User
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="p-3 text-sm font-semibold text-gray-400 uppercase">User</th>
                            <th className="p-3 text-sm font-semibold text-gray-400 uppercase">Role</th>
                            <th className="p-3 text-sm font-semibold text-gray-400 uppercase">Assigned Leads</th>
                            <th className="p-3 text-sm font-semibold text-gray-400 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b border-gray-700 last:border-0 hover:bg-base-300">
                                <td className="p-3 font-medium text-white">{user.username}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-600 text-purple-100' : 'bg-blue-600 text-blue-100'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-3 text-white">{getAssignedCount(user.id)}</td>
                                <td className="p-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => onEditUser(user)} className="p-2 text-gray-400 hover:text-white hover:bg-base-100 rounded-md" aria-label={`Edit ${user.username}`}>
                                            <EditIcon />
                                        </button>
                                        <button onClick={() => onRemoveUser(user.id)} className="p-2 text-gray-400 hover:text-white hover:bg-base-100 rounded-md" aria-label={`Remove ${user.username}`} disabled={users.length <= 1 || user.id === 'master-admin'}>
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};