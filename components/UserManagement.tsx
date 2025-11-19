
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

    const handleRemoveClick = (userId: string, username: string) => {
        if (window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
            onRemoveUser(userId);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Manage Users</h2>
                <button
                    onClick={onAddUser}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all flex items-center"
                >
                    <UserIcon className="mr-2 h-4 w-4" /> Add New User
                </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left">
                    <thead className="bg-gray-50">
                        <tr className="border-b border-gray-200">
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Leads</th>
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 font-medium text-gray-900">{user.username}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 text-xs font-bold rounded-full border ${user.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-gray-600">{getAssignedCount(user.id)}</td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => onEditUser(user)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" aria-label={`Edit ${user.username}`}>
                                            <EditIcon />
                                        </button>
                                        <button 
                                            onClick={() => handleRemoveClick(user.id, user.username)} 
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                            aria-label={`Remove ${user.username}`} 
                                            disabled={users.length <= 1 || user.id === 'master-admin'}
                                        >
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
