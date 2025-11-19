
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
import { EmailPage } from './EmailPage'; // Import EmailPage
import { TimeTrackingPage } from './TimeTrackingPage'; // Import TimeTrackingPage
import { SettingsIcon, UserIcon, DownloadIcon, PlusIcon, InboxIcon, ClockIcon } from './icons'; // Import InboxIcon, ClockIcon
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../context/AuthContext';
import { findBusinesses, findBusinessesOnFacebook, findDecisionMakers } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import type { Business, Settings, CrmContact, LeadStatus, User, CrmFilters, GroundingChunk, SearchParams } from '../types';

// Define view states to act like pages
type ViewState = 'search' | 'crm-list' | 'crm-detail' | 'users' | 'email-campaign' | 'time-tracking';

export function MainApp() {
  const [view, setView] = useState<ViewState>('search');
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

  // Load CRM Contacts from Supabase
  useEffect(() => {
    const loadContacts = async () => {
        try {
            const { data, error } = await supabase.from('crm_contacts').select('*');
            if (error) {
                console.error("Error loading contacts from Supabase:", JSON.stringify(error, null, 2));
            } else if (data) {
                const loadedContacts = data.map((row: any) => row.data);
                setCrmContacts(loadedContacts);
            }
        } catch (e) {
            console.error("Unexpected error loading contacts:", e);
        }
    };
    loadContacts();
  }, []);

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
            // 'en-CA' locale format is YYYY-MM-DD, ensuring we compare local dates correctly
            const localDateStr = dateObj.toLocaleDateString('en-CA');
            
            if (filters.date.type === 'today') {
                const todayStr = new Date().toLocaleDateString('en-CA');
                return localDateStr === todayStr;
            }
            if (filters.date.type === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                // For week/month, full object comparison is safer for "last X days" logic
                return dateObj >= weekAgo;
            }
            if (filters.date.type === 'month') {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return dateObj >= monthAgo;
            }
            if (filters.date.type === 'custom' && filters.date.startDate && filters.date.endDate) {
                // Compare date strings to be timezone-agnostic for user selected range
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
          source: 'custom', // Explicitly marking as custom
          activities: [{ id: Date.now().toString(), type: 'created', content: 'Manual lead created.', timestamp: new Date().toISOString() }] 
      };
      setCrmContacts(prev => [...prev, newContact]);
      await upsertContactToDb(newContact);
  };

  const handleRemoveFromCrm = async (businessId: string) => {
      // If deleting the currently viewed contact, go back to list
      if (selectedContactId === businessId) {
          setView('crm-list');
          setSelectedContactId(null);
      }
      setCrmContacts(prev => prev.filter(c => c.id !== businessId));
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
    if (user.id) {
      setUsers(users.map(u => u.id === user.id ? user : u));
    } else {
      setUsers([...users, { ...user, id: `user-${Date.now()}` }]);
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

  // --- Navigation Logic ---
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
        <svg className="animate-spin mx-auto h-12 w-12 text-brand-primary mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-white text-xl font-medium">Scouring the web for prospects...</p>
        <p className="text-gray-400 text-sm mt-2">This AI-powered search is finding real-time data.</p>
    </div>
  );

  const renderGroundingChunks = () => {
    if (!groundingChunks || groundingChunks.length === 0) return null;
    return (
      <div className="mt-8 p-6 glass-panel rounded-xl border-t border-brand-primary/20">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Source Intelligence
        </h4>
        <ul className="space-y-3">
          {groundingChunks.map((chunk, index) => {
            if (chunk.web) {
              return <li key={index} className="text-sm text-gray-400 flex items-start gap-2"><span className="mt-1 text-brand-primary">•</span><a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:underline hover:text-white transition-colors">{chunk.web.title || chunk.web.uri}</a></li>;
            }
            if (chunk.maps) {
              return (
                <li key={index} className="text-sm text-gray-400">
                  <a href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:underline hover:text-white transition-colors font-medium block mb-1">{chunk.maps.title || chunk.maps.uri}</a>
                  {chunk.maps.placeAnswerSources?.map((source, idx) => 
                    source.reviewSnippets?.map((snippet, sIndex) => (
                      <div key={`${idx}-${sIndex}`} className="pl-4 mt-2 border-l-2 border-brand-primary/30 py-1">
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

  return (
    <React.Fragment>
      <header className="sticky top-0 z-50 glass-header shadow-lg border-b border-white/5">
        <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20">
                   <span className="text-white font-bold text-lg">R</span>
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight leading-tight">Rit Outreach</h1>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Click Zia</p>
                </div>
             </div>
             {/* Mobile Settings/Logout Toggle could go here */}
          </div>

          {/* Main Navigation - Now in Header */}
          <nav className="flex bg-base-300/50 p-1 rounded-lg border border-white/5 backdrop-blur-sm w-full md:w-auto overflow-x-auto">
            <button 
                onClick={() => setView('search')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${view === 'search' ? 'bg-brand-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                Search Results
            </button>
            <button 
                onClick={() => setView(view === 'crm-detail' ? 'crm-detail' : 'crm-list')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all relative whitespace-nowrap ${view.startsWith('crm') ? 'bg-brand-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                My CRM
                {crmContacts.length > 0 && <span className="absolute top-1.5 right-1.5 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span></span>}
            </button>
            <button 
                onClick={() => setView('email-campaign')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'email-campaign' ? 'bg-brand-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <InboxIcon className="h-4 w-4" /> Email
            </button>
            <button 
                onClick={() => setView('time-tracking')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${view === 'time-tracking' ? 'bg-brand-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
                <ClockIcon className="h-4 w-4" /> Time
            </button>
            {currentUser?.role === 'admin' && (
                <button 
                    onClick={() => setView('users')}
                    className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${view === 'users' ? 'bg-brand-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    Users
                </button>
            )}
          </nav>
          
          <div className="flex items-center gap-2 hidden md:flex">
            {currentUser && (
              <div className="flex items-center text-gray-300 text-sm mr-2">
                <UserIcon className="h-4 w-4 mr-2 text-brand-secondary" />
                <span className="font-medium">{currentUser.username}</span>
              </div>
            )}
            <button onClick={() => setIsSettingsModalOpen(true)} className="text-gray-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all" title="Settings">
              <SettingsIcon />
            </button>
            <button onClick={logout} className="text-sm font-medium text-red-400 hover:text-red-300 px-3 py-1.5 hover:bg-red-500/10 rounded-lg transition-all">
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto p-4 md:p-6 max-w-6xl">
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-4 rounded-xl mb-6 shadow-lg backdrop-blur-sm" role="alert">{error}</div>}

          <section className="min-h-[500px] animate-fadeIn">
            
            {/* --- SEARCH VIEW --- */}
            {view === 'search' && (
                  <>
                    <div className="mb-8">
                         <SearchForm onSearch={handleSearch} isLoading={isLoading || isLoadingMore} />
                         {geolocation.error && <p className="text-sm text-yellow-400 mt-2 bg-yellow-500/10 p-2 rounded-lg inline-block border border-yellow-500/20">⚠️ Could not get location: {geolocation.error.message}.</p>}
                    </div>

                    {isLoading && businesses.length === 0 ? renderLoadingState() : (
                      <React.Fragment>
                        {businesses.length > 0 && (
                          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                            <p className="text-gray-300 font-medium bg-base-300/50 px-4 py-2 rounded-full border border-white/5">Found <span className="text-white font-bold">{businesses.length}</span> prospects{isLoading ? " (scanning...)" : ""}</p>
                            <button onClick={handleDownloadCsv} className="bg-green-600/90 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center shadow-lg shadow-green-900/20 border border-green-500/30"><DownloadIcon /><span className="ml-2">Download CSV</span></button>
                          </div>
                        )}
                        <BusinessList businesses={businesses} onComposeEmail={handleComposeEmail} emailedBusinessIds={emailedBusinessIds} onAddToCrm={handleAddToCrm} crmContactIds={crmContactIds} />
                        
                        {isLoading && businesses.length > 0 && (
                             <div className="flex flex-col items-center py-8">
                                <svg className="animate-spin h-8 w-8 text-brand-accent mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span className="text-gray-400 text-sm animate-pulse">Finding more results...</span>
                             </div>
                        )}

                        {renderGroundingChunks()}

                        {!isLoading && canLoadMore && (
                            <div className="flex justify-center mt-10">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore}
                                    className="bg-base-200 hover:bg-base-300 text-white border border-white/10 font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-brand-primary/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-full sm:w-auto"
                                >
                                    {isLoadingMore ? (
                                        <span className="flex items-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Digging deeper...</span>
                                    ) : 'Load More Results'}
                                </button>
                            </div>
                        )}
                      </React.Fragment>
                    )}
                  </>
            )}
            
            {/* --- CRM LIST VIEW --- */}
            {view === 'crm-list' && (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-bold text-white">My Pipeline</h2>
                         <button 
                            onClick={() => setIsAddContactModalOpen(true)}
                            className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-all flex items-center"
                        >
                            <PlusIcon className="h-5 w-5 mr-2" /> Add Lead
                        </button>
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

            {/* --- CRM DETAIL VIEW --- */}
            {view === 'crm-detail' && selectedContactId && (() => {
                const contact = crmContacts.find(c => c.id === selectedContactId);
                if (!contact) return <div className="text-white text-center">Contact not found. <button onClick={handleBackToCrmList} className="text-brand-primary underline">Go Back</button></div>;
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
            
            {/* --- EMAIL CAMPAIGN VIEW --- */}
            {view === 'email-campaign' && (
                <EmailPage 
                    crmContacts={crmContacts} 
                    settings={settings} 
                    onUpdateContact={handleUpdateContactDetails}
                />
            )}

            {/* --- TIME TRACKING VIEW --- */}
            {view === 'time-tracking' && (
                <TimeTrackingPage />
            )}
            
            {/* --- USER MANAGEMENT VIEW --- */}
            {view === 'users' && currentUser?.role === 'admin' && (
               <UserManagement crmContacts={crmContacts} onAddUser={() => { setEditingUser(null); setIsUserModalOpen(true); }} onEditUser={(user) => { setEditingUser(user); setIsUserModalOpen(true); }} onRemoveUser={handleRemoveUser} />
            )}

          </section>
      </div>

      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onSave={saveSettings} />
      <EmailComposerModal isOpen={isEmailComposerOpen} onClose={() => setIsEmailComposerOpen(false)} business={selectedBusiness} settings={settings} onEmailSent={handleEmailSent} />
      <AddContactModal isOpen={isAddContactModalOpen} onClose={() => setIsAddContactModalOpen(false)} onSave={handleManualAddContact} />
      {isUserModalOpen && <AddEditUserModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} onSave={handleSaveUser} userToEdit={editingUser} />}
    </React.Fragment>
  );
}
