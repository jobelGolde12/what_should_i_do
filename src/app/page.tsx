import { Inter } from 'next/font/google';
import Header from '../components/header/page';
import HeroSection from '../components/hero-section/page';
import Footer from '../components/Footer';

const inter = Inter({ subsets: ['latin'] });

export default function Home() {
  return (
    <div className={`min-h-screen gradient-bg ${inter.className}`}>
      {/* Header/Navigation */}
      <Header />

      {/* Hero Section */}
      <HeroSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}