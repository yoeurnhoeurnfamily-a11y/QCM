import React, { useState } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  Layers,
  Check,
  X,
  ShieldAlert,
  Sparkles,
  BookOpen,
  FileText,
  Truck,
  Download,
  Bookmark,
  History,
  Clock
} from 'lucide-react';
import type { Product, BulkPricingTier } from '../types/store';

interface ProductsViewProps {
  products: Product[];
  onCreateProduct: (prod: Partial<Product>) => Promise<void>;
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  stockCounts: Record<string, number>;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  products,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  stockCounts
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formatFilter, setFormatFilter] = useState<'all' | 'pdf' | 'printed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('4.50');
  const [badge, setBadge] = useState('📄 PDF');
  const [instructions, setInstructions] = useState('');
  const [bulkPricingEnabled, setBulkPricingEnabled] = useState(false);
  const [tiers, setTiers] = useState<BulkPricingTier[]>([]);
  const [isActive, setIsActive] = useState(true);

  // Book specific fields
  const [bookFormat, setBookFormat] = useState<'pdf' | 'printed'>('pdf');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('250');
  const [fileSize, setFileSize] = useState('15.0 MB');
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState('');

  const filteredProducts = products.filter((p) => {
    if (formatFilter !== 'all' && (p.bookFormat || 'pdf') !== formatFilter) return false;
    if (categoryFilter !== 'all' && !p.category.includes(categoryFilter) && !p.id.includes(categoryFilter)) return false;
    return true;
  });

  const pdfCount = products.filter(p => (p.bookFormat || 'pdf') === 'pdf').length;
  const printedCount = products.filter(p => p.bookFormat === 'printed').length;

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setCategory('សៀវភៅត្រៀមប្រឡង');
    setDescription('');
    setPrice('3.50');
    setBookFormat('pdf');
    setBadge('🔥 HOT បាក់ឌុប');
    setAuthor('');
    setPages('320');
    setFileSize('20.0 MB');
    setPdfDownloadUrl('');
    setInstructions('1. ចុចលើ Link ទាញយកឯកសារ PDF គុណភាពខ្ពស់\n2. ភ្ជាប់មកជាមួយ File កម្រងរូបមន្ត & Key ចម្លើយ\n3. អាចទាញយកអាប់ដេតវិញ្ញាសាថ្មីៗបន្ថែមដោយឥតគិតថ្លៃ!');
    setBulkPricingEnabled(false);
    setTiers([]);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setCategory(prod.category);
    setDescription(prod.description);
    setPrice(prod.price.toString());
    setBadge(prod.badge || '');
    setInstructions(prod.instructions || '');
    setBulkPricingEnabled(prod.bulkPricingEnabled);
    setTiers(prod.tiers ? [...prod.tiers] : []);
    setIsActive(prod.isActive);

    setBookFormat(prod.bookFormat === 'printed' ? 'printed' : 'pdf');
    setAuthor(prod.author || '');
    setPages(prod.pages ? prod.pages.toString() : '');
    setFileSize(prod.fileSize || '');
    setPdfDownloadUrl(prod.pdfDownloadUrl || '');
    setIsModalOpen(true);
  };

  const handleAddTier = () => {
    setTiers([...tiers, { minQty: 3, maxQty: null, pricePerUnit: 3.50 }]);
  };

  const handleRemoveTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const handleTierChange = (idx: number, field: keyof BulkPricingTier, value: any) => {
    const updated = [...tiers];
    updated[idx] = { ...updated[idx], [field]: value };
    setTiers(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Product> = {
      ...(editingProduct || {}),
      name,
      category,
      description,
      price: parseFloat(price) || 1.0,
      badge: badge || (bookFormat === 'printed' ? '📖 ព្រីន' : '📄 PDF'),
      instructions,
      bulkPricingEnabled,
      tiers,
      isActive,
      bookFormat,
      author,
      pages: parseInt(pages, 10) || undefined,
      fileSize: bookFormat === 'pdf' ? fileSize : undefined,
      pdfDownloadUrl: bookFormat === 'pdf' ? pdfDownloadUrl : undefined
    };

    if (editingProduct) {
      await onUpdateProduct(editingProduct.id, payload);
    } else {
      await onCreateProduct(payload);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>កាតាឡុកសៀវភៅ (Book Catalog - {products.length})</span>
          </h3>
          <p className="text-xs text-slate-400">គ្រប់គ្រងសៀវភៅអេឡិចត្រូនិក PDF និងសៀវភៅព្រីន Hardcopy សម្រាប់លក់លើ Telegram Bot</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ បន្ថែមសៀវភៅថ្មី</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => { setFormatFilter('all'); setCategoryFilter('all'); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            formatFilter === 'all' && categoryFilter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          ទាំងអស់ ({products.length})
        </button>

        <button
          onClick={() => { setCategoryFilter('pre'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            categoryFilter === 'pre'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>👶 គ្រូមតេយ្យ (5)</span>
        </button>

        <button
          onClick={() => { setCategoryFilter('pri'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            categoryFilter === 'pri'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🎒 គ្រូបឋម (5)</span>
        </button>

        <button
          onClick={() => { setCategoryFilter('low'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            categoryFilter === 'low'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🏫 គ្រូអនុវិទ្យាល័យ (5)</span>
        </button>

        <button
          onClick={() => { setCategoryFilter('upp'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            categoryFilter === 'upp'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <span>🏢 គ្រូវិទ្យាល័យ (5)</span>
        </button>

        <span className="w-px h-4 bg-slate-800 mx-1"></span>

        <button
          onClick={() => setFormatFilter('pdf')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            formatFilter === 'pdf'
              ? 'bg-sky-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF ({pdfCount})</span>
        </button>
        <button
          onClick={() => setFormatFilter('printed')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            formatFilter === 'printed'
              ? 'bg-amber-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>ព្រីន ({printedCount})</span>
        </button>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((prod) => {
          const availableStock = stockCounts[prod.id] || 0;
          const isPrinted = prod.bookFormat === 'printed';
          const unitName = isPrinted ? 'ក្បាល' : 'ច្បាប់';

          return (
            <div
              key={prod.id}
              className={`bg-slate-900/80 border rounded-xl p-5 flex flex-col justify-between transition-all ${
                prod.isActive ? 'border-slate-800/80 hover:border-slate-700' : 'border-rose-900/30 opacity-70'
              }`}
            >
              <div>
                {/* Header with category and format badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-indigo-400 truncate max-w-[150px]">
                    {prod.category}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                        isPrinted
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {isPrinted ? <BookOpen className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      <span>{isPrinted ? 'សៀវភៅព្រីន' : 'សៀវភៅ PDF'}</span>
                    </span>

                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                        prod.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {prod.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {/* Book Title */}
                <h4 className="text-sm font-bold text-white mb-1.5 leading-snug">
                  {prod.name}
                </h4>

                {/* Author & Pages meta */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mb-2">
                  {prod.author && (
                    <span className="text-slate-300">
                      ✍️ <span className="font-medium text-white">{prod.author}</span>
                    </span>
                  )}
                  {prod.pages && (
                    <span>📑 {prod.pages} ទំព័រ</span>
                  )}
                  {!isPrinted && prod.fileSize && (
                    <span className="font-mono text-[10px] text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-900/40">
                      {prod.fileSize}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                  {prod.description}
                </p>

                {/* Delivery Type Note */}
                <div className="text-[11px] mb-3 flex items-center gap-1.5 text-slate-400">
                  {isPrinted ? (
                    <>
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                      <span>ដឹកជញ្ជូនរហ័សទូទាំងប្រទេស</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>ទាញយកអានភ្លាមៗ 24/7 (Instant Delivery)</span>
                    </>
                  )}
                </div>

                {/* Pricing & Stock */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 mb-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">តម្លៃលក់</span>
                    <span className="text-sm font-bold text-white font-mono tabular-nums">
                      ${prod.price.toFixed(2)} USD
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">ស្តុកនៅសល់</span>
                    <span
                      className={`text-sm font-bold font-mono tabular-nums ${
                        availableStock > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {availableStock > 0 ? `${availableStock} ${unitName}` : '❌ អស់ស្តុក'}
                    </span>
                  </div>
                </div>

                {/* Bulk Pricing Info */}
                {prod.bulkPricingEnabled && prod.tiers && prod.tiers.length > 0 && (
                  <div className="text-[11px] text-slate-400 mb-3 bg-indigo-950/20 border border-indigo-900/30 rounded-lg p-2">
                    <span className="font-semibold text-indigo-300 block mb-1">🏷️ តារាងទិញដុំ ({unitName})៖</span>
                    {prod.tiers.map((t, idx) => (
                      <div key={idx} className="flex justify-between font-mono text-[10px]">
                        <span>{t.maxQty ? `${t.minQty} - ${t.maxQty} ${unitName}` : `≥ ${t.minQty} ${unitName}`}:</span>
                        <span className="text-white font-bold">${t.pricePerUnit.toFixed(2)}/{unitName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-2">
                <button
                  onClick={() => onUpdateProduct(prod.id, { isActive: !prod.isActive })}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    prod.isActive
                      ? 'text-slate-400 hover:text-white bg-slate-800/50'
                      : 'text-emerald-400 hover:text-emerald-300 bg-emerald-950/30'
                  }`}
                >
                  {prod.isActive ? 'បិទលក់' : 'បើកលក់វិញ'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(prod)}
                    className="p-1.5 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all cursor-pointer"
                    title="កែប្រែទិន្នន័យសៀវភៅ"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`តើអ្នកពិតជាចង់លុបសៀវភៅ "${prod.name}" មែនទេ?`)) {
                        onDeleteProduct(prod.id);
                      }
                    }}
                    className="p-1.5 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 cursor-pointer shadow-xs"
                    title="លុបសៀវភៅ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>{editingProduct ? 'កែប្រែព័ត៌មានសៀវភៅ' : 'បន្ថែមសៀវភៅថ្មី'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Format Selection: PDF vs Printed */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  ប្រភេទសៀវភៅ (Book Format) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBookFormat('pdf');
                      if (!badge || badge === '📖 ព្រីន') setBadge('📄 PDF');
                    }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      bookFormat === 'pdf'
                        ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>សៀវភៅអេឡិចត្រូនិក PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBookFormat('printed');
                      if (!badge || badge === '📄 PDF') setBadge('📖 ព្រីន');
                    }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      bookFormat === 'printed'
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>សៀវភៅព្រីន (Hardcopy)</span>
                  </button>
                </div>
              </div>

              {/* Book Title */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ចំណងជើងសៀវភៅ (Book Title) *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ឧ. វិញ្ញាសាត្រៀមប្រឡងបាក់ឌុប BacII ២០២៦ & គន្លឹះដោះស្រាយ"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Author & Pages */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    អ្នកនិពន្ធ (Author)
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="ឧ. សាស្រ្តាចារ្យ គណិត-វិទ្យាសាស្ត្រ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ចំនួនទំព័រ (Pages)
                  </label>
                  <input
                    type="number"
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                    placeholder="ឧ. 350"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Category & Badge */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ប្រភេទ (Category)
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="ឧ. សៀវភៅត្រៀមប្រឡង, កម្រងសំណួរ QCM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      '👶 ឈុតគ្រូមតេយ្យសិក្សា (Preschool QCM)',
                      '🎒 ឈុតគ្រូបឋមសិក្សា (Primary School QCM)',
                      '🏫 ឈុតគ្រូអនុវិទ្យាល័យ (Lower Secondary QCM)',
                      '🏢 ឈុតគ្រូវិទ្យាល័យ (Upper Secondary QCM)'
                    ].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    ផ្លាក Badge (ឧ. 📄 PDF HOT, 📖 ព្រីន BEST)
                  </label>
                  <input
                    type="text"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="🔥 HOT បាក់ឌុប"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['🔥 HOT បាក់ឌុប', '⭐ QCM រដ្ឋ BEST', '📖 ព្រីន គ្រូបង្រៀន', '🩺 QCM ពេទ្យ'].map((bdg) => (
                      <button
                        key={bdg}
                        type="button"
                        onClick={() => setBadge(bdg)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                      >
                        {bdg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* PDF Specific Info */}
              {bookFormat === 'pdf' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-sky-950/20 border border-sky-900/30 rounded-xl">
                  <div>
                    <label className="block text-sky-300 font-medium mb-1">
                      ទំហំឯកសារ PDF (File Size)
                    </label>
                    <input
                      type="text"
                      value={fileSize}
                      onChange={(e) => setFileSize(e.target.value)}
                      placeholder="ឧ. 18.5 MB"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sky-300 font-medium mb-1">
                      តំណភ្ជាប់ទាញយក PDF (Download URL)
                    </label>
                    <input
                      type="url"
                      value={pdfDownloadUrl}
                      onChange={(e) => setPdfDownloadUrl(e.target.value)}
                      placeholder="https://khbookstore.com/downloads/book.pdf"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono text-[11px] focus:outline-hidden focus:border-sky-500"
                    />
                  </div>
                </div>
              )}

              {/* Price & Active Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    តម្លៃលក់គិតជា USD ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-slate-300 font-medium">ដាក់លក់លើ Bot (Active)</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ខ្លឹមសារសង្ខេបនៃសៀវភៅ (Book Description)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ព័ត៌មានលម្អិតពីសៀវភៅ ជំពូកសំខាន់ៗ ឬចំណេះដឹងដែលទទួលបាន..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Instructions after purchase */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  ការណែនាំពីរបៀបទទួល ឬអានសៀវភៅ (Post-Purchase Instructions)
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder={
                    bookFormat === 'printed'
                      ? '1. រៀបចំវេចខ្ចប់ក្នុងរយៈពេល 24 ម៉ោង\n2. ផ្ញើតាមរយៈ Virak Buntham / J&T\n3. ផ្តល់លេខកូដតាមដានតាម Telegram!'
                      : '1. ចុច Link ទាញយកឯកសារ PDF\n2. អាចអានលើ iPad, iPhone, Android, PC និង Kindle\n3. រីករាយជាមួយការអាន!'
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Bulk Pricing Tiers Section */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={bulkPricingEnabled}
                      onChange={(e) => setBulkPricingEnabled(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <span className="text-slate-200 font-semibold">បើកបញ្ចុះតម្លៃទិញច្រើន ({bookFormat === 'printed' ? 'ទិញច្រើនក្បាល' : 'ទិញជាក្រុម'})</span>
                  </label>
                  {bulkPricingEnabled && (
                    <button
                      type="button"
                      onClick={handleAddTier}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                    >
                      + បន្ថែម Tier
                    </button>
                  )}
                </div>

                {bulkPricingEnabled && (
                  <div className="space-y-2 bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg">
                    {tiers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-1">
                        មិនទាន់មាន Tier ទេ។ ចុច "+ បន្ថែម Tier" ដើម្បីកំណត់។
                      </p>
                    ) : (
                      tiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block">Min Qty</span>
                            <input
                              type="number"
                              min="2"
                              value={tier.minQty}
                              onChange={(e) => handleTierChange(idx, 'minQty', parseInt(e.target.value) || 2)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block">Max Qty (ឬទទេ)</span>
                            <input
                              type="number"
                              placeholder="គ្មានកំណត់"
                              value={tier.maxQty || ''}
                              onChange={(e) => handleTierChange(idx, 'maxQty', e.target.value ? parseInt(e.target.value) : null)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono"
                            />
                          </div>
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block">តម្លៃក្នុង 1 Qty ($)</span>
                            <input
                              type="number"
                              step="0.01"
                              value={tier.pricePerUnit}
                              onChange={(e) => handleTierChange(idx, 'pricePerUnit', parseFloat(e.target.value) || 0.1)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(idx)}
                            className="p-1 mt-4 text-rose-400 hover:text-rose-300 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Preserved Edit History & Last Updated (មិនបាត់ទិន្នន័យចាស់ៗ) */}
              {editingProduct && (editingProduct.updatedAt || (editingProduct.editHistory && editingProduct.editHistory.length > 0)) && (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-indigo-400" />
                      <span>ប្រវត្តិកែប្រែ & ទិន្នន័យចាស់ៗ (Preserved History)</span>
                    </span>
                    {editingProduct.updatedAt && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>កែប្រែចុងក្រោយ៖ {new Date(editingProduct.updatedAt).toLocaleString()}</span>
                      </span>
                    )}
                  </div>

                  {editingProduct.editHistory && editingProduct.editHistory.length > 0 && (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {editingProduct.editHistory.map((h, i) => (
                        <div key={i} className="p-2 bg-slate-900 border border-slate-800/80 rounded-lg text-[10px] space-y-1">
                          <div className="flex items-center justify-between text-slate-300">
                            <span className="font-semibold">{h.action}</span>
                            <span className="text-slate-400 font-mono">{new Date(h.timestamp).toLocaleTimeString()}</span>
                          </div>
                          {h.previousData && (
                            <div className="text-slate-400 font-mono text-[9px] bg-slate-950 p-1 rounded overflow-x-auto">
                              <span>តម្លៃមុនកែប្រែ៖ </span>
                              <code>
                                {typeof h.previousData === 'object'
                                  ? `Price: $${h.previousData.price ?? ''}, Format: ${h.previousData.bookFormat ?? ''}, Name: ${h.previousData.name ?? ''}`
                                  : JSON.stringify(h.previousData)}
                              </code>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`⚠️ តើអ្នកពិតជាចង់លុបសៀវភៅ "${editingProduct.name}" ចេញពីប្រព័ន្ធមែនទេ?`)) {
                        onDeleteProduct(editingProduct.id);
                        setIsModalOpen(false);
                      }
                    }}
                    className="p-2 rounded-xl bg-[#231224] hover:bg-[#321734] border border-rose-500/30 hover:border-rose-400/50 text-[#ff5c8a] hover:text-rose-300 transition-all active:scale-95 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>លុបសៀវភៅនេះ</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-secondary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    រក្សាទុកសៀវភៅ
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
