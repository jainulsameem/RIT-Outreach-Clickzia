
import React, { useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { CloseIcon } from './icons';
import { hashPassword } from '../services/security';

interface AddEditUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User) => void;
    userToEdit: User | null;
}

const AVAILABLE_TOOLS = [
    { id: 'search', label: 'Outreach Finder' },
    { id: 'crm-list', label: 'CRM Pipeline' },
    { id: 'email-campaign', label: 'Email Campaigns' },
    { id: 'time-tracking', label: 'Time Tracking' },
    { id: 'invoicing', label: 'Invoicing & Inventory' },
];

export const AddEditUserModal: React.FC<AddEditUserModalProps> = ({ isOpen, onClose, onSave, userToEdit }) => {
    const [user, setUser] = useState<Partial<User>>({});
    const [selectedTools, setSelectedTools] = useState<string[]>(['hub']);
    const [inputPassword, setInputPassword] = useState('');
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setError('');
            setInputPassword('');
            setIsProcessing(false);
            if (userToEdit) {
                setUser({ ...userToEdit });
                setSelectedTools(userToEdit.allowedTools || ['hub', 'search', 'crm-list', 'email-campaign', 'time-tracking', 'invoicing']);
            } else {
                setUser({ username: '', role: 'user' });
                setSelectedTools(['hub', 'search', 'crm-list', 'email-campaign', 'time-tracking', 'invoicing']);
            }
        }
    }, [isOpen, userToEdit]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!user.username || !user.role) {
            setError('Username and role are required.');
            return;
        }
        if (!userToEdit && !inputPassword) {
             setError('Password is required for new users.');
             return;
        }
        
        setIsProcessing(true);

        try {
            // Handle Password Hashing
            let finalPassword = user.password;
            if (inputPassword) {
                finalPassword = await hashPassword(inputPassword);
            }

            // Ensure hub is included
            const finalTools = Array.from(new Set([...selectedTools, 'hub']));
            
            const userToSave = { 
                ...user, 
                password: finalPassword,
                allowedTools: finalTools 
            } as User;
            
            onSave(userToSave);
            onClose();
        } catch (e) {
            setError('Error processing password security.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleChange = (field: keyof User, value: any) => {
        setUser(prev => ({ ...prev, [field]: value }));
    };

    const toggleTool = (toolId: string) => {
        setSelectedTools(prev => {
            if (prev.includes(toolId)) {
                return prev.filter(t => t !== toolId);
            } else {
                return [...prev, toolId];
            }
        });
    };

    const isEditing = !!userToEdit;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md m-4 transform transition-all border border-gray-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                            value={inputPassword}
                            onChange={(e) => setInputPassword(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder={isEditing ? 'Leave blank to keep current' : ''}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Allowed Tools</label>
                        <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            {AVAILABLE_TOOLS.map(tool => (
                                <label key={tool.id} className="flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedTools.includes(tool.id)}
                                        onChange={() => toggleTool(tool.id)}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="ml-2 text-sm text-gray-700">{tool.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                </div>
                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isProcessing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                    >
                        {isProcessing ? 'Securing...' : 'Save User'}
                    </button>
                </div>
            </div>
        </div>
    );
};
