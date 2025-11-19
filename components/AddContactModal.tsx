
import React, { useState } from 'react';
import type { Business, SearchSource } from '../types';
import { CloseIcon } from './icons';

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (business: Business) => void;
}

export const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Business>>({
        name: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        contactName: '',
        contactRole: '',
        customSourceDetails: '',
        source: 'custom',
    });
    
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleChange = (field: keyof Business, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim()) {
            setError('Business Name is required');
            return;
        }
        
        const newBusiness: Business = {
            id: `custom-${Date.now()}`,
            name: formData.name,
            address: formData.address,
            phone: formData.phone,
            email: formData.email,
            website: formData.website,
            contactName: formData.contactName,
            contactRole: formData.contactRole,
            customSourceDetails: formData.customSourceDetails,
            source: 'custom',
            profileStatus: 'unknown'
        };
        
        onSave(newBusiness);
        onClose();
        setFormData({
            name: '', address: '', phone: '', email: '', website: '', contactName: '', contactRole: '', customSourceDetails: '', source: 'custom'
        });
        setError('');
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg m-4 transform transition-all border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Add Manual Lead</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <CloseIcon />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {error && <div className="text-red-600 text-sm p-2 bg-red-50 rounded border border-red-100">{error}</div>}
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Business Name *</label>
                        <input 
                            type="text" 
                            value={formData.name} 
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. Acme Corp"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contact Person</label>
                            <input 
                                type="text" 
                                value={formData.contactName} 
                                onChange={(e) => handleChange('contactName', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Role / Title</label>
                            <input 
                                type="text" 
                                value={formData.contactRole} 
                                onChange={(e) => handleChange('contactRole', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="e.g. Manager"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                            <input 
                                type="email" 
                                value={formData.email} 
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="john@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                            <input 
                                type="text" 
                                value={formData.phone} 
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Website</label>
                        <input 
                            type="text" 
                            value={formData.website} 
                            onChange={(e) => handleChange('website', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="www.example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Address</label>
                        <input 
                            type="text" 
                            value={formData.address} 
                            onChange={(e) => handleChange('address', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="123 Main St, City"
                        />
                    </div>

                    <div className="pt-2 border-t border-gray-100 mt-2">
                         <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Source Details</label>
                         <input 
                            type="text" 
                            value={formData.customSourceDetails} 
                            onChange={(e) => handleChange('customSourceDetails', e.target.value)}
                            className="w-full bg-gray-50 border border-purple-200 rounded-xl px-4 py-2 text-gray-900 focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="e.g. Referral from Mike, Networking Event, etc."
                        />
                        <p className="text-xs text-gray-400 mt-1">Identify where this lead came from (Required for custom leads).</p>
                    </div>

                    <div className="mt-6 flex justify-end pt-4">
                        <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-indigo-200"
                        >
                            Add Lead
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
