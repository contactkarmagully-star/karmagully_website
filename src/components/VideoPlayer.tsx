import { useEffect, useRef } from 'react';
import { Play } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  autoPlay?: boolean;
}

export default function VideoPlayer({ url, autoPlay = true }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!url) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && autoPlay) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.5 }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    return () => observer.disconnect();
  }, [autoPlay, url]);

  if (!url) return null;

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return (
      <div className="w-full h-full">
        <iframe 
          className="w-full h-full border-none"
          src={url.includes('embed') ? url : url.replace('watch?v=', 'embed/')} 
          title="Product Video"
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
      </div>
    );
  }

  return (
    <video 
      ref={videoRef}
      src={url} 
      className="w-full h-full object-cover" 
      muted 
      playsInline 
      loop 
      controls
    />
  );
}
