
import React, { useState, useEffect } from 'react';
import type { Business, Settings } from '../types';
import { CloseIcon } from './icons';
import { generateColdEmail } from '../services/geminiService';

interface EmailComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    business: Business | null;
    settings: Settings;
    onEmailSent: (businessId: string) => void;
}

export const EmailComposerModal: React.FC<EmailComposerModalProps> = ({ isOpen, onClose, business, settings, onEmailSent }) => {
    const [emailBody, setEmailBody] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setEmailBody('');
            setError(null);
        }
    }, [isOpen]);

    if (!isOpen || !business) return null;

    const handleGenerateEmail = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const content = await generateColdEmail(business.name, settings.fromName, settings.outreachTopic);
            const signature = settings.emailSignature ? `\n\n--\n${settings.emailSignature}` : '';
            setEmailBody(content.trim() + signature);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendEmail = () => {
        // This is a simulation. In a real app, you would use an email sending service.
        console.log(`Sending email to ${business.email} from ${settings.fromEmail}...`);
        console.log(`Body: ${emailBody}`);
        onEmailSent(business.id);
        onClose();
    };

    const isSendDisabled = !emailBody || isGenerating;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity">
            <div className="bg-base-200 rounded-lg shadow-2xl p-6 w-full max-w-2xl m-4 flex flex-col transform transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Compose Email</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                <div className="flex-grow flex flex-col space-y-4">
                    <div className="p-3 bg-base-300 rounded-md border border-gray-600">
                        <p><span className="font-semibold text-gray-400">To:</span> {business.name} &lt;{business.email}&gt;</p>
                        <p><span className="font-semibold text-gray-400">From:</span> {settings.fromName} &lt;{settings.fromEmail}&gt;</p>
                    </div>
                    <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Email content will appear here... Click 'Generate with AI' to start."
                        className="w-full flex-grow bg-base-300 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary resize-none"
                        rows={12}
                    />
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                </div>
                <div className="mt-6 flex justify-between items-center">
                    <button
                        onClick={handleGenerateEmail}
                        disabled={isGenerating}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center"
                    >
                        {isGenerating ? (
                            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generating...</>
                        ) : '✨ Generate with AI'}
                    </button>
                    <button
                        onClick={handleSendEmail}
                        disabled={isSendDisabled}
                        className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        Send Email
                    </button>
                </div>
            </div>
        </div>
    );
};
