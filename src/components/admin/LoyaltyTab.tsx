import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, ShieldCheck, Clock, Check, X, 
  Search, Award, Zap, AlertTriangle, User,
  TrendingUp, BarChart3, Settings, ShieldAlert, Trash2,
  ChevronUp, ChevronDown, Send, Gift, Bell, Sparkles,
  Layers, Star, Crown, Terminal
} from 'lucide-react';
import { UserProfile, AppSettings } from '../../types';
import { 
  getPendingLoyaltyClaims, 
  approveLoyaltyClaim, 
  rejectLoyaltyClaim,
  revokeLoyaltyStatus,
  getAllTrustedUsers,
  updateUserTrustStats,
  searchUserByProfileId,
  updateUserTier
} from '../../services/loyaltyService';
import { getSettings, updateSettings } from '../../services/settingsService';
import { getAllCoupons, Coupon } from '../../services/couponService';

export default function LoyaltyTab() {
  const [pendingClaims, setPendingClaims] = useState<UserProfile[]>([]);
  const [trustedUsers, setTrustedUsers] = useState<UserProfile[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allNotifications, setAllNotifications] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'users' | 'tiers' | 'settings' | 'history'>('claims');
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [deleteConfirmUid, setDeleteConfirmUid] = useState<string | null>(null);
  
  const [manualAddTier, setManualAddTier] = useState<number>(1);
  
  // Notification States
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifyTier, setNotifyTier] = useState<number | 'user'>(2);
  const [notifyTargetUid, setNotifyTargetUid] = useState('');
  const [notifyBanner, setNotifyBanner] = useState('');
  const [notifyMsg, setNotifyMsg] = useState('');
  const [notifyTitle, setNotifyTitle] = useState('');
  const [selectedCoupon, setSelectedCoupon] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { getSettings } = await import('../../services/settingsService');
      const { getAllCoupons } = await import('../../services/couponService');
      
      const [pending, trusted, s, c] = await Promise.all([
        getPendingLoyaltyClaims(),
        getAllTrustedUsers(),
        getSettings(),
        getAllCoupons()
      ]);
      setPendingClaims(pending);
      setTrustedUsers(trusted);
      setSettings(s);
      setCoupons(c.filter(cp => cp.isActive));
    } catch (error) {
      console.error("Error fetching loyalty data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { getAllNotifications } = await import('../../services/notificationService');
      const data = await getAllNotifications();
      setAllNotifications(data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'history') {
      fetchHistory();
    }
  }, [activeSubTab]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // ~800KB limit for Base64 storage
      alert('File too large. Please use an image under 800KB for neural sync.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setNotifyBanner(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const { deleteNotification } = await import('../../services/notificationService');
      await deleteNotification(id);
      setAllNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const handleApprove = async (uid: string) => {
    if (!settings) return;
    try {
      await approveLoyaltyClaim(uid, settings.loyalty?.badgeNames?.trusted || 'Trusted Buyer');
      await fetchData();
    } catch (error) {
      console.error("Approve failed:", error);
    }
  };

  const handleTierUpdate = async (uid: string, tier: number, currentBadge?: string) => {
    if (!settings) return;
    try {
      const badgeName = tier === 3 ? settings.loyalty?.badgeNames?.elite :
                        tier === 2 ? settings.loyalty?.badgeNames?.collector :
                        settings.loyalty?.badgeNames?.trusted;
      
      await updateUserTier(uid, tier, badgeName);
      await fetchData();
    } catch (error) {
      console.error("Tier update failed:", error);
    }
  };

  const handleReject = async (uid: string) => {
    try {
      await rejectLoyaltyClaim(uid);
      await fetchData();
    } catch (error) {
      console.error("Reject failed:", error);
    }
  };

  const [searchedProfile, setSearchedProfile] = useState<UserProfile | null>(null);

  const handleSearchProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId) return;
    setManualSearching(true);
    setSearchedProfile(null);
    try {
      const profile = await searchUserByProfileId(manualId.trim());
      if (profile) {
        setSearchedProfile(profile);
      } else {
        alert('Error: Profile ID not found in database. Ensure the ID is exactly correct (e.g. KG-XXXX).');
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setManualSearching(false);
    }
  };

  const handleActivateUser = async () => {
    if (!searchedProfile || !settings) return;
    setManualSearching(true);
    try {
      const badgeName = manualAddTier === 3 ? settings.loyalty?.badgeNames?.elite :
                        manualAddTier === 2 ? settings.loyalty?.badgeNames?.collector :
                        settings.loyalty?.badgeNames?.trusted;
      
      const targetId = searchedProfile.uid; 
      if (!targetId) throw new Error("No valid User Identity found for this profile.");

      await updateUserTier(targetId, manualAddTier, badgeName);
      alert(`User Successfully Activated: ${searchedProfile.displayName || searchedProfile.email} -> Tier ${manualAddTier}`);
      setManualId('');
      setSearchedProfile(null);
      await fetchData();
    } catch (error: any) {
      console.error("Activation failed:", error);
      alert('Activation protocol failed. Check administrative logs.');
    } finally {
      setManualSearching(false);
    }
  };

  const handleSendNotification = async () => {
    if (!notifyMsg || !notifyTitle) return;
    setIsSending(true);
    try {
      const { sendBroadcastNotification } = await import('../../services/notificationService');
      const { searchUserByProfileId } = await import('../../services/loyaltyService');
      
      if (notifyTier === 'user' && notifyTargetUid) {
        // Support comma separated Profile IDs
        const ids = notifyTargetUid.split(',').map(id => id.trim()).filter(id => id.startsWith('KG-'));
        
        if (ids.length === 0) {
           alert('Invalid Target IDs. Please use profile IDs (e.g. KG-XXXX).');
           setIsSending(false);
           return;
        }

        for (const pid of ids) {
          const profile = await searchUserByProfileId(pid);
          if (profile) {
            await sendBroadcastNotification({
              title: notifyTitle,
              message: notifyMsg,
              type: 'system',
              targetUid: profile.uid,
              couponCode: selectedCoupon || undefined,
              bannerUrl: notifyBanner || undefined
            });
          }
        }
      } else {
        await sendBroadcastNotification({
          title: notifyTitle,
          message: notifyMsg,
          type: 'broadcast',
          targetTier: typeof notifyTier === 'number' ? notifyTier : 0,
          couponCode: selectedCoupon || undefined,
          bannerUrl: notifyBanner || undefined
        });
      }
      
      setIsSending(false);
      setShowNotificationModal(false);
      setNotifyMsg('');
      setNotifyTitle('');
      setNotifyBanner('');
      setNotifyTargetUid('');
      setSelectedCoupon('');
      alert('Success: Notifications transmitted to authorized recipients.');
    } catch (error) {
      console.error("Notification broadcast failed:", error);
      setIsSending(false);
      alert('Broadcast transmission failed. Check network link.');
    }
  };

  const handleUpdateSettings = async (updates: Partial<AppSettings['loyalty']>) => {
    if (!settings) return;
    try {
      const newSettings = {
        ...settings,
        loyalty: {
          ...settings.loyalty!,
          ...updates
        }
      };
      await updateSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error("Update settings failed:", error);
    }
  };

  const filteredUsers = trustedUsers.filter(u => {
    const matchesSearch = u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.profileId?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'all' || u.loyaltyTier === tierFilter;
    return matchesSearch && matchesTier;
  });

  const tier2Count = trustedUsers.filter(u => u.loyaltyTier === 2).length;
  const tier3Count = trustedUsers.filter(u => u.loyaltyTier === 3).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 bg-white/5 p-1 rounded-2xl border border-white/5 w-full sm:w-fit">
        <button 
          onClick={() => setActiveSubTab('claims')}
          className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'claims' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-white/40 hover:text-white'}`}
        >
          <Clock className="w-3 h-3" />
          Pending ({pendingClaims.length})
        </button>
        <button 
          onClick={() => { setActiveSubTab('users'); setTierFilter('all'); }}
          className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'users' && tierFilter === 'all' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-white/40 hover:text-white'}`}
        >
          <ShieldCheck className="w-3 h-3" />
          Verified DB
        </button>
        <button 
          onClick={() => { setActiveSubTab('users'); setTierFilter(2); }}
          className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'users' && tierFilter === 2 ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
        >
          <Star className="w-3 h-3" />
          Collectors ({tier2Count})
        </button>
        <button 
          onClick={() => { setActiveSubTab('users'); setTierFilter(3); }}
          className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'users' && tierFilter === 3 ? 'bg-amber-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
        >
          <Crown className="w-3 h-3" />
          Elite ({tier3Count})
        </button>
        <button 
          onClick={() => setActiveSubTab('history')}
          className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
        >
          <Clock className="w-3 h-3" />
          History
        </button>
        <button 
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeSubTab === 'settings' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
        >
          <Settings className="w-3 h-3" />
          Config
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'claims' && (
          <motion.div 
            key="claims"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {pendingClaims.length > 0 ? (
              pendingClaims.map(user => (
                <div key={user.uid} className="glass-morphism p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-4 flex-grow">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                      <User className="w-6 h-6 text-white/20" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase italic tracking-tight">{user.displayName || 'Unnamed User'}</h4>
                      <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{user.email}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-md text-[8px] font-black uppercase tracking-widest border border-purple-500/20">
                          {user.trustStats?.deliveredCodOrders || 0} COD Orders
                        </span>
                        <span className="px-2 py-0.5 bg-pink-500/10 text-pink-400 rounded-md text-[8px] font-black uppercase tracking-widest border border-pink-500/20">
                          {user.trustStats?.successfulPrepaidOrders || 0} Prepaid
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleApprove(user.uid)}
                      className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Check className="w-4 h-4" /> Approve Claim
                    </button>
                    <button 
                      onClick={() => handleReject(user.uid)}
                      className="p-3 bg-pink-500/10 text-pink-500 rounded-xl hover:bg-pink-500 hover:text-white transition-all border border-pink-500/20"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center glass-morphism rounded-3xl border border-white/5">
                <Clock className="w-12 h-12 text-white/5 mx-auto mb-4" />
                <p className="text-sm font-black uppercase italic tracking-widest text-white/20">No pending verification claims</p>
              </div>
            )}
          </motion.div>
        )}

        {activeSubTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input 
                  type="text" 
                  placeholder="Search Users..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-purple-500 transition-all font-bold"
                />
              </div>

              <div className="lg:col-span-1 flex flex-col gap-2">
                <form onSubmit={handleSearchProfile} className="flex gap-2">
                   <input 
                    type="text" 
                    placeholder="KG ID (e.g. KG-XXXX)"
                    value={manualId}
                    onChange={e => setManualId(e.target.value.toUpperCase())}
                    className="flex-grow bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-emerald-500 transition-all uppercase tracking-widest font-black"
                  />
                  <button 
                    disabled={manualSearching || !manualId}
                    className="px-6 py-4 h-fit bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                    type="submit"
                  >
                    {manualSearching ? '...' : 'Search'}
                  </button>
                </form>
                {searchedProfile && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-3"
                  >
                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                      <span className="text-emerald-500">{searchedProfile.displayName || 'Found User'}</span>
                      <button onClick={() => setSearchedProfile(null)} className="text-white/20 hover:text-white">Cancel</button>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3].map(t => (
                        <button key={t} type="button" onClick={() => setManualAddTier(t)} className={`flex-grow py-1 rounded-lg text-[8px] font-black border ${manualAddTier === t ? 'bg-emerald-500 text-white' : 'bg-white/5'}`}>Tier {t}</button>
                      ))}
                    </div>
                    <button type="button" onClick={handleActivateUser} className="w-full py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Confirm Activation</button>
                  </motion.div>
                )}
              </div>

              <button 
                onClick={() => setShowNotificationModal(true)}
                className="lg:col-span-1 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-purple-600/20"
              >
                <Send className="w-4 h-4" /> Broadcast Tier Rewards
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map(user => (
                <div key={user.uid} className="glass-morphism p-6 rounded-3xl border border-white/5 hover:border-purple-500/20 transition-all group relative overflow-hidden">
                  {/* Tier Accent */}
                  <div className={`absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full blur-2xl opacity-20 transition-all ${user.loyaltyTier === 3 ? 'bg-amber-500' : user.loyaltyTier === 2 ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${user.loyaltyTier === 3 ? 'bg-amber-500/10 border-amber-500/20' : user.loyaltyTier === 2 ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                      {user.loyaltyTier === 3 ? <Crown className="w-6 h-6 text-amber-500" /> : 
                       user.loyaltyTier === 2 ? <Star className="w-6 h-6 text-blue-400" /> : 
                       <ShieldCheck className="w-6 h-6 text-emerald-500" />}
                    </div>
                    
                    <div className="flex gap-1">
                      <div className="flex flex-col gap-1">
                        <button 
                          onClick={() => handleTierUpdate(user.uid, Math.min(3, (user.loyaltyTier || 1) + 1))}
                          className="p-1 text-white/20 hover:text-emerald-500 transition-colors"
                          title="Promote Member"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            if (user.loyaltyTier === 1) setDeleteConfirmUid(user.uid);
                            else handleTierUpdate(user.uid, Math.max(1, (user.loyaltyTier || 1) - 1));
                          }}
                          className="p-1 text-white/20 hover:text-pink-500 transition-colors"
                          title="Demote Member"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => setDeleteConfirmUid(user.uid)}
                        className="p-2 text-white/10 hover:text-pink-500 transition-colors self-start ml-2"
                        title="Revoke Status"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {deleteConfirmUid === user.uid && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 z-20 bg-dark-bg/95 rounded-3xl p-4 flex flex-col items-center justify-center text-center gap-4 border border-pink-500/30"
                      >
                        <ShieldAlert className="w-8 h-8 text-pink-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-pink-500">Revoke Verified Access?</p>
                        <div className="flex gap-2 w-full">
                           <button 
                            onClick={async () => {
                              await revokeLoyaltyStatus(user.uid);
                              setDeleteConfirmUid(null);
                              await fetchData();
                            }}
                            className="flex-grow px-4 py-3 bg-pink-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-lg shadow-pink-600/20"
                           >
                             Confirm Revocation
                           </button>
                           <button 
                            onClick={() => setDeleteConfirmUid(null)}
                            className="px-4 py-3 bg-white/5 text-white/40 rounded-xl text-[8px] font-black uppercase tracking-widest"
                           >
                             Abort
                           </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-1">
                    <h4 className="text-sm font-black uppercase italic tracking-tight truncate">{user.displayName || 'Unnamed Protocol'}</h4>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest truncate">{user.email}</p>
                      <p className="text-[10px] text-purple-400 font-black tracking-widest">ID: {user.profileId || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Status Level</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                         <span className={`text-[10px] font-black uppercase italic ${user.loyaltyTier === 3 ? 'text-amber-500' : user.loyaltyTier === 2 ? 'text-blue-500' : 'text-emerald-500'}`}>
                           {user.loyaltyTier === 3 ? 'ELITE' : user.loyaltyTier === 2 ? 'COLLECTOR' : 'TRUSTED'}
                         </span>
                         <div className="flex gap-0.5">
                           {[1, 2, 3].map(lvl => (
                             <div key={lvl} className={`w-1.5 h-1.5 rounded-full ${lvl <= (user.loyaltyTier || 1) ? (user.loyaltyTier === 3 ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]' : user.loyaltyTier === 2 ? 'bg-blue-500' : 'bg-emerald-500') : 'bg-white/10'}`} />
                           ))}
                         </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Trust Index</p>
                      <p className="text-[10px] font-black uppercase italic text-white/60">
                         {((user.trustStats?.deliveredCodOrders || 0) + (user.trustStats?.successfulPrepaidOrders || 0)) * 10}
                      </p>
                    </div>
                  </div>
                  
                  <p className="mt-4 text-[9px] text-white/40 font-bold italic truncate">Badge: {user.badge || 'Standard'}</p>
                </div>
              ))}
              
              {filteredUsers.length === 0 && (
                <div className="col-span-full py-24 text-center glass-morphism rounded-3xl border border-white/5 opacity-50">
                  <Terminal className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-sm font-black uppercase italic tracking-widest">No users found matching query params</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-2 px-2">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Transmission Logs</h3>
              <button 
                onClick={fetchHistory}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                disabled={historyLoading}
              >
                {historyLoading ? 'Syncing...' : 'Refresh Logs'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {allNotifications.map(notif => (
                <div key={notif.id} className="glass-morphism p-6 rounded-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-grow">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                      <Bell className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase italic tracking-tight">{notif.title}</h4>
                      <p className="text-[10px] text-white/40 font-bold uppercase truncate max-w-md">{notif.message}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{notif.type}</span>
                        {notif.targetTier && <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">TIER {notif.targetTier}</span>}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteNotification(notif.id!)}
                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {allNotifications.length === 0 && !historyLoading && (
                <div className="py-12 text-center text-white/20 uppercase font-black text-xs border border-dashed border-white/5 rounded-3xl">
                  No Transmission Found in Mesh
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSubTab === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            <div className="glass-morphism p-8 rounded-3xl border border-white/5 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center border border-purple-500/20 shadow-lg shadow-purple-600/10">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter">COD Protocol</h3>
                  <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Security verification parameters</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-xs font-black uppercase italic tracking-tight">Active Matrix Check</p>
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Apply verification fees</p>
                  </div>
                  <button 
                    onClick={() => handleUpdateSettings({ isCodVerificationEnabled: !settings?.loyalty?.isCodVerificationEnabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings?.loyalty?.isCodVerificationEnabled ? 'bg-purple-600' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings?.loyalty?.isCodVerificationEnabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Verification Deposit (₹)</label>
                  <input 
                    type="number" 
                    value={settings?.loyalty?.codVerificationAmount || 0}
                    onChange={e => handleUpdateSettings({ codVerificationAmount: Number(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-black italic tracking-tighter focus:border-purple-500 outline-none text-purple-400"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-xs font-black uppercase italic tracking-tight">AI Auto-Approval</p>
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Neural bypass for claims</p>
                  </div>
                  <button 
                    onClick={() => handleUpdateSettings({ autoApproveTrustedBuyer: !settings?.loyalty?.autoApproveTrustedBuyer })}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings?.loyalty?.autoApproveTrustedBuyer ? 'bg-emerald-600' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings?.loyalty?.autoApproveTrustedBuyer ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-morphism p-8 rounded-3xl border border-white/5 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600/20 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                  <Award className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter">Tier Identity</h3>
                  <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Custom designation labels</p>
                </div>
              </div>

              <div className="space-y-6">
                {[
                  { key: 'trusted', label: 'Tier 01 (Trusted)', color: 'border-emerald-500' },
                  { key: 'collector', label: 'Tier 02 (Collector)', color: 'border-blue-500' },
                  { key: 'elite', label: 'Tier 03 (Elite)', color: 'border-amber-500' }
                ].map(tier => (
                  <div key={tier.key} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">{tier.label}</label>
                    <input 
                      type="text" 
                      value={(settings?.loyalty?.badgeNames as any)?.[tier.key] || ''}
                      onChange={e => handleUpdateSettings({ 
                        badgeNames: { ...settings?.loyalty?.badgeNames!, [tier.key]: e.target.value } 
                      })}
                      className={`w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-black italic tracking-tighter focus:${tier.color} outline-none`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Broadcast Modal */}
      <AnimatePresence>
        {showNotificationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-xl glass-morphism rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden relative"
            >
              {/* Animated BG */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 animate-pulse" />
              
              <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-8 space-y-6 sm:space-y-8 relative">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-600/20 shrink-0">
                      <Bell className="w-6 h-6 sm:w-7 sm:h-7 text-white animate-bounce" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-white">Broadcast Protocol</h3>
                      <p className="text-[9px] sm:text-[10px] text-white/40 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-purple-400" /> Neural Push Notification
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowNotificationModal(false)}
                    className="p-2 sm:p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/10"
                  >
                    <X className="w-5 h-5 text-white/40" />
                  </button>
                </div>

                <div className="space-y-8 pb-12">
                  {/* Select Target Tier */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Target Audience</p>
                    <div className="flex gap-2">
                      {[
                        { id: 1, label: 'Trusted', count: trustedUsers.filter(u => u.loyaltyTier === 1).length, color: 'emerald' },
                        { id: 2, label: 'Collector', count: tier2Count, color: 'blue' },
                        { id: 3, label: 'Elite', count: tier3Count, color: 'amber' },
                        { id: 'user', label: 'ID Only', count: 1, color: 'purple' }
                      ].map(t => (
                        <button 
                          key={t.id}
                          onClick={() => setNotifyTier(t.id as any)}
                          className={`flex-grow p-4 rounded-2xl border transition-all text-center group ${notifyTier === t.id ? `bg-${t.color}-500/20 border-${t.color}-500/50` : 'bg-white/5 border-white/10 opacity-40 hover:opacity-100'}`}
                        >
                          <p className={`text-[10px] font-black uppercase tracking-tighter ${notifyTier === t.id ? `text-${t.color}-500` : 'text-white/60'}`}>{t.label}</p>
                          <p className="text-[8px] font-bold uppercase tracking-widest text-white/20 mt-1">{t.id === 'user' ? 'Targeted' : `${t.count} Active IDs`}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {notifyTier === 'user' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Target Profile ID (e.g. KG-XXXX)</p>
                       <input 
                         type="text"
                         value={notifyTargetUid}
                         onChange={e => setNotifyTargetUid(e.target.value.toUpperCase())}
                         placeholder="Paste User Profile ID..."
                         className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-purple-500 outline-none transition-all placeholder:text-white/10 font-bold tracking-widest"
                       />
                    </div>
                  )}

                  {/* Message Input */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1 text-white">Broadcast Title</p>
                      <input 
                        type="text"
                        value={notifyTitle}
                        onChange={e => setNotifyTitle(e.target.value)}
                        placeholder="Internal Protocol ID or Subject..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-purple-500 outline-none transition-all placeholder:text-white/10 font-bold text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Banner Selection</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-white/20 ml-1">Direct Link</p>
                          <input 
                            type="text"
                            value={notifyBanner}
                            onChange={e => setNotifyBanner(e.target.value)}
                            placeholder="https://images.com/banner.jpg"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-[10px] focus:border-purple-500 outline-none transition-all placeholder:text-white/10"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-[8px] font-black uppercase tracking-widest text-white/20 ml-1">Upload Local Asset</p>
                          <label className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl px-4 py-3 text-[10px] cursor-pointer hover:bg-indigo-600/30 transition-all font-black uppercase tracking-widest text-indigo-400">
                             <Layers className="w-4 h-4" /> Pick Image
                             <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                          </label>
                        </div>
                      </div>
                      {notifyBanner && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-2 relative rounded-2xl overflow-hidden border border-white/10 aspect-video group"
                        >
                          <img src={notifyBanner} alt="Preview" className="w-full h-full object-cover" />
                          <button onClick={() => setNotifyBanner('')} className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Encrypted Message</p>
                      <textarea 
                        value={notifyMsg}
                        onChange={e => setNotifyMsg(e.target.value)}
                        placeholder="Enter rewards transmission details..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:border-purple-500 outline-none transition-all placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  {/* Reward / Coupon */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1 flex items-center gap-2">
                      <Gift className="w-3 h-3" /> Reward Payload (Optional)
                    </p>
                    <select 
                      value={selectedCoupon}
                      onChange={e => setSelectedCoupon(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-black uppercase italic tracking-tighter focus:border-emerald-500 outline-none text-emerald-400"
                    >
                      <option value="">No Coupon Attached</option>
                      {coupons.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`} OFF</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button 
                  onClick={handleSendNotification}
                  disabled={isSending || !notifyMsg}
                  className="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Transmitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Initiating Neural Broadcast
                    </>
                  )}
                </button>

                <p className="text-center text-[8px] text-white/20 font-bold uppercase tracking-widest">
                  Caution: Transmissions are final and cannot be retracted from the mesh.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
