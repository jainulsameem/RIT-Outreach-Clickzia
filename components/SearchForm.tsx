import React, { useState, useEffect } from 'react';
import { SearchIcon, LocationIcon, FacebookIcon } from './icons';
import { getLocationSuggestions } from '../services/geminiService';
import type { SearchParams, SearchSource, ProfileStatus } from '../types';

interface SearchFormProps {
    onSearch: (params: SearchParams) => void;
    isLoading: boolean;
}

const industries = [
    'All', 'Restaurant', 'Retail', 'Home Services', 'Health & Medical', 'Automotive', 'Beauty & Spa',
    'Real Estate', 'Financial Services', 'Legal Services', 'Education', 'Entertainment', 'Travel'
];

export const SearchForm: React.FC<SearchFormProps> = ({ onSearch, isLoading }) => {
    const [industry, setIndustry] = useState('All');
    const [keywords, setKeywords] = useState('');
    const [location, setLocation] = useState('');
    const [source, setSource] = useState<SearchSource>('google');
    const [profileStatus, setProfileStatus] = useState<ProfileStatus>('all');
    const [numberOfResults, setNumberOfResults] = useState(50);
    
    const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
    const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

    useEffect(() => {
        if (location.trim().length < 3) {
            setLocationSuggestions([]);
            return;
        }

        const debounceTimer = setTimeout(async () => {
            setIsSuggestionsLoading(true);
            try {
                const suggestions = await getLocationSuggestions(location);
                setLocationSuggestions(suggestions);
            } catch (error) {
                console.error("Failed to fetch location suggestions:", error);
                setLocationSuggestions([]);
            } finally {
                setIsSuggestionsLoading(false);
            }
        }, 500); // 500ms debounce delay

        return () => clearTimeout(debounceTimer);
    }, [location]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLocationSuggestions([]);
        if (location.trim() && (keywords.trim() || industry !== 'All')) {
            onSearch({ industry, keywords: keywords.trim(), location: location.trim(), source, profileStatus, numberOfResults });
        }
    };
    
    const handleSuggestionClick = (suggestion: string) => {
        setLocation(suggestion);
        setLocationSuggestions([]);
    };

    const isSearchDisabled = isLoading || !location.trim() || (!keywords.trim() && industry === 'All');

    return (
        <form onSubmit={handleSubmit} className="w-full bg-base-200 p-4 rounded-lg shadow-lg space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Search Source</label>
                <div className="flex bg-base-300 rounded-md border border-gray-600 p-1">
                    <button type="button" onClick={() => setSource('google')} disabled={isLoading} className={`flex-1 text-sm py-2 px-3 rounded transition-colors flex items-center justify-center gap-2 ${source === 'google' ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-base-100'}`}>
                        <LocationIcon /> Google Maps
                    </button>
                    <button type="button" onClick={() => setSource('facebook')} disabled={isLoading} className={`flex-1 text-sm py-2 px-3 rounded transition-colors flex items-center justify-center gap-2 ${source === 'facebook' ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-base-100'}`}>
                        <FacebookIcon /> Facebook Pages
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="industry" className="block text-sm font-medium text-gray-400 mb-1">Industry</label>
                    <select
                        id="industry"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-3 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                        disabled={isLoading}
                    >
                        {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                    </select>
                </div>

                <div>
                    <label htmlFor="keywords" className="block text-sm font-medium text-gray-400 mb-1">Keywords</label>
                    <input
                        type="text"
                        id="keywords"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder="e.g., 'pizza'"
                        className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                        disabled={isLoading}
                    />
                </div>
                
                <div className="relative">
                    <label htmlFor="location" className="block text-sm font-medium text-gray-400 mb-1">Location</label>
                    <div className="relative">
                        <input
                            type="text"
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., 'New York, NY'"
                            className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                            disabled={isLoading}
                            required
                            autoComplete="off"
                        />
                         {isSuggestionsLoading && (
                             <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                             </div>
                        )}
                    </div>
                    {locationSuggestions.length > 0 && (
                        <ul className="absolute z-10 w-full bg-base-300 border border-gray-600 rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
                            {locationSuggestions.map((suggestion, index) => (
                                <li
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-4 py-2 text-white hover:bg-brand-primary cursor-pointer"
                                >
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                 <div>
                    <label htmlFor="profileStatus" className="block text-sm font-medium text-gray-400 mb-1">Profile Status</label>
                    <select
                        id="profileStatus"
                        value={profileStatus}
                        onChange={(e) => setProfileStatus(e.target.value as ProfileStatus)}
                        className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-3 text-white focus:ring-2 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading || source !== 'google'}
                    >
                        <option value="all">All Profiles</option>
                        <option value="claimed">Claimed Only</option>
                        <option value="unclaimed">Unclaimed Only</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="numberOfResults" className="block text-sm font-medium text-gray-400 mb-1">Results per Page</label>
                    <input
                        type="number"
                        id="numberOfResults"
                        value={numberOfResults}
                        onChange={(e) => setNumberOfResults(parseInt(e.target.value, 10))}
                        min="10"
                        max="100"
                        step="10"
                        className="w-full bg-base-300 border border-gray-600 rounded-md px-3 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                        disabled={isLoading}
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isSearchDisabled}
                className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-bold py-3 px-6 rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center"
            >
                {isLoading ? (
                     <><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Searching...</>
                ) : <><SearchIcon /> <span className="ml-2">Find Prospects</span></>}
            </button>
        </form>
    );
};