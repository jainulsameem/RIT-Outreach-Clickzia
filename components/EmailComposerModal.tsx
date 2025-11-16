
import React, { useState, useEffect } from 'react';
import type { Business, Settings } from '../types';
import { CloseIcon } from './icons';
import { generateColdEmail } from '../services/geminiService';
import { sendGmail } from '../services/gmailService';

interface EmailComposerModalProps {
    isOpen: boolean;
    onClose: () => void;
    business: Business | null;
    settings: Settings;
    onEmailSent: (businessId: string) => void;
}

export const EmailComposerModal: React.FC<EmailComposerModalProps> = ({ isOpen, onClose, business, settings, onEmailSent }) => {
    const [subject, setSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSubject(`Collaboration with ${business?.name || 'your business'}`);
            setEmailBody('');
            setError(null);
            setSuccessMsg(null);
            setIsSending(false);
        }
    }, [isOpen, business]);

    if (!isOpen || !business) return null;

    const handleGenerateEmail = async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const content = await generateColdEmail(business.name, settings.fromName, settings.outreachTopic);
            const signature = settings.emailSignature ? `\n\n--\n${settings.emailSignature}` : '';
            setEmailBody(content.trim() + signature);
            
            // Auto-update subject if we want to get fancy later, for now basic default is fine
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendEmail = async () => {
        if (!process.env.GOOGLE_CLIENT_ID) {
            setError("Google Client ID is missing. Please check your .env configuration.");
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            await sendGmail(business.email || '', subject, emailBody);
            setSuccessMsg("Email sent successfully via Gmail!");
            setTimeout(() => {
                onEmailSent(business.id);
                onClose();
            }, 1500);
        } catch (err: any) {
            console.error("Gmail Send Error:", err);
            if (err.result && err.result.error) {
                setError(`Gmail API Error: ${err.result.error.message}`);
            } else if (err.message) {
                setError(err.message);
            } else {
                setError("Failed to send email. Ensure pop-ups are allowed for Google Login.");
            }
        } finally {
            setIsSending(false);
        }
    };

    const isSendDisabled = !emailBody || !subject || isGenerating || isSending;
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity">
            <div className="bg-base-200 rounded-lg shadow-2xl p-6 w-full max-w-2xl m-4 flex flex-col transform transition-all h-[80vh]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Compose Email</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                
                {error && <div className="mb-4 p-3 bg-red-900/50 border border-red-700 text-red-200 text-sm rounded-md">{error}</div>}
                {successMsg && <div className="mb-4 p-3 bg-green-900/50 border border-green-700 text-green-200 text-sm rounded-md">{successMsg}</div>}

                <div className="flex-grow flex flex-col space-y-4 overflow-y-auto pr-2">
                    <div className="p-3 bg-base-300 rounded-md border border-gray-600 space-y-2">
                        <div className="flex justify-between">
                            <p className="text-sm text-gray-400">To:</p>
                            <p className="text-white font-medium">{business.name} &lt;{business.email || 'No Email Found'}&gt;</p>
                        </div>
                        <div className="flex justify-between">
                             <p className="text-sm text-gray-400">From:</p>
                             <p className="text-white font-medium">{settings.fromName} (via Gmail)</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Subject</label>
                        <input 
                            type="text" 
                            value={subject} 
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                        />
                    </div>

                    <div className="flex-grow flex flex-col">
                         <label className="block text-sm font-medium text-gray-400 mb-1">Message Body</label>
                        <textarea
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            placeholder="Email content will appear here... Click 'Generate with AI' to start."
                            className="w-full flex-grow bg-base-300 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary resize-none min-h-[200px]"
                        />
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <button
                        onClick={handleGenerateEmail}
                        disabled={isGenerating || isSending}
                        className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isGenerating ? (
                            <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generating...</>
                        ) : '✨ Generate with AI'}
                    </button>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {!process.env.GOOGLE_CLIENT_ID && (
                            <span className="text-xs text-red-400 hidden sm:inline">Config missing</span>
                        )}
                        <button
                            onClick={handleSendEmail}
                            disabled={isSendDisabled}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                           {isSending ? (
                                <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending via Gmail...</>
                           ) : (
                               <><span className="mr-2">🚀</span> Send via Gmail</>
                           )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
