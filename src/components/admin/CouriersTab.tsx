import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Edit2, Check, X, Truck, Image as ImageIcon, Upload, Globe, AlertTriangle, Clock } from 'lucide-react';
import { CourierPartner } from '../../types';
import { addCourier, updateCourier, deleteCourier } from '../../services/courierService';
import { uploadToCloudinary } from '../../lib/cloudinary';

interface CouriersTabProps {
  couriers: CourierPartner[];
  onRefresh: () => Promise<void>;
}

export default function CouriersTab({ couriers, onRefresh }: CouriersTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<CourierPartner | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    logoUrl: '',
    isActive: true
  });

  const resetForm = () => {
    setForm({ name: '', logoUrl: '', isActive: true });
    setEditingCourier(null);
  };

  const openModal = (courier?: CourierPartner) => {
    if (courier) {
      setEditingCourier(courier);
      setForm({
        name: courier.name,
        logoUrl: courier.logoUrl,
        isActive: courier.isActive
      });
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const url = await uploadToCloudinary(file, 'image');
      setForm(prev => ({ ...prev, logoUrl: url }));
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload logo. Please try URL method.");
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.logoUrl) return;

    setLoading(true);
    try {
      if (editingCourier) {
        await updateCourier(editingCourier.id, form);
      } else {
        await addCourier(form as any);
      }
      await onRefresh();
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Failed to save courier partner.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    console.log("Deleting courier partner:", id);
    try {
      await deleteCourier(id);
      await onRefresh();
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert(`Failed to delete courier: ${err.message || 'Check your permissions'}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter italic">Courier Partners</h2>
          <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-1">Manage logistics branding & logos</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-white text-black px-6 py-2 rounded-full font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:bg-neon-purple hover:text-white transition-all shadow-xl shadow-white/5 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Add Courier
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {couriers.map((courier) => (
          <motion.div
            key={courier.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-5 rounded-3xl border border-white/5 backdrop-blur-xl transition-all ${courier.isActive ? 'bg-white/5' : 'bg-white/[0.02] opacity-60'}`}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden p-2">
                {courier.logoUrl ? (
                  <img src={courier.logoUrl} alt={courier.name} className="w-full h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <Truck className="w-6 h-6 text-white/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black uppercase italic tracking-tight truncate">{courier.name}</h3>
                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${courier.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
                  {courier.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => openModal(courier)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {deletingId === courier.id ? (
                  <button className="p-2 bg-pink-500/10 text-pink-500 rounded-xl"><Clock className="w-4 h-4 animate-spin" /></button>
                ) : confirmingId === courier.id ? (
                   <div className="flex gap-2 items-center animate-in fade-in slide-in-from-right-2 duration-200">
                      <button 
                        onClick={() => { handleDelete(courier.id); setConfirmingId(null); }} 
                        className="px-3 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all font-bold"
                      >
                        Confirm
                      </button>
                      <button 
                        onClick={() => setConfirmingId(null)}
                        className="p-1 px-3 text-white/40 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest font-bold"
                      >
                        Cancel
                      </button>
                   </div>
                ) : (
                  <button 
                    onClick={() => setConfirmingId(courier.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-white/20 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="text-[9px] text-white/20 font-bold uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{courier.logoUrl}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md" 
            onClick={() => setIsModalOpen(false)}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-lg bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 p-8 shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-purple via-neon-blue to-neon-purple h-1 opacity-50" />
            
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic italic">
                  {editingCourier ? 'Edit Partner' : 'New Courier'}
                </h2>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Configure logistics branding</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2 block">Partner Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Blue Dart"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-neon-purple/50 transition-colors uppercase tracking-wider"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2 block">Logo Source</label>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={form.logoUrl}
                          onChange={(e) => setForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                          placeholder="Paste Logo URL here..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-[10px] font-bold focus:outline-none focus:border-neon-blue/50 transition-colors tracking-wider"
                        />
                      </div>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <button type="button" className="h-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl px-5 flex items-center gap-2 transition-all">
                          <Upload className="w-4 h-4" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Upload</span>
                        </button>
                      </div>
                    </div>

                    {form.logoUrl && (
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center h-24">
                        <img src={form.logoUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-5 h-5 rounded-lg border-white/10 bg-black/40 text-neon-purple focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider">Active Partner</span>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white/5 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neon-purple hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Processing...' : editingCourier ? 'Update Partner' : 'Add Partner'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
