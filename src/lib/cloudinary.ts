export const uploadToCloudinary = async (file: File | Blob, resourceType: 'image' | 'video' = 'image') => {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error('Cloudinary configuration missing in environment variables');
    throw new Error('Cloudinary configuration missing');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Upload failed');
  }

  const data = await response.json();
  return data.secure_url;
};

export const getOptimizedImageUrl = (url: string, width = 800) => {
  if (!url || !url.includes('cloudinary.com')) return url;
  
  // Cloudinary optimization transformations
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  
  return `${parts[0]}/upload/f_auto,q_auto,w_${width}/${parts[1]}`;
};
