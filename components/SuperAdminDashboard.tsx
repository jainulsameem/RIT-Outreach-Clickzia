
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import type { Organization } from '../types';
import { BriefcaseIcon, PlusIcon, CheckIcon, UserIcon, TrashIcon } from './icons';
import { useAuth } from '../context/AuthContext';

export const SuperAdminDashboard: React.FC = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form State
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgPlan, setNewOrgPlan] = useState('standard');
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    
    const [isCreating, setIsCreating] = useState(false);
    
    const { currentUser, switchOrganization } = useAuth();

    const fetchOrganizations = async () => {
        setIsLoading(true);
        const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching organizations:', error);
        } else {
            setOrganizations(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOrgName.trim() || !adminUsername.trim() || !adminPassword.trim()) {
            alert("Please fill in all fields including the Admin credentials.");
            return;
        }

        setIsLoading(true);
        const newOrgId = `org-${Date.now()}`;
        
        // 1. Create Organization
        const { error: orgError } = await supabase.from('organizations').insert({
            id: newOrgId,
            name: newOrgName.trim(),
            plan: newOrgPlan
        });

        if (orgError) {
            alert('Error creating organization: ' + orgError.message);
            setIsLoading(false);
            return;
        }

        // 2. Create Initial Admin User for this Org
        const { error: userError } = await supabase.from('app_users').insert({
            id: `user-${Date.now()}`,
            username: adminUsername.trim(),
            password: adminPassword.trim(),
            role: 'admin',
            organization_id: newOrgId,
            allowed_tools: ['hub', 'search', 'crm-list', 'email-campaign', 'time-tracking'] // Full access for admin
        });

        if (userError) {
            alert('Organization created, but failed to create Admin user: ' + userError.message);
        } else {
            setNewOrgName('');
            setAdminUsername('');
            setAdminPassword('');
            setIsCreating(false);
            fetchOrganizations();
            alert('Organization and Admin user created successfully!');
        }
        setIsLoading(false);
    };

    const handleDeleteOrg = async (orgId: string, orgName: string) => {
        if (orgId === 'org-default') {
            alert("You cannot delete the Default Organization.");
            return;
        }

        if (!window.confirm(`Are you sure you want to DELETE "${orgName}"?\n\nWARNING: This will permanently delete ALL USERS and DATA associated with this organization. This action cannot be undone.`)) {
            return;
        }

        setIsLoading(true);

        // 1. Delete all users associated with this org
        const { error: usersError } = await supabase.from('app_users').delete().eq('organization_id', orgId);
        if (usersError) {
            alert("Failed to clean up organization users: " + usersError.message);
            setIsLoading(false);
            return;
        }

        // 2. Delete the organization
        const { error: orgError } = await supabase.from('organizations').delete().eq('id', orgId);
        if (orgError) {
            alert("Failed to delete organization: " + orgError.message);
        } else {
            // If we deleted the current context, switch back to default
            if (currentUser?.organizationId === orgId) {
               await switchOrganization('org-default');
            }
            fetchOrganizations();
        }
        setIsLoading(false);
    };

    const handleSwitch = async (orgId: string) => {
        await switchOrganization(orgId);
    };

    return (
        <div className="animate-fadeIn space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                            <BriefcaseIcon className="h-8 w-8 text-indigo-600" />
                            Organization Management
                        </h2>
                        <p className="text-gray-500 mt-1">Create tenants, assign admins, and manage user contexts.</p>
                    </div>
                    {!isCreating && (
                        <button 
                            onClick={() => setIsCreating(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center"
                        >
                            <PlusIcon className="h-5 w-5 mr-2" /> New Organization
                        </button>
                    )}
                </div>

                {isCreating && (
                    <div className="mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200 animate-fadeIn shadow-inner">
                        <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-200 pb-2">1. Organization Details</h3>
                        <form onSubmit={handleCreateOrg}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Organization Name</label>
                                    <input 
                                        type="text" 
                                        value={newOrgName}
                                        onChange={e => setNewOrgName(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. Acme Corp"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plan</label>
                                    <select 
                                        value={newOrgPlan}
                                        onChange={e => setNewOrgPlan(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="standard">Standard</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-6 border-b border-gray-200 pb-2">2. Assign Organization Admin</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Admin Username</label>
                                    <input 
                                        type="text" 
                                        value={adminUsername}
                                        onChange={e => setAdminUsername(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="e.g. admin_acme"
                                        required
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Admin Password</label>
                                    <input 
                                        type="text" 
                                        value={adminPassword}
                                        onChange={e => setAdminPassword(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Strong password"
                                        required
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setIsCreating(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-200 transition-all flex items-center">
                                    {isLoading ? 'Creating...' : 'Create Organization & Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {organizations.map(org => {
                        const isCurrent = currentUser?.organizationId === org.id;
                        return (
                            <div key={org.id} className={`relative p-6 rounded-2xl border transition-all group ${isCurrent ? 'bg-indigo-50 border-indigo-200 shadow-md ring-2 ring-indigo-500 ring-offset-2' : 'bg-white border-gray-200 hover:shadow-lg hover:border-indigo-100'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{org.name}</h3>
                                        <div className="flex gap-2 mt-1">
                                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-1 rounded-md border border-gray-200">
                                                {org.plan}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {isCurrent && <CheckIcon className="h-6 w-6 text-indigo-600" />}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteOrg(org.id, org.name); }}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                            title="Delete Organization"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-gray-100 mt-4">
                                    <button 
                                        onClick={() => handleSwitch(org.id)}
                                        disabled={isCurrent}
                                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-all ${isCurrent ? 'bg-indigo-200 text-indigo-700 cursor-default' : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200'}`}
                                    >
                                        {isCurrent ? (
                                            <>Current Context</>
                                        ) : (
                                            <>
                                                <UserIcon className="h-4 w-4 mr-2" /> Manage Users & Tools
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[10px] text-gray-400 text-center mt-2">
                                        {isCurrent ? "You are currently managing this organization's users." : "Switch to add/edit users for this org."}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
