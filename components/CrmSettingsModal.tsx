
import React, { useState, useEffect } from 'react';
import { CloseIcon, LinkIcon, AdjustmentsIcon, PlusIcon, TrashIcon, CheckIcon, FacebookIcon, ChevronRightIcon } from './icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import type { CrmConfig, FacebookPage, FacebookForm, FacebookQuestion } from '../types';

interface CrmSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Declare FB SDK
declare global {
    interface Window {
        FB: any;
        fbAsyncInit: any;
    }
}

const DEFAULT_CRM_CONFIG: CrmConfig = {
    leadSources: ['Referral', 'Cold Call', 'Webinar', 'Conference', 'Website'],
    defaultAssignee: '',
    autoArchiveDays: 0
};

export const CrmSettingsModal: React.FC<CrmSettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'integrations'>('integrations');
    const { currentUser } = useAuth();
    const [config, setConfig] = useState<CrmConfig>(DEFAULT_CRM_CONFIG);
    const [isLoading, setIsLoading] = useState(false);
    
    // General Prefs State
    const [newSource, setNewSource] = useState('');

    // --- Facebook Wizard State ---
    const [fbStep, setFbStep] = useState<'connect' | 'select-page' | 'select-form' | 'map-fields' | 'success'>('connect');
    const [userAccessToken, setUserAccessToken] = useState<string>('');
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [selectedPage, setSelectedPage] = useState<FacebookPage | null>(null);
    const [forms, setForms] = useState<FacebookForm[]>([]);
    const [selectedForm, setSelectedForm] = useState<FacebookForm | null>(null);
    const [questions, setQuestions] = useState<FacebookQuestion[]>([]);
    const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}); 
    const [sdkReady, setSdkReady] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (currentUser?.organizationId) {
                loadConfig();
            }

            // Initialize Facebook SDK
            const appId = import.meta.env.VITE_FACEBOOK_APP_ID || process.env.FACEBOOK_APP_ID;
            
            if (!appId) {
                console.error("Facebook App ID missing. Check .env file.");
                return;
            }

            if (window.FB) {
                setSdkReady(true);
            } else {
                window.fbAsyncInit = function() {
                    window.FB.init({
                        appId: appId,
                        cookie: true,
                        xfbml: true,
                        version: 'v18.0'
                    });
                    setSdkReady(true);
                    console.log("Facebook SDK Initialized");
                };

                if (!document.getElementById('facebook-jssdk')) {
                    const js = document.createElement('script');
                    js.id = 'facebook-jssdk';
                    js.src = "https://connect.facebook.net/en_US/sdk.js";
                    js.async = true;
                    js.defer = true;
                    document.body.appendChild(js);
                }
            }
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

    // --- Facebook API Helpers (Promisified) ---
    const fbLogin = () => {
        return new Promise((resolve, reject) => {
            if (!window.FB) {
                reject('Facebook SDK not ready. Please refresh the page.');
                return;
            }
            window.FB.login((response: any) => {
                if (response.authResponse) {
                    resolve(response.authResponse.accessToken);
                } else {
                    reject('User cancelled login or did not fully authorize.');
                }
            }, { scope: 'pages_show_list,leads_retrieval,pages_read_engagement,pages_manage_metadata' });
        });
    };

    const fbApi = (path: string, token: string) => {
        return new Promise<any>((resolve, reject) => {
            window.FB.api(path, { access_token: token }, (response: any) => {
                if (!response || response.error) {
                    reject(response?.error || 'FB API Error');
                } else {
                    resolve(response);
                }
            });
        });
    };

    // --- Wizard Steps ---

    const handleConnectFacebook = async () => {
        if (!sdkReady) {
            alert("Facebook SDK is still loading. Please wait a moment.");
            return;
        }

        try {
            const token = await fbLogin() as string;
            setUserAccessToken(token);
            
            // Fetch Pages
            const response = await fbApi('/me/accounts', token);
            const pagesList = response.data.map((p: any) => ({
                id: p.id,
                name: p.name,
                access_token: p.access_token
            }));
            
            setPages(pagesList);
            setFbStep('select-page');
        } catch (err) {
            alert("Facebook Login Failed: " + (typeof err === 'string' ? err : JSON.stringify(err)));
        }
    };

    const handleSelectPage = async (page: FacebookPage) => {
        setSelectedPage(page);
        setIsLoading(true);
        try {
            const response = await fbApi(`/${page.id}/leadgen_forms`, page.access_token);
            setForms(response.data || []);
            setFbStep('select-form');
        } catch (err: any) {
            alert("Failed to fetch forms: " + (err.message || err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectForm = async (form: FacebookForm) => {
        setSelectedForm(form);
        setIsLoading(true);
        try {
            if (!selectedPage) return;
            const response = await fbApi(`/${form.id}?fields=questions,name`, selectedPage.access_token);
            
            const fetchedQuestions = response.questions || [];
            const standardFields = [
                { id: 'full_name', label: 'Full Name', type: 'FULL_NAME' },
                { id: 'email', label: 'Email', type: 'EMAIL' },
                { id: 'phone_number', label: 'Phone Number', type: 'PHONE' },
            ];
            
            const merged = [...standardFields, ...fetchedQuestions.map((q: any) => ({
                id: q.key || q.id,
                label: q.label,
                type: q.type
            }))];

            setQuestions(merged);
            setFbStep('map-fields');
        } catch (err: any) {
            alert("Failed to fetch form fields: " + (err.message || err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleMappingChange = (questionId: string, crmField: string) => {
        setFieldMappings(prev => ({ ...prev, [questionId]: crmField }));
    };

    const handleSaveIntegration = async () => {
        if (!selectedPage || !selectedForm) return;
        setIsLoading(true);
        try {
            // 1. Fetch existing
            const { data: existing } = await supabase
                .from('facebook_integrations')
                .select('form_mappings')
                .eq('page_id', selectedPage.id)
                .single();
            
            const currentMappings = existing?.form_mappings || {};
            
            // 2. Update
            const updatedMappings = {
                ...currentMappings,
                [selectedForm.id]: fieldMappings
            };

            // 3. Save
            const { error } = await supabase.from('facebook_integrations').upsert({
                page_id: selectedPage.id,
                organization_id: currentUser?.organizationId,
                page_name: selectedPage.name,
                access_token: selectedPage.access_token,
                form_mappings: updatedMappings,
                connected_at: new Date().toISOString()
            });

            if (error) throw error;
            setFbStep('success');
        } catch (err: any) {
            alert("Failed to save integration: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const resetWizard = () => {
        setFbStep('connect');
        setSelectedPage(null);
        setSelectedForm(null);
        setFieldMappings({});
    };

    // --- General Prefs ---
    const saveConfig = async () => {
        if (!currentUser?.organizationId) return;
        setIsLoading(true);
        try {
            const { error } = await supabase.from('app_settings').upsert({
                id: `crm_config_${currentUser.organizationId}`,
                data: config
            });
            if (error) throw error;
            alert("Preferences saved.");
        } catch (error) {
            console.error("Error saving config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddSource = (e: React.FormEvent) => {
        e.preventDefault();
        if (newSource.trim() && !config.leadSources.includes(newSource.trim())) {
            setConfig(prev => ({ ...prev, leadSources: [...prev.leadSources, newSource.trim()] }));
            setNewSource('');
        }
    };

    if (!isOpen) return null;

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
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                                <div className="flex gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg h-fit"><FacebookIcon className="w-6 h-6 text-blue-600" /></div>
                                    <div>
                                        <h3 className="font-bold text-blue-900">Facebook Lead Ads Integration</h3>
                                        <p className="text-sm text-blue-700 mt-1">Connect your Facebook Page to automatically sync leads from Lead Forms.</p>
                                    </div>
                                </div>
                            </div>

                            {/* WIZARD UI */}
                            <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
                                {fbStep === 'connect' && (
                                    <div className="text-center py-8">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">Connect with Facebook</h3>
                                        <p className="text-gray-500 mb-6 max-w-xs mx-auto">Grant permission to access your Pages and Lead Forms.</p>
                                        <button 
                                            onClick={handleConnectFacebook} 
                                            disabled={!sdkReady}
                                            className="bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all flex items-center mx-auto disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <FacebookIcon className="w-5 h-5 mr-2 text-white" /> 
                                            {sdkReady ? 'Login with Facebook' : 'Loading SDK...'}
                                        </button>
                                        {!process.env.FACEBOOK_APP_ID && !import.meta.env.VITE_FACEBOOK_APP_ID && (
                                            <p className="text-xs text-red-500 mt-3">⚠️ Config Error: VITE_FACEBOOK_APP_ID missing.</p>
                                        )}
                                    </div>
                                )}

                                {fbStep === 'select-page' && (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Select a Page</h3>
                                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                            {pages.map(page => (
                                                <button 
                                                    key={page.id} 
                                                    onClick={() => handleSelectPage(page)}
                                                    className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex justify-between items-center group"
                                                >
                                                    <span className="font-medium text-gray-800">{page.name}</span>
                                                    <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {fbStep === 'select-form' && (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">Select Lead Form</h3>
                                        <p className="text-sm text-gray-500 mb-4">Page: <span className="font-bold">{selectedPage?.name}</span></p>
                                        
                                        {isLoading ? <p className="text-center py-4 text-gray-500">Loading forms...</p> : (
                                            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                                {forms.length === 0 && <p className="text-center text-amber-600 bg-amber-50 p-3 rounded-lg">No Lead Forms found on this page.</p>}
                                                {forms.map(form => (
                                                    <button 
                                                        key={form.id} 
                                                        onClick={() => handleSelectForm(form)}
                                                        className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex justify-between items-center group"
                                                    >
                                                        <div>
                                                            <span className="font-medium text-gray-800 block">{form.name}</span>
                                                            <span className="text-xs text-gray-400 uppercase tracking-wider">{form.status}</span>
                                                        </div>
                                                        <ChevronRightIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {fbStep === 'map-fields' && (
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">Map Fields</h3>
                                        <p className="text-sm text-gray-500 mb-6">Form: <span className="font-bold">{selectedForm?.name}</span>. Match Facebook fields to CRM columns.</p>
                                        
                                        <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                                            {questions.map(q => (
                                                <div key={q.id} className="grid grid-cols-2 gap-4 items-center">
                                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm text-gray-700 truncate" title={q.label}>
                                                        {q.label} <span className="block text-[10px] text-gray-400">({q.id})</span>
                                                    </div>
                                                    <select 
                                                        className="bg-white border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        value={fieldMappings[q.id] || ''}
                                                        onChange={(e) => handleMappingChange(q.id, e.target.value)}
                                                    >
                                                        <option value="">-- Ignore --</option>
                                                        <option value="name">Full Name</option>
                                                        <option value="email">Email</option>
                                                        <option value="phone">Phone</option>
                                                        <option value="address">Address</option>
                                                        <option value="website">Website</option>
                                                        <option value="customSourceDetails">Note / Details</option>
                                                    </select>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                            <button onClick={() => setFbStep('select-form')} className="text-gray-500 hover:text-gray-800 font-medium">Back</button>
                                            <button onClick={handleSaveIntegration} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-xl shadow-lg transition-all">
                                                {isLoading ? 'Saving...' : 'Save Integration'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {fbStep === 'success' && (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <CheckIcon className="w-8 h-8 text-green-600" />
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-900">Connected Successfully!</h3>
                                        <p className="text-gray-500 mt-2 mb-6">Leads from <strong>{selectedForm?.name}</strong> will now sync automatically.</p>
                                        <button onClick={resetWizard} className="bg-gray-100 text-gray-700 font-bold py-2 px-6 rounded-xl hover:bg-gray-200">
                                            Connect Another Form
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">Custom Lead Sources</h3>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {config.leadSources.map(source => (
                                        <div key={source} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-sm font-medium flex items-center border border-indigo-100">
                                            {source}
                                            <button onClick={() => setConfig(prev => ({ ...prev, leadSources: prev.leadSources.filter(s => s !== source) }))} className="ml-2 text-indigo-400 hover:text-indigo-900"><TrashIcon className="h-3 w-3" /></button>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleAddSource} className="flex gap-2">
                                    <input type="text" value={newSource} onChange={e => setNewSource(e.target.value)} placeholder="e.g. LinkedIn Campaign" className="flex-grow bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    <button type="submit" disabled={!newSource.trim()} className="bg-gray-900 text-white px-4 py-2 rounded-xl hover:bg-black transition-colors"><PlusIcon className="h-5 w-5" /></button>
                                </form>
                            </div>
                            <div className="flex justify-end pt-6 border-t border-gray-100">
                                <button onClick={saveConfig} disabled={isLoading} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg">
                                    {isLoading ? 'Saving...' : 'Save Preferences'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
