
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
    DocumentTextIcon, CubeIcon, SettingsIcon, PlusIcon, TrashIcon, 
    EditIcon, PrinterIcon, WhatsAppIcon, EmailIcon, DownloadIcon,
    ShoppingCartIcon, ChevronLeftIcon, CheckIcon, ArrowLeftIcon
} from './icons';
import type { Product, Invoice, InvoiceItem, InvoiceSettings, CrmContact } from '../types';

const DEFAULT_SETTINGS: InvoiceSettings = {
    organizationId: '',
    companyName: '',
    companyAddress: '',
    companyEmail: '',
    companyPhone: '',
    companyWebsite: '',
    logoUrl: '',
    taxRate: 10,
    currency: '$',
    nextInvoiceNumber: 1000
};

const COUNTRY_CODES = [
    { code: '+1', label: 'US/CA (+1)' },
    { code: '+44', label: 'UK (+44)' },
    { code: '+91', label: 'IN (+91)' },
    { code: '+61', label: 'AU (+61)' },
    { code: '+81', label: 'JP (+81)' },
    { code: '+49', label: 'DE (+49)' },
    { code: '+33', label: 'FR (+33)' },
    { code: '+971', label: 'UAE (+971)' },
];

export const InvoicePage: React.FC = () => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'inventory' | 'settings' | 'builder' | 'viewer'>('dashboard');
    const [isLoading, setIsLoading] = useState(false);
    
    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);
    const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);

    // Editing / Builder State
    const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
    const [productForm, setProductForm] = useState<Partial<Product>>({});
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [selectedCountryCode, setSelectedCountryCode] = useState('+1');

    const orgId = currentUser?.organizationId || 'org-default';

    // Fetch Data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Settings
            const { data: setRes } = await supabase.from('invoice_settings').select('data').eq('organization_id', orgId).single();
            if (setRes) setSettings({ ...DEFAULT_SETTINGS, ...setRes.data, organizationId: orgId });
            else setSettings({ ...DEFAULT_SETTINGS, organizationId: orgId });

            // Products
            const { data: prodRes } = await supabase.from('products').select('data').eq('organization_id', orgId);
            if (prodRes) setProducts(prodRes.map((r: any) => r.data));

            // Invoices
            const { data: invRes } = await supabase.from('invoices').select('data').eq('organization_id', orgId).order('created_at', { ascending: false });
            if (invRes) setInvoices(invRes.map((r: any) => r.data));

            // CRM Contacts (for customer selection)
            const { data: crmRes } = await supabase.from('crm_contacts').select('data');
            if (crmRes) setCrmContacts(crmRes.map((r: any) => r.data));

        } catch (error) {
            console.error('Error loading invoice data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (orgId) fetchData();
    }, [orgId]);

    // --- Actions ---

    const saveProduct = async () => {
        if (!productForm.name || !productForm.price) return alert('Name and Price are required');
        
        const newProduct: Product = {
            id: productForm.id || `prod-${Date.now()}`,
            name: productForm.name,
            description: productForm.description || '',
            price: Number(productForm.price),
            type: productForm.type || 'service',
            stock: productForm.type === 'product' ? Number(productForm.stock || 0) : undefined,
            sku: productForm.sku || ''
        };

        const updatedProducts = productForm.id 
            ? products.map(p => p.id === newProduct.id ? newProduct : p)
            : [...products, newProduct];
            
        setProducts(updatedProducts);
        await supabase.from('products').upsert({ id: newProduct.id, organization_id: orgId, data: newProduct });
        setIsProductModalOpen(false);
        setProductForm({});
    };

    const deleteProduct = async (id: string) => {
        if (!confirm('Delete this item?')) return;
        setProducts(prev => prev.filter(p => p.id !== id));
        await supabase.from('products').delete().eq('id', id);
    };

    const saveSettingsConfig = async () => {
        await supabase.from('invoice_settings').upsert({ organization_id: orgId, data: settings });
        alert('Settings Saved');
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 1024 * 1024) { // 1MB limit
            alert("Logo file size must be less than 1MB to ensure fast loading.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setSettings({ ...settings, logoUrl: base64String });
        };
        reader.readAsDataURL(file);
    };

    const createNewInvoice = () => {
        const newInv: Invoice = {
            id: `inv-${Date.now()}`,
            number: `INV-${settings.nextInvoiceNumber}`,
            customerName: '',
            date: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [],
            subtotal: 0,
            taxRate: settings.taxRate,
            taxAmount: 0,
            total: 0,
            status: 'draft',
            createdAt: new Date().toISOString()
        };
        setCurrentInvoice(newInv);
        setActiveTab('builder');
    };

    const handleEditInvoice = async () => {
        if (!currentInvoice) return;

        // If Invoice is NOT draft (Pending or Paid), we must return stock
        if (currentInvoice.status !== 'draft') {
            if (!window.confirm("Editing a finalized invoice will revert stock quantities and set status to Draft. Continue?")) {
                return;
            }

            // 1. Revert Stock
            const updatedProducts = [...products];
            for (const item of currentInvoice.items) {
                if (item.productId) {
                    const prodIndex = updatedProducts.findIndex(p => p.id === item.productId);
                    if (prodIndex > -1 && updatedProducts[prodIndex].type === 'product') {
                        const currentStock = updatedProducts[prodIndex].stock || 0;
                        const newStock = currentStock + item.quantity;
                        
                        // Update in Memory
                        updatedProducts[prodIndex] = { ...updatedProducts[prodIndex], stock: newStock };
                        
                        // Update in DB
                        await supabase.from('products').upsert({
                             id: updatedProducts[prodIndex].id, 
                             organization_id: orgId, 
                             data: updatedProducts[prodIndex] 
                        });
                    }
                }
            }
            setProducts(updatedProducts);
        }
        
        // 2. Set status to draft
        const draftInvoice = { ...currentInvoice, status: 'draft' as const };
        setCurrentInvoice(draftInvoice);
        
        // 3. Update Invoice in DB immediately to prevent state drift if they close window
        await supabase.from('invoices').upsert({
            id: draftInvoice.id,
            organization_id: orgId,
            customer_name: draftInvoice.customerName,
            status: 'draft',
            data: draftInvoice
        });

        // 4. Switch to Builder
        setActiveTab('builder');
    };

    const saveInvoice = async (status: Invoice['status'] = 'pending') => {
        if (!currentInvoice) return;
        
        // Check Stock for products if finalizing
        if (status === 'pending' && currentInvoice.status === 'draft') {
             for (const item of currentInvoice.items) {
                 if (item.productId) {
                     const prod = products.find(p => p.id === item.productId);
                     if (prod && prod.type === 'product') {
                         if ((prod.stock || 0) < item.quantity) {
                             alert(`Insufficient stock for ${prod.name}. Available: ${prod.stock}`);
                             return;
                         }
                         // Deduct stock
                         const updatedProd = { ...prod, stock: (prod.stock || 0) - item.quantity };
                         setProducts(prev => prev.map(p => p.id === prod.id ? updatedProd : p));
                         await supabase.from('products').upsert({ id: prod.id, organization_id: orgId, data: updatedProd });
                     }
                 }
             }
             // Increment Invoice Number
             const newSettings = { ...settings, nextInvoiceNumber: settings.nextInvoiceNumber + 1 };
             setSettings(newSettings);
             await supabase.from('invoice_settings').upsert({ organization_id: orgId, data: newSettings });
        }

        const finalInvoice = { ...currentInvoice, status };
        
        setInvoices(prev => {
            const exists = prev.find(i => i.id === finalInvoice.id);
            if (exists) return prev.map(i => i.id === finalInvoice.id ? finalInvoice : i);
            return [finalInvoice, ...prev];
        });

        await supabase.from('invoices').upsert({ 
            id: finalInvoice.id, 
            organization_id: orgId, 
            customer_name: finalInvoice.customerName,
            status: finalInvoice.status,
            data: finalInvoice 
        });

        setActiveTab('invoices');
    };

    const handleAddItem = (item: InvoiceItem) => {
        if (!currentInvoice) return;
        const newItems = [...currentInvoice.items, item];
        recalculateTotals(newItems);
    };

    const handleRemoveItem = (itemId: string) => {
         if (!currentInvoice) return;
         const newItems = currentInvoice.items.filter(i => i.id !== itemId);
         recalculateTotals(newItems);
    };

    const recalculateTotals = (items: InvoiceItem[]) => {
        if (!currentInvoice) return;
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const taxAmount = (subtotal * currentInvoice.taxRate) / 100;
        const total = subtotal + taxAmount;
        setCurrentInvoice({ ...currentInvoice, items, subtotal, taxAmount, total });
    };

    const shareWhatsApp = (invoice: Invoice) => {
        if (!invoice.customerPhone) return alert('Customer phone number missing');
        const text = `Hello ${invoice.customerName}, here is your invoice ${invoice.number} for ${settings.currency}${invoice.total.toFixed(2)}. Please pay by ${invoice.dueDate}. Thank you!`;
        // Simple clean of phone number
        const cleanPhone = invoice.customerPhone.replace(/[^0-9]/g, '');
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const shareEmail = (invoice: Invoice) => {
         if (!invoice.customerEmail) return alert('Customer email missing');
         const subject = `Invoice ${invoice.number} from ${settings.companyName}`;
         const body = `Hello ${invoice.customerName},\n\nPlease find attached invoice ${invoice.number} for ${settings.currency}${invoice.total.toFixed(2)} due on ${invoice.dueDate}.\n\nThank you,\n${settings.companyName}`;
         window.location.href = `mailto:${invoice.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    // --- Render Functions (Converted from Inner Components to avoid remounting) ---

    const renderDashboard = () => {
        const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
        const pendingAmount = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.total, 0);
        
        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <p className="text-gray-500 text-xs font-bold uppercase mb-2">Total Revenue</p>
                        <p className="text-3xl font-bold text-green-600">{settings.currency}{totalRevenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <p className="text-gray-500 text-xs font-bold uppercase mb-2">Pending Payment</p>
                        <p className="text-3xl font-bold text-amber-500">{settings.currency}{pendingAmount.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <p className="text-gray-500 text-xs font-bold uppercase mb-2">Total Invoices</p>
                        <p className="text-3xl font-bold text-indigo-600">{invoices.length}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Invoices</h3>
                        <div className="space-y-3">
                            {invoices.slice(0, 5).map(inv => (
                                <div key={inv.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                    <div>
                                        <p className="font-bold text-gray-800">{inv.number}</p>
                                        <p className="text-xs text-gray-500">{inv.customerName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900">{settings.currency}{inv.total.toFixed(2)}</p>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                            inv.status === 'paid' ? 'bg-green-100 text-green-700' : 
                                            inv.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                                        }`}>{inv.status}</span>
                                    </div>
                                </div>
                            ))}
                            {invoices.length === 0 && <p className="text-gray-400 italic text-sm">No invoices generated yet.</p>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                         <h3 className="text-lg font-bold text-gray-900 mb-4">Low Stock Alert</h3>
                         <div className="space-y-3">
                             {products.filter(p => p.type === 'product' && (p.stock || 0) < 10).map(p => (
                                 <div key={p.id} className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100">
                                     <span className="font-medium text-gray-800">{p.name}</span>
                                     <span className="text-red-600 font-bold">{p.stock} left</span>
                                 </div>
                             ))}
                             {products.filter(p => p.type === 'product' && (p.stock || 0) < 10).length === 0 && 
                                <p className="text-green-500 text-sm flex items-center"><CheckIcon className="w-4 h-4 mr-2"/> Inventory looks good!</p>
                             }
                         </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderInventory = () => (
        <div className="animate-fadeIn bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Inventory & Services</h2>
                <button onClick={() => { setProductForm({ type: 'service' }); setIsProductModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center hover:bg-indigo-700 transition-colors">
                    <PlusIcon className="mr-2 h-5 w-5" /> Add Item
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                        <tr>
                            <th className="p-4 rounded-tl-xl">Name</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Price</th>
                            <th className="p-4">Stock</th>
                            <th className="p-4 rounded-tr-xl text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium text-gray-900">{p.name} <span className="block text-xs text-gray-400 font-normal">{p.sku}</span></td>
                                <td className="p-4"><span className={`px-2 py-1 rounded text-xs uppercase font-bold ${p.type === 'service' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{p.type}</span></td>
                                <td className="p-4">{settings.currency}{p.price.toFixed(2)}</td>
                                <td className="p-4">{p.type === 'product' ? p.stock : '∞'}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => { setProductForm(p); setIsProductModalOpen(true); }} className="text-gray-400 hover:text-indigo-600 mr-3"><EditIcon className="h-4 w-4" /></button>
                                    <button onClick={() => deleteProduct(p.id)} className="text-gray-400 hover:text-red-600"><TrashIcon className="h-4 w-4" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderBuilder = () => {
        if (!currentInvoice) return null;
        
        const addItem = (prodId: string) => {
            const prod = products.find(p => p.id === prodId);
            if (prod) {
                const newItem: InvoiceItem = {
                    id: `item-${Date.now()}`,
                    productId: prod.id,
                    description: prod.name,
                    price: prod.price,
                    quantity: 1,
                    total: prod.price
                };
                handleAddItem(newItem);
            }
        };

        const handleQuantityChange = (itemId: string, qty: number) => {
             const items = currentInvoice.items.map(i => {
                 if (i.id === itemId) {
                     return { ...i, quantity: qty, total: qty * i.price };
                 }
                 return i;
             });
             recalculateTotals(items);
        };

        // Handle Customer Phone with Country Code
        const handlePhoneChange = (phone: string) => {
            setCurrentInvoice({...currentInvoice, customerPhone: phone});
        };

        return (
            <div className="animate-fadeIn grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Editor */}
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                     <div className="flex justify-between mb-6">
                         <div>
                             <h2 className="text-2xl font-bold text-gray-900">New Invoice {currentInvoice.number}</h2>
                             <p className="text-sm text-gray-500">Date: {currentInvoice.date}</p>
                         </div>
                         <div className="text-right">
                             <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Due Date</label>
                             <input type="date" value={currentInvoice.dueDate} onChange={e => setCurrentInvoice({...currentInvoice, dueDate: e.target.value})} className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none"/>
                         </div>
                     </div>

                     <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Customer Details</label>
                         <div className="flex gap-4 mb-3">
                             <select 
                                onChange={e => {
                                    const contact = crmContacts.find(c => c.id === e.target.value);
                                    if (contact) {
                                        setCurrentInvoice({
                                            ...currentInvoice,
                                            customerId: contact.id,
                                            customerName: contact.name,
                                            customerEmail: contact.email || '',
                                            customerPhone: contact.phone || '',
                                            customerAddress: contact.address || ''
                                        });
                                    }
                                }}
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
                             >
                                 <option value="">Select from CRM...</option>
                                 {crmContacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                             </select>
                             <span className="text-gray-400 self-center text-xs">OR</span>
                             <input type="text" placeholder="Manual Name" value={currentInvoice.customerName} onChange={e => setCurrentInvoice({...currentInvoice, customerName: e.target.value})} className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <input type="text" placeholder="Email" value={currentInvoice.customerEmail} onChange={e => setCurrentInvoice({...currentInvoice, customerEmail: e.target.value})} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                             
                             {/* Phone Number with Country Code */}
                             <div className="flex gap-2">
                                <select 
                                    value={selectedCountryCode}
                                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                                    className="w-24 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none"
                                >
                                    {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>{c.code}</option>
                                    ))}
                                </select>
                                <input 
                                    type="text" 
                                    placeholder="Phone" 
                                    value={currentInvoice.customerPhone?.replace(selectedCountryCode, '') || ''} 
                                    onChange={e => handlePhoneChange(`${selectedCountryCode}${e.target.value}`)} 
                                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" 
                                />
                             </div>

                             <input type="text" placeholder="Address" value={currentInvoice.customerAddress} onChange={e => setCurrentInvoice({...currentInvoice, customerAddress: e.target.value})} className="col-span-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" />
                         </div>
                     </div>

                     <div className="mb-6">
                         <h3 className="font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Items</h3>
                         {currentInvoice.items.map(item => (
                             <div key={item.id} className="flex items-center gap-4 mb-3">
                                 <div className="flex-grow">
                                     <p className="font-medium text-sm text-gray-900">{item.description}</p>
                                     <p className="text-xs text-gray-500">{settings.currency}{item.price}</p>
                                 </div>
                                 <input 
                                    type="number" 
                                    min="1" 
                                    value={item.quantity} 
                                    onChange={e => handleQuantityChange(item.id, parseInt(e.target.value))}
                                    className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-center text-sm outline-none"
                                 />
                                 <div className="w-20 text-right font-bold text-sm text-gray-900">{settings.currency}{item.total.toFixed(2)}</div>
                                 <button onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                             </div>
                         ))}
                         {currentInvoice.items.length === 0 && <p className="text-center text-gray-400 italic py-4">No items added.</p>}
                     </div>

                     <div className="flex justify-end border-t border-gray-100 pt-4">
                         <div className="w-64 space-y-2">
                             <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span> <span>{settings.currency}{currentInvoice.subtotal.toFixed(2)}</span></div>
                             <div className="flex justify-between text-sm text-gray-600"><span>Tax ({currentInvoice.taxRate}%)</span> <span>{settings.currency}{currentInvoice.taxAmount.toFixed(2)}</span></div>
                             <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-100"><span>Total</span> <span>{settings.currency}{currentInvoice.total.toFixed(2)}</span></div>
                         </div>
                     </div>

                     <div className="mt-8 flex gap-3 justify-end">
                         <button onClick={() => setActiveTab('invoices')} className="px-4 py-2 text-gray-500 font-medium hover:bg-gray-100 rounded-xl">Cancel</button>
                         <button onClick={() => saveInvoice('draft')} className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Save Draft</button>
                         <button onClick={() => saveInvoice('pending')} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700">Finalize Invoice</button>
                     </div>
                </div>

                {/* Product Selector Sidebar */}
                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm h-fit">
                    <h3 className="font-bold text-gray-900 mb-4">Add Item</h3>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                        {products.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => addItem(p.id)}
                                className="w-full flex justify-between items-center p-3 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-100 border border-transparent rounded-xl transition-all group text-left"
                            >
                                <div>
                                    <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-700">{p.name}</p>
                                    <p className="text-xs text-gray-500">{p.type === 'product' ? `Stock: ${p.stock}` : 'Service'}</p>
                                </div>
                                <span className="text-sm font-medium text-gray-600">{settings.currency}{p.price}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderViewer = () => {
        if (!currentInvoice) return null;
        return (
            <div className="animate-fadeIn flex flex-col lg:flex-row gap-6">
                <style>
                {`
                    @media print {
                        body * { visibility: hidden; }
                        #invoice-print-area, #invoice-print-area * { visibility: visible; }
                        #invoice-print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; border: none; box-shadow: none; }
                        .print-hidden { display: none !important; }
                    }
                `}
                </style>
                 <div className="flex-grow bg-white p-10 rounded-none shadow-lg border border-gray-200 print:shadow-none print:border-0 print:w-full" id="invoice-print-area">
                     <div className="flex justify-between items-start mb-10 border-b border-gray-100 pb-8">
                         <div>
                             {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" className="h-16 mb-4 object-contain" />}
                             <h1 className="text-4xl font-bold text-gray-900 mb-2">{settings.companyName}</h1>
                             <div className="text-gray-500 text-sm space-y-1">
                                 <p>{settings.companyAddress}</p>
                                 <p>{settings.companyPhone} | {settings.companyEmail}</p>
                                 <p>{settings.companyWebsite}</p>
                             </div>
                         </div>
                         <div className="text-right">
                             <h2 className="text-3xl font-light text-indigo-600 mb-2">INVOICE</h2>
                             <p className="text-gray-600 font-bold"># {currentInvoice.number}</p>
                             <p className="text-gray-500 text-sm mt-4">Date: {currentInvoice.date}</p>
                             <p className="text-gray-500 text-sm">Due: {currentInvoice.dueDate}</p>
                         </div>
                     </div>

                     <div className="mb-10">
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To</h3>
                         <p className="text-xl font-bold text-gray-900">{currentInvoice.customerName}</p>
                         <div className="text-gray-600 text-sm mt-1">
                            <p>{currentInvoice.customerAddress}</p>
                            <p>{currentInvoice.customerEmail}</p>
                            <p>{currentInvoice.customerPhone}</p>
                         </div>
                     </div>

                     <table className="w-full mb-10">
                         <thead>
                             <tr className="border-b-2 border-gray-100">
                                 <th className="text-left py-3 text-sm font-bold text-gray-600 uppercase">Description</th>
                                 <th className="text-right py-3 text-sm font-bold text-gray-600 uppercase">Qty</th>
                                 <th className="text-right py-3 text-sm font-bold text-gray-600 uppercase">Price</th>
                                 <th className="text-right py-3 text-sm font-bold text-gray-600 uppercase">Total</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-5">
                             {currentInvoice.items.map(item => (
                                 <tr key={item.id}>
                                     <td className="py-4 text-gray-800">{item.description}</td>
                                     <td className="py-4 text-right text-gray-600">{item.quantity}</td>
                                     <td className="py-4 text-right text-gray-600">{settings.currency}{item.price.toFixed(2)}</td>
                                     <td className="py-4 text-right font-bold text-gray-900">{settings.currency}{item.total.toFixed(2)}</td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>

                     <div className="flex justify-end mb-10">
                         <div className="w-1/2 lg:w-1/3 space-y-3">
                             <div className="flex justify-between text-gray-600"><span>Subtotal</span> <span>{settings.currency}{currentInvoice.subtotal.toFixed(2)}</span></div>
                             <div className="flex justify-between text-gray-600"><span>Tax ({currentInvoice.taxRate}%)</span> <span>{settings.currency}{currentInvoice.taxAmount.toFixed(2)}</span></div>
                             <div className="flex justify-between text-2xl font-bold text-indigo-600 pt-4 border-t border-gray-200"><span>Total</span> <span>{settings.currency}{currentInvoice.total.toFixed(2)}</span></div>
                         </div>
                     </div>
                     
                     <div className="text-center text-gray-400 text-sm pt-10 border-t border-gray-100">
                         <p>Thank you for your business!</p>
                     </div>
                 </div>

                 {/* Actions Sidebar */}
                 <div className="w-full lg:w-80 space-y-4 print-hidden">
                     <button onClick={() => window.print()} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold flex items-center justify-center hover:bg-black transition-colors shadow-lg">
                         <PrinterIcon className="mr-2 h-5 w-5" /> Print / PDF
                     </button>
                     <button onClick={() => shareWhatsApp(currentInvoice)} className="w-full bg-[#25D366] text-white py-3 rounded-xl font-bold flex items-center justify-center hover:bg-[#20bd5a] transition-colors shadow-lg">
                         <WhatsAppIcon className="mr-2 h-5 w-5" /> WhatsApp
                     </button>
                     <button onClick={() => shareEmail(currentInvoice)} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg">
                         <EmailIcon className="mr-2 h-5 w-5" /> Email
                     </button>
                     {currentInvoice.status !== 'paid' && (
                         <button onClick={() => saveInvoice('paid')} className="w-full bg-green-100 text-green-700 border border-green-200 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-green-200 transition-colors">
                             <CheckIcon className="mr-2 h-5 w-5" /> Mark as Paid
                         </button>
                     )}
                     
                     <div className="border-t border-gray-200 my-4"></div>
                     
                     <button onClick={handleEditInvoice} className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-indigo-100 transition-colors">
                         <EditIcon className="mr-2 h-5 w-5" /> Edit / Restock
                     </button>

                     <button onClick={() => setActiveTab('invoices')} className="w-full bg-white text-gray-600 border border-gray-200 py-3 rounded-xl font-bold flex items-center justify-center hover:bg-gray-50 transition-colors">
                         Close
                     </button>
                 </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8 rounded-3xl font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        <DocumentTextIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Invoicing & Inventory</h1>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Dashboard</button>
                    <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'invoices' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Invoices</button>
                    <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'inventory' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Inventory</button>
                    <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>Settings</button>
                </div>
            </div>

            {/* Main Content */}
            <div className="print:p-0">
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'inventory' && renderInventory()}
                
                {activeTab === 'invoices' && (
                    <div className="animate-fadeIn bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
                            <button onClick={createNewInvoice} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center">
                                <PlusIcon className="mr-2 h-5 w-5" /> Create New
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs">
                                    <tr>
                                        <th className="p-4 rounded-tl-xl">Number</th>
                                        <th className="p-4">Customer</th>
                                        <th className="p-4">Date</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4">Total</th>
                                        <th className="p-4 rounded-tr-xl text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setCurrentInvoice(inv); setActiveTab('viewer'); }}>
                                            <td className="p-4 font-mono font-bold text-indigo-600">{inv.number}</td>
                                            <td className="p-4 font-medium text-gray-900">{inv.customerName}</td>
                                            <td className="p-4 text-gray-500">{inv.date}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                                                    inv.status === 'paid' ? 'bg-green-100 text-green-700' : 
                                                    inv.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                                                    inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                                                }`}>{inv.status}</span>
                                            </td>
                                            <td className="p-4 font-bold text-gray-900">{settings.currency}{inv.total.toFixed(2)}</td>
                                            <td className="p-4 text-right">
                                                <button className="text-indigo-600 font-bold text-xs hover:underline">View</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'builder' && renderBuilder()}
                {activeTab === 'viewer' && renderViewer()}

                {activeTab === 'settings' && (
                    <div className="animate-fadeIn max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Organization Settings</h2>
                        <div className="space-y-4">
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Company Name</label><input type="text" value={settings.companyName} onChange={e => setSettings({...settings, companyName: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label><input type="text" value={settings.companyEmail} onChange={e => setSettings({...settings, companyEmail: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label><input type="text" value={settings.companyPhone} onChange={e => setSettings({...settings, companyPhone: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                            </div>
                            <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label><textarea value={settings.companyAddress} onChange={e => setSettings({...settings, companyAddress: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                            
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Company Logo</label>
                                <div className="flex items-center gap-4">
                                    {settings.logoUrl && (
                                        <img src={settings.logoUrl} alt="Logo Preview" className="h-12 w-12 object-contain border border-gray-200 rounded-lg" />
                                    )}
                                    <label className="cursor-pointer bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-indigo-300 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium transition-all">
                                        {settings.logoUrl ? 'Change Logo' : 'Upload Logo (Max 1MB)'}
                                        <input 
                                            type="file" 
                                            accept="image/png, image/jpeg, image/svg+xml" 
                                            className="hidden" 
                                            onChange={handleLogoUpload}
                                        />
                                    </label>
                                    {settings.logoUrl && (
                                         <button onClick={() => setSettings({...settings, logoUrl: ''})} className="text-red-500 text-xs font-bold hover:underline">Remove</button>
                                    )}
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Supported formats: PNG, JPG, SVG. Max size: 1MB.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tax Rate %</label><input type="number" value={settings.taxRate} onChange={e => setSettings({...settings, taxRate: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Currency</label><input type="text" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                            </div>
                            <button onClick={saveSettingsConfig} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Save Settings</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full">
                        <h3 className="text-xl font-bold mb-6">Add/Edit Item</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Item Name" value={productForm.name || ''} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                            <div className="grid grid-cols-2 gap-4">
                                <select value={productForm.type || 'service'} onChange={e => setProductForm({...productForm, type: e.target.value as any})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none">
                                    <option value="service">Service</option>
                                    <option value="product">Physical Product</option>
                                </select>
                                <input type="number" placeholder="Price" value={productForm.price || ''} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                            </div>
                            {productForm.type === 'product' && (
                                <input type="number" placeholder="Initial Stock" value={productForm.stock || ''} onChange={e => setProductForm({...productForm, stock: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                            )}
                            <div className="flex justify-end gap-3 mt-6">
                                <button onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 text-gray-500 font-bold">Cancel</button>
                                <button onClick={saveProduct} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-indigo-200">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
