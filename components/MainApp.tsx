
import React, { useState, useEffect } from 'react';
import { SearchForm } from './SearchForm';
import { BusinessList } from './BusinessList';
import { SettingsModal } from './SettingsModal';
import { EmailComposerModal } from './EmailComposerModal';
import { CrmList } from './CrmList';
import { CrmDetailPage } from './CrmDetailPage'; 
import { CrmFilterBar } from './CrmFilterBar';
import { UserManagement } from './UserManagement';
import { AddEditUserModal } from './AddEditUserModal';
import { AddContactModal } from './AddContactModal';
import { EmailPage } from './EmailPage'; 
import { TimeTrackingPage } from './TimeTrackingPage'; 
import { SuperAdminDashboard } from './SuperAdminDashboard'; 
import { InvoicePage } from './InvoicePage'; 
import { ProjectManagementPage } from './ProjectManagementPage'; 
import { CrmSettingsModal } from './CrmSettingsModal';
import { SettingsIcon, UserIcon, DownloadIcon, PlusIcon, InboxIcon, ClockIcon, GridIcon, SearchIcon, BriefcaseIcon, LeadexisLogo, DocumentTextIcon, BoardIcon, AdjustmentsIcon } from './icons'; 
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../context/AuthContext';
import { findBusinesses, findBusinessesOnFacebook, findDecisionMakers } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import type { Business, Settings, CrmContact, LeadStatus, User, CrmFilters, GroundingChunk, SearchParams } from '../types';

// Updated ViewState
type ViewState = 'hub' | 'search' | 'crm-list' | 'crm-detail' | 'users' | 'email-campaign' | 'time-tracking' | 'super-admin' | 'invoicing' | 'projects';

export function MainApp() {
  const [view, setView] = useState<ViewState>('hub'); 
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[] | undefined>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { currentUser, users, updateUsersAndPersist: setUsers, logout } = useAuth();

  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [settings, setSettings] = useState<Settings>({
    fromName: '', fromEmail: '', outreachTopic: '', emailSignature: '',
  });

  const [emailedBusinessIds, setEmailedBusinessIds] = useState<string[]>([]);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
  const [isCrmSettingsModalOpen, setIsCrmSettingsModalOpen] = useState(false);

  const [filters, setFilters] = useState<CrmFilters>({
    status: 'All',
    assignee: 'all',
    date: { type: 'any' },
    sortOrder: 'newest',
  });
  
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState<SearchParams | null>(null);
  const [canLoadMore, setCanLoadMore] = useState(false);

  const geolocation = useGeolocation();

  // Check Permissions Helper
  const hasAccess = (toolId: string) => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true; // Admins have all access
      return currentUser.allowedTools?.includes(toolId) ?? false;
  };

  // Load CRM Contacts from Supabase AND Facebook Leads
  useEffect(() => {
    const loadContactsAndLeads = async () => {
        if (!currentUser) return;
        try {
            // 1. Fetch Existing CRM Contacts
            let query = supabase.from('crm_contacts').select('*');
            const { data: contactsData, error: contactsError } = await query;
            
            let loadedContacts: CrmContact[] = [];
            if (contactsData) {
                loadedContacts = contactsData.map((row: any) => row.data);
            }

            // 2. Fetch Incoming Facebook Leads
            // We only fetch leads that aren't already 'claimed' or moved into the CRM contacts via ID check
            // Note: In a real app, you might use a separate 'processed' flag in the leads table.
            // Here we simply fetch all and merge in memory for the UI.
            const { data: leadsData, error: leadsError } = await supabase.from('leads').select('*');
            
            if (leadsData && leadsData.length > 0) {
                const incomingLeads: CrmContact[] = leadsData.map((l: any) => {
                    // Check if this lead is already in our contacts
                    const exists = loadedContacts.some(c => c.id === l.leadgen_id);
                    if (exists) return null;

                    // Map DB Lead to CrmContact
                    return {
                        id: l.leadgen_id,
                        name: l.full_name || 'Facebook Lead',
                        email: l.email,
                        phone: l.phone_number,
                        address: 'Facebook Lead Ad',
                        source: 'facebook',
                        status: 'New',
                        activities: [{
                            id: `created-${l.leadgen_id}`,
                            type: 'created',
                            content: `Lead received from Facebook Ad (Form: ${l.form_id})`,
                            timestamp: l.created_at
                        }],
                        customSourceDetails: `Form ID: ${l.form_id}`
                    } as CrmContact;
                }).filter((l: any) => l !== null); // Remove nulls (duplicates)

                loadedContacts = [...loadedContacts, ...incomingLeads];
            }

            setCrmContacts(loadedContacts);

            if (contactsError) console.error("Error loading contacts:", contactsError);
            
            if (leadsError) {
                // 42P01 is PostgreSQL error for "relation does not exist" (table missing)
                if (leadsError.code === '42P01') {
                    console.warn("Facebook Leads table not found. Skipping leads sync. Run the SQL script to enable.");
                } else {
                    console.error("Error loading leads:", JSON.stringify(leadsError, null, 2));
                }
            }

        } catch (e) {
            console.error("Unexpected error loading contacts:", e);
        }
    };
    loadContactsAndLeads();
  }, [currentUser]);

  // Load Settings from Supabase
  useEffect(() => {
    if (!currentUser) return;
    const loadSettings = async () => {
        try {
            const { data, error } = await supabase.from('user_settings').select('data').eq('user_id', currentUser.id).single();
            if (error && error.code !== 'PGRST116') { 
                 console.error("Error loading settings:", JSON.stringify(error, null, 2));
            }
            if (data && data.data) {
                setSettings(data.data);
            }
        } catch (e) {
            console.error("Unexpected error loading settings:", e);
        }
    };
    loadSettings();
  }, [currentUser]);

  const saveSettings = async (newSettings: Settings) => {
      setSettings(newSettings);
      if (currentUser) {
          const { error } = await supabase.from('user_settings').upsert({
              user_id: currentUser.id,
              data: newSettings
          });
          if (error) console.error("Error saving settings:", JSON.stringify(error, null, 2));
      }
  };

  const filteredAndSortedContacts = React.useMemo(() => {
      let filtered = [...crmContacts];
      if (filters.status !== 'All') filtered = filtered.filter(c => c.status === filters.status);
      if (filters.assignee === 'me') filtered = filtered.filter(c => c.assignedTo === currentUser?.id);
      else if (filters.assignee === 'unassigned') filtered = filtered.filter(c => !c.assignedTo);
      else if (filters.assignee !== 'all') filtered = filtered.filter(c => c.assignedTo === filters.assignee);

      if (filters.date.type !== 'any') {
        filtered = filtered.filter(c => {
            const createdActivity = c.activities?.find(a => a.type === 'created');
            const timestamp = createdActivity?.timestamp;
            if (!timestamp) return false;
            
            const dateObj = new Date(timestamp);
            const localDateStr = dateObj.toLocaleDateString('en-CA');
            
            if (filters.date.type === 'today') {
                const todayStr = new Date().toLocaleDateString('en-CA');
                return localDateStr === todayStr;
            }
            if (filters.date.type === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return dateObj >= weekAgo;
            }
            if (filters.date.type === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return dateObj >= monthAgo;
            }
            if (filters.date.type === 'custom' && filters.date.startDate && filters.date.endDate) {
                return localDateStr >= filters.date.startDate && localDateStr <= filters.date.endDate;
            }
            return true;
        });
      }

      filtered.sort((a, b) => {
        const aDate = new Date(a.activities?.find(act => act.type === 'created')?.timestamp || 0).getTime();
        const bDate = new Date(b.activities?.find(act => act.type === 'created')?.timestamp || 0).getTime();
        return filters.sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
      });
      return filtered;
  }, [crmContacts, filters, currentUser]);

  const handleSearch = async (params: SearchParams) => {
    setIsLoading(true); setError(null); setBusinesses([]); setView('search');
    setGroundingChunks([]);
    setLastSearchParams(params);
    setCanLoadMore(false);

    const onBatchLoaded = (newData: Business[], newChunks: GroundingChunk[]) => {
         setBusinesses(prev => [...prev, ...newData]);
         if (newChunks) setGroundingChunks(prev => [...(prev || []), ...newChunks]);
    };

    try {
      let results: Business[] = [];
      if (params.source === 'facebook') {
        const response = await findBusinessesOnFacebook(params.industry, params.keywords, params.location, params.numberOfResults, [], onBatchLoaded);
        results = response.businesses;
      } else if (params.source === 'linkedin') {
        const response = await findDecisionMakers(params.industry, params.keywords, params.location, params.numberOfResults, [], onBatchLoaded);
        results = response.businesses;
      } else {
        const response = await findBusinesses(params.industry, params.keywords, params.location, geolocation.coords, params.profileStatus, params.numberOfResults, [], onBatchLoaded);
        results = response.businesses;
      }
      if (results.length >= params.numberOfResults) setCanLoadMore(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!lastSearchParams || isLoadingMore) return;
    setIsLoadingMore(true); setError(null);
    const existingBusinessNames = businesses.map(b => lastSearchParams.source === 'linkedin' ? `${b.contactName}-${b.name}` : b.name);
    const onBatchLoaded = (newData: Business[], newChunks: GroundingChunk[]) => {
         setBusinesses(prev => [...prev, ...newData]);
         if (newChunks) setGroundingChunks(prev => [...(prev || []), ...newChunks]);
    };
    try {
        let newResults: Business[] = [];
        if (lastSearchParams.source === 'facebook') {
            const response = await findBusinessesOnFacebook(lastSearchParams.industry, lastSearchParams.keywords, lastSearchParams.location, lastSearchParams.numberOfResults, existingBusinessNames, onBatchLoaded);
            newResults = response.businesses;
        } else if (lastSearchParams.source === 'linkedin') {
            const response = await findDecisionMakers(lastSearchParams.industry, lastSearchParams.keywords, lastSearchParams.location, lastSearchParams.numberOfResults, existingBusinessNames, onBatchLoaded);
            newResults = response.businesses;
        } else {
            const response = await findBusinesses(lastSearchParams.industry, lastSearchParams.keywords, lastSearchParams.location, geolocation.coords, lastSearchParams.profileStatus, lastSearchParams.numberOfResults, existingBusinessNames, onBatchLoaded);
            newResults = response.businesses;
        }
        if (newResults.length === 0) setCanLoadMore(false);
        else setCanLoadMore(true);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while loading more results.');
        setCanLoadMore(false);
    } finally {
        setIsLoadingMore(false);
    }
  };
  
  const handleComposeEmail = (business: Business) => {
    if (!settings.fromName || !settings.fromEmail || !settings.outreachTopic) {
        setError("Please complete your outreach settings before composing an email.");
        setIsSettingsModalOpen(true);
        return;
    }
    setError(null); setSelectedBusiness(business); setIsEmailComposerOpen(true);
  };
  
  const upsertContactToDb = async (contact: CrmContact) => {
      const { error } = await supabase.from('crm_contacts').upsert({
          id: contact.id,
          assigned_to: contact.assignedTo,
          status: contact.status,
          data: contact
      });
      if (error) console.error("Error upserting contact:", JSON.stringify(error, null, 2));
  };

  const handleEmailSent = async (businessId: string) => {
    setEmailedBusinessIds(prev => [...prev, businessId]);
    const contact = crmContacts.find(c => c.id === businessId);
    if (contact) {
        const updatedContact = {
             ...contact, 
             status: 'Contacted' as LeadStatus, 
             activities: [{ id: Date.now().toString(), type: 'email' as const, content: `Email sent regarding "${settings.outreachTopic}".`, timestamp: new Date().toISOString() }, ...contact.activities]
        };
        setCrmContacts(prev => prev.map(c => c.id === businessId ? updatedContact : c));
        await upsertContactToDb(updatedContact);
    }
  };

  const handleAddToCrm = async (business: Business) => {
    if (crmContacts.some(c => c.id === business.id)) return;
    const newContact: CrmContact = { ...business, status: 'New', activities: [{ id: Date.now().toString(), type: 'created', content: 'Contact added to CRM.', timestamp: new Date().toISOString() }] };
    setCrmContacts(prev => [...prev, newContact]);
    await upsertContactToDb(newContact);
  };
  
  const handleManualAddContact = async (business: Business) => {
      const newContact: CrmContact = { 
          ...business, 
          status: 'New',
          source: 'custom', 
          activities: [{ id: Date.now().toString(), type: 'created', content: 'Manual lead created.', timestamp: new Date().toISOString() }] 
      };
      setCrmContacts(prev => [...prev, newContact]);
      await upsertContactToDb(newContact);
  };

  const handleRemoveFromCrm = async (businessId: string) => {
      if (selectedContactId === businessId) {
          setView('crm-list');
          setSelectedContactId(null);
      }
      setCrmContacts(prev => prev.filter(c => c.id !== businessId));
      
      // If it's a Facebook lead, we technically shouldn't delete from 'leads' table usually, but we can remove from view
      const { error } = await supabase.from('crm_contacts').delete().eq('id', businessId);
      if (error) console.error("Error removing contact:", JSON.stringify(error, null, 2));
  };
  
  const handleUpdateStatus = async (contactId: string, status: LeadStatus) => {
    const contact = crmContacts.find(c => c.id === contactId);
    if (contact) {
        const updatedContact = {
            ...contact, status, activities: [{ id: Date.now().toString(), type: 'status_change' as const, content: `Status changed from ${contact.status} to ${status}.`, timestamp: new Date().toISOString() }, ...contact.activities]
        };
        setCrmContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
        await upsertContactToDb(updatedContact);
    }
  };

  const handleUpdateContactDetails = async (contactId: string, updates: Partial<CrmContact>) => {
    const contact = crmContacts.find(c => c.id === contactId);
    if (contact) {
        const updatedContact = {
            ...contact,
            ...updates,
            activities: [{ 
                id: Date.now().toString(), 
                type: 'note' as const, 
                content: `Contact details updated.`, 
                timestamp: new Date().toISOString() 
            }, ...contact.activities]
        };
        setCrmContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
        await upsertContactToDb(updatedContact);
    }
  };

  const handleAddNote = async (contactId: string, note: string) => {
    const contact = crmContacts.find(c => c.id === contactId);
    if (contact) {
        const updatedContact = {
          ...contact, activities: [{ id: Date.now().toString(), type: 'note' as const, content: note, timestamp: new Date().toISOString() }, ...contact.activities]
        };
        setCrmContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
        await upsertContactToDb(updatedContact);
    }
  };
  
  const handleAssignContact = async (contactId: string, userId: string | 'unassigned') => {
    const user = users.find(u => u.id === userId);
    const contact = crmContacts.find(c => c.id === contactId);
    if (contact) {
        const prevAssignee = users.find(u => u.id === contact.assignedTo)?.username || 'unassigned';
        const updatedContact = { 
          ...contact, assignedTo: userId === 'unassigned' ? undefined : userId, 
          activities: [{ id: Date.now().toString(), type: 'assignment' as const, content: userId === 'unassigned' ? `Unassigned from ${prevAssignee}.` : `Assigned to ${user?.username} by ${currentUser?.username}.`, timestamp: new Date().toISOString() }, ...contact.activities] 
        };
        setCrmContacts(prev => prev.map(c => c.id === contactId ? updatedContact : c));
        await upsertContactToDb(updatedContact);
    }
  };

  const handleSaveUser = (user: User) => {
    const updatedUser = { ...user, organizationId: currentUser?.organizationId };
    if (user.id) {
      setUsers(users.map(u => u.id === user.id ? updatedUser : u));
    } else {
      setUsers([...users, { ...updatedUser, id: `user-${Date.now()}` }]);
    }
  };
  
  const handleRemoveUser = async (userId: string) => {
    const contactsToUpdate = crmContacts.filter(c => c.assignedTo === userId);
    const updatedContacts = crmContacts.map(c => c.assignedTo === userId ? { ...c, assignedTo: undefined } : c);
    setCrmContacts(updatedContacts);
    for (const contact of contactsToUpdate) {
        await upsertContactToDb({ ...contact, assignedTo: undefined });
    }
    setUsers(users.filter(u => u.id !== userId));
    const { error } = await supabase.from('app_users').delete().eq('id', userId);
    if (error) console.error("Error removing user:", JSON.stringify(error, null, 2));
  };

  const handleDownloadCsv = () => {
    if (businesses.length === 0) return;
    const escapeCsvField = (field: any): string => {
        if (field === null || field === undefined) return '';
        return `"${String(field).replace(/"/g, '""')}"`;
    };
    const headers = ['ID', 'Name', 'Contact Name', 'Contact Role', 'Address', 'Phone', 'Website', 'Email', 'LinkedIn', 'Profile Status', 'Source', 'Source Details'];
    const rows = businesses.map(b => [ 
        escapeCsvField(b.id), 
        escapeCsvField(b.name),
        escapeCsvField(b.contactName),
        escapeCsvField(b.contactRole),
        escapeCsvField(b.address), 
        escapeCsvField(b.phone), 
        escapeCsvField(b.website), 
        escapeCsvField(b.email), 
        escapeCsvField(b.linkedinUrl),
        escapeCsvField(b.profileStatus), 
        escapeCsvField(b.source),
        escapeCsvField(b.customSourceDetails)
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'prospects.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const crmContactIds = React.useMemo(() => crmContacts.map(c => c.id), [crmContacts]);

  const handleViewDetails = (contactId: string) => {
      setSelectedContactId(contactId);
      setView('crm-detail');
      window.scrollTo(0, 0);
  };

  const handleBackToCrmList = () => {
      setView('crm-list');
      setSelectedContactId(null);
  };

  const renderLoadingState = () => (
    <div className="text-center py-20 glass-panel rounded-xl mx-auto max-w-md">
        <svg className="animate-spin mx-auto h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-gray-900 text-xl font-medium">Scouring the web for prospects...</p>
        <p className="text-gray-500 text-sm mt-2">This AI-powered search is finding real-time data.</p>
    </div>
  );

  const renderGroundingChunks = () => {
    if (!groundingChunks || groundingChunks.length === 0) return null;
    return (
      <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Source Intelligence
        </h4>
        <ul className="space-y-3">
          {groundingChunks.map((chunk, index) => {
            if (chunk.web) {
              return <li key={index} className="text-sm text-gray-600 flex items-start gap-2"><span className="mt-1 text-indigo-500">•</span><a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline hover:text-indigo-800 transition-colors">{chunk.web.title || chunk.web.uri}</a></li>;
            }
            if (chunk.maps) {
              return (
                <li key={index} className="text-sm text-gray-600">
                  <a href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline hover:text-indigo-800 transition-colors font-medium block mb-1">{chunk.maps.title || chunk.maps.uri}</a>
                  {chunk.maps.placeAnswerSources?.map((source, idx) => 
                    source.reviewSnippets?.map((snippet, sIndex) => (
                      <div key={`${idx}-${sIndex}`} className="pl-4 mt-2 border-l-2 border-indigo-200 py-1">
                        <blockquote className="italic text-gray-500 text-xs">"{snippet.snippet}"</blockquote>
                      </div>
                    ))
                  )}
                </li>
              );
            }
            return null;
          })}
        </ul>
      </div>
    );
  };

  const HubCard = ({ title, description, icon, onClick, colorClass }: { title: string, description: string, icon: React.ReactNode, onClick: () => void, colorClass: string }) => (
      <button 
        onClick={onClick}
        className="group relative bg-white p-8 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 text-left flex flex-col h-full overflow-hidden hover:-translate-y-1"
      >
          <div className={`absolute top-0 left-0 w-full h-2 ${colorClass}`}></div>
          <div className="mb-6 p-4 rounded-2xl bg-gray-50 w-fit group-hover:bg-gray-100 transition-colors">
              <div className="text-gray-700 group-hover:text-indigo-600 transition-colors">
                {icon}
              </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
          <div className="mt-auto pt-6 flex items-center text-sm font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
              Open Tool &rarr;
          </div>
      </button>
  );

  const renderHub = () => (
      <div className="animate-fadeIn max-w-5xl mx-auto py-8">
          <div className="text-center mb-12">
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">Welcome Back, {currentUser?.username}</h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">Select a tool to manage your outreach, relationships, campaigns, or time tracking.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Super Admin Card */}
              {currentUser?.id === 'master-admin' && (
                   <HubCard 
                      title="Organization Admin" 
                      description="Manage tenants, create new organizations, and switch contexts."
                      icon={<BriefcaseIcon className="h-8 w-8" />}
                      onClick={() => setView('super-admin')}
                      colorClass="bg-gradient-to-r from-gray-800 to-black"
                  />
              )}

              {hasAccess('search') && (
                  <HubCard 
                      title="Outreach Finder" 
                      description="Discover new prospects using AI-powered search across Google Maps, Facebook, and LinkedIn."
                      icon={<SearchIcon className="h-8 w-8" />}
                      onClick={() => setView('search')}
                      colorClass="bg-gradient-to-r from-blue-500 to-cyan-500"
                  />
              )}
              {hasAccess('crm-list') && (
                  <HubCard 
                      title="CRM Pipeline" 
                      description="Manage your leads, track interactions, and move prospects through your sales funnel."
                      icon={<BriefcaseIcon className="h-8 w-8" />}
                      onClick={() => setView('crm-list')}
                      colorClass="bg-gradient-to-r from-indigo-500 to-purple-500"
                  />
              )}
              {hasAccess('email-campaign') && (
                  <HubCard 
                      title="Email Campaigns" 
                      description="Compose personalized cold emails, manage templates, and track sent messages."
                      icon={<InboxIcon className="h-8 w-8" />}
                      onClick={() => setView('email-campaign')}
                      colorClass="bg-gradient-to-r from-pink-500 to-rose-500"
                  />
              )}
              {hasAccess('projects') && (
                  <HubCard 
                      title="Project Management" 
                      description="Organize tasks, track progress with Kanban boards, and log time against projects."
                      icon={<BoardIcon className="h-8 w-8" />}
                      onClick={() => setView('projects')}
                      colorClass="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  />
              )}
              {hasAccess('time-tracking') && (
                  <HubCard 
                      title="Time Tracking" 
                      description="Log work hours, manage timesheets, book time off, and process payroll."
                      icon={<ClockIcon className="h-8 w-8" />}
                      onClick={() => setView('time-tracking')}
                      colorClass="bg-gradient-to-r from-amber-500 to-orange-500"
                  />
              )}
              {hasAccess('invoicing') && (
                  <HubCard 
                      title="Invoicing & Inventory" 
                      description="Create professional invoices, manage inventory, and share via WhatsApp/Email."
                      icon={<DocumentTextIcon className="h-8 w-8" />}
                      onClick={() => setView('invoicing')}
                      colorClass="bg-gradient-to-r from-teal-500 to-emerald-500"
                  />
              )}
              {currentUser?.role === 'admin' && (
                  <HubCard 
                      title="User Management" 
                      description="Add new team members, manage roles, and handle access permissions."
                      icon={<UserIcon className="h-8 w-8" />}
                      onClick={() => setView('users')}
                      colorClass="bg-gradient-to-r from-gray-600 to-gray-800"
                  />
              )}
          </div>
      </div>
  );

  return (
    <React.Fragment>
      <header className="sticky top-0 z-50 glass-header shadow-sm print:hidden">
        <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
             <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('hub')}>
                <div className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center overflow-hidden">
                   <LeadexisLogo className="w-full h-full" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">Leadexis</h1>
                    <p className="text-[10px] text-indigo-600 uppercase tracking-widest font-bold">Powered by Clickzia</p>
                </div>
             </div>
             <button onClick={logout} className="md:hidden text-sm font-medium text-red-500 hover:text-red-700 px-3 py-1.5 bg-red-50 rounded-lg">Logout</button>
          </div>

          {/* Main Navigation - Horizontal Scroll on Mobile */}
          <nav className="flex bg-gray-100/50 p-1 rounded-xl border border-gray-200 backdrop-blur-sm w-full md:w-auto overflow-x-auto no-scrollbar">
            <button 
                onClick={() => setView('hub')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'hub' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
            >
                <GridIcon className="h-4 w-4" /> Apps
            </button>
            
            {currentUser?.id === 'master-admin' && (
                 <button 
                    onClick={() => setView('super-admin')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${view === 'super-admin' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                >
                    Organizations
                </button>
            )}
            {hasAccess('search') && (
                <button 
                    onClick={() => setView('search')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${view === 'search' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                >
                    Outreach
                </button>
            )}
            {hasAccess('crm-list') && (
                <button 
                    onClick={() => setView(view === 'crm-detail' ? 'crm-detail' : 'crm-list')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all relative whitespace-nowrap ${view.startsWith('crm') ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                >
                    CRM
                    {crmContacts.length > 0 && <span className="absolute top-1.5 right-1.5 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span></span>}
                </button>
            )}
            {hasAccess('email-campaign') && (
                <button 
                    onClick={() => setView('email-campaign')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'email-campaign' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                >
                    Email
                </button>
            )}
            {hasAccess('projects') && (
                <button 
                    onClick={() => setView('projects')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'projects' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                >
                    Projects
                </button>
            )}
            {hasAccess('time-tracking') && (
                <button 
                    onClick={() => setView('time-tracking')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'time-tracking' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                >
                    Time
                </button>
            )}
            {hasAccess('invoicing') && (
                <button 
                    onClick={() => setView('invoicing')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'invoicing' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'}`}
                >
                    Invoices
                </button>
            )}
          </nav>
          
          <div className="flex items-center gap-2 hidden md:flex">
            {currentUser && (
              <div className="flex items-center text-gray-600 text-sm mr-2 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                <UserIcon className="h-4 w-4 mr-2 text-indigo-500" />
                <span className="font-medium">{currentUser.username}</span>
                {currentUser.id === 'master-admin' && <span className="ml-2 text-[10px] bg-black text-white px-1.5 rounded uppercase font-bold">Master</span>}
              </div>
            )}
            <button onClick={() => setIsSettingsModalOpen(true)} className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-all" title="Global Settings">
              <SettingsIcon />
            </button>
            <button onClick={logout} className="text-sm font-medium text-red-500 hover:text-red-700 px-3 py-1.5 hover:bg-red-50 rounded-lg transition-all">
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto p-4 md:p-6 max-w-6xl print:max-w-none print:p-0">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-4 rounded-xl mb-6 shadow-sm print:hidden" role="alert">{error}</div>}

          <section className="min-h-[500px] animate-fadeIn">
            
            {view === 'hub' && renderHub()}

            {view === 'super-admin' && currentUser?.id === 'master-admin' && (
                <SuperAdminDashboard />
            )}

            {view === 'search' && hasAccess('search') && (
                  <>
                    <div className="mb-8">
                         <SearchForm onSearch={handleSearch} isLoading={isLoading || isLoadingMore} />
                         {geolocation.error && <p className="text-sm text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg inline-block border border-amber-200">⚠️ Could not get location: {geolocation.error.message}.</p>}
                    </div>

                    {isLoading && businesses.length === 0 ? renderLoadingState() : (
                      <React.Fragment>
                        {businesses.length > 0 && (
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                            <p className="text-gray-600 font-medium bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">Found <span className="text-indigo-600 font-bold">{businesses.length}</span> prospects{isLoading ? " (scanning...)" : ""}</p>
                            <button onClick={handleDownloadCsv} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center shadow-lg shadow-green-100 border border-green-500/30"><DownloadIcon /><span className="ml-2">Download CSV</span></button>
                          </div>
                        )}
                        <BusinessList businesses={businesses} onComposeEmail={handleComposeEmail} emailedBusinessIds={emailedBusinessIds} onAddToCrm={handleAddToCrm} crmContactIds={crmContactIds} />
                        
                        {isLoading && businesses.length > 0 && (
                             <div className="flex flex-col items-center py-8">
                                <svg className="animate-spin h-8 w-8 text-indigo-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span className="text-gray-500 text-sm animate-pulse">Finding more results...</span>
                             </div>
                        )}

                        {renderGroundingChunks()}

                        {!isLoading && canLoadMore && (
                            <div className="flex justify-center mt-10">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-3 px-8 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-full sm:w-auto"
                                >
                                    {isLoadingMore ? (
                                        <span className="flex items-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Digging deeper...</span>
                                    ) : 'Load More Results'}
                                </button>
                            </div>
                        )}
                      </React.Fragment>
                    )}
                  </>
            )}
            
            {view === 'crm-list' && hasAccess('crm-list') && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-bold text-gray-900">My Pipeline</h2>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsCrmSettingsModalOpen(true)}
                                className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg shadow-sm transition-all flex items-center"
                            >
                                <AdjustmentsIcon className="h-5 w-5 mr-2 text-gray-500" /> Settings
                            </button>
                            <button 
                                onClick={() => setIsAddContactModalOpen(true)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg shadow-indigo-200 transition-all flex items-center"
                            >
                                <PlusIcon className="h-5 w-5 mr-2" /> Add Lead
                            </button>
                        </div>
                    </div>
                    <CrmFilterBar filters={filters} onFiltersChange={setFilters} users={users} currentUser={currentUser} />
                    <CrmList 
                        contacts={filteredAndSortedContacts} 
                        onViewDetails={handleViewDetails} 
                        currentUser={currentUser}
                        users={users}
                    />
                </>
            )}

            {view === 'crm-detail' && hasAccess('crm-list') && selectedContactId && (() => {
                const contact = crmContacts.find(c => c.id === selectedContactId);
                if (!contact) return <div className="text-gray-600 text-center">Contact not found. <button onClick={handleBackToCrmList} className="text-indigo-600 underline">Go Back</button></div>;
                return (
                    <CrmDetailPage 
                        contact={contact}
                        onBack={handleBackToCrmList}
                        onComposeEmail={handleComposeEmail}
                        hasBeenEmailed={emailedBusinessIds.includes(contact.id)}
                        onRemoveFromCrm={handleRemoveFromCrm}
                        onUpdateStatus={handleUpdateStatus}
                        onAddNote={handleAddNote}
                        users={users}
                        currentUser={currentUser}
                        onAssignContact={handleAssignContact}
                        onUpdateContactDetails={handleUpdateContactDetails}
                    />
                );
            })()}
            
            {view === 'email-campaign' && hasAccess('email-campaign') && (
                <EmailPage 
                    crmContacts={crmContacts} 
                    settings={settings} 
                    onUpdateContact={handleUpdateContactDetails}
                />
            )}

            {view === 'projects' && hasAccess('projects') && (
                <ProjectManagementPage />
            )}

            {view === 'time-tracking' && hasAccess('time-tracking') && (
                <TimeTrackingPage />
            )}

            {view === 'invoicing' && hasAccess('invoicing') && (
                <InvoicePage />
            )}
            
            {view === 'users' && currentUser?.role === 'admin' && (
               <UserManagement crmContacts={crmContacts} onAddUser={() => { setEditingUser(null); setIsUserModalOpen(true); }} onEditUser={(user) => { setEditingUser(user); setIsUserModalOpen(true); }} onRemoveUser={handleRemoveUser} />
            )}

          </section>
      </div>

      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onSave={saveSettings} />
      <CrmSettingsModal isOpen={isCrmSettingsModalOpen} onClose={() => setIsCrmSettingsModalOpen(false)} />
      <EmailComposerModal isOpen={isEmailComposerOpen} onClose={() => setIsEmailComposerOpen(false)} business={selectedBusiness} settings={settings} onEmailSent={handleEmailSent} />
      <AddContactModal isOpen={isAddContactModalOpen} onClose={() => setIsAddContactModalOpen(false)} onSave={handleManualAddContact} />
      {isUserModalOpen && <AddEditUserModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} onSave={handleSaveUser} userToEdit={editingUser} />}
    </React.Fragment>
  );
}
