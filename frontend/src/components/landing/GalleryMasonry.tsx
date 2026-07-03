'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

const galleryImages = [
  { id: 1, category: 'Events', src: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800', span: 'col-span-1 md:col-span-2 row-span-2' },
  { id: 2, category: 'Labs', src: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=600', span: 'col-span-1 row-span-1' },
  { id: 3, category: 'Hackathons', src: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=600', span: 'col-span-1 row-span-1' },
  { id: 4, category: 'Workshops', src: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=600', span: 'col-span-1 md:col-span-2 row-span-1' },
  { id: 5, category: 'Innovation Fair', src: 'https://images.unsplash.com/photo-1475721025870-2460665d9118?auto=format&fit=crop&q=80&w=600', span: 'col-span-1 row-span-1' },
];

const categories = ['All', 'Events', 'Hackathons', 'Labs', 'Workshops', 'Innovation Fair'];

export function GalleryMasonry() {
  const [filter, setFilter] = useState('All');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const filteredImages = galleryImages.filter(img => filter === 'All' || img.category === filter);

  return (
    <section id="gallery" className="py-24 bg-gray-50 dark:bg-bg-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Life at <span className="text-gradient">Spark</span>
          </motion.h2>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                filter === cat
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/25'
                  : 'bg-white dark:bg-bg-900 text-gray-600 dark:text-gray-300 hover:text-brand-primary border border-gray-200 dark:border-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <motion.div layout className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[250px]">
          <AnimatePresence>
            {filteredImages.map((image) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3 }}
                key={image.id}
                className={`relative rounded-3xl overflow-hidden group cursor-pointer ${filter === 'All' ? image.span : 'col-span-1 row-span-1'}`}
                onClick={() => setSelectedImage(image.src)}
              >
                <img
                  src={image.src}
                  alt={image.category}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <ZoomIn className="w-8 h-8 text-white mx-auto mb-2" />
                    <span className="text-white font-medium px-4 py-1 rounded-full border border-white/30 bg-white/10">
                      {image.category}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-12"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-[110]"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={selectedImage}
              alt="Expanded view"
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
