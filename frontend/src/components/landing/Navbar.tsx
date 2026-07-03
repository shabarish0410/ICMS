'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Moon, Sun, Globe, Zap } from 'lucide-react';

const navLinks = [
  { name: 'Home', href: '#' },
  { name: 'About', href: '#about' },
  { name: 'Programs', href: '#programs' },
  { name: 'Facilities', href: '#facilities' },
  { name: 'Events', href: '#events' },
  { name: 'Mentors', href: '#mentors' },
  { name: 'Gallery', href: '#gallery' },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'py-3 bg-white/70 dark:bg-bg-900/70 backdrop-blur-lg border-b border-black/5 dark:border-white/10 shadow-sm'
          : 'py-5 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-blue flex items-center justify-center text-white shadow-lg shadow-brand-primary/20 group-hover:shadow-brand-primary/40 transition-all">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
              Spark
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-brand-primary dark:text-gray-300 dark:hover:text-white rounded-full hover:bg-gray-100/50 dark:hover:bg-white/5 transition-all"
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="hidden lg:flex items-center gap-3">
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-bg-800 transition-colors"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}
            <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-bg-800 transition-colors">
              <Globe className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-brand-primary dark:hover:text-brand-blue transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-brand-primary to-brand-purple hover:from-brand-primary/90 hover:to-brand-purple/90 rounded-full shadow-lg shadow-brand-primary/25 hover:shadow-brand-primary/40 hover:-translate-y-0.5 transition-all"
            >
              Apply Now
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden p-2 text-gray-600 dark:text-gray-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-gray-100 dark:border-white/10 bg-white/95 dark:bg-bg-900/95 backdrop-blur-xl"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="block px-4 py-2 text-base font-medium text-gray-600 dark:text-gray-300 hover:text-brand-primary dark:hover:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex flex-col gap-3">
                <Link
                  href="/login"
                  className="w-full px-4 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-bg-800 rounded-xl"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="w-full px-4 py-2 text-center text-sm font-semibold text-white bg-gradient-to-r from-brand-primary to-brand-purple rounded-xl"
                >
                  Apply Now
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
