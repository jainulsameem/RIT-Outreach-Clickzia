
import React, { useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { CloseIcon } from './icons';

interface AddEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User) => void;
    userToEdit: User | null;
}

export const AddEditUserModal: React.FC<AddEditUserModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
    const [user, setUser] = useState<Partial<User>>({});
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setError('');
            setUser(userToEdit ? { ...userToEdit } : { username: '', role: 'user', password: '' });
        }
    }, [isOpen, userToEdit]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!user.username || !user.role) {
            setError('Username and role are required.');
            return;
        }
        if (!userToEdit && !user.password) {
             setError('Password is required for new users.');
             return;
        }
        onSave(user as User);
        onClose();
    };

    const handleChange = (field: keyof User, value: any) => {
        setUser(prev => ({ ...prev, [field]: value }));
    };

    const isEditing = !!userToEdit;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md m-4 transform transition-all border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit User' : 'Add New User'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <CloseIcon />
                    </button>
                </div>
                <div className="space-y-5">
                    <div>
                        <label htmlFor="username" className="block text-xs font-bold text-gray-500 uppercase mb-1">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={user.username || ''}
                            onChange={(e) => handleChange('username', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-xs font-bold text-gray-500 uppercase mb-1">Role</label>
                        <select
                            id="role"
                            value={user.role || 'user'}
                            onChange={(e) => handleChange('role', e.target.value as UserRole)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            {isEditing ? 'New Password (optional)' : 'Password'}
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={user.password || ''}
                            onChange={(e) => handleChange('password', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder={isEditing ? 'Leave blank to keep current' : ''}
                        />
                    </div>
                    {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                </div>
                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all"
                    >
                        Save User
                    </button>
                </div>
            </div>
        </div>
    );
};
