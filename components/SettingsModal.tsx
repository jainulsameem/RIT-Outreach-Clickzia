
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
    const originUrl = window.location.origin;

    React.useEffect(() => {
        setCurrentSettings(settings);
    }, [settings, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(currentSettings);
        onClose();
    };

    // Refactored to avoid generic arrow function syntax <T extends...> which can confuse TSX parsers
    const handleChange = (field: keyof Settings, value: string) => {
        setCurrentSettings(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity">
            <div className="bg-base-200 rounded-lg shadow-2xl p-6 w-full max-w-md m-4 transform transition-all max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Outreach Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="space-y-6">
                    {/* Google Config Helper */}
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                        <h3 className="text-sm font-bold text-blue-200 mb-2">Google Console Setup</h3>
                        <p className="text-xs text-gray-400 mb-2">
                            To enable Gmail sending, add this exact URL to <strong>Authorized JavaScript origins</strong> in your Google Cloud Console:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="bg-black/50 p-2 rounded text-xs text-green-400 flex-grow border border-white/10 break-all">
                                {originUrl}
                            </code>
                            <button 
                                onClick={() => navigator.clipboard.writeText(originUrl)}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-2 rounded transition-colors"
                                title="Copy to clipboard"
                            >
                                Copy
                            </button>
                        </div>
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
                </div>

                <div className="mt-6 flex justify-end border-t border-white/10 pt-4">
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
