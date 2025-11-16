
import React, { useState, useEffect } from 'react';
import { SearchForm } from './SearchForm';
import { BusinessList } from './BusinessList';
import { SettingsModal } from './SettingsModal';
import { EmailComposerModal } from './EmailComposerModal';
import { CrmList } from './CrmList';
import { CrmFilterBar } from './CrmFilterBar';
import { UserManagement } from './UserManagement';
import { AddEditUserModal } from './AddEditUserModal';
import { SettingsIcon, UserIcon, DownloadIcon } from './icons';
import { useGeolocation } from '../hooks/useGeolocation';
import { useAuth } from '../context/AuthContext';
import { findBusinesses, findBusinessesOnFacebook } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';
import type { Business, Settings, CrmContact, LeadStatus, User, CrmFilters, GroundingChunk, SearchParams } from '../types';

export function MainApp() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [groundingChunks, setGroundingChunks] = useState<GroundingChunk[] | undefined>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { currentUser, users, updateUsersAndPersist: setUsers, logout } = useAuth();

  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [settings, setSettings] = useState<Settings>({
    fromName: '', fromEmail: '', outreachTopic: '', emailSignature: '',
  });

  const [activeTab, setActiveTab] = useState<'search' | 'crm' | 'users'>('search');
  const [emailedBusinessIds, setEmailedBusinessIds] = useState<string[]>([]);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
                // Don't block the UI, just log it. 
            } else if (data) {
                // Map the `data` jsonb column back to the object
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
            if (error && error.code !== 'PGRST116') { // Ignore "Row not found" error
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
            const createdActivity = c.activities.find(a => a.type === 'created');
            if (!createdActivity) return false;
            const addedDate = new Date(createdActivity.timestamp);
            addedDate.setHours(0, 0, 0, 0);
            if (filters.date.type === 'today') { const today = new Date(); today.setHours(0, 0, 0, 0); return addedDate.getTime() === today.getTime(); }
            if (filters.date.type === 'week') { const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7); oneWeekAgo.setHours(0, 0, 0, 0); return addedDate >= oneWeekAgo; }
            if (filters.date.type === 'month') { const oneMonthAgo = new Date(); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1); oneMonthAgo.setHours(0, 0, 0, 0); return addedDate >= oneMonthAgo; }
            if (filters.date.type === 'custom' && filters.date.startDate && filters.date.endDate) { const startDate = new Date(filters.date.startDate); const endDate = new Date(filters.date.endDate); return addedDate >= startDate && addedDate <= endDate; }
            return true;
        });
      }

      filtered.sort((a, b) => {
        const aDate = new Date(a.activities.find(act => act.type === 'created')?.timestamp || 0).getTime();
        const bDate = new Date(b.activities.find(act => act.type === 'created')?.timestamp || 0).getTime();
        return filters.sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
      });
      return filtered;
  }, [crmContacts, filters, currentUser]);

  const handleSearch = async (params: SearchParams) => {
    setIsLoading(true); setError(null); setBusinesses([]); setActiveTab('search');
    setGroundingChunks([]);
    setLastSearchParams(params);
    setCanLoadMore(false);
    try {
      const { businesses: results, groundingChunks: chunks } = params.source === 'facebook'
        ? await findBusinessesOnFacebook(params.industry, params.keywords, params.location, params.numberOfResults)
        : await findBusinesses(params.industry, params.keywords, params.location, geolocation.coords, params.profileStatus, params.numberOfResults);
      setBusinesses(results);
      setGroundingChunks(chunks);
      if (results.length === params.numberOfResults) {
        setCanLoadMore(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!lastSearchParams || isLoadingMore) return;
    
    setIsLoadingMore(true);
    setError(null);
    const existingBusinessNames = businesses.map(b => b.name);

    try {
        const { businesses: newResults, groundingChunks: newChunks } = lastSearchParams.source === 'facebook'
            ? await findBusinessesOnFacebook(lastSearchParams.industry, lastSearchParams.keywords, lastSearchParams.location, lastSearchParams.numberOfResults, existingBusinessNames)
            : await findBusinesses(lastSearchParams.industry, lastSearchParams.keywords, lastSearchParams.location, geolocation.coords, lastSearchParams.profileStatus, lastSearchParams.numberOfResults, existingBusinessNames);
        
        if (newResults.length > 0) {
            const uniqueNewBusinesses = newResults.filter(newBusiness => !businesses.some(existing => existing.id === newBusiness.id || existing.name === newBusiness.name));
            setBusinesses(prev => [...prev, ...uniqueNewBusinesses]);
            if (newChunks) {
                setGroundingChunks(prev => [...(prev || []), ...newChunks]);
            }
        }
        
        if (newResults.length < lastSearchParams.numberOfResults) {
            setCanLoadMore(false);
        } else {
            setCanLoadMore(true);
        }
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
  
  // Sync helper
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

  const handleRemoveFromCrm = async (businessId: string) => {
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
    // Persistence handled by AuthContext
  };
  
  const handleRemoveUser = async (userId: string) => {
    // Unassign contacts locally
    const contactsToUpdate = crmContacts.filter(c => c.assignedTo === userId);
    const updatedContacts = crmContacts.map(c => c.assignedTo === userId ? { ...c, assignedTo: undefined } : c);
    setCrmContacts(updatedContacts);
    
    // Persist unassigned contacts
    for (const contact of contactsToUpdate) {
        await upsertContactToDb({ ...contact, assignedTo: undefined });
    }

    // Remove user
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
    const headers = ['ID', 'Name', 'Address', 'Phone', 'Website', 'Email', 'Profile Status', 'Source'];
    const rows = businesses.map(b => [ escapeCsvField(b.id), escapeCsvField(b.name), escapeCsvField(b.address), escapeCsvField(b.phone), escapeCsvField(b.website), escapeCsvField(b.email), escapeCsvField(b.profileStatus), escapeCsvField(b.source) ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'prospects.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const crmContactIds = React.useMemo(() => crmContacts.map(c => c.id), [crmContacts]);

  return (
    <>
      <header className="bg-base-200 shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Rit Outreach by Click Zia</h1>
          <div className="flex items-center gap-4">
            {currentUser && (
              <div className="flex items-center text-white">
                <UserIcon className="h-5 w-5 mr-2" />
                <span>{currentUser.username}</span>
              </div>
            )}
            <button onClick={() => setIsSettingsModalOpen(true)} className="text-gray-300 hover:text-white p-2 rounded-full hover:bg-base-300 transition-colors" aria-label="Open settings">
              <SettingsIcon />
            </button>
            <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md transition-colors text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <section className="mb-8">
              <SearchForm onSearch={handleSearch} isLoading={isLoading || isLoadingMore} />
              {geolocation.error && <p className="text-sm text-yellow-400 mt-2">Could not get your location: {geolocation.error.message}.</p>}
          </section>

          <div className="mb-6 border-b border-gray-700">
            <div className="flex space-x-4">
              <button onClick={() => setActiveTab('search')} className={`py-2 px-4 text-lg font-medium transition-colors ${activeTab === 'search' ? 'text-brand-light border-b-2 border-brand-light' : 'text-gray-400 hover:text-white'}`}>Search Results</button>
              <button onClick={() => setActiveTab('crm')} className={`py-2 px-4 text-lg font-medium transition-colors relative ${activeTab === 'crm' ? 'text-brand-light border-b-2 border-brand-light' : 'text-gray-400 hover:text-white'}`}>
                My CRM <span className="absolute top-0 right-0 -mt-1 -mr-1 text-xs bg-brand-primary text-white rounded-full h-5 w-5 flex items-center justify-center">{crmContacts.length}</span>
              </button>
              {currentUser?.role === 'admin' && (
                <button onClick={() => setActiveTab('users')} className={`py-2 px-4 text-lg font-medium transition-colors ${activeTab === 'users' ? 'text-brand-light border-b-2 border-brand-light' : 'text-gray-400 hover:text-white'}`}>User Management</button>
              )}
            </div>
          </div>

          <section>
            {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md mb-6" role="alert">{error}</div>}
            
            {activeTab === 'crm' && <CrmFilterBar filters={filters} onFiltersChange={setFilters} users={users} currentUser={currentUser} />}
            
            {isLoading ? (
                <div className="text-center py-10"><svg className="animate-spin mx-auto h-10 w-10 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p className="mt-4 text-white text-lg">Searching for businesses...</p></div>
            ) : (
              <>
                {activeTab === 'search' && (
                  <div>
                    {businesses.length > 0 && (
                      <div className="flex justify-between items-center mb-4">
                        <p className="text-gray-400">Found {businesses.length} prospects.</p>
                        <button onClick={handleDownloadCsv} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center"><DownloadIcon /><span className="ml-2">Download CSV</span></button>
                      </div>
                    )}
                    <BusinessList businesses={businesses} onComposeEmail={handleComposeEmail} emailedBusinessIds={emailedBusinessIds} onAddToCrm={handleAddToCrm} crmContactIds={crmContactIds} />
                    {groundingChunks && groundingChunks.length > 0 && (
                      <div className="mt-8 p-4 bg-base-200 rounded-lg">
                        <h4 className="text-lg font-semibold text-white mb-3">Data Sources</h4>
                        <ul className="space-y-2">
                          {groundingChunks.map((chunk, index) => {
                            if (chunk.web) {
                              return <li key={index} className="text-sm text-gray-400"><a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:underline">{chunk.web.title || chunk.web.uri}</a></li>;
                            }
                            if (chunk.maps) {
                              return (
                                <li key={index} className="text-sm text-gray-400">
                                  <a href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:underline">{chunk.maps.title || chunk.maps.uri}</a>
                                  {chunk.maps.placeAnswerSources?.map(source => 
                                    source.reviewSnippets?.map((snippet, sIndex) => (
                                      <div key={sIndex} className="pl-4 mt-1 border-l-2 border-gray-700">
                                        <blockquote className="italic text-gray-500">"{snippet.snippet}"</blockquote>
                                        <a href={snippet.uri} target="_blank" rel="noopener noreferrer" className="text-brand-light hover:underline text-xs">{snippet.title}</a>
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
                    )}
                    {canLoadMore && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={handleLoadMore}
                                disabled={isLoadingMore}
                                className="bg-brand-secondary hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                                {isLoadingMore ? (
                                    <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Loading More...</>
                                ) : 'Load More Results'}
                            </button>
                        </div>
                    )}
                  </div>
                )}
                {activeTab === 'crm' && <CrmList contacts={filteredAndSortedContacts} onComposeEmail={handleComposeEmail} emailedBusinessIds={emailedBusinessIds} onRemoveFromCrm={handleRemoveFromCrm} onUpdateStatus={handleUpdateStatus} onAddNote={handleAddNote} users={users} currentUser={currentUser} onAssignContact={handleAssignContact} />}
                {activeTab === 'users' && currentUser?.role === 'admin' && (
                  <UserManagement crmContacts={crmContacts} onAddUser={() => { setEditingUser(null); setIsUserModalOpen(true); }} onEditUser={(user) => { setEditingUser(user); setIsUserModalOpen(true); }} onRemoveUser={handleRemoveUser} />
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={settings} onSave={saveSettings} />
      <EmailComposerModal isOpen={isEmailComposerOpen} onClose={() => setIsEmailComposerOpen(false)} business={selectedBusiness} settings={settings} onEmailSent={handleEmailSent} />
      {isUserModalOpen && <AddEditUserModal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} onSave={handleSaveUser} userToEdit={editingUser} />}
    </>
  );
}
