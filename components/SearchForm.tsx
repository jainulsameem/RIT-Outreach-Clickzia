
import React, { useState, useEffect } from 'react';
import { SearchIcon, LocationIcon, FacebookIcon, LinkedInIcon } from './icons';
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
        }, 500);

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
        <form onSubmit={handleSubmit} className="w-full bg-white p-6 rounded-2xl shadow-lg border border-gray-100 relative overflow-hidden transition-all">
             {/* Glossy highlight effect replaced with soft gradient top for light theme */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80"></div>
            
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Source</label>
                <div className="flex flex-col sm:flex-row bg-gray-50 rounded-xl p-1 border border-gray-200 gap-1">
                    <button type="button" onClick={() => setSource('google')} disabled={isLoading} className={`flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${source === 'google' ? 'bg-white text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
                        <LocationIcon /> Google Maps
                    </button>
                    <button type="button" onClick={() => setSource('facebook')} disabled={isLoading} className={`flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${source === 'facebook' ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
                        <FacebookIcon /> Facebook
                    </button>
                    <button type="button" onClick={() => setSource('linkedin')} disabled={isLoading} className={`flex-1 text-sm font-medium py-2.5 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${source === 'linkedin' ? 'bg-white text-[#0a66c2] shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
                        <LinkedInIcon /> Decision Makers
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                <div className="group">
                    <label htmlFor="industry" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Industry</label>
                    <div className="relative">
                        <select
                            id="industry"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none transition-all hover:bg-gray-100 outline-none"
                            disabled={isLoading}
                        >
                            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="keywords" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Keywords</label>
                    <input
                        type="text"
                        id="keywords"
                        value={keywords}
                        onChange={(e) => setKeywords(e.target.value)}
                        placeholder={source === 'linkedin' ? "e.g., 'CEO', 'Founder'" : "e.g., 'pizza', 'dentist'"}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all hover:bg-gray-100 outline-none"
                        disabled={isLoading}
                    />
                </div>
                
                <div className="relative">
                    <label htmlFor="location" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Location</label>
                    <div className="relative">
                        <input
                            type="text"
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., 'Austin, TX'"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all hover:bg-gray-100 outline-none"
                            disabled={isLoading}
                            required
                            autoComplete="off"
                        />
                         {isSuggestionsLoading && (
                             <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                                <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                             </div>
                        )}
                    </div>
                    {locationSuggestions.length > 0 && (
                        <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl mt-2 shadow-2xl max-h-60 overflow-y-auto">
                            {locationSuggestions.map((suggestion, index) => (
                                <li
                                    key={index}
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-4 py-3 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer text-sm border-b border-gray-100 last:border-0 transition-colors"
                                >
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                 <div>
                    <label htmlFor="profileStatus" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Profile Status</label>
                    <div className="relative">
                        <select
                            id="profileStatus"
                            value={profileStatus}
                            onChange={(e) => setProfileStatus(e.target.value as ProfileStatus)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none transition-all hover:bg-gray-100 outline-none disabled:opacity-50"
                            disabled={isLoading || source !== 'google'}
                        >
                            <option value="all">All Profiles</option>
                            <option value="claimed">Claimed Only</option>
                            <option value="unclaimed">Unclaimed Only</option>
                        </select>
                         <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                </div>
                <div>
                    <label htmlFor="numberOfResults" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Limit</label>
                    <input
                        type="number"
                        id="numberOfResults"
                        value={numberOfResults}
                        onChange={(e) => setNumberOfResults(parseInt(e.target.value, 10))}
                        min="10"
                        max="100"
                        step="10"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all hover:bg-gray-100 outline-none"
                        disabled={isLoading}
                    />
                </div>
            </div>

            <div className="pt-6">
                <button
                    type="submit"
                    disabled={isSearchDisabled}
                    className="w-full bg-btn-gradient hover:bg-btn-gradient-hover text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform active:scale-[0.99] text-lg"
                >
                    {isLoading ? (
                        <span className="flex items-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> AI Search in Progress...</span>
                    ) : (
                        <span className="flex items-center"><SearchIcon /> <span className="ml-2">Find Prospects</span></span>
                    )}
                </button>
            </div>
        </form>
    );
};
