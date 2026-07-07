/* =============================================================================
 *  cloudinary.js  —  Unsigned image uploads. Returns a secure image URL that we
 *  store in Supabase. Cloudinary is used ONLY for images, never as a database.
 *  Requires config.js.
 * ========================================================================== */

const Cloudinary = {
  /**
   * Upload a File/Blob to Cloudinary using an unsigned preset.
   * @param {File} file
   * @param {(pct:number)=>void} [onProgress]  optional 0..100 progress callback
   * @returns {Promise<string>} the secure_url of the uploaded image
   */
  upload(file, onProgress) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file selected.'));
      if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('Image must be under 8 MB.'));

      const url = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`;
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
      if (CONFIG.CLOUDINARY_FOLDER) form.append('folder', CONFIG.CLOUDINARY_FOLDER);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) resolve(res.secure_url);
          else reject(new Error(res.error?.message || 'Upload failed.'));
        } catch (_) {
          reject(new Error('Unexpected response from Cloudinary.'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(form);
    });
  },

  /** Ask Cloudinary for a smaller, optimized version of a stored image. */
  thumb(imageUrl, w = 400) {
    if (!imageUrl || !imageUrl.includes('/upload/')) return imageUrl;
    return imageUrl.replace('/upload/', `/upload/f_auto,q_auto,c_fill,w_${w},h_${w}/`);
  },
};
