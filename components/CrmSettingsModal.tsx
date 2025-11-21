
import React, { useState, useEffect } from 'react';
import { CloseIcon, LinkIcon, AdjustmentsIcon, PlusIcon, TrashIcon, CheckIcon } from './icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import type { CrmConfig } from '../types';

interface CrmSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_CRM_CONFIG: CrmConfig = {
    leadSources: ['Referral', 'Cold Call', 'Webinar', 'Conference', 'Website'],
    defaultAssignee: '',
    autoArchiveDays: 0
};

export const CrmSettingsModal: React.FC<CrmSettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'integrations'>('integrations');
    const { currentUser, users } = useAuth();
    const [config, setConfig] = useState<CrmConfig>(DEFAULT_CRM_CONFIG);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form State for adding new source
    const [newSource, setNewSource] = useState('');

    useEffect(() => {
        if (isOpen && currentUser?.organizationId) {
            loadConfig();
        }
    }, [isOpen, currentUser]);

    const loadConfig = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('app_settings')
                .select('data')
                .eq('id', `crm_config_${currentUser?.organizationId}`)
                .single();
            
            if (data && data.data) {
                setConfig({ ...DEFAULT_CRM_CONFIG, ...data.data });
            }
        } catch (error) {
            console.error("Error loading CRM config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveConfig = async () => {
        if (!currentUser?.organizationId) return;
        setIsLoading(true);
        try {
            const { error } = await supabase.from('app_settings').upsert({
                id: `crm_config_${currentUser.organizationId}`,
                data: config
            });
            
            if (error) throw error;
            alert("Preferences saved successfully.");
        } catch (error) {
            console.error("Error saving CRM config:", error);
            alert("Failed to save settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddSource = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSource.trim() && !config.leadSources.includes(newSource.trim())) {
            setConfig(prev => ({
                ...prev,
                leadSources: [...prev.leadSources, newSource.trim()]
            }));
            setNewSource('');
        }
    };

    const handleRemoveSource = (source: string) => {
        setConfig(prev => ({
            ...prev,
            leadSources: prev.leadSources.filter(s => s !== source)
        }));
    };

    if (!isOpen) return null;

    // Assuming the webhook endpoint is relative to the deployed domain
    const webhookUrl = `${window.location.origin}/api/facebook-webhook`;
    const verifyToken = "leadexis_secret_123"; // Example default

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">CRM Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><CloseIcon /></button>
                </div>
                
                <div className="flex border-b border-gray-100">
                    <button 
                        onClick={() => setActiveTab('integrations')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'integrations' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <div className="flex items-center justify-center gap-2"><LinkIcon className="h-4 w-4" /> Integrations</div>
                    </button>
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <div className="flex items-center justify-center gap-2"><AdjustmentsIcon className="h-4 w-4" /> Preferences</div>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-grow">
                    {activeTab === 'integrations' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg h-fit"><span className="text-xl">f</span></div>
                                    <div>
                                        <h3 className="font-bold text-blue-900">Facebook Lead Ads Integration</h3>
                                        <p className="text-sm text-blue-700 mt-1">Automatically sync leads from your Facebook Ads to the CRM pipeline.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Callback URL</label>
                                    <div className="flex gap-2">
                                        <code className="flex-grow bg-gray-100 border border-gray-200 p-3 rounded-lg text-sm text-gray-700 break-all font-mono">{webhookUrl}</code>
                                        <button 
                                            onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                            className="bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-200 px-4 rounded-lg font-bold text-sm transition-all shadow-sm"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Verify Token</label>
                                    <div className="flex gap-2">
                                        <code className="flex-grow bg-gray-100 border border-gray-200 p-3 rounded-lg text-sm text-gray-700 font-mono">{verifyToken}</code>
                                        <button 
                                            onClick={() => navigator.clipboard.writeText(verifyToken)}
                                            className="bg-white border border-gray-200 text-gray-600 hover:text-indigo-600 hover:border-indigo-200 px-4 rounded-lg font-bold text-sm transition-all shadow-sm"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Use these values in the <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Facebook Developers Portal</a> under Webhooks settings.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="space-y-8">
                            
                            {/* Lead Sources Section */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Custom Lead Sources</h3>
                                <p className="text-sm text-gray-500 mb-4">Define the options available when manually adding new leads.</p>
                                
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {config.leadSources.map(source => (
                                        <div key={source} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium flex items-center border border-indigo-100">
                                            {source}
                                            <button onClick={() => handleRemoveSource(source)} className="ml-2 text-indigo-400 hover:text-indigo-900">
                                                <TrashIcon className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {config.leadSources.length === 0 && <p className="text-gray-400 text-sm italic">No custom sources defined.</p>}
                                </div>

                                <form onSubmit={handleAddSource} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newSource}
                                        onChange={e => setNewSource(e.target.value)}
                                        placeholder="e.g. LinkedIn Campaign"
                                        className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={!newSource.trim()}
                                        className="bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-black transition-colors disabled:opacity-50"
                                    >
                                        <PlusIcon className="h-5 w-5" />
                                    </button>
                                </form>
                            </div>

                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Automation Rules</h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Default Lead Assignee</label>
                                        <select 
                                            value={config.defaultAssignee}
                                            onChange={e => setConfig({...config, defaultAssignee: e.target.value})}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value="">-- Unassigned --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.username}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">New leads from Facebook or Webhooks will be assigned to this user automatically.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Auto-Archive Converted Leads</label>
                                        <select 
                                            value={config.autoArchiveDays}
                                            onChange={e => setConfig({...config, autoArchiveDays: parseInt(e.target.value)})}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        >
                                            <option value={0}>Never (Keep visible)</option>
                                            <option value={7}>After 7 days</option>
                                            <option value={30}>After 30 days</option>
                                            <option value={90}>After 90 days</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">Automatically hide leads marked as 'Converted' from the main pipeline view after a set period.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors">
                        Cancel
                    </button>
                    {activeTab === 'general' ? (
                        <button onClick={saveConfig} disabled={isLoading} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center">
                            {isLoading ? 'Saving...' : <><CheckIcon className="h-4 w-4 mr-2" /> Save Changes</>}
                        </button>
                    ) : (
                        <button onClick={onClose} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors">
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
