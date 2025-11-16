
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
            id: `custom-${Date.now()}`, // Temporary ID, Supabase might generate one or we use this
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
        // Reset form
        setFormData({
            name: '', address: '', phone: '', email: '', website: '', contactName: '', contactRole: '', customSourceDetails: '', source: 'custom'
        });
        setError('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity">
            <div className="bg-base-200 rounded-lg shadow-2xl p-6 w-full max-w-lg m-4 transform transition-all border border-white/10">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Add Manual Lead</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {error && <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded border border-red-800/50">{error}</div>}
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Business Name *</label>
                        <input 
                            type="text" 
                            value={formData.name} 
                            onChange={(e) => handleChange('name', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            placeholder="e.g. Acme Corp"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contact Person</label>
                            <input 
                                type="text" 
                                value={formData.contactName} 
                                onChange={(e) => handleChange('contactName', e.target.value)}
                                className="w-full bg-base-300 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Role / Title</label>
                            <input 
                                type="text" 
                                value={formData.contactRole} 
                                onChange={(e) => handleChange('contactRole', e.target.value)}
                                className="w-full bg-base-300 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                                placeholder="e.g. Manager"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email</label>
                            <input 
                                type="email" 
                                value={formData.email} 
                                onChange={(e) => handleChange('email', e.target.value)}
                                className="w-full bg-base-300 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                                placeholder="john@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Phone</label>
                            <input 
                                type="text" 
                                value={formData.phone} 
                                onChange={(e) => handleChange('phone', e.target.value)}
                                className="w-full bg-base-300 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Website</label>
                        <input 
                            type="text" 
                            value={formData.website} 
                            onChange={(e) => handleChange('website', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                            placeholder="www.example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Address</label>
                        <input 
                            type="text" 
                            value={formData.address} 
                            onChange={(e) => handleChange('address', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-primary"
                            placeholder="123 Main St, City"
                        />
                    </div>

                    <div className="pt-2 border-t border-white/10 mt-2">
                         <label className="block text-xs font-bold text-brand-secondary uppercase tracking-wider mb-1">Source Details</label>
                         <input 
                            type="text" 
                            value={formData.customSourceDetails} 
                            onChange={(e) => handleChange('customSourceDetails', e.target.value)}
                            className="w-full bg-base-300 border border-brand-secondary/50 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-secondary"
                            placeholder="e.g. Referral from Mike, Networking Event, etc."
                        />
                        <p className="text-xs text-gray-500 mt-1">Identify where this lead came from (Required for custom leads).</p>
                    </div>

                    <div className="mt-6 flex justify-end pt-4">
                        <button
                            type="submit"
                            className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-lg"
                        >
                            Add Lead
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
