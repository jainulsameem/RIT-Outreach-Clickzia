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

    // Refactored to avoid generic arrow function syntax which triggers 'Unexpected token >' in some parsers
    const handleChange = (field: keyof User, value: any) => {
        setUser(prev => ({ ...prev, [field]: value }));
    };

    const isEditing = !!userToEdit;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity">
            <div className="bg-base-200 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 transform transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">{isEditing ? 'Edit User' : 'Add New User'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-base-content mb-1">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={user.username || ''}
                            onChange={(e) => handleChange('username', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-base-content mb-1">Role</label>
                        <select
                            id="role"
                            value={user.role || 'user'}
                            onChange={(e) => handleChange('role', e.target.value as UserRole)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                        >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-base-content mb-1">
                            {isEditing ? 'New Password (optional)' : 'Password'}
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={user.password || ''}
                            onChange={(e) => handleChange('password', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                            placeholder={isEditing ? 'Leave blank to keep current' : ''}
                        />
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        Save User
                    </button>
                </div>
            </div>
        </div>
    );
};