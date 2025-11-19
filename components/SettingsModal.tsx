
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

    const handleChange = (field: keyof Settings, value: string) => {
        setCurrentSettings(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md m-4 transform transition-all max-h-[90vh] overflow-y-auto custom-scrollbar border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Outreach Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="space-y-6">
                    {/* Google Config Helper */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <h3 className="text-sm font-bold text-blue-800 mb-2">Google Console Setup</h3>
                        <p className="text-xs text-blue-600 mb-2">
                            To enable Gmail sending, add this exact URL to <strong>Authorized JavaScript origins</strong> in your Google Cloud Console:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="bg-white p-2 rounded text-xs text-gray-600 flex-grow border border-blue-200 break-all font-mono">
                                {originUrl}
                            </code>
                            <button 
                                onClick={() => navigator.clipboard.writeText(originUrl)}
                                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors font-semibold"
                                title="Copy to clipboard"
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="fromName" className="block text-xs font-bold text-gray-500 uppercase mb-1">Your Name</label>
                            <input
                                type="text"
                                id="fromName"
                                value={currentSettings.fromName}
                                onChange={(e) => handleChange('fromName', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g., Jane Doe"
                            />
                        </div>
                        <div>
                            <label htmlFor="fromEmail" className="block text-xs font-bold text-gray-500 uppercase mb-1">Your 'From' Email</label>
                            <input
                                type="email"
                                id="fromEmail"
                                value={currentSettings.fromEmail}
                                onChange={(e) => handleChange('fromEmail', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g., jane.d@example.com"
                            />
                        </div>
                        <div>
                            <label htmlFor="outreachTopic" className="block text-xs font-bold text-gray-500 uppercase mb-1">Your Service/Topic</label>
                            <input
                                type="text"
                                id="outreachTopic"
                                value={currentSettings.outreachTopic}
                                onChange={(e) => handleChange('outreachTopic', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="e.g., Web Design Services"
                            />
                        </div>
                         <div>
                            <label htmlFor="emailSignature" className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Signature</label>
                            <textarea
                                id="emailSignature"
                                value={currentSettings.emailSignature}
                                onChange={(e) => handleChange('emailSignature', e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                placeholder="Best regards,&#10;Jane Doe&#10;CEO, Example Inc."
                                rows={4}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end border-t border-gray-100 pt-4">
                    <button
                        onClick={handleSave}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-indigo-200"
                    >
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};
