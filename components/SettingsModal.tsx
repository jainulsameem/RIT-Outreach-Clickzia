import React from 'react';
import type { Settings } from '../types';
import { CloseIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onSave: (newSettings: Settings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
    const [currentSettings, setCurrentSettings] = React.useState<Settings>(settings);

    React.useEffect(() => {
        setCurrentSettings(settings);
    }, [settings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(currentSettings);
        onClose();
    };

    const handleChange = <T extends keyof Settings>(field: T, value: Settings[T]) => {
        setCurrentSettings(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity">
            <div className="bg-base-200 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 transform transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Outreach Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="fromName" className="block text-sm font-medium text-base-content mb-1">Your Name</label>
                        <input
                            type="text"
                            id="fromName"
                            value={currentSettings.fromName}
                            onChange={(e) => handleChange('fromName', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            placeholder="e.g., Jane Doe"
                        />
                    </div>
                    <div>
                        <label htmlFor="fromEmail" className="block text-sm font-medium text-base-content mb-1">Your 'From' Email</label>
                        <input
                            type="email"
                            id="fromEmail"
                            value={currentSettings.fromEmail}
                            onChange={(e) => handleChange('fromEmail', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            placeholder="e.g., jane.d@example.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="outreachTopic" className="block text-sm font-medium text-base-content mb-1">Your Service/Topic</label>
                        <input
                            type="text"
                            id="outreachTopic"
                            value={currentSettings.outreachTopic}
                            onChange={(e) => handleChange('outreachTopic', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            placeholder="e.g., Web Design Services"
                        />
                    </div>
                     <div>
                        <label htmlFor="emailSignature" className="block text-sm font-medium text-base-content mb-1">Email Signature</label>
                        <textarea
                            id="emailSignature"
                            value={currentSettings.emailSignature}
                            onChange={(e) => handleChange('emailSignature', e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            placeholder="Best regards,&#10;Jane Doe&#10;CEO, Example Inc."
                            rows={4}
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};