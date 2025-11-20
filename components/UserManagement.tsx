
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
    const { users, currentUser } = useAuth();

    const getAssignedCount = (userId: string) => {
        return crmContacts.filter(c => c.assignedTo === userId).length;
    };

    const handleRemoveClick = (userId: string, username: string) => {
        if (window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
            onRemoveUser(userId);
        }
    };

    const getToolBadges = (user: User) => {
        const tools = user.allowedTools || [];
        // Filter out 'hub' as it's default
        const displayTools = tools.filter(t => t !== 'hub');
        if (displayTools.length === 0) return <span className="text-gray-400 text-xs">No Tools</span>;
        
        const count = displayTools.length;
        if (count > 3) return <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 font-medium">{count} Tools</span>;
        
        return (
            <div className="flex flex-wrap gap-1">
                {displayTools.map(t => (
                    <span key={t} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 capitalize">
                        {t.replace('-', ' ')}
                    </span>
                ))}
            </div>
        );
    };
    
    const isMasterAdmin = currentUser?.id === 'master-admin';

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Manage Users</h2>
                    {isMasterAdmin && (
                        <p className="text-xs text-indigo-600 font-bold mt-1 uppercase tracking-wider">
                            Managing Context: {currentUser.organizationId === 'org-default' ? 'Default Organization' : `Org ID: ${currentUser.organizationId}`}
                        </p>
                    )}
                </div>
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
                            <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Access</th>
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
                                <td className="p-4">
                                    {getToolBadges(user)}
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
                                            // Master Admin can delete anyone (except themselves in logic upstream), Org admins can't delete last admin check should ideally be here but basic length check suffices
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
