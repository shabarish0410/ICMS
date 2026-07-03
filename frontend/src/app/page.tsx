import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { AboutTimeline } from '@/components/landing/AboutTimeline';
import { ProgramsGrid } from '@/components/landing/ProgramsGrid';
import { Facilities } from '@/components/landing/Facilities';
import { SuccessStories } from '@/components/landing/SuccessStories';
import { EventsTimeline } from '@/components/landing/EventsTimeline';
import { MentorsGrid } from '@/components/landing/MentorsGrid';
import { GalleryMasonry } from '@/components/landing/GalleryMasonry';
import { CallToAction } from '@/components/landing/CallToAction';
import { Footer } from '@/components/landing/Footer';

export const metadata = {
  title: 'Spark Innovation Center | Build the Future',
  description: 'A next-generation innovation ecosystem helping students, startups, researchers, and entrepreneurs transform ideas into successful products and companies.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-bg-900 selection:bg-brand-primary/30 selection:text-brand-primary">
      <Navbar />
      <main>
        <HeroSection />
        <AboutTimeline />
        <ProgramsGrid />
        <Facilities />
        <SuccessStories />
        <EventsTimeline />
        <MentorsGrid />
        <GalleryMasonry />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}
