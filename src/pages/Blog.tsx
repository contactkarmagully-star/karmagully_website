import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Clock, Calendar, ChevronRight, Search } from 'lucide-react';
import { getAllBlogs } from '../services/blogService';
import { BlogPost } from '../types';

export default function Blog() {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function load() {
      const data = await getAllBlogs();
      setBlogs(data);
      setLoading(false);
    }
    load();
  }, []);

  const filteredBlogs = blogs.filter(b => 
    (b.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    b.tags?.some(t => t?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-dark-bg py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-16 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-500 mb-2">Editorial</p>
          <h1 className="text-4xl md:text-7xl font-black italic tracking-tighter uppercase mb-6">The <span className="text-gradient">Blog</span></h1>
          <p className="text-white/40 max-w-xl mx-auto text-sm uppercase tracking-widest font-bold leading-relaxed">
            Exploring the intersection of anime culture and sustainable metal art.
          </p>
        </header>

        <div className="mb-12 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text" 
              placeholder="SEARCH THE PRESS..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-full pl-12 pr-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] focus:border-purple-500/50 outline-none transition-all"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-[4/5] bg-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 sm:gap-16">
            {filteredBlogs.map((blog, idx) => (
              <motion.article 
                key={blog.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group flex flex-col gap-6"
              >
                <Link to={`/blog/${blog.slug}`} className="relative aspect-[4/5] overflow-hidden rounded-[2.5rem] bg-white/5 border border-white/5 group-hover:border-purple-500/30 transition-all">
                  {blog.coverImage ? (
                    <img 
                      src={blog.coverImage || undefined} 
                      alt={blog.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-8 text-center text-white/5 uppercase font-black tracking-tighter text-4xl italic">
                      {blog.title}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-purple-500/60">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {blog.createdAt?.toDate ? blog.createdAt.toDate().toLocaleDateString() : 'Dec 2023'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> 5 MIN READ</span>
                  </div>
                  
                  <Link to={`/blog/${blog.slug}`} className="block group-hover:translate-x-2 transition-transform">
                    <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter leading-none group-hover:text-purple-500 transition-colors">
                      {blog.title}
                    </h2>
                  </Link>

                  <p className="text-white/40 text-sm line-clamp-3 leading-relaxed uppercase tracking-wide font-medium">
                    {blog.excerpt || blog.content.substring(0, 150).replace(/[#*]/g, '') + '...'}
                  </p>

                  <Link 
                    to={`/blog/${blog.slug}`}
                    className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white group-hover:text-purple-500 transition-colors"
                  >
                    CONTINUE READING <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        )}

        {!loading && filteredBlogs.length === 0 && (
          <div className="text-center py-40 border-2 border-dashed border-white/5 rounded-[3rem]">
            <p className="text-xs font-black uppercase tracking-widest text-white/20">No articles found in the archives</p>
            <button onClick={() => setSearchTerm('')} className="mt-4 text-purple-500 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors">View All Posts</button>
          </div>
        )}
      </div>
    </div>
  );
}
