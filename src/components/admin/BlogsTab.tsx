import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Edit2, Trash2, Search, Wand2, Clock, Check, X, 
  Settings as SettingsIcon, Save, Image as ImageIcon, LayoutGrid, Rss,
  Eye, ExternalLink, MessageCircle, AlertTriangle, ChevronRight,
  Upload, Copy, Sparkles, FileText, Video, Mail
} from 'lucide-react';
import { BlogPost, BlogSettings, Subscriber } from '../../types';
import { createBlog, updateBlog, updateBlogSettings } from '../../services/blogService';
import { getAllSubscribers } from '../../services/subscriptionService';
import { generateBlogTopics, generateCompleteBlogPost, generateBlogImage, generateAltText } from '../../services/blogAiService';

import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface BlogsTabProps {
  blogs: BlogPost[];
  settings: BlogSettings | null;
  onRefresh: () => void;
  onDelete: (id: string) => Promise<void>;
}

export default function BlogsTab({ blogs, settings, onRefresh, onDelete }: BlogsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'emails'>('posts');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genStep, setGenStep] = useState<'topics' | 'content' | 'saving' | 'idle'>('idle');
  const [genTimer, setGenTimer] = useState<number>(0);
  const [subLoading, setSubLoading] = useState(false);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  
  const [blogForm, setBlogForm] = useState<Partial<BlogPost>>({
    title: '',
    slug: '',
    content: '',
    status: 'draft',
    coverImage: '',
    coverImageAlt: '',
    tags: [],
    seoKeywords: []
  });

  const [collectionCardForm, setCollectionCardForm] = useState({
    title: '',
    btnText: '',
    link: '',
    image: ''
  });

  const collectionInputRef = React.useRef<HTMLInputElement>(null);

  const [settingsForm, setSettingsForm] = useState<Partial<BlogSettings>>(
    settings || { isAutoEnabled: false, intervalDays: 3, targetTopics: [] }
  );

  const [isDragging, setIsDragging] = useState(false);
  const [isForging, setIsForging] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [showMarkerForge, setShowMarkerForge] = useState<'button' | 'image' | 'collection' | null>(null);
  const [markerForgeData, setMarkerForgeData] = useState({ text: '', link: '', alt: '', image: '', btnText: '' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<HTMLTextAreaElement>(null);

  // Helper to extract image markers from content
  const extractImages = (content: string) => {
    const markers: { full: string; url: string; alt: string; index: number }[] = [];
    const regex = /\[IMAGE: ([\s\S]*?)\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const meta = match[1]; // Do not replace spaces yet, URL might be base64
      if (meta.includes('|')) {
        const [url, alt] = meta.split('|').map(s => s.trim());
        markers.push({ full: match[0], url, alt: alt || 'Visual Asset', index: match.index });
      } else {
        markers.push({ full: match[0], url: meta.trim(), alt: 'Visual Asset', index: match.index });
      }
    }
    return markers;
  };

  const extractCollections = (content: string) => {
    const markers: { full: string; title: string; btn: string; link: string; img: string; index: number }[] = [];
    const regex = /\[COLLECTION_LINK: ([\s\S]*?)\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const meta = match[1];
      const parts = meta.split('|').map(s => s.trim());
      markers.push({
        full: match[0],
        title: parts[0] || '',
        btn: parts[1] || '',
        link: parts[2] || '',
        img: parts[3] || '',
        index: match.index
      });
    }
    return markers;
  };

  const extractButtons = (content: string) => {
    const markers: { full: string; text: string; link: string; index: number }[] = [];
    const regex = /\[BUTTON: ([\s\S]*?)\]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const meta = match[1];
      const [text, link] = meta.split('|').map(s => s.trim());
      markers.push({ full: match[0], text, link: link || '#', index: match.index });
    }
    return markers;
  };

  const imagesInContent = extractImages(blogForm.content || '');
  const collectionsInContent = extractCollections(blogForm.content || '');
  const buttonsInContent = extractButtons(blogForm.content || '');

  const updateCollectionMarker = (oldMarker: string, data: typeof collectionCardForm) => {
    const marker = `[COLLECTION_LINK: ${data.title} | ${data.btnText} | ${data.link} | ${data.image}]`;
    setBlogForm(prev => ({
      ...prev,
      content: (prev.content || '').replace(oldMarker, marker)
    }));
  };

  const updateButtonMarker = (oldMarker: string, text: string, link: string) => {
    const marker = `[BUTTON: ${text} | ${link}]`;
    setBlogForm(prev => ({
      ...prev,
      content: (prev.content || '').replace(oldMarker, marker)
    }));
  };

  const updateImageMarker = (oldMarker: string, newUrl: string, newAlt: string) => {
    const marker = `[IMAGE: ${newUrl} | ${newAlt}]`;
    setBlogForm(prev => ({
      ...prev,
      content: (prev.content || '').replace(oldMarker, marker)
    }));
  };

  const removeImageMarker = (marker: string) => {
    setBlogForm(prev => ({
      ...prev,
      content: (prev.content || '').replace(marker, '').trim()
    }));
  };

  const removeCollectionMarker = (marker: string) => {
    setBlogForm(prev => ({
      ...prev,
      content: (prev.content || '').replace(marker, '').trim()
    }));
  };

  const removeButtonMarker = (marker: string) => {
    setBlogForm(prev => ({
      ...prev,
      content: (prev.content || '').replace(marker, '').trim()
    }));
  };

  const moveMarker = (marker: string, direction: 'up' | 'down') => {
    const content = blogForm.content || '';
    if (!content.includes(marker)) return;

    // Split into lines to find the block
    const lines = content.split('\n');
    let targetIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(marker)) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx === -1) return;

    // A block is the line with the marker + surrounding non-empty lines
    let start = targetIdx;
    while (start > 0 && lines[start - 1].trim() !== '') start--;
    let end = targetIdx;
    while (end < lines.length - 1 && lines[end + 1].trim() !== '') end++;

    const block = lines.slice(start, end + 1);
    const otherLines = [...lines];
    otherLines.splice(start, block.length);

    if (direction === 'up') {
      if (start <= 0) return;
      // Find insertion point before previous block
      let insertAt = start - 1;
      while (insertAt > 0 && otherLines[insertAt].trim() === '') insertAt--; // skip empty
      while (insertAt > 0 && otherLines[insertAt - 1].trim() !== '') insertAt--; // skip previous block
      
      const newLines = [...otherLines];
      newLines.splice(insertAt, 0, ...block);
      setBlogForm(prev => ({ ...prev, content: newLines.join('\n') }));
    } else {
      let insertAt = start;
      while (insertAt < otherLines.length && otherLines[insertAt].trim() === '') insertAt++; // skip empty
      if (insertAt >= otherLines.length) return;
      while (insertAt < otherLines.length - 1 && otherLines[insertAt + 1].trim() !== '') insertAt++; // skip next block
      
      const newLines = [...otherLines];
      newLines.splice(insertAt + 1, 0, ...block);
      setBlogForm(prev => ({ ...prev, content: newLines.join('\n') }));
    }
  };

  const insertTextAtCursor = (text: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      setBlogForm(prev => ({ ...prev, content: (prev.content || '') + text }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = blogForm.content || '';
    const newContent = content.substring(0, start) + text + content.substring(end);
    
    setBlogForm(prev => ({ ...prev, content: newContent }));
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + text.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  const uploadImage = async (file: File): Promise<string> => {
    console.log("BLOG_EDITOR: Starting Cloudinary upload for:", file.name);
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configuration missing. Please check .env variables.");
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', 'Karmagully');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Cloudinary upload failed");
      }

      const data = await response.json();
      console.log("BLOG_EDITOR: Cloudinary success:", data.secure_url);
      return data.secure_url;
    } catch (err: any) {
      console.error("BLOG_EDITOR: CLOUDINARY_UPLOAD_ERROR:", err);
      throw err;
    }
  };

  const processFile = async (file: File) => {
    setIsForging(true);
    try {
      const url = await uploadImage(file);
      setMarkerForgeData({ text: '', link: url, alt: file.name.split('.')[0], image: '', btnText: '' });
      setShowMarkerForge('image');
    } catch (err) {
      console.error("BLOG_EDITOR: Process file failed:", err);
      alert("Forge failed. Check console.");
    } finally {
      setIsForging(false);
    }
  };

  const filteredBlogs = blogs.filter(b => 
    b.title?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
    b.tags?.some(t => t?.toLowerCase()?.includes(searchTerm.toLowerCase()))
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsForging(true);
      const url = await uploadImage(file);
      setBlogForm(prev => ({ ...prev, coverImage: url }));
    } catch (err) {
      console.error("Cover image upload failed:", err);
      alert("Failed to upload cover image.");
    } finally {
      setIsForging(false);
    }
  };

  const handleCreateNew = () => {
    setEditingBlog(null);
    setBlogForm({
      title: '',
      slug: '',
      content: '',
      status: 'draft',
      tags: [],
      seoKeywords: []
    });
    setShowEditor(true);
  };

  const handleEdit = (blog: BlogPost) => {
    setEditingBlog(blog);
    setBlogForm(blog);
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingBlog) {
        await updateBlog(editingBlog.id, blogForm);
      } else {
        await createBlog(blogForm as any);
      }
      setShowEditor(false);
      onRefresh();
    } catch (err) {
      console.error(err);
      alert('Save failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    
    setLoading(true);
    setDeletingId(id); // Keep it set so the spinner shows on the right button
    try {
      console.log('Initiating delete for blog:', id);
      await onDelete(id);
      setDeletingId(null);
      alert('Post deleted successfully');
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
      // Don't reset deletingId on error so they can try again or cancel
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTopics = async () => {
    setGenError(null);
    setGenLoading(true);
    setGenStep('topics');
    try {
      const topics = await generateBlogTopics();
      if (!topics || topics.length === 0) throw new Error('No topics suggested by AI');
      setSuggestedTopics(topics);
    } catch (err) {
      console.error(err);
      let errorMsg = err instanceof Error ? err.message : 'Research failed';
      if (errorMsg.includes('500') || errorMsg.includes('Rpc failed') || errorMsg.includes('xhr error')) {
        errorMsg = 'AI Connection issue (500). Please try again soon.';
      }
      setGenError(errorMsg);
    } finally {
      setGenLoading(false);
    }
  };

  const handleGenerateComplete = async (topic: string) => {
    setSelectedTopic(topic);
    setGenError(null);
    setGenLoading(true);
    setGenStep('content');
    setGenTimer(0);
    
    // Start a timer for user feedback
    const interval = setInterval(() => {
      setGenTimer(prev => prev + 1);
    }, 1000);

    try {
      console.log('--- STARTING AI BLOG FORGE ---');
      console.log('Topic selected:', topic);
      
      const result = await generateCompleteBlogPost(topic);
      
      console.log('AI Generation successful. Title:', result?.title);
      if (!result || !result.content) {
        console.error('Incomplete AI response:', result);
        throw new Error('AI failed to forge valid content. Please try again.');
      }

      const imageUrl = '';
      
      const title = result.title || topic;
      const newBlog: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'> = {
        title,
        slug: result.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `post-${Date.now()}`,
        content: result.content || '',
        excerpt: result.excerpt || '',
        metaDescription: result.metaDescription || '',
        seoKeywords: result.seoKeywords || [],
        faq: result.faq || [],
        schemaMarkup: result.schemaMarkup || {},
        status: 'draft',
        isAiGenerated: true,
        coverImage: imageUrl,
        tags: [topic.split(' ')[0] || 'Anime']
      };

      console.log('Final Blog Object for Save:', JSON.stringify(newBlog, null, 2));
      console.log('Pushing new article to database...');
      setGenStep('saving');
      const newBlogId = await createBlog(newBlog);
      console.log('Article successfully posted! Firestore ID:', newBlogId);
      
      // Finalize UI
      setGenStep('idle');
      setSuggestedTopics([]);
      setShowGenerator(false);
      onRefresh();
      
      setTimeout(() => {
        alert('SUCCESS: AI Article forged and saved as draft! You can find it in your posts list.');
      }, 500);

    } catch (err: any) {
      console.error('AI Generation Error:', err);
      let errorMsg = err instanceof Error ? err.message : 'Forging failed';
      
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'AI is busy (Rate Limit). Please wait a minute and try again.';
      } else if (errorMsg.includes('404')) {
        errorMsg = 'AI Model not found or unavailable in this region.';
      } else if (errorMsg.includes('500') || errorMsg.includes('Rpc failed') || errorMsg.includes('xhr error') || errorMsg.includes('Failed to fetch')) {
        errorMsg = 'AI Connection issue. This might be a temporary network delay. Please try again soon.';
      } else if (errorMsg.includes('JSON')) {
        errorMsg = 'AI returned an invalid data format. Please try a different topic.';
      }
      
      setGenError(errorMsg);
    } finally {
      clearInterval(interval);
      setGenLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await updateBlogSettings(settingsForm);
      setShowSettings(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscribers = async () => {
    setSubLoading(true);
    try {
      const data = await getAllSubscribers();
      setSubscribers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSubLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeSubTab === 'emails') {
      fetchSubscribers();
    }
  }, [activeSubTab]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">AI <span className="text-gradient">Editorial</span></h2>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Manage blog content & AI automation</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
           <button 
             onClick={() => setActiveSubTab('posts')}
             className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'posts' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
           >
             Posts
           </button>
           <button 
             onClick={() => setActiveSubTab('emails')}
             className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'emails' ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
           >
             Emails
           </button>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-3 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all flex items-center gap-2"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Settings</span>
          </button>
          {activeSubTab === 'posts' && (
            <>
              <button 
                onClick={() => setShowGenerator(true)}
                className="p-3 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-xl hover:bg-purple-600/30 transition-all flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">AI Generate</span>
              </button>
              <button 
                onClick={handleCreateNew}
                className="p-3 bg-white text-black rounded-xl hover:scale-105 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">New Post</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeSubTab === 'posts' ? (
        <>
          {/* Stats / Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Total Posts</p>
              <p className="text-2xl font-black italic tracking-tighter">{blogs.length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Published</p>
              <p className="text-2xl font-black italic tracking-tighter text-emerald-500">{blogs.filter(b => b.status === 'published').length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Drafts</p>
              <p className="text-2xl font-black italic tracking-tighter text-amber-500">{blogs.filter(b => b.status === 'draft').length}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-1">Automation</p>
              <p className={`text-sm font-black uppercase tracking-widest ${settings?.isAutoEnabled ? 'text-emerald-500' : 'text-red-500'}`}>
                {settings?.isAutoEnabled ? `ACTIVE (${settings.intervalDays}d)` : 'DISABLED'}
              </p>
            </div>
          </div>

          {/* Blog List */}
          <div className="glass-morphism rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
               <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input 
                  type="text" 
                  placeholder="SEARCH THE PRESS..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-black/20 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-bold uppercase tracking-widest focus:border-purple-500/50 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Article</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">SEO Score</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">AI</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredBlogs.map(blog => (
                    <tr key={blog.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          {blog.coverImage && <img src={blog.coverImage || undefined} className="w-10 h-10 rounded-lg object-cover" />}
                          <div>
                            <p className="text-sm font-black italic tracking-tighter uppercase">{blog.title}</p>
                            <p className="text-[8px] text-white/40 uppercase tracking-widest">/{blog.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${blog.status === 'published' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                          {blog.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold uppercase text-white/60">
                        {blog.seoKeywords?.length || 0} KW
                      </td>
                      <td className="px-6 py-4">
                        {blog.isAiGenerated && <div className="p-1 px-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20 text-[8px] font-black uppercase tracking-widest w-fit">AI</div>}
                      </td>
                       <td className="px-6 py-4">
                           <div className="flex gap-2">
                            {deletingId === blog.id ? (
                              <div className="flex gap-2 items-center">
                                <button 
                                  onClick={() => handleDelete(blog.id)}
                                  disabled={loading}
                                  className="px-3 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all flex items-center gap-1 disabled:opacity-50"
                                >
                                  {loading ? <Clock className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} 
                                  {loading ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="px-3 py-2 bg-white/5 text-white/40 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handleEdit(blog)} 
                                  className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all text-white/60 hover:text-white"
                                  title="Edit Article"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => setDeletingId(blog.id)} 
                                  className="p-2.5 bg-red-500/5 hover:bg-red-500/20 border border-red-500/10 rounded-xl transition-all text-red-500/40 hover:text-red-500"
                                  title="Delete Article"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                           </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-morphism rounded-3xl border border-white/5 overflow-hidden">
          <div className="p-6 border-b border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-purple-500" />
              <h3 className="text-xl font-black italic uppercase tracking-tighter">Subscriber Nucleus</h3>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">{subscribers.length} CONNECTIONS ACTIVE</p>
          </div>
          
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-white/5 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Secure Email</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Linked At</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white/40">Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {subLoading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/20 animate-pulse">Syncing subscribers...</p>
                    </td>
                  </tr>
                ) : subscribers.length === 0 ? (
                   <tr>
                    <td colSpan={3} className="px-6 py-12 text-center opacity-20">
                      <Mail className="w-12 h-12 mx-auto mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">No subscribers in terminal</p>
                    </td>
                  </tr>
                ) : (
                  subscribers.map(sub => (
                    <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-black tracking-tight text-white/80">{sub.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                          {sub.createdAt?.toDate ? sub.createdAt.toDate().toLocaleString() : 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">PROTECTED</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               onClick={() => setShowEditor(false)}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto no-scrollbar bg-dark-bg border border-white/10 p-8 rounded-3xl"
             >
                <div className="flex justify-between items-center mb-8">
                   <h2 className="text-2xl font-black uppercase italic tracking-tighter">{editingBlog ? 'Edit Article' : 'New Article'}</h2>
                   <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Title</label>
                        <input 
                          className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-purple-500/50 outline-none"
                          value={blogForm.title}
                          onChange={e => setBlogForm({ ...blogForm, title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Slug</label>
                        <input 
                          className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-purple-500/50 outline-none"
                          value={blogForm.slug}
                          onChange={e => setBlogForm({ ...blogForm, slug: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Status</label>
                        <select 
                          className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-purple-500/50 outline-none appearance-none"
                          value={blogForm.status}
                          onChange={e => setBlogForm({ ...blogForm, status: e.target.value as any })}
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Cover Image</label>
                        <div className="flex flex-col gap-4">
                           <div className="flex gap-4 items-center">
                              <div className="w-20 h-20 rounded-xl bg-white/5 shrink-0 overflow-hidden border border-white/5 relative group flex flex-col items-center justify-center">
                                {blogForm.coverImage ? (
                                  <>
                                    <img src={blogForm.coverImage || undefined} className="w-full h-full object-cover" />
                                    <button 
                                      type="button"
                                      onClick={() => setBlogForm({ ...blogForm, coverImage: '' })}
                                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                      <X className="w-4 h-4 text-white" />
                                    </button>
                                  </>
                                ) : (
                                  <ImageIcon className="w-6 h-6 text-white/10" />
                                )}
                              </div>
                              <div className="flex-grow space-y-2">
                                <input 
                                  placeholder="Thumbnail URL..."
                                  className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-[10px] focus:border-purple-500/50 outline-none font-medium text-white/80"
                                  value={blogForm.coverImage}
                                  onChange={e => setBlogForm({ ...blogForm, coverImage: e.target.value })}
                                />
                                <input 
                                  placeholder="Cover Image Alt Text (SEO)..."
                                  className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-[10px] focus:border-purple-500/50 outline-none font-medium text-white/80 mt-2"
                                  value={blogForm.coverImageAlt}
                                  onChange={e => setBlogForm({ ...blogForm, coverImageAlt: e.target.value })}
                                />
                                <div className="flex items-center gap-3">
                                  <label className="cursor-pointer px-4 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all text-[8px] font-black uppercase tracking-widest flex items-center gap-2">
                                    <ImageIcon className="w-3 h-3" />
                                    Upload Custom
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                  </label>
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>

                      {/* NEW: Asset Forge for Content Images */}
                      <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2">
                           <Wand2 className="w-3 h-3 text-purple-400" />
                           <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Asset Forge</span>
                        </div>
                        <p className="text-[8px] text-white/40 italic">Drop an image here to insert it directly into your story.</p>
                        <label className="block w-full cursor-pointer px-4 py-3 bg-white/5 border border-white/10 border-dashed rounded-xl text-center hover:bg-white/10 transition-all group">
                           <span className="text-[9px] font-black uppercase tracking-widest text-white/30 group-hover:text-white transition-colors">Forge & Insert Visual</span>
                           <input 
                             type="file" 
                             accept="image/*" 
                             className="hidden" 
                             onChange={(e) => {
                               const file = e.target.files?.[0];
                               if (file) processFile(file);
                             }}
                           />
                        </label>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">SEO Meta Description</label>
                        <textarea 
                          className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-base focus:border-purple-500/50 outline-none h-24"
                          value={blogForm.metaDescription}
                          onChange={e => setBlogForm({ ...blogForm, metaDescription: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Markdown Content & Visual Hub</label>
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[8px] text-purple-400 font-bold hover:text-purple-300 transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <Upload className="w-3 h-3" />
                        {isForging ? 'FORGING ASSET...' : 'CLICK OR DRAG IMAGES HERE'}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const file of files) await processFile(file);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative">
                      {isForging && (
                        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center rounded-3xl pointer-events-none">
                          <div className="bg-black/90 border border-purple-500/30 p-8 rounded-3xl flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(168,85,247,0.2)]">
                            <Sparkles className="w-10 h-10 text-purple-500 animate-pulse" />
                            <div className="text-center">
                              <p className="text-[12px] font-black uppercase tracking-widest text-white italic">Forging Visual Asset...</p>
                              <p className="text-[8px] text-white/40 mt-1 uppercase tracking-tighter">Uploading to secure terminal</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="lg:col-span-3 space-y-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between px-2 mb-2 gap-2">
                           <div className="flex items-center gap-2">
                             <FileText className="w-4 h-4 text-purple-400" />
                             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Content Foundry</span>
                           </div>
                            <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1.5 rounded-xl border border-white/10 shadow-inner">
                              <button type="button" onMouseDown={(e) => e.preventDefault()} title="Bold" onClick={() => insertTextAtCursor('**BOLD**')} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-[10px] text-white/60 font-black transition-colors">B</button>
                              <button type="button" onMouseDown={(e) => e.preventDefault()} title="Italic" onClick={() => insertTextAtCursor('*ITALIC*')} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-[10px] text-white/60 italic font-medium transition-colors">I</button>
                              <button type="button" onMouseDown={(e) => e.preventDefault()} title="Heading 2" onClick={() => insertTextAtCursor('\n## ')} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-[10px] text-white/60 font-bold transition-colors">H2</button>
                              <button type="button" onMouseDown={(e) => e.preventDefault()} title="Heading 3" onClick={() => insertTextAtCursor('\n### ')} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-[10px] text-white/60 font-bold transition-colors">H3</button>
                              <div className="w-px h-4 bg-white/10 mx-1" />
                              <button 
                                type="button" 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e: any) => {
                                    const file = e.target.files?.[0];
                                    if (file) processFile(file);
                                  };
                                  input.click();
                                }} 
                                className="px-3 h-8 flex items-center gap-2 hover:bg-purple-500/20 rounded-lg text-purple-400 transition-all border border-purple-500/20 group"
                                title="Upload & Insert Image"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest group-hover:text-white">Upload Image</span>
                              </button>
                              <button 
                                type="button" 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setMarkerForgeData({ text: '', link: '', alt: '', image: '', btnText: '' });
                                  setShowMarkerForge('collection');
                                  editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }} 
                                className="px-3 h-8 flex items-center gap-2 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-all border border-emerald-500/20 group"
                                title="Insert Terminal Card"
                              >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest group-hover:text-white">Terminal Card</span>
                              </button>
                              <button 
                                type="button" 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setMarkerForgeData({ text: '', link: '', alt: '', image: '', btnText: '' });
                                  setShowMarkerForge('button');
                                  // Scroll back up to editor if needed
                                  editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }} 
                                className="px-3 h-8 flex items-center gap-2 hover:bg-purple-500/20 rounded-lg text-purple-400 transition-all border border-purple-500/20 group"
                                title="Insert Theme Button"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="text-[8px] font-black uppercase tracking-widest group-hover:text-white">Theme Button</span>
                              </button>
                              <button 
                                type="button" 
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => insertTextAtCursor('\n\n[VIDEO: https://www.youtube.com/embed/dQw4w9WgXcQ]\n\n')} 
                                className="w-8 h-8 flex items-center justify-center hover:bg-blue-500/20 rounded-lg text-blue-400 transition-all border border-blue-500/20"
                                title="Insert Video"
                              >
                                <Video className="w-3.5 h-3.5" />
                              </button>
                           </div>
                        </div>

                          <div className="flex bg-black/40 border border-white/5 p-1 rounded-2xl w-fit mb-4">
                            <button 
                              type="button"
                              onClick={() => setIsPreview(false)}
                              className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${!isPreview ? 'bg-white text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                              Editor
                            </button>
                            <button 
                              type="button"
                              onClick={() => setIsPreview(true)}
                              className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${isPreview ? 'bg-purple-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                              Preview
                            </button>
                          </div>

                          <div 
                            className={`relative rounded-3xl border transition-all duration-300 ${isDragging ? 'border-purple-500 bg-purple-500/5 scale-[1.01]' : 'border-white/5 bg-black/40'}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              const files = Array.from(e.dataTransfer.files);
                              files.forEach(f => {
                                if (f.type.startsWith('image/')) processFile(f);
                              });
                            }}
                          >
                            {!isPreview ? (
                              <div className="relative">
                                <textarea 
                                  ref={editorRef}
                                  className="w-full bg-transparent p-6 text-sm font-medium leading-relaxed focus:ring-0 outline-none min-h-[500px] resize-y no-scrollbar text-white/80"
                                  placeholder="BEGIN THE STORY... (DRAG IMAGES HERE TO FORGE)"
                                  value={blogForm.content}
                                  onChange={e => setBlogForm({ ...blogForm, content: e.target.value })}
                                />
                                
                                <AnimatePresence>
                                  {showMarkerForge && (
                                    <motion.div 
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: 10 }}
                                      className="absolute bottom-6 right-6 w-72 bg-dark-bg border border-white/10 p-4 rounded-2xl shadow-2xl z-50 backdrop-blur-xl"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-[9px] font-black uppercase tracking-widest text-white/60">
                                          {showMarkerForge === 'button' ? 'Configure Theme Button' : showMarkerForge === 'collection' ? 'Configure Terminal Card' : 'Confirm Asset Meta'}
                                        </h4>
                                        <button onClick={() => setShowMarkerForge(null)} className="text-white/20 hover:text-white"><X className="w-3 h-3" /></button>
                                      </div>
                                      <div className="space-y-3">
                                        {showMarkerForge === 'button' ? (
                                          <>
                                            <input 
                                              placeholder="Button Text"
                                              autoFocus
                                              className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs outline-none focus:border-orange-500"
                                              value={markerForgeData.text}
                                              onChange={e => setMarkerForgeData({ ...markerForgeData, text: e.target.value })}
                                            />
                                            <input 
                                              placeholder="Redirect Link"
                                              className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-xs outline-none focus:border-orange-500"
                                              value={markerForgeData.link}
                                              onChange={e => setMarkerForgeData({ ...markerForgeData, link: e.target.value })}
                                            />
                                          </>
                                        ) : showMarkerForge === 'collection' ? (
                                          <>
                                            <div className="grid grid-cols-2 gap-2">
                                              <input 
                                                placeholder="Card Title"
                                                autoFocus
                                                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-purple-500"
                                                value={markerForgeData.text}
                                                onChange={e => setMarkerForgeData({ ...markerForgeData, text: e.target.value })}
                                              />
                                              <input 
                                                placeholder="Button Text"
                                                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-purple-500"
                                                value={markerForgeData.btnText}
                                                onChange={e => setMarkerForgeData({ ...markerForgeData, btnText: e.target.value })}
                                              />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                              <input 
                                                placeholder="Link (/shop)"
                                                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-purple-500"
                                                value={markerForgeData.link}
                                                onChange={e => setMarkerForgeData({ ...markerForgeData, link: e.target.value })}
                                              />
                                              <input 
                                                placeholder="Image URL"
                                                className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-purple-500"
                                                value={markerForgeData.image}
                                                onChange={e => setMarkerForgeData({ ...markerForgeData, image: e.target.value })}
                                              />
                                            </div>
                                          </>
                                        ) : (
                                            <div className="space-y-3">
                                              <p className="text-[10px] font-black italic text-white/60">Asset Forged Successfully</p>
                                              <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase tracking-widest text-white/20">Image Description (Alt Text)</label>
                                                <input 
                                                  placeholder="Enter descriptive alt text for SEO..."
                                                  autoFocus
                                                  className="w-full bg-black border border-purple-500/30 rounded-lg px-4 py-3 text-xs outline-none focus:border-purple-500 shadow-lg text-white"
                                                  value={markerForgeData.alt}
                                                  onChange={e => setMarkerForgeData({ ...markerForgeData, alt: e.target.value })}
                                                />
                                              </div>
                                            </div>
                                        )}
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            if (showMarkerForge === 'button') {
                                              insertTextAtCursor(`\n\n[BUTTON: ${markerForgeData.text || 'Explore Articles'} | ${markerForgeData.link || '#'}]\n\n`);
                                            } else if (showMarkerForge === 'collection') {
                                              insertTextAtCursor(`\n\n[COLLECTION_LINK: ${markerForgeData.text || 'Collection'} | ${markerForgeData.btnText || 'Browse'} | ${markerForgeData.link || '/shop'} | ${markerForgeData.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e'}]\n\n`);
                                            } else {
                                              insertTextAtCursor(`\n\n[IMAGE: ${markerForgeData.link} | ${markerForgeData.alt || 'Asset'}]\n\n`);
                                            }
                                            setShowMarkerForge(null);
                                            setMarkerForgeData({ text: '', link: '', alt: '', image: '', btnText: '' });
                                          }}
                                          className={`w-full py-2 ${showMarkerForge === 'button' ? 'bg-orange-500 shadow-orange-500/20' : showMarkerForge === 'collection' ? 'bg-purple-600 shadow-purple-500/20' : 'bg-purple-500 shadow-purple-500/20'} text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg`}
                                        >
                                          Forging Complete
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ) : (
                              <div className="w-full bg-transparent p-8 text-sm leading-relaxed min-h-[500px] text-white/90 max-w-none">
                                <div className="markdown-body">
                                  <ReactMarkdown 
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                      p: ({ children }) => {
                                        const getChildrenText = (node: any): string => {
                                          if (!node) return '';
                                          if (typeof node === 'string') return node;
                                          if (Array.isArray(node)) return node.map(getChildrenText).join('');
                                          if (node.props?.children) return getChildrenText(node.props.children);
                                          return '';
                                        };
                                        const content = getChildrenText(children);
                                        
                                        // Handle Collection Links
                                        if (content.includes('[COLLECTION_LINK:')) {
                                          const col = extractCollections(content)[0];
                                          if (col) {
                                            return (
                                              <div className="my-8 p-6 bg-purple-500/10 border border-purple-500/20 rounded-3xl flex flex-col sm:flex-row gap-6 items-center">
                                                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-xl">
                                                  <img src={col.img} className="w-full h-full object-cover" alt={col.title} />
                                                </div>
                                                <div className="flex-grow text-center sm:text-left">
                                                  <h4 className="text-xl font-black italic uppercase tracking-tighter mb-2 text-white">{col.title}</h4>
                                                  <a href={col.link} className="inline-block px-8 py-3 bg-purple-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-lg shadow-purple-500/20">
                                                    {col.btn}
                                                  </a>
                                                </div>
                                              </div>
                                            );
                                          }
                                        }

                                        // Handle Theme Buttons
                                        if (content.match(/\[BUTTON\s*:\s*(.*?)\]/i)) {
                                          const marker = content.match(/\[BUTTON\s*:\s*(.*?)\]/i);
                                          if (marker) {
                                            const [text, link] = marker[1].split('|').map(s => s.trim());
                                            return (
                                              <div className="my-10 text-center">
                                                <a 
                                                  href={link}
                                                  className="inline-block px-8 py-3 bg-black border border-white/10 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.1)] hover:shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:scale-[1.03] transition-all text-[11px] italic no-underline hover:border-purple-500/50"
                                                >
                                                  {text}
                                                </a>
                                              </div>
                                            );
                                          }
                                        }
                                        
                                        // Handle Image Markers
                                        if (content.includes('[IMAGE:')) {
                                           const img = extractImages(content)[0];
                                           if (img) {
                                             return (
                                               <div className="my-8 space-y-3">
                                                 <img src={img.url} alt={img.alt} className="w-full rounded-2xl border border-white/10 shadow-2xl" />
                                                 <p className="text-[10px] text-center text-white/20 uppercase tracking-widest font-bold font-mono">/ {img.alt}</p>
                                               </div>
                                             );
                                           }
                                        }

                                        // Use div instead of p to avoid nesting violations (div inside p is illegal)
                                        return <div className="mb-6 text-white/80 leading-relaxed text-base">{children}</div>;
                                      },
                                      h2: ({ children }) => <h2 className="text-3xl font-black italic uppercase italic tracking-tighter mt-12 mb-6 text-purple-400">{children}</h2>,
                                      h3: ({ children }) => <h3 className="text-2xl font-black italic uppercase italic tracking-tighter mt-8 mb-4 text-white">{children}</h3>,
                                      img: ({ src, alt }) => {
                                        if (!src) return null;
                                        return (
                                          <div className="my-8">
                                            <img src={src} alt={alt || ''} className="w-full rounded-2xl border border-white/10 shadow-2xl" />
                                          </div>
                                        );
                                      }
                                    }}
                                  >
                                    {blogForm.content || ''}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                            {isDragging && !isPreview && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="px-6 py-3 bg-purple-500 text-white rounded-full font-black uppercase tracking-widest text-[10px] shadow-2xl animate-bounce">
                                  Drop to forge asset
                                </div>
                              </div>
                            )}
                          </div>
                      </div>

                      {/* Asset Hub Side Panel */}
                      <div className="space-y-4">
                        <div className="p-5 bg-white/5 border border-white/10 rounded-3xl space-y-4 max-h-[500px] overflow-y-auto no-scrollbar shadow-2xl">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <ImageIcon className="w-3 h-3 text-white/40" />
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Visual Assets</h4>
                              </div>
                              <span className="text-[10px] font-bold text-white/20">{imagesInContent.length}</span>
                           </div>
                           {imagesInContent.length === 0 && (
                             <div className="py-12 flex flex-col items-center justify-center text-center opacity-20">
                               <ImageIcon className="w-8 h-8 mb-2" />
                               <p className="text-[8px] font-bold uppercase tracking-widest">No visuals forged</p>
                             </div>
                           )}

                           <div className="space-y-3">
                              {imagesInContent.map((img, idx) => (
                               <div key={idx} className="p-3 bg-black/40 border border-white/5 rounded-2xl group space-y-3">
                                  <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer" onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = async (e: any) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          setIsForging(true);
                                          const url = await uploadImage(file);
                                          updateImageMarker(img.full, url, img.alt);
                                        } catch (err) {
                                          console.error(err);
                                          alert("Upload failed");
                                        } finally {
                                          setIsForging(false);
                                        }
                                      }
                                    };
                                    input.click();
                                  }}>
                                    {img.url ? (
                                      <img src={img.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    ) : (
                                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                        <Sparkles className="w-4 h-4 text-purple-500/40" />
                                      </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 flex items-center justify-center gap-2">
                                       <Upload className="w-2.5 h-2.5 text-white/70" />
                                       <span className="text-[7px] font-black uppercase text-white/50">Change Asset</span>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex gap-1">
                                      <input 
                                        className="flex-grow bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[9px] text-white outline-none focus:border-purple-500"
                                        value={img.alt}
                                        placeholder="Alt Info"
                                        onChange={(e) => updateImageMarker(img.full, img.url, e.target.value)}
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => moveMarker(img.full, 'up')}
                                        className="p-1.5 bg-white/5 text-white/40 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all font-black"
                                        title="Move Up"
                                      >
                                        <ChevronRight className="w-3 h-3 -rotate-90" />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => moveMarker(img.full, 'down')}
                                        className="p-1.5 bg-white/5 text-white/40 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all font-black"
                                        title="Move Down"
                                      >
                                        <ChevronRight className="w-3 h-3 rotate-90" />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => insertTextAtCursor(img.full)}
                                        className="p-1.5 bg-purple-500 text-white rounded-lg hover:scale-110 transition-all font-black"
                                        title="Insert Code"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => removeImageMarker(img.full)}
                                        className="p-1.5 bg-red-500 text-white rounded-lg hover:scale-110 transition-all font-black"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex gap-1">
                                      <input 
                                        className="flex-grow bg-black/20 border border-white/5 rounded-lg px-2 py-1 text-[8px] text-white/40 outline-none focus:border-purple-500"
                                        value={img.url.startsWith('data:') ? 'Base64 Managed' : img.url}
                                        placeholder="Image URL"
                                        onChange={(e) => {
                                          if (!e.target.value.startsWith('data:')) {
                                            updateImageMarker(img.full, e.target.value, img.alt);
                                          }
                                        }}
                                      />
                                      <button 
                                        type="button"
                                        onClick={async () => {
                                          const aiAlt = await generateAltText(img.alt);
                                          updateImageMarker(img.full, img.url, aiAlt);
                                        }}
                                        className="p-1.5 bg-white/5 text-purple-400 border border-white/10 rounded-lg hover:bg-purple-500/20"
                                        title="AI Gen Alt"
                                      >
                                        <Sparkles className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                           </div>

                           <div className="grid grid-cols-2 gap-2 pt-2">
                             <label className="cursor-pointer px-4 py-3 bg-white/5 border border-white/10 border-dashed rounded-xl text-center hover:bg-white/10 transition-all group">
                               <span className="text-[9px] font-black uppercase tracking-widest text-white/30 group-hover:text-white transition-colors">Forge File</span>
                               <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                 const file = e.target.files?.[0];
                                 if (file) processFile(file);
                               }} />
                             </label>
                             <button 
                               type="button"
                               onClick={() => {
                                 const url = prompt("Enter Image URL:");
                                 if (url) {
                                   const imgTag = `<img src="${url}" alt="External Asset" class="blog-image" />`;
                                   insertTextAtCursor(imgTag);
                                 }
                               }}
                               className="px-4 py-3 bg-white/5 border border-white/10 border-dashed rounded-xl text-center hover:bg-white/10 transition-all group"
                             >
                               <span className="text-[9px] font-black uppercase tracking-widest text-white/30 group-hover:text-white transition-colors">URL Asset</span>
                             </button>
                           </div>
                        </div>

                         {/* Collection Cards Management */}
                        <div className="p-5 bg-purple-500/5 border border-purple-500/10 rounded-3xl space-y-4 shadow-xl">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <LayoutGrid className="w-3 h-3 text-purple-400" />
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Collection Cards</h4>
                              </div>
                              <span className="text-[10px] font-bold text-white/20">{collectionsInContent.length}</span>
                          </div>
                          
                          <div className="space-y-3">
                              {collectionsInContent.map((col, idx) => (
                               <div key={idx} className="p-3 bg-black/60 border border-white/5 rounded-2xl group space-y-3">
                                  <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all cursor-pointer" onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = async (e: any) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          setIsForging(true);
                                          const url = await uploadImage(file);
                                          updateCollectionMarker(col.full, { image: url, title: col.title, btnText: col.btn, link: col.link });
                                        } catch (err) {
                                          console.error(err);
                                          alert("Upload failed");
                                        } finally {
                                          setIsForging(false);
                                        }
                                      }
                                    };
                                    input.click();
                                  }}>
                                    {col.img ? (
                                      <img src={col.img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                    ) : (
                                      <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                        <ImageIcon className="w-4 h-4 text-white/10" />
                                      </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 flex items-center justify-center gap-2">
                                       <Upload className="w-2.5 h-2.5 text-white/70" />
                                       <span className="text-[7px] font-black uppercase text-white/50">Change Visual</span>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex gap-1">
                                      <input 
                                        placeholder="Display Title"
                                        className="flex-grow bg-black/20 border border-white/5 rounded-lg px-2 py-2 text-[9px] text-white outline-none focus:border-purple-500"
                                        value={col.title}
                                        onChange={(e) => updateCollectionMarker(col.full, { title: e.target.value, btnText: col.btn, link: col.link, image: col.img })}
                                      />
                                      <button 
                                        type="button"
                                        onClick={() => moveMarker(col.full, 'up')}
                                        className="p-1.5 bg-white/5 text-white/40 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all font-black"
                                      >
                                        <ChevronRight className="w-3 h-3 -rotate-90" />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => moveMarker(col.full, 'down')}
                                        className="p-1.5 bg-white/5 text-white/40 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-all font-black"
                                      >
                                        <ChevronRight className="w-3 h-3 rotate-90" />
                                      </button>
                                      <button 
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => insertTextAtCursor(col.full)}
                                        className="p-1.5 bg-purple-500 text-white rounded-lg hover:scale-110 transition-all font-black"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => removeCollectionMarker(col.full)}
                                        className="p-1.5 bg-red-500 text-white rounded-lg hover:scale-110 transition-all font-black"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex gap-2">
                                      <input 
                                        placeholder="Button Text"
                                        className="flex-grow bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[9px] text-white/60 outline-none focus:border-purple-500"
                                        value={col.btn}
                                        onChange={(e) => updateCollectionMarker(col.full, { btnText: e.target.value, title: col.title, link: col.link, image: col.img })}
                                      />
                                      <input 
                                        placeholder="Protocol Link"
                                        className="flex-grow bg-black/20 border border-white/5 rounded-lg px-3 py-2 text-[9px] text-white/40 outline-none focus:border-purple-500"
                                        value={col.link}
                                        onChange={(e) => updateCollectionMarker(col.full, { link: e.target.value, title: col.title, btnText: col.btn, image: col.img })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>

                          <button 
                            type="button"
                            onClick={() => {
                              setMarkerForgeData({ text: '', link: '', alt: '', image: '', btnText: '' });
                              setShowMarkerForge('collection');
                              // Scroll back up to editor if needed
                              editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className="w-full py-3 bg-white/5 border border-purple-500/20 text-purple-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-purple-500/10 hover:border-purple-500/50 transition-all shadow-lg"
                          >
                            Add New Terminal Card
                          </button>
                        </div>

                        {/* Magic Buttons Management */}
                        <div className="p-5 bg-orange-500/5 border border-orange-500/10 rounded-3xl space-y-4 shadow-xl">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                 <ExternalLink className="w-3 h-3 text-orange-400" />
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Call-to-Action Buttons</h4>
                              </div>
                              <span className="text-[10px] font-bold text-white/20">{buttonsInContent.length}</span>
                          </div>
                          
                          <div className="space-y-2">
                              {buttonsInContent.map((btn, idx) => (
                                <div key={idx} className="p-3 bg-black/60 border border-white/5 rounded-2xl space-y-2 group">
                                  <div className="flex gap-1">
                                    <input 
                                      className="flex-grow bg-black/20 border border-white/5 rounded-lg px-2 py-2 text-[9px] text-white outline-none focus:border-orange-500"
                                      value={btn.text}
                                      onChange={(e) => updateButtonMarker(btn.full, e.target.value, btn.link)}
                                    />
                                    <button onClick={() => removeButtonMarker(btn.full)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                  <input 
                                    className="w-full bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 text-[8px] text-white/40 outline-none focus:border-orange-500"
                                    value={btn.link}
                                    onChange={(e) => updateButtonMarker(btn.full, btn.text, e.target.value)}
                                  />
                                </div>
                              ))}
                          </div>

                          <button 
                            type="button"
                            onClick={() => {
                              setMarkerForgeData({ text: '', link: '', alt: '', image: '', btnText: '' });
                              setShowMarkerForge('button');
                              // Scroll back up to editor if needed
                              editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              setTimeout(() => editorRef.current?.focus(), 500);
                            }}
                            className="w-full py-3 bg-white/5 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-500/10 hover:border-orange-500/50 transition-all shadow-lg"
                          >
                            Add New Action Button
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-white/5">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                    >
                      {loading ? 'SAVING...' : 'SAVE ARTICLE'}
                    </button>
                  </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generator Modal */}
      <AnimatePresence>
        {showGenerator && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/90 backdrop-blur-md"
               onClick={() => !genLoading && setShowGenerator(false)}
             />
             <motion.div 
               className="relative w-full max-w-xl bg-dark-bg border border-white/10 p-8 rounded-3xl text-center"
             >
                <Wand2 className="w-12 h-12 text-purple-500 mx-auto mb-6 animate-pulse" />
                <h2 className="text-3xl font-black italic uppercase italic tracking-tighter mb-2">AI Post <span className="text-gradient">Generator</span></h2>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-8">AI-driven niche research & content forge</p>

                {genLoading ? (
                  <div className="py-12 space-y-4">
                    <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">
                      {genStep === 'topics' ? 'RESEARCHING TRENDING TOPICS...' : 
                       genStep === 'saving' ? 'WRITING TO DATABASE...' : 
                       `FORGING CONTENT & SEO DATA (${genTimer}s)...`}
                    </p>
                    {genTimer > 30 && genStep === 'content' && (
                      <p className="text-[8px] text-white/30 uppercase tracking-widest font-bold">This is taking longer than usual. Please stay on this page.</p>
                    )}
                  </div>
                ) : genError ? (
                  <div className="py-8 space-y-6">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                      <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest leading-relaxed">
                        {genError}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={genStep === 'topics' ? handleGenerateTopics : () => selectedTopic && handleGenerateComplete(selectedTopic)}
                        className="w-full py-4 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all"
                      >
                        Try Again
                      </button>
                      <button 
                        onClick={() => { setShowGenerator(false); setGenError(null); setGenStep('idle'); setSelectedTopic(null); }}
                        className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : suggestedTopics.length === 0 ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 text-left">Custom Topic (Manual):</p>
                       <div className="flex gap-2">
                         <input 
                           type="text" 
                           placeholder="Enter your specific topic..."
                           className="flex-grow bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-purple-500/50 outline-none"
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               const val = (e.target as HTMLInputElement).value;
                               if (val.trim()) handleGenerateComplete(val.trim());
                             }
                           }}
                         />
                         <button 
                           onClick={(e) => {
                             const input = (e.currentTarget.previousSibling as HTMLInputElement);
                             if (input.value.trim()) handleGenerateComplete(input.value.trim());
                           }}
                           className="px-6 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all"
                         >
                           Forge
                         </button>
                       </div>
                    </div>

                    <div className="relative">
                       <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                       <div className="relative flex justify-center"><span className="bg-dark-bg px-4 text-[8px] font-black uppercase text-white/20 tracking-[0.4em]">OR RESEARCH</span></div>
                    </div>

                    <button 
                      onClick={handleGenerateTopics}
                      className="w-full py-4 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-purple-600/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Research Latest Trends
                    </button>
                    <button 
                      onClick={() => setShowGenerator(false)}
                      className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 text-left">AI Recommended Topics:</p>
                       <button 
                        onClick={() => setSuggestedTopics([])}
                        className="text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white flex items-center gap-1"
                       >
                         <X className="w-3 h-3" /> Back
                       </button>
                    </div>
                    {suggestedTopics.map((topic, i) => (
                      <button 
                        key={i}
                        onClick={() => handleGenerateComplete(topic)}
                        className="w-full p-4 bg-white/5 border border-white/5 rounded-xl text-left hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-black italic uppercase tracking-tighter text-white/80 group-hover:text-white">{topic}</span>
                          <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-purple-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               onClick={() => setShowSettings(false)}
             />
             <motion.div 
               className="relative w-full max-w-md bg-dark-bg border border-white/10 p-8 rounded-3xl"
             >
                <div className="flex justify-between items-center mb-8">
                   <h2 className="text-2xl font-black uppercase italic tracking-tighter">AI Settings</h2>
                   <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest">Auto-Posting</p>
                      <p className="text-[8px] text-white/40 uppercase">Enable AI to post automatically</p>
                    </div>
                    <button 
                      onClick={() => setSettingsForm({ ...settingsForm, isAutoEnabled: !settingsForm.isAutoEnabled })}
                      className={`w-12 h-6 rounded-full transition-all relative ${settingsForm.isAutoEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settingsForm.isAutoEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Posting Frequency (Days)</label>
                    <input 
                      type="number"
                      className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm focus:border-purple-500/50 outline-none"
                      placeholder="e.g. 3"
                      value={settingsForm.intervalDays === undefined ? '' : settingsForm.intervalDays}
                      onChange={e => setSettingsForm({ ...settingsForm, intervalDays: e.target.value === '' ? undefined : Number(e.target.value) })}
                    />
                  </div>

                   <button 
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="w-full py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {loading ? 'SAVING...' : 'SAVE CONFIG'}
                  </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
