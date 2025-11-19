
import React, { useState, useEffect } from 'react';
import type { CrmContact, Settings } from '../types';
import { sendGmail } from '../services/gmailService';
import { generateColdEmail } from '../services/geminiService';
import { CheckIcon, SearchIcon, PaperAirplaneIcon, CloseIcon } from './icons';

interface EmailPageProps {
    crmContacts: CrmContact[];
    settings: Settings;
    onUpdateContact: (contactId: string, updates: Partial<CrmContact>) => void;
}

interface SendingLog {
    id: string;
    recipient: string;
    status: 'success' | 'error';
    message: string;
    timestamp: string;
}

export const EmailPage: React.FC<EmailPageProps> = ({ crmContacts, settings, onUpdateContact }) => {
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [fromName, setFromName] = useState(settings.fromName || '');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<SendingLog[]>([]);

    // Filter contacts to those with emails
    const contactsWithEmails = crmContacts.filter(c => c.email && c.email.includes('@'));
    
    // Filter based on search
    const filteredContacts = contactsWithEmails.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectAll = () => {
        if (selectedContactIds.size === filteredContacts.length) {
            setSelectedContactIds(new Set());
        } else {
            setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
        }
    };

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedContactIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedContactIds(newSelected);
    };

    const handleGenerateAI = async () => {
        setIsGenerating(true);
        try {
            const prompt = `Write a professional email body about "${settings.outreachTopic || 'our services'}". Keep it engaging and under 200 words.`;
            // Reuse existing service, passing a dummy name since we are templating
            const content = await generateColdEmail("Generic Business", fromName, settings.outreachTopic);
            setBody(content + (settings.emailSignature ? `\n\n--\n${settings.emailSignature}` : ''));
            if (!subject) setSubject(`Collaboration with you`);
        } catch (error) {
            console.error("AI Generation failed", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendCampaign = async () => {
        if (selectedContactIds.size === 0) return;
        if (!body.trim() || !subject.trim()) {
            alert("Please provide a subject and email body.");
            return;
        }

        setIsSending(true);
        setProgress(0);
        setLogs([]);
        
        const recipients = contactsWithEmails.filter(c => selectedContactIds.has(c.id));
        let successCount = 0;

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const currentProgress = Math.round(((i + 1) / recipients.length) * 100);
            setProgress(currentProgress);

            try {
                // Personalize a bit if possible (simple replacement)
                const personalizedBody = body.replace('{Name}', recipient.contactName || 'there').replace('{Business}', recipient.name);
                
                await sendGmail(recipient.email!, subject, personalizedBody);
                
                // Log Success
                setLogs(prev => [{
                    id: Date.now().toString(),
                    recipient: recipient.name,
                    status: 'success',
                    message: 'Sent successfully',
                    timestamp: new Date().toLocaleTimeString()
                }, ...prev]);
                
                // Update CRM
                onUpdateContact(recipient.id, {
                    status: 'Contacted',
                    activities: [
                        { 
                            id: Date.now().toString(), 
                            type: 'email', 
                            content: `Campaign Email Sent: "${subject}"`, 
                            timestamp: new Date().toISOString() 
                        },
                        ...(recipient.activities || [])
                    ]
                });
                successCount++;

            } catch (error: any) {
                console.error(`Failed to send to ${recipient.name}`, error);
                setLogs(prev => [{
                    id: Date.now().toString(),
                    recipient: recipient.name,
                    status: 'error',
                    message: error.message || 'Failed to send',
                    timestamp: new Date().toLocaleTimeString()
                }, ...prev]);
            }
            
            // Simple delay to avoid hitting rate limits too hard
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setIsSending(false);
        if (successCount > 0) {
            alert(`Campaign finished! Sent ${successCount} emails.`);
            setSelectedContactIds(new Set()); // Clear selection on success
        }
    };

    return (
        <div className="animate-fadeIn h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6 pb-6">
            
            {/* Left Panel: Recipients */}
            <div className="w-full md:w-1/3 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Recipients</h2>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Search contacts..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                    <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                        <span>{selectedContactIds.size} selected</span>
                        <button onClick={handleSelectAll} className="text-indigo-600 hover:text-indigo-800 font-semibold">
                            {selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                </div>
                
                <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredContacts.length === 0 ? (
                        <p className="text-center text-gray-400 py-8 text-sm">No contacts with email addresses found.</p>
                    ) : (
                        filteredContacts.map(contact => (
                            <div 
                                key={contact.id} 
                                onClick={() => handleToggleSelect(contact.id)}
                                className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${selectedContactIds.has(contact.id) ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-gray-50 border-transparent'}`}
                            >
                                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-colors ${selectedContactIds.has(contact.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                    {selectedContactIds.has(contact.id) && <CheckIcon className="w-3 h-3 text-white" />}
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-sm font-medium text-gray-900 truncate">{contact.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{contact.email}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Composer & Sender */}
            <div className="w-full md:w-2/3 flex flex-col gap-6">
                
                {/* Composer */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex-grow flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-900">Compose Campaign</h2>
                        <div className="text-xs text-gray-500">
                            Sending via Gmail as <span className="text-gray-800 font-semibold">{settings.fromEmail || 'Logged in user'}</span>
                        </div>
                    </div>

                    <div className="space-y-4 flex-grow flex flex-col">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sender Name</label>
                                <input 
                                    type="text" 
                                    value={fromName} 
                                    onChange={e => setFromName(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    placeholder="Your Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Subject Line</label>
                                <input 
                                    type="text" 
                                    value={subject} 
                                    onChange={e => setSubject(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    placeholder="Exciting opportunity..."
                                />
                            </div>
                        </div>

                        <div className="flex-grow relative">
                            <textarea 
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                className="w-full h-full bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-900 text-sm focus:ring-1 focus:ring-indigo-500 resize-none outline-none"
                                placeholder="Write your email content here... Use {Name} or {Business} for simple placeholders."
                            />
                            <button 
                                onClick={handleGenerateAI}
                                disabled={isGenerating}
                                className="absolute bottom-4 right-4 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-all flex items-center shadow-sm"
                            >
                                {isGenerating ? 'Generating...' : '✨ AI Draft'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-gray-100 pt-4 flex justify-between items-center">
                         <div className="text-xs text-gray-400">
                             <p>Tip: Ensure you have authenticated with Google in the main dashboard first.</p>
                         </div>
                         <button 
                            onClick={handleSendCampaign}
                            disabled={isSending || selectedContactIds.size === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                             {isSending ? (
                                 <span className="flex items-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Sending... {progress}%</span>
                             ) : (
                                 <span className="flex items-center"><PaperAirplaneIcon className="mr-2" /> Send to {selectedContactIds.size} Recipients</span>
                             )}
                         </button>
                    </div>
                </div>

                {/* Status / Logs Area - Only show when active or has logs */}
                {(isSending || logs.length > 0) && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 h-48 overflow-hidden flex flex-col">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Sending Status</h3>
                        
                        {isSending && (
                             <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
                                <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        )}

                        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2">
                            {logs.map(log => (
                                <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded bg-gray-50 border border-gray-100">
                                    <span className="text-gray-900 font-medium">{log.recipient}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400">{log.timestamp}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${log.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                            {log.message}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
