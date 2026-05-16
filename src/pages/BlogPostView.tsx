import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Calendar, Clock, ChevronLeft, Tag as TagIcon, Share2, Facebook, Twitter, MessageSquare, ImageIcon, Instagram } from 'lucide-react';
import { getBlogBySlug } from '../services/blogService';
import { subscribeToSettings } from '../services/settingsService';
import { addSubscriber } from '../services/subscriptionService';
import { BlogPost, AppSettings } from '../types';
import TerminalSubscriber from '../components/TerminalSubscriber';

export default function BlogPostView() {
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeToSettings(setSettings);
  }, []);

  useEffect(() => {
    async function load() {
      if (!slug) return;
      const data = await getBlogBySlug(slug);
      if (data) {
        setBlog(data);
        
        // SEO: Update Meta
        document.title = `${data.title} | KarmaGully Blog`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', data.metaDescription || '');
        
        // SEO: FAQ Schema
        if (data.schemaMarkup) {
          const script = document.createElement('script');
          script.type = 'application/ld+json';
          script.text = JSON.stringify(data.schemaMarkup);
          script.id = 'faq-schema';
          document.head.appendChild(script);
        }
      }
      setLoading(false);
    }
    load();

    return () => {
      document.getElementById('faq-schema')?.remove();
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-black uppercase tracking-widest text-white/40 mb-4">Transmission Lost</p>
          <Link to="/blog" className="px-6 py-3 bg-white text-black rounded-xl font-black uppercase text-[10px] tracking-widest">Back to Blog Feed</Link>
        </div>
      </div>
    );
  }

  // Pre-process content to handle legacy markers and ensure spacing
  const processedContent = (blog.content || '')
    // Ensure every list item (⚡ or -) has proper spacing
    .replace(/^([⚡\-])/gm, '\n\n$1')
    .replace(/\[IMAGE: ([\s\S]*?)\]/g, 
      (match, meta) => {
        if (meta.includes('|')) {
          const [url, alt] = meta.split('|').map((s: string) => s.trim());
          return `\n<img src="${url}" alt="${alt}" class="blog-image" />\n`;
        }
        return `\n<img src="${meta.trim()}" alt="Blog Image" class="blog-image" />\n`;
      }
    )
    .replace(
      /\[VIDEO: ([^\]]+)\]/g,
      (match, url) => {
        const videoUrl = url.trim();
        return `\n\n<div class="my-16 aspect-video w-full max-w-4xl mx-auto overflow-hidden rounded-[2.5rem] border border-white/10 bg-black shadow-2xl">
  <iframe 
    src="${videoUrl}" 
    class="w-full h-full" 
    frameborder="0" 
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
    allowfullscreen
  ></iframe>
</div>\n\n`;
      }
    )
    .replace(
      /\[COLLECTION_LINK: ([\s\S]*?)\]/g,
      (match, meta) => {
        const parts = meta.split('|').map((s: string) => s.trim());
        const title = parts[0] || "Explore Collection";
        const btnText = parts[1] || "Explore Terminal";
        const link = parts[2] || "/shop";
        const bgImg = parts[3] || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2000&auto=format&fit=crop";

        return `\n\n<div class="my-16 relative group overflow-hidden rounded-[40px] border border-white/10 shadow-2xl">
  <div class="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110 opacity-40" style="background-image: url('${bgImg}')"></div>
  <div class="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
  <div class="relative z-10 flex flex-col items-center text-center py-20 px-6">
    <p class="text-[10px] font-black uppercase tracking-[0.4em] text-purple-500 mb-4 bg-purple-500/10 px-4 py-1 rounded-full border border-purple-500/20">Protocol: Active</p>
    <h3 class="text-4xl md:text-6xl font-black italic uppercase tracking-tighter mb-8 text-white drop-shadow-2xl">${title}</h3>
    <a href="${link}" class="group/btn flex items-center gap-4 px-12 py-5 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)]">
      ${btnText}
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="group-hover/btn:translate-x-1 transition-transform"><path d="m9 18 6-6-6-6"/></svg>
    </a>
  </div>
</div>\n\n`;
      }
    )
    .replace(
      /\[BUTTON\s*:\s*(.*?)\]/gi,
      (match, meta) => {
        const [text, link] = meta.split('|').map((s: string) => s.trim());
        return `\n\n<div class="my-12 text-center">
  <a 
    href="${link || '#'}" 
    target="_blank" 
    rel="noopener noreferrer" 
    class="inline-block px-8 py-3 bg-black border border-white/10 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.1)] hover:shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:scale-[1.03] transition-all text-[11px] italic no-underline hover:border-purple-500/50 hover:text-white"
  >
    ${text}
  </a>
</div>\n\n`;
      }
    );


  return (
    <div className="min-h-screen bg-dark-bg text-white pb-20">
      {/* Hero Header */}
      <div className="relative h-[60vh] md:h-[80vh] w-full overflow-hidden">
        {blog.coverImage ? (
          <img 
            src={blog.coverImage || undefined} 
            alt={blog.coverImageAlt || blog.title} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/20 to-transparent" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-purple-500">
               <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {blog.createdAt?.toDate ? blog.createdAt.toDate().toLocaleDateString() : 'Dec 2023'}</span>
               <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
               <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 5 MIN READ</span>
            </div>
            <h1 className="text-4xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">
              {blog.title}
            </h1>
            {blog.tags && blog.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {blog.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-white/40">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        <Link 
          to="/blog"
          className="absolute top-8 left-8 p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-white hover:text-black transition-all group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        <div className="glass-morphism rounded-[3rem] border border-white/5 p-8 md:p-16 space-y-12 shadow-2xl">
          
          <div className="markdown-body">
             <Markdown
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
                   
                   // Handle Theme Buttons
                   if (content.match(/\[BUTTON\s*:\s*(.*?)\]/i)) {
                     const marker = content.match(/\[BUTTON\s*:\s*(.*?)\]/i);
                     if (marker) {
                       const [text, link] = marker[1].split('|').map(s => s.trim());
                       return (
                         <div className="my-10 text-center">
                           <a 
                             href={link || '#'}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="inline-block px-8 py-3 bg-black border border-white/10 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.1)] hover:shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:scale-[1.03] transition-all text-[11px] italic no-underline hover:border-purple-500/50"
                           >
                             {text}
                           </a>
                         </div>
                       );
                     }
                   }
                   
                   // Handle Image Markers
                   if (content.match(/\[IMAGE: (.*?)\]/)) {
                      const marker = content.match(/\[IMAGE: (.*?)\]/);
                      if (marker) {
                        const [url, alt] = marker[1].split('|').map(s => s.trim());
                        return (
                          <div className="my-12 space-y-3">
                            <img src={url} alt={alt} className="w-full rounded-2xl border border-white/10 shadow-2xl" />
                            {alt && <p className="text-[10px] text-center text-white/20 uppercase tracking-widest font-bold font-mono">/ {alt}</p>}
                          </div>
                        );
                      }
                   }

                   // Handle Collection Links (Terminal Cards)
                   if (content.match(/\[COLLECTION_LINK: (.*?)\]/)) {
                     const marker = content.match(/\[COLLECTION_LINK: (.*?)\]/);
                     if (marker) {
                       const parts = marker[1].split('|').map(s => s.trim());
                       if (parts.length >= 4) {
                         return (
                           <div className="my-12 p-6 bg-purple-500/10 border border-purple-500/20 rounded-3xl flex flex-col sm:flex-row gap-6 items-center">
                             <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-xl">
                               <img src={parts[3]} className="w-full h-full object-cover" alt={parts[0]} />
                             </div>
                             <div className="flex-grow text-center sm:text-left">
                               <h4 className="text-xl font-black italic uppercase tracking-tighter mb-2 text-white">{parts[0]}</h4>
                               <a href={parts[2]} className="inline-block px-8 py-3 bg-purple-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:scale-105 transition-all shadow-lg shadow-purple-500/20">
                                 {parts[1]}
                               </a>
                             </div>
                           </div>
                         );
                       }
                     }
                   }

                   return <div className="mb-6 text-white/80 leading-relaxed text-base">{children}</div>;
                 },
                 img: ({ ...props }) => (
                   <img 
                     {...props} 
                     loading="lazy"
                     className="blog-image" 
                     referrerPolicy="no-referrer"
                   />
                 ),
                 li: ({ children }) => (
                   <li className="flex items-start gap-4 my-6 text-white/70 leading-relaxed group">
                      <div className="flex-grow pt-1 text-sm md:text-base selection:bg-purple-500/30">
                        {children}
                      </div>
                   </li>
                 ),
                 a: ({ ...props }) => {
                   const isInternal = props.href?.startsWith('/');
                   if (isInternal) {
                     return (
                       <Link 
                         to={props.href || '/'} 
                         className="text-purple-400 hover:text-purple-300 underline underline-offset-8 decoration-purple-500/30 transition-all font-bold"
                       >
                         {props.children}
                       </Link>
                     );
                   }
                   return (
                     <a 
                       href={props.href} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="text-white hover:text-purple-400 transition-colors border-b border-white/20"
                     >
                       {props.children}
                     </a>
                   );
                 }
               }}
             >
               {processedContent}
             </Markdown>
          </div>

          {/* Social Share */}
          <div className="pt-12 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6">
             <div className="flex items-center gap-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Distribute Intel</span>
                <div className="flex gap-4">
                   {settings?.socialLinks?.twitter && (
                     <a href={settings.socialLinks.twitter} target="_blank" rel="noreferrer" className="p-3 bg-white/5 rounded-2xl hover:bg-purple-500 hover:text-white transition-all border border-white/5 group shadow-xl">
                       <Twitter className="w-4 h-4 group-hover:scale-110 transition-transform" />
                     </a>
                   )}
                   {settings?.socialLinks?.facebook && (
                     <a href={settings.socialLinks.facebook} target="_blank" rel="noreferrer" className="p-3 bg-white/5 rounded-2xl hover:bg-purple-500 hover:text-white transition-all border border-white/5 group shadow-xl">
                       <Facebook className="w-4 h-4 group-hover:scale-110 transition-transform" />
                     </a>
                   )}
                   {settings?.socialLinks?.instagram && (
                     <a href={settings.socialLinks.instagram} target="_blank" rel="noreferrer" className="p-3 bg-white/5 rounded-2xl hover:bg-purple-500 hover:text-white transition-all border border-white/5 group shadow-xl">
                       <Instagram className="w-4 h-4 group-hover:scale-110 transition-transform" />
                     </a>
                   )}
                   <button 
                     onClick={() => {
                       navigator.clipboard.writeText(window.location.href);
                       alert('Link copied to terminal.');
                     }}
                     className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 hover:text-purple-400 transition-all border border-white/5 group shadow-xl"
                   >
                     <Share2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                   </button>
                </div>
             </div>
             {/* Community Debate feature temporarily disabled - can be restored here */}
          </div>
        </div>

        {/* FAQ Section */}
        {blog.faq && blog.faq.length > 0 && (
          <div className="mt-20 space-y-8">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-center">Protocol <span className="text-gradient">F.A.Q.</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {blog.faq.map((item, idx) => (
                <div key={idx} className="p-8 bg-white/5 border border-white/5 rounded-[2.5rem] space-y-3">
                   <p className="text-xs font-black uppercase tracking-widest text-purple-500">Q: {item.question}</p>
                   <p className="text-white/60 text-sm leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Read Suggestion / Terminal Connection */}
        <div className="mt-32">
          <TerminalSubscriber />
        </div>
      </div>
    </div>
  );
}
