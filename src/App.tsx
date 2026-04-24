/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, ReactNode, ErrorInfo } from "react";
import { 
  ShoppingBag, 
  Menu, 
  X, 
  Instagram, 
  Facebook, 
  Search, 
  ArrowRight,
  Heart,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Star,
  Edit,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { translations, Language } from "./translations";
import { collection, getDocs, getDoc, doc, setDoc, addDoc, deleteDoc, updateDoc, query, where, orderBy, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from "firebase/auth";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-4xl font-display mb-4 text-charcoal">Une erreur est survenue</h1>
          <p className="text-charcoal/60 mb-8 max-w-md">
            Nous sommes désolés, une erreur inattendue s'est produite. Veuillez réessayer.
          </p>
          <pre className="text-xs bg-sand p-4 rounded-sm text-left overflow-auto max-w-2xl w-full mb-8 text-charcoal/80">
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="bg-charcoal text-cream px-8 py-3 text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors"
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return (this.props as ErrorBoundaryProps).children;
  }
}

const LanguageContext = React.createContext<{ currentLang: Language; toggleLang: () => void }>({
  currentLang: 'fr',
  toggleLang: () => {},
});
const useLanguage = () => React.useContext(LanguageContext);

// --- Types ---
export interface ProductVariant {
  color: string;
  img: string;
  price: number;
  quantity: number;
}

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  badge: string | null;
  soldOut: boolean;
  img1: string;
  img2: string;
  images?: string[];
  tags?: string[];
  alt: string;
  colors: string[];
  description: string;
  shortDesc: string;
  variants?: ProductVariant[];
  quantity?: number;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  date: string;
  published: boolean;
}

interface Coupon {
  id?: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  usageCount: number;
  createdAt: string;
}

interface Review {
  id?: string;
  productId: number;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

// --- Mock Data ---
const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "La Donna",
    price: 349,
    category: "Lunettes",
    badge: null,
    soldOut: false,
    img1: "https://mywillows.com/cdn/shop/products/IMG_4113.jpg?v=1635193358&width=800",
    img2: "https://mywillows.com/cdn/shop/products/Donna.jpg?v=1635813674&width=800",
    alt: "Lunettes à chaîne Donna - Lunaria",
    colors: ["#C9A96E","#1C1A17","#8B7355"],
    description: "Notre modèle signature, né d'un amour pour l'artisanat authentique. La Donna marie une chaîne dorée plaquée 18K à des cristaux de quartz naturel taillés à la main. Portée par des femmes dans 90 pays, elle est le symbole d'une élégance qui ne s'excuse pas. Chaque paire est unique — exactement comme vous.",
    shortDesc: "Notre bestseller intemporel. Chaîne dorée 18K + cristaux naturels."
  },
  {
    id: 2,
    name: "La Silver Minx",
    price: 389,
    category: "Lunettes",
    badge: null,
    soldOut: false,
    img1: "https://mywillows.com/cdn/shop/products/SilverMinx-01-Hero.jpg?v=1605316285&width=800",
    img2: "https://mywillows.com/cdn/shop/products/SilverMinx-02.jpg?v=1605316285&width=800",
    alt: "Lunettes Silver Minx - Lunaria",
    colors: ["#C0C0C0","#1C1A17","#C9A96E"],
    description: "La Silver Minx est pour la femme qui entre dans une pièce et change son énergie. Chaîne argentée rhodiée, cristaux de quartz fumé, monture cat-eye vintage. Elle ne passe pas inaperçue — et c'est exactement l'idée. Assemblée à la main, une pièce à la fois.",
    shortDesc: "Cat-eye audacieux. Chaîne argentée rhodiée + quartz fumé."
  },
  {
    id: 3,
    name: "La Crystal Rose",
    price: 369,
    category: "Lunettes",
    badge: "Nouveau",
    soldOut: false,
    img1: "https://mywillows.com/cdn/shop/files/Figgy_Pudding.jpg?v=1772752982&width=800",
    img2: "https://mywillows.com/cdn/shop/files/willows_figgy-pudding_illustration.png?v=1772752982&width=800",
    alt: "Lunettes Crystal Rose - Lunaria",
    colors: ["#E8C4B8","#C9A96E","#1C1A17"],
    description: "Nouvelle arrivée dans la collection. La Crystal Rose capture la douceur du quartz rose et la chaleur du soleil tunisien. Ses teintes pêche et nude s'accordent avec toutes les carnations. Portez-la au bord de la mer à Hammamet ou en terrasse à La Marsa — elle trouve sa place partout.",
    shortDesc: "Nouvelle collection. Quartz rose + teintes nude pour toutes."
  },
  {
    id: 4,
    name: "La Chaîne Dorée",
    price: 399,
    category: "Lunettes",
    badge: null,
    soldOut: false,
    img1: "https://mywillows.com/cdn/shop/products/IMG_4113.jpg?v=1635193358&width=800",
    img2: "https://mywillows.com/cdn/shop/products/Donna.jpg?v=1635813674&width=800",
    alt: "Lunettes Chaîne Dorée - Lunaria",
    colors: ["#C9A96E","#8B7355","#F2E4D4"],
    description: "La Chaîne Dorée est le summum du luxe accessible. Sa chaîne épaisse plaquée or 18K fait tourner les têtes, ses cristaux de citrine captent chaque rayon de lumière. C'est la pièce que vos amies vous demanderont d'où elle vient. La réponse : assemblée à la main, disponible uniquement chez Lunaria.",
    shortDesc: "La plus statement de notre collection. Chaîne épaisse or 18K."
  },
  {
    id: 5,
    name: "La Classique Noire",
    price: 329,
    category: "Lunettes",
    badge: null,
    soldOut: false,
    img1: "https://mywillows.com/cdn/shop/products/SilverMinx-01-Hero.jpg?v=1605316285&width=800",
    img2: "https://mywillows.com/cdn/shop/products/IMG_4113.jpg?v=1635193358&width=800",
    alt: "Lunettes Classique Noire - Lunaria",
    colors: ["#1C1A17","#2D2A27","#4A4540"],
    description: "Certaines choses ne se démodent jamais. La Classique Noire est notre entrée dans la collection — élégante, intemporelle, accessible. Monture noire mat, chaîne oxydée, cristaux de quartz fumé. Elle va avec tout. Elle élève tout. C'est la paire que vous porterez pendant des années.",
    shortDesc: "L'intemporelle. Monture noire mat + quartz fumé. Notre prix d'entrée."
  },
  {
    id: 6,
    name: "L'Optique Lunaire",
    price: 419,
    category: "Optique",
    badge: "Optique",
    soldOut: false,
    img1: "https://mywillows.com/cdn/shop/products/Donna.jpg?v=1635813674&width=800",
    img2: "https://mywillows.com/cdn/shop/products/SilverMinx-01-Hero.jpg?v=1605316285&width=800",
    alt: "Lunettes Optique Lunaire - Lunaria",
    colors: ["#C9A96E","#E8C4B8","#1C1A17"],
    description: "Pourquoi choisir entre correction visuelle et beauté ? L'Optique Lunaire est notre première monture disponible avec verres correcteurs. Montée sur une base Rx-compatible, elle accepte toutes les prescriptions. Apportez votre ordonnance chez votre opticien habituel — il s'occupe des verres, Lunaria s'occupe du reste.",
    shortDesc: "Compatible correction visuelle. Beauté + vision, enfin réunies."
  },
  {
    id: 7,
    name: "Pendentifs Cristal",
    price: 149,
    category: "Accessoires",
    badge: "Accessoire",
    soldOut: false,
    img1: "https://mywillows.com/cdn/shop/files/willows_figgy-pudding_illustration.png?v=1772752982&width=800",
    img2: "https://mywillows.com/cdn/shop/files/Figgy_Pudding.jpg?v=1772752982&width=800",
    alt: "Pendentifs Cristal - Lunaria",
    colors: ["#C9A96E","#C0C0C0","#E8C4B8"],
    description: "Nos pendentifs sont la touche finale parfaite. Conçus pour s'accorder avec l'ensemble de la collection Lunaria, ils peuvent aussi se porter seuls sur n'importe quelle paire de lunettes. Cristaux naturels, montures dorées ou argentées. Le cadeau idéal — pour vous ou pour une femme dans votre vie.",
    shortDesc: "Assortis à toute la collection. Idéal en cadeau. Dès 149 DT."
  },
  {
    id: 8,
    name: "La Figgy — Édition Limitée",
    price: 379,
    category: "Lunettes",
    badge: "Épuisé",
    soldOut: true,
    img1: "https://mywillows.com/cdn/shop/files/Figgy_Pudding.jpg?v=1772752982&width=800",
    img2: "https://mywillows.com/cdn/shop/files/willows_figgy-pudding_illustration.png?v=1772752982&width=800",
    alt: "La Figgy Édition Limitée - Lunaria",
    colors: ["#D4A88A","#C9A96E","#1C1A17"],
    description: "Produite en série limitée de 50 pièces, La Figgy est désormais épuisée. Elle restera dans les mémoires pour sa chaîne torsadée unique et ses cristaux d'ambre naturel. Si vous souhaitez être notifiée lors du prochain drop, laissez votre email ci-dessous. Les éditions limitées partent en moins de 48h.",
    shortDesc: "Édition 50 pièces — épuisée. Laissez votre email pour le prochain drop."
  }
];

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  const target = e.currentTarget;
  if (!target.dataset.errorHandled) {
    target.dataset.errorHandled = 'true';
    target.style.background = 'linear-gradient(135deg,#E8C4B8,#C9A96E)';
    target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
};

// --- Components ---

const GrainOverlay = () => (
  <div className="grain-overlay pointer-events-none fixed inset-0 z-50 opacity-[0.03]" />
);

const Navbar = ({ 
  cartCount, 
  wishlistCount,
  onCartOpen,
  onWishlistOpen,
  onNavigate,
  searchQuery,
  onSearchChange,
  user,
  onLogin,
  onLogout
}: { 
  cartCount: number; 
  wishlistCount: number;
  onCartOpen: () => void;
  onWishlistOpen: () => void;
  onNavigate: (view: 'home' | 'shop' | 'admin' | 'shipping' | 'care' | 'contact' | 'faq' | 'about' | 'blogs') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { currentLang, toggleLang } = useLanguage();
  const t = translations[currentLang];

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 w-full z-40 transition-all duration-300 px-6 py-4 md:px-12 ${
        isScrolled ? "bg-cream/95 backdrop-blur-md border-b border-charcoal/5 shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between relative h-10">
        {/* Mobile Menu Toggle */}
        <div className="flex items-center md:hidden z-50">
          <button 
            className="text-charcoal p-3 -ml-3 hover:bg-charcoal/5 rounded-full transition-colors"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={28} strokeWidth={1.5} />
          </button>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8">
          <button onClick={() => onNavigate('shop')} className="text-[10px] uppercase tracking-[0.2em] font-sans font-bold hover:text-gold transition-colors">{t.nav.shop}</button>
          <button onClick={() => { onNavigate('about'); }} className="text-[10px] uppercase tracking-[0.2em] font-sans font-bold hover:text-gold transition-colors">{t.nav.story}</button>
        </div>

        {/* Logo - Centered and responsive */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center z-50">
          <button onClick={() => onNavigate('home')} className="block text-center cursor-pointer">
            <h1 className="text-lg sm:text-xl md:text-3xl font-display tracking-tight text-charcoal whitespace-nowrap">
              Lunaria <span className="italic font-light">Tunisia</span>
            </h1>
          </button>
        </div>

        {/* Icons */}
        <div className="flex items-center space-x-2 sm:space-x-4 md:space-x-6">
          <button 
            onClick={toggleLang}
            className="text-[10px] uppercase tracking-[0.2em] font-sans font-bold hover:text-gold transition-colors hidden sm:block"
          >
            {currentLang === 'fr' ? 'EN' : 'FR'}
          </button>
          
          <button 
            onClick={onWishlistOpen}
            className="text-charcoal hover:text-gold transition-colors flex items-center space-x-1"
          >
            <Heart size={18} />
            <span className="text-[10px] md:text-xs font-sans font-medium">({wishlistCount})</span>
          </button>

          <button 
            onClick={onCartOpen}
            className="text-charcoal hover:text-gold transition-colors flex items-center space-x-1"
          >
            <ShoppingBag size={18} />
            <span className="text-[10px] md:text-xs font-sans font-medium">({cartCount})</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-cream text-charcoal z-[100] p-8 flex flex-col overflow-y-auto"
          >
              <div className="flex justify-between items-center mb-12">
                <h2 className="text-xl font-display italic">Menu</h2>
                <button 
                  onClick={() => setIsMenuOpen(false)} 
                  className="p-3 -mr-3 hover:bg-charcoal/5 rounded-full transition-colors"
                  aria-label="Close menu"
                >
                  <X size={32} strokeWidth={1.5} className="text-charcoal" />
                </button>
              </div>
              <div className="flex flex-col space-y-8">
                <button onClick={() => { setIsMenuOpen(false); onNavigate('shop'); }} className="text-4xl font-display italic text-left">{t.nav.shopAll}</button>
                <button onClick={() => { setIsMenuOpen(false); onNavigate('about'); }} className="text-4xl font-display italic text-left">{t.nav.story}</button>
                
                <button onClick={() => { setIsMenuOpen(false); toggleLang(); }} className="text-2xl font-sans uppercase tracking-widest text-left mt-4">
                  Langue: {currentLang === 'fr' ? 'Français' : 'English'}
                </button>
              </div>
              <div className="mt-auto pt-12 flex space-x-6">
                <a href="https://www.instagram.com/mylunariatn/" target="_blank" rel="noopener noreferrer" className="text-charcoal hover:text-gold transition-colors">
                  <Instagram size={24} />
                </a>
                <a href="https://www.tiktok.com/@mylunariatn" target="_blank" rel="noopener noreferrer" className="text-charcoal hover:text-gold transition-colors">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
                <a href="https://www.facebook.com/myLunaria/" target="_blank" rel="noopener noreferrer" className="text-charcoal hover:text-gold transition-colors">
                  <Facebook size={24} />
                </a>
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [heroCaption, setHeroCaption] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'home');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.heroImages && data.heroImages.length > 0) {
          setHeroImages(data.heroImages);
        } else {
          setHeroImages(["https://mywillows.com/cdn/shop/files/Willows_10.20_37_1.jpg?v=1614322477&width=2000"]);
        }
        
        if (currentLang === 'fr' && data.heroCaptionFr) {
          setHeroCaption(data.heroCaptionFr);
        } else if (currentLang === 'en' && data.heroCaptionEn) {
          setHeroCaption(data.heroCaptionEn);
        } else {
          setHeroCaption('');
        }
      } else {
        setHeroImages(["https://mywillows.com/cdn/shop/files/Willows_10.20_37_1.jpg?v=1614322477&width=2000"]);
        setHeroCaption('');
      }
    }, (error) => {
      console.error("Error fetching hero settings:", error);
      setHeroImages(["https://mywillows.com/cdn/shop/files/Willows_10.20_37_1.jpg?v=1614322477&width=2000"]);
      setHeroCaption('');
    });

    return () => unsubscribe();
  }, [currentLang]);

  useEffect(() => {
    if (heroImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages]);

  return (
    <section className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-sand">
      {/* Background Image with Parallax-like effect */}
      <AnimatePresence mode="wait">
        {heroImages.length > 0 && (
          <motion.div 
            key={currentImageIndex}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img 
              src={heroImages[currentImageIndex]} 
              alt="Artisanal Jewelry" 
              className="w-full h-full object-cover opacity-80"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.errorHandled) {
                  target.dataset.errorHandled = 'true';
                  target.src = "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=2000&auto=format&fit=crop";
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cream/20 to-cream/60" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 text-center px-6">
        <motion.h2 
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 1.2 }}
          className="text-4xl sm:text-5xl md:text-8xl font-display leading-tight mb-8 text-charcoal"
        >
          {heroCaption ? (
            <span className="block">{heroCaption}</span>
          ) : (
            <>
              {t.hero.title1} <br />
              <span className="italic font-light">{t.hero.title2}</span>
            </>
          )}
        </motion.h2>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
        >
          <a 
            href="#shop" 
            className="inline-flex items-center space-x-4 bg-charcoal text-cream px-8 py-4 rounded-full hover:bg-gold transition-all duration-500 group"
          >
            <span className="text-xs uppercase tracking-widest font-sans font-medium">{t.hero.cta}</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div 
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 text-charcoal/40"
      >
        <div className="w-[1px] h-12 bg-charcoal/20 mx-auto" />
      </motion.div>
    </section>
  );
};

const Marquee = () => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  return (
    <div className="bg-charcoal text-cream py-3 md:py-4 overflow-hidden whitespace-nowrap border-y border-charcoal flex w-full">
      <motion.div 
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
        className="flex shrink-0"
      >
        {[...Array(10)].map((_, i) => (
          <span key={i} className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.4em] font-sans mx-4 md:mx-8 shrink-0">
            {t.marquee}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

const ProductCard: React.FC<{ 
  product: Product; 
  onOpen: () => void; 
  onAdd: () => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}> = ({ product, onOpen, onAdd, isWishlisted, onToggleWishlist }) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  const translatedProduct = t.products.find(p => p.id === product.id) || product;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-sand mb-6 rounded-sm shadow-sm" onClick={onOpen}>
        <img 
          src={product.img1} 
          alt={product.alt}
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 group-hover:opacity-0"
          onError={handleImageError}
        />
        <img 
          src={product.img2} 
          alt={product.alt}
          className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 opacity-0 group-hover:opacity-100"
          onError={handleImageError}
        />
        
        {product.badge && (
          <div className="absolute top-4 left-4 z-10">
            <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-sans font-bold rounded-sm ${
              product.badge === 'Épuisé' || product.badge === 'Sold Out' 
                ? 'bg-charcoal text-cream' 
                : 'bg-cream text-charcoal'
            }`}>
              {product.badge}
            </span>
          </div>
        )}

        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist?.();
            }}
            className="p-2 bg-cream/80 backdrop-blur-sm rounded-full hover:bg-rose transition-colors"
          >
            <Heart size={18} className={isWishlisted ? "text-rose fill-rose" : "text-charcoal"} />
          </button>
        </div>
        
        {product.tags && product.tags.length > 0 && (
          <div className="absolute top-16 right-4 z-10 flex flex-col gap-2 items-end">
            {product.tags.map(tag => (
              <span key={tag} className="px-3 py-1 text-[10px] uppercase tracking-widest font-sans font-bold rounded-sm bg-gold text-charcoal shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        )}

        {product.soldOut && (
          <div className="absolute inset-0 bg-charcoal/20 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <span className="bg-cream text-charcoal px-6 py-2 text-xs uppercase tracking-widest font-sans font-bold">
              {t.product?.soldOut || "Épuisé"}
            </span>
          </div>
        )}
        
        {!product.soldOut && (
          <div className="absolute bottom-0 left-0 w-full p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500 bg-gradient-to-t from-charcoal/40 to-transparent z-20">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (product.variants && product.variants.length > 0) {
                  onOpen();
                } else {
                  onAdd(); 
                }
              }}
              className="w-full bg-cream text-charcoal py-3 text-xs uppercase tracking-widest font-sans font-semibold hover:bg-gold transition-colors"
            >
              {product.variants && product.variants.length > 0 ? "Choisir une option" : t.product.quickAdd}
            </button>
          </div>
        )}
      </div>
      <div className="flex justify-between items-start" onClick={onOpen}>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-charcoal/50 font-sans mb-1">{translatedProduct.category}</p>
          <h3 className="text-lg font-display text-charcoal group-hover:text-gold transition-colors">{translatedProduct.name}</h3>
        </div>
        <p className="text-sm font-sans font-medium text-charcoal">{product.price} TND</p>
      </div>
    </motion.div>
  );
};

const Accordion = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-charcoal/10 py-5">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex justify-between items-center w-full text-left font-sans font-bold text-xs uppercase tracking-widest text-charcoal"
      >
        {title}
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 text-charcoal/70 font-body text-sm leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProductPage: React.FC<{ 
  product: Product; 
  products: Product[]; 
  onClose: () => void; 
  onAdd: (qty: number, variant?: ProductVariant) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
}> = ({ product, products, onClose, onAdd, isWishlisted, onToggleWishlist }) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants && product.variants.length > 0 ? product.variants[0] : null
  );
  
  // Track recently viewed products
  useEffect(() => {
    if (product) {
      const viewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      const updatedViewed = [product.id, ...viewed.filter((id: number) => id !== product.id)].slice(0, 4);
      localStorage.setItem('recentlyViewed', JSON.stringify(updatedViewed));
    }
  }, [product]);

  useEffect(() => {
    if (product) {
      setQuantity(1);
      setActiveImage(0);
      setSelectedVariant(product.variants && product.variants.length > 0 ? product.variants[0] : null);
      window.scrollTo(0, 0);
      
      // SEO Dynamic Title
      document.title = `${product.name} | Lunaria`;
    }
  }, [product]);

  if (!product) return null;
  const translatedProduct = t.products.find(p => p.id === product.id) || product;
  
  // Get recently viewed products
  const recentlyViewedIds = JSON.parse(localStorage.getItem('recentlyViewed') || '[]').filter((id: number) => id !== product.id);
  const recentlyViewedProducts = recentlyViewedIds
    .map((id: number) => products.find(p => p.id === id))
    .filter((p: Product | undefined): p is Product => p !== undefined)
    .slice(0, 4);
  
  // Get related products (same category, excluding current)
  const relatedProducts = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  const galleryImages = Array.from(new Set([
    selectedVariant?.img || product.img1,
    product.img2,
    ...(product.images || [])
  ])).filter(Boolean).slice(0, 6);

  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const isSoldOut = selectedVariant ? selectedVariant.quantity <= 0 : product.soldOut;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto min-h-screen"
    >
      <button 
        onClick={onClose} 
        className="flex items-center space-x-2 text-charcoal/60 hover:text-charcoal mb-8 md:mb-12 transition-colors group"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm uppercase tracking-widest font-bold">Retour à la boutique</span>
      </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 items-start">
        {/* Left: Images Gallery */}
        <div className="flex flex-col gap-4 w-full">
          {/* Main Image */}
          <div className="w-full aspect-square md:aspect-[4/5] rounded-sm overflow-hidden relative bg-white border border-charcoal/5 shadow-sm flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.img 
                key={activeImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                src={galleryImages[activeImage]} 
                alt={product.alt} 
                className="absolute inset-0 w-full h-full object-contain p-4" 
                onError={handleImageError}
              />
            </AnimatePresence>
            {isSoldOut && (
              <div className="absolute top-4 left-4 z-10">
                <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-sans font-bold rounded-sm bg-charcoal text-cream`}>
                  {product.badge === 'Épuisé' || product.badge === 'Sold Out' ? product.badge : 'Épuisé'}
                </span>
              </div>
            )}
            {!isSoldOut && product.badge && (
              <div className="absolute top-4 left-4 z-10">
                <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-sans font-bold rounded-sm bg-cream text-charcoal`}>
                  {product.badge}
                </span>
              </div>
            )}
            {product.tags && product.tags.length > 0 && (
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                {product.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 text-[10px] uppercase tracking-widest font-sans font-bold rounded-sm bg-gold text-charcoal shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Thumbnails */}
          {galleryImages.length > 1 && (
            <div className="grid grid-cols-5 md:grid-cols-6 gap-2 md:gap-3">
              {galleryImages.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`relative aspect-square rounded-sm overflow-hidden border-2 transition-all bg-white ${
                    activeImage === idx ? 'border-charcoal shadow-md' : 'border-charcoal/10 hover:border-charcoal/30'
                  }`}
                >
                  <img 
                    src={img} 
                    alt={`${product.alt} - view ${idx + 1}`} 
                    className="w-full h-full object-contain p-1"
                    onError={handleImageError}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Right: Info */}
        <div className="relative w-full">
          <div className="md:sticky md:top-32 flex flex-col gap-6">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gold font-sans font-bold mb-2">{translatedProduct.category}</p>
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-display mb-2">{translatedProduct.name}</h1>
                </div>
                <button 
                  onClick={onToggleWishlist}
                  className="p-3 bg-sand rounded-full hover:bg-rose transition-colors shrink-0 ml-4"
                >
                  <Heart size={24} className={isWishlisted ? "text-rose fill-rose" : "text-charcoal"} />
                </button>
              </div>
              <p className="text-2xl font-sans font-light">{currentPrice} TND</p>
            </div>
            
            {product.variants && product.variants.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest font-sans font-bold mb-3">Couleur</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedVariant(variant);
                        setActiveImage(0); // Reset to first image which will be the variant image
                      }}
                      className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold border transition-colors ${
                        selectedVariant === variant 
                          ? 'border-charcoal bg-charcoal text-cream' 
                          : 'border-charcoal/20 text-charcoal hover:border-charcoal'
                      }`}
                    >
                      {variant.color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!isSoldOut && (
              <div className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-widest font-sans font-bold">Quantité</p>
                <div className="flex items-center border border-charcoal/20 rounded-sm w-32">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center text-charcoal hover:text-gold transition-colors text-lg"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-sans font-medium">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center text-charcoal hover:text-gold transition-colors text-lg"
                  >
                    +
                  </button>
                </div>
                {selectedVariant && (
                  <p className="text-[10px] text-charcoal/60">
                    {selectedVariant.quantity} en stock
                  </p>
                )}
              </div>
            )}

            <div className="pb-6 space-y-3 border-b border-charcoal/10">
              <button 
                onClick={() => {
                  if (!isSoldOut) {
                    onAdd(quantity, selectedVariant || undefined);
                  }
                }}
                disabled={isSoldOut}
                className={`w-full py-4 rounded-sm text-sm uppercase tracking-widest font-sans font-bold transition-colors ${
                  isSoldOut 
                    ? 'bg-charcoal/10 text-charcoal/40 cursor-not-allowed' 
                    : 'bg-charcoal text-cream hover:bg-gold'
                }`}
              >
                {isSoldOut ? (t.product?.notifyMe || "M'avertir du retour") : t.product.addToBag}
              </button>
              <p className="text-[10px] text-center text-charcoal/40 uppercase tracking-widest">
                Taxes incluses. Livraison calculée à l'étape de paiement.
              </p>
            </div>

            <div>
              <p className="text-charcoal/90 font-body leading-relaxed text-base line-clamp-2">
                {translatedProduct.description}
              </p>
            </div>

            <div className="pt-2">
              <Accordion title="Détails du produit" defaultOpen={true}>
                <p className="mb-4">Chaque pièce est unique et fabriquée à la main dans notre atelier en Tunisie. Nous utilisons des matériaux de haute qualité pour garantir la durabilité et l'élégance de nos accessoires.</p>
                <ul className="list-disc pl-4 space-y-2">
                  <li>Design exclusif Lunaria</li>
                  <li>Série limitée</li>
                </ul>
              </Accordion>
              
              <Accordion title="Matériaux & Entretien">
                <p className="mb-4">Pour préserver l'éclat de votre accessoire :</p>
                <ul className="list-disc pl-4 space-y-2">
                  <li>Éviter le contact direct avec l'eau et le parfum</li>
                  <li>Nettoyer avec un chiffon doux et sec</li>
                  <li>Ranger dans sa pochette d'origine lorsqu'il n'est pas utilisé</li>
                </ul>
              </Accordion>

              <Accordion title="Livraison & Retours">
                <p className="mb-4">Nous expédions partout en Tunisie.</p>
                <ul className="list-disc pl-4 space-y-2">
                  <li>Livraison standard (Tunis, Sousse, Sfax, etc.) : 24 à 48 heures ouvrables</li>
                  <li>Livraison gratuite à partir de 300 TND d'achat</li>
                  <li>Retours acceptés sous 7 jours (sous conditions)</li>
                </ul>
              </Accordion>

              <Accordion title="FAQ">
                <div className="space-y-4">
                  <div>
                    <p className="font-bold text-sm mb-1">Où êtes-vous situés ?</p>
                    <p className="text-sm">Notre atelier est basé à Tunis, où chaque pièce est conçue et assemblée à la main avec soin.</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">Quels sont les délais de livraison ?</p>
                    <p className="text-sm">Nous livrons sur toute la Tunisie (Grand Tunis, Sousse, Sfax, Djerba, etc.) en 24 à 48h ouvrables via nos partenaires de livraison express.</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">Les cristaux sont-ils authentiques ?</p>
                    <p className="text-sm">Oui, nous sélectionnons rigoureusement des pierres naturelles et authentiques pour toutes nos créations (Quartz, Améthyste, Citrine...).</p>
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">Puis-je personnaliser ma chaîne ?</p>
                    <p className="text-sm">Absolument ! Contactez-nous sur Instagram @mylunariatn pour toute demande de personnalisation sur-mesure.</p>
                  </div>
                </div>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Sell Sections */}
      <div className="mt-32 border-t border-charcoal/10 pt-16">
        {relatedProducts.length > 0 && (
          <div className="mb-24">
            <h3 className="text-2xl font-display mb-8 text-center">{t.product.youMayAlsoLike || "Vous Aimerez Aussi"}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {relatedProducts.map(p => (
                <div key={p.id} className="group cursor-pointer" onClick={() => {
                  onClose();
                  // A small hack to open the new product: we can trigger a custom event or just rely on the parent component
                  // For now, since we don't have a direct way to change the product from here without modifying props,
                  // we will dispatch an event that the parent can listen to.
                  window.dispatchEvent(new CustomEvent('openProduct', { detail: p }));
                }}>
                  <div className="aspect-[4/3] bg-sand mb-4 overflow-hidden relative">
                    <img src={p.img1} alt={p.name} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                    {p.tags && p.tags.length > 0 && (
                      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
                        {p.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-[8px] uppercase tracking-widest font-sans font-bold rounded-sm bg-gold text-charcoal shadow-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <h4 className="font-display text-lg">{t.products.find(tp => tp.id === p.id)?.name || p.name}</h4>
                  <p className="text-sm font-sans text-charcoal/60">{p.price} TND</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentlyViewedProducts.length > 0 && (
          <div>
            <h3 className="text-2xl font-display mb-8 text-center">{t.product.recentlyViewed || "Récemment Consultés"}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              {recentlyViewedProducts.map(p => (
                <div key={p.id} className="group cursor-pointer" onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('openProduct', { detail: p }));
                }}>
                  <div className="aspect-[4/3] bg-sand mb-4 overflow-hidden relative">
                    <img src={p.img1} alt={p.name} className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                    {p.tags && p.tags.length > 0 && (
                      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 items-end">
                        {p.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-[8px] uppercase tracking-widest font-sans font-bold rounded-sm bg-gold text-charcoal shadow-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <h4 className="font-display text-lg">{t.products.find(tp => tp.id === p.id)?.name || p.name}</h4>
                  <p className="text-sm font-sans text-charcoal/60">{p.price} TND</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const ShopSection = ({ 
  products, 
  onProductOpen, 
  onAddToCart,
  wishlist,
  onToggleWishlist
}: { 
  products: Product[]; 
  onProductOpen: (p: Product) => void; 
  onAddToCart: (p: Product) => void;
  wishlist: Product[];
  onToggleWishlist: (p: Product) => void;
}) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  const [filter, setFilter] = useState("All");
  const filteredProducts = filter === "All" ? products : products.filter(p => p.category === filter);

  return (
    <section id="shop" className="py-24 px-6 md:px-12 bg-cream">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 space-y-6 md:space-y-0">
          <div>
            <h2 className="text-4xl md:text-6xl font-display mb-4">{t.shop.title}</h2>
            <p className="text-charcoal/60 max-w-md font-body leading-relaxed">
              {t.shop.desc}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { id: "All", label: t.shop.all },
              { id: "Chains", label: t.shop.chains },
              { id: "Sunglasses", label: t.shop.sunglasses }
            ].map((cat) => (
              <button 
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-6 py-2 border rounded-full text-xs uppercase tracking-widest font-sans transition-all ${
                  filter === cat.id ? "bg-charcoal text-cream border-charcoal" : "border-charcoal/10 hover:border-charcoal"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {filteredProducts.map((product) => (
            <ProductCard 
              key={product.id} 
              product={product} 
              onOpen={() => onProductOpen(product)}
              onAdd={() => onAddToCart(product)}
              isWishlisted={wishlist.some(p => p.id === product.id)}
              onToggleWishlist={() => onToggleWishlist(product)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const StorySection = ({ onNavigate }: { onNavigate: (view: 'about') => void }) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  return (
    <section id="story" className="py-24 bg-sand overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-[3/4] rounded-sm overflow-hidden shadow-xl relative z-10 w-full">
              <img 
                src="https://mywillows.com/cdn/shop/files/Figgy_Pudding.jpg?v=1614322477&width=1000" 
                alt="Artisan at work" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.errorHandled) {
                    target.dataset.errorHandled = 'true';
                    target.src = "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1000&auto=format&fit=crop";
                  }
                }}
              />
            </div>
            <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-gold/20 rounded-full blur-3xl -z-10" />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[10px] uppercase tracking-[0.3em] text-gold font-sans font-bold mb-6 block">{t.story.tag}</span>
            <h2 className="text-4xl md:text-6xl font-display mb-8 leading-tight">
              {t.story.title1} <br />
              <span className="italic font-light">{t.story.title2}</span>
            </h2>
            <div className="space-y-6 text-charcoal/70 font-body leading-relaxed text-lg">
              <p>
                {t.story.p1}
              </p>
              <p>
                {t.story.p2}
              </p>
            </div>
            <button onClick={() => onNavigate('about')} className="mt-12 group flex items-center space-x-4 text-charcoal">
              <span className="text-xs uppercase tracking-widest font-sans font-bold border-b border-charcoal pb-1">{t.story.cta}</span>
              <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Footer = ({ onNavigate, isAdmin, user, onLogin, onLogout, blogs }: { onNavigate: (view: string) => void, isAdmin: boolean, user: User | null, onLogin: () => void, onLogout: () => void, blogs: BlogPost[] }) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      try {
        await addDoc(collection(db, 'newsletters'), {
          email,
          createdAt: new Date().toISOString()
        });
        setSubscribed(true);
        setEmail("");
        setTimeout(() => setSubscribed(false), 3000);
      } catch (error) {
        console.error("Error subscribing to newsletter:", error);
      }
    }
  };

  return (
    <footer className="bg-charcoal text-cream pt-24 pb-12 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-24">
          <div className="lg:col-span-1">
            <h2 className="text-2xl font-display mb-6">Lunaria</h2>
            <p className="text-cream/50 font-body text-sm leading-relaxed mb-8">
              {t.footer.desc}
            </p>
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/mylunariatn/" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors"><Instagram size={20} /></a>
              <a href="https://www.tiktok.com/@mylunariatn" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
              <a href="https://www.facebook.com/myLunaria/" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors"><Facebook size={20} /></a>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs uppercase tracking-widest font-sans font-bold mb-8 text-gold">{t.footer.shop}</h4>
            <ul className="space-y-4 text-sm text-cream/70 font-body">
              <li><button onClick={() => onNavigate('shop')} className="hover:text-cream transition-colors text-left">{t.footer.allProducts}</button></li>
              <li><button onClick={() => onNavigate('shop')} className="hover:text-cream transition-colors text-left">{t.footer.crystalChains}</button></li>
              <li><button onClick={() => onNavigate('shop')} className="hover:text-cream transition-colors text-left">{t.footer.sunglasses}</button></li>
              <li><button onClick={() => onNavigate('shop')} className="hover:text-cream transition-colors text-left">{t.footer.giftCards}</button></li>
              <li><button onClick={() => onNavigate('blogs')} className="hover:text-cream transition-colors text-left">Blog</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-widest font-sans font-bold mb-8 text-gold">{t.footer.support}</h4>
            <ul className="space-y-4 text-sm text-cream/70 font-body">
              <li><button onClick={() => onNavigate('about')} className="hover:text-cream transition-colors text-left">À propos</button></li>
              <li><button onClick={() => onNavigate('shipping')} className="hover:text-cream transition-colors text-left">{t.footer.shippingReturns}</button></li>
              <li><button onClick={() => onNavigate('care')} className="hover:text-cream transition-colors text-left">{t.footer.careGuide}</button></li>
              <li><button onClick={() => onNavigate('contact')} className="hover:text-cream transition-colors text-left">{t.footer.contactUs}</button></li>
              <li><button onClick={() => onNavigate('faq')} className="hover:text-cream transition-colors text-left">{t.footer.faq}</button></li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="text-xs uppercase tracking-widest font-sans font-bold mb-8 text-gold">{t.footer.newsletter}</h4>
            <p className="text-sm text-cream/50 font-body mb-6">{t.footer.newsletterDesc}</p>
            <form className="relative" onSubmit={handleSubscribe}>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={subscribed ? t.footer.thankYou : t.footer.emailPlaceholder} 
                className={`w-full bg-transparent border-b py-3 text-sm focus:outline-none transition-colors font-body ${
                  subscribed ? "border-gold text-gold" : "border-cream/20 focus:border-gold"
                }`}
              />
              {!subscribed && (
                <button type="submit" className="absolute right-0 top-1/2 -translate-y-1/2 hover:text-gold transition-colors">
                  <ArrowRight size={18} />
                </button>
              )}
            </form>
          </div>
        </div>
        
        <div className="pt-12 border-t border-cream/10 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-[10px] uppercase tracking-widest text-cream/30 font-sans">
          <p>{t.footer.rights}</p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            <a href="#" className="hover:text-cream transition-colors">{t.footer.privacy}</a>
            <a href="#" className="hover:text-cream transition-colors">{t.footer.terms}</a>
            {user ? (
              <button onClick={onLogout} className="hover:text-cream transition-colors">Déconnexion</button>
            ) : (
              <button onClick={onLogin} className="hover:text-cream transition-colors">Connexion</button>
            )}
            {isAdmin && (
              <button onClick={() => onNavigate('admin')} className="hover:text-cream transition-colors">Admin</button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

const WishlistDrawer = ({ 
  isOpen, 
  onClose, 
  wishlist, 
  onRemove, 
  onAddToCart 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  wishlist: Product[]; 
  onRemove: (id: number) => void; 
  onAddToCart: (product: Product) => void; 
}) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[60]"
          />
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-cream z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-8 flex items-center justify-between border-b border-charcoal/5">
              <h2 className="text-2xl font-display italic">Wishlist</h2>
              <button onClick={onClose} className="hover:rotate-90 transition-transform duration-300">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {wishlist.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Heart size={48} className="text-charcoal/10 mb-6" />
                  <p className="text-charcoal/50 font-body mb-8">Votre wishlist est vide.</p>
                  <button 
                    onClick={onClose}
                    className="bg-charcoal text-cream px-8 py-4 rounded-full text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors"
                  >
                    {t.cart.startShopping}
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {wishlist.map((item, idx) => {
                    const translatedItem = t.products.find(p => p.id === item.id) || item;
                    return (
                      <div key={`${item.id}-${idx}`} className="flex space-x-6">
                        <div className="w-24 h-36 bg-sand rounded-sm overflow-hidden flex-shrink-0">
                          <img src={item.img1} alt={translatedItem.name} className="w-full h-full object-cover object-center" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <h3 className="text-lg font-display">{translatedItem.name}</h3>
                            <p className="text-xs text-charcoal/50 uppercase tracking-widest font-sans">{translatedItem.category}</p>
                          </div>
                          <div className="flex justify-between items-end">
                            <p className="text-sm font-sans font-medium">{item.price} TND</p>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => onRemove(item.id)}
                                className="text-[10px] uppercase tracking-widest font-sans font-bold border-b border-charcoal/20 hover:border-charcoal transition-colors"
                              >
                                {t.cart.remove}
                              </button>
                              <button 
                                onClick={() => {
                                  if (item.variants && item.variants.length > 0) {
                                    onClose();
                                    // We need to pass a way to open the product page.
                                    // But WishlistDrawer doesn't have onProductOpen.
                                    // Let's just call onAddToCart, and we'll handle it in App.tsx
                                    onAddToCart(item);
                                  } else {
                                    onAddToCart(item);
                                    onRemove(item.id);
                                  }
                                }}
                                className="text-[10px] uppercase tracking-widest font-sans font-bold border-b border-charcoal/20 hover:border-charcoal transition-colors"
                              >
                                {item.variants && item.variants.length > 0 ? "Choisir" : "Ajouter"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const CartDrawer = ({ isOpen, onClose, cart, onRemove, onCheckout }: { isOpen: boolean; onClose: () => void; cart: (Product & { selectedVariant?: ProductVariant })[]; onRemove: (id: number) => void; onCheckout: () => void; }) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  const total = cart.reduce((sum, item) => sum + (item.selectedVariant ? item.selectedVariant.price : item.price), 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[60]"
          />
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-cream z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-8 flex items-center justify-between border-b border-charcoal/5">
              <h2 className="text-2xl font-display italic">{t.cart.title}</h2>
              <button onClick={onClose} className="hover:rotate-90 transition-transform duration-300">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <ShoppingBag size={48} className="text-charcoal/10 mb-6" />
                  <p className="text-charcoal/50 font-body mb-8">{t.cart.empty}</p>
                  <button 
                    onClick={onClose}
                    className="bg-charcoal text-cream px-8 py-4 rounded-full text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors"
                  >
                    {t.cart.startShopping}
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {cart.map((item, idx) => {
                    const translatedItem = t.products.find(p => p.id === item.id) || item;
                    const itemPrice = item.selectedVariant ? item.selectedVariant.price : item.price;
                    const itemImg = item.selectedVariant?.img || item.img1;
                    return (
                      <div key={`${item.id}-${idx}`} className="flex space-x-6">
                        <div className="w-24 h-36 bg-sand rounded-sm overflow-hidden flex-shrink-0">
                          <img src={itemImg} alt={translatedItem.name} className="w-full h-full object-cover object-center" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 flex flex-col justify-between py-1">
                          <div>
                            <h3 className="text-lg font-display">{translatedItem.name}</h3>
                            <p className="text-xs text-charcoal/50 uppercase tracking-widest font-sans">{translatedItem.category}</p>
                            {item.selectedVariant && (
                              <p className="text-xs text-charcoal/70 mt-1">Couleur: {item.selectedVariant.color}</p>
                            )}
                          </div>
                          <div className="flex justify-between items-end">
                            <p className="text-sm font-sans font-medium">{itemPrice} TND</p>
                            <button 
                              onClick={() => onRemove(idx)}
                              className="text-[10px] uppercase tracking-widest font-sans font-bold border-b border-charcoal/20 hover:border-charcoal transition-colors"
                            >
                              {t.cart.remove}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-8 bg-sand/50 border-t border-charcoal/5">
              <div className="flex justify-between mb-6">
                <span className="text-xs uppercase tracking-widest font-sans font-bold">{t.cart.subtotal}</span>
                <span className="font-sans font-medium">{total} TND</span>
              </div>
              <button 
                disabled={cart.length === 0}
                onClick={() => {
                  if (cart.length > 0) {
                    onClose();
                    onCheckout();
                  }
                }}
                className={`w-full py-4 rounded-full text-xs uppercase tracking-widest font-sans font-bold transition-colors ${
                  cart.length > 0 ? "bg-charcoal text-cream hover:bg-gold" : "bg-charcoal/20 text-charcoal/40 cursor-not-allowed"
                }`}
              >
                {t.cart.checkout}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const GOVERNORATES = [
  "Ariana", "Béja", "Ben Arous", "Bizerte", "Gabès", "Gafsa", "Jendouba", "Kairouan",
  "Kasserine", "Kébili", "Le Kef", "Mahdia", "La Manouba", "Médenine", "Monastir",
  "Nabeul", "Sfax", "Sidi Bouzid", "Siliana", "Sousse", "Tataouine", "Tozeur", "Tunis", "Zaghouan"
];

const CheckoutOverlay = ({ 
  isOpen, 
  onClose, 
  cart, 
  onSuccess,
  addToast,
  user
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  cart: (Product & { selectedVariant?: ProductVariant })[]; 
  onSuccess: () => void;
  addToast: (msg: string) => void;
  user: User | null;
}) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", phone: "", address: "", gov: "Tunis"
  });
  const [promoCode, setPromoCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + (item.selectedVariant ? item.selectedVariant.price : item.price), 0);
  const total = Math.max(0, subtotal - discount);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setOrderNumber("");
      setDiscount(0);
      setPromoCode("");
      setAppliedCoupon("");
    }
  }, [isOpen]);

  const handlePromo = async () => {
    if (!promoCode) return;
    
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', promoCode.toUpperCase().trim()), where('active', '==', true));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const coupon = querySnapshot.docs[0].data() as Coupon;
        let calculatedDiscount = 0;
        if (coupon.type === 'percentage') {
          calculatedDiscount = subtotal * (coupon.value / 100);
        } else {
          calculatedDiscount = coupon.value;
        }
        setDiscount(calculatedDiscount);
        setAppliedCoupon(coupon.code);
        addToast("Code promo appliqué !");
      } else {
        addToast("Code promo invalide ou expiré");
        setDiscount(0);
        setAppliedCoupon("");
      }
    } catch (error) {
      console.error("Error validating coupon:", error);
      addToast("Erreur lors de la validation du code promo");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.phone || !formData.address) {
        addToast("Veuillez remplir tous les champs obligatoires.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setIsSubmitting(true);
      const newOrderNumber = `WT-${Math.floor(100000 + Math.random() * 900000)}`;
      setOrderNumber(newOrderNumber);
      
      try {
        const orderData: any = {
          orderNumber: newOrderNumber,
          customer: formData,
          items: cart,
          subtotal,
          discount,
          shipping: 0,
          paymentMethod: 'cash',
          total,
          couponCode: appliedCoupon || null,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        
        if (user) {
          orderData.userId = user.uid;
        }
        
        await addDoc(collection(db, 'orders'), orderData);
        
        // Update coupon usage count
        if (appliedCoupon) {
          try {
            const q = query(collection(db, 'coupons'), where('code', '==', appliedCoupon));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const couponDoc = querySnapshot.docs[0];
              await updateDoc(doc(db, 'coupons', couponDoc.id), {
                usageCount: (couponDoc.data().usageCount || 0) + 1
              });
            }
          } catch (couponError) {
            console.error("Error updating coupon usage:", couponError);
          }
        }
        
        // Update product quantities
        for (const item of cart) {
          try {
            const productRef = doc(db, 'products', item.id.toString());
            const productDoc = await getDoc(productRef);
            
            if (productDoc.exists()) {
              const productData = productDoc.data() as Product;
              
              if (item.selectedVariant && productData.variants) {
                const updatedVariants = productData.variants.map(v => {
                  if (v.color === item.selectedVariant!.color) {
                    return { ...v, quantity: Math.max(0, v.quantity - 1) };
                  }
                  return v;
                });
                
                // Check if all variants are sold out
                const allSoldOut = updatedVariants.every(v => v.quantity <= 0);
                
                await updateDoc(productRef, {
                  variants: updatedVariants,
                  soldOut: allSoldOut
                });
              } else if (productData.quantity !== undefined) {
                // Fallback for products without variants but with a quantity field
                const newQuantity = Math.max(0, (productData.quantity as number) - 1);
                await updateDoc(productRef, {
                  quantity: newQuantity,
                  soldOut: newQuantity <= 0
                });
              }
            }
          } catch (updateError) {
            console.error("Failed to update product quantity:", updateError);
          }
        }
        
        // Send email notification
        try {
          await fetch('/api/send-order-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderNumber: newOrderNumber,
              customer: formData,
              items: cart,
              shipping: 0,
              paymentMethod: 'cash',
              total
            }),
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // We don't block the user if email fails
        }

        setStep(3);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'orders');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/60 backdrop-blur-md z-[100]"
            onClick={step === 3 ? () => { onSuccess(); onClose(); } : undefined}
          />
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 w-full md:top-0 md:right-0 md:left-auto md:w-[600px] bg-cream z-[110] h-[90vh] md:h-full shadow-2xl flex flex-col rounded-t-2xl md:rounded-none"
          >
            {/* Header */}
            <div className="p-6 border-b border-charcoal/10 flex justify-between items-center bg-cream sticky top-0 z-20 rounded-t-2xl md:rounded-none">
              <h2 className="text-2xl font-display italic">
                {step === 1 ? "Informations" : step === 2 ? "Paiement" : "Confirmation"}
              </h2>
              {step < 3 && (
                <button onClick={onClose} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {step < 3 && (
              <div className="w-full h-1 bg-charcoal/10">
                <motion.div 
                  className="h-full bg-gold"
                  initial={{ width: "33%" }}
                  animate={{ width: step === 1 ? "50%" : "100%" }}
                />
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {step === 1 && (
                <form id="checkout-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-2">Prénom *</label>
                      <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full border border-charcoal/20 p-3 rounded-sm focus:border-charcoal outline-none bg-transparent" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-2">Nom *</label>
                      <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full border border-charcoal/20 p-3 rounded-sm focus:border-charcoal outline-none bg-transparent" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-2">Email</label>
                    <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border border-charcoal/20 p-3 rounded-sm focus:border-charcoal outline-none bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-2">Téléphone *</label>
                    <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-charcoal/20 p-3 rounded-sm focus:border-charcoal outline-none bg-transparent" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-2">Gouvernorat *</label>
                    <select value={formData.gov} onChange={e => setFormData({...formData, gov: e.target.value})} className="w-full border border-charcoal/20 p-3 rounded-sm focus:border-charcoal outline-none bg-transparent appearance-none">
                      {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-2">Adresse complète *</label>
                    <textarea required rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border border-charcoal/20 p-3 rounded-sm focus:border-charcoal outline-none bg-transparent resize-none" />
                  </div>
                </form>
              )}

              {step === 2 && (
                <form id="checkout-form" onSubmit={handleSubmit} className="space-y-8">
                  {/* Shipping */}
                  <div>
                    <h3 className="text-sm uppercase tracking-widest font-sans font-bold mb-4">Mode de livraison</h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between p-4 border rounded-sm cursor-pointer transition-colors border-charcoal bg-charcoal/5">
                        <div className="flex items-center space-x-3">
                          <input type="radio" name="shipping" checked={true} readOnly className="accent-charcoal" />
                          <span className="font-sans text-sm">Standard (entre 24h et 48h)</span>
                        </div>
                        <span className="font-sans font-medium text-sm">Gratuit</span>
                      </label>
                    </div>
                  </div>

                  {/* Payment */}
                  <div>
                    <h3 className="text-sm uppercase tracking-widest font-sans font-bold mb-4">Mode de paiement</h3>
                    <div className="space-y-3">
                      <label className="flex items-center p-4 border rounded-sm cursor-pointer transition-colors border-charcoal bg-charcoal/5">
                        <input type="radio" name="payment" checked={true} readOnly className="accent-charcoal mr-3" />
                        <span className="font-sans text-sm">Paiement à la livraison (Cash)</span>
                      </label>
                    </div>
                  </div>

                  {/* Promo Code */}
                  <div>
                    <h3 className="text-sm uppercase tracking-widest font-sans font-bold mb-4">Code Promo</h3>
                    <div className="flex space-x-2">
                      <input 
                        type="text" 
                        value={promoCode} 
                        onChange={e => setPromoCode(e.target.value)} 
                        placeholder="" 
                        className="flex-1 border border-charcoal/20 p-3 rounded-sm focus:border-charcoal outline-none bg-transparent uppercase" 
                      />
                      <button type="button" onClick={handlePromo} className="px-6 bg-charcoal text-cream text-xs uppercase tracking-widest font-sans font-bold rounded-sm hover:bg-gold transition-colors">
                        Appliquer
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {step === 3 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="w-24 h-24 bg-gold/20 rounded-full flex items-center justify-center text-gold mb-4"
                  >
                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <h2 className="text-4xl font-display italic">Merci pour votre commande !</h2>
                  <p className="text-charcoal/60 font-body">
                    Votre commande <span className="font-bold text-charcoal">{orderNumber}</span> a été confirmée. 
                    Vous recevrez un SMS de confirmation sous peu.
                  </p>
                  <div className="w-full bg-sand p-6 rounded-sm mt-8 text-left">
                    <h3 className="text-xs uppercase tracking-widest font-sans font-bold mb-4 border-b border-charcoal/10 pb-2">Récapitulatif</h3>
                    <div className="space-y-2 font-sans text-sm">
                      <div className="flex justify-between"><span>Total payé:</span> <span className="font-bold">{total.toFixed(2)} TND</span></div>
                      <div className="flex justify-between"><span>Paiement:</span> <span>À la livraison</span></div>
                      <div className="flex justify-between"><span>Livraison:</span> <span>{formData.address}, {formData.gov}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Summary */}
            {step < 3 && (
              <div className="p-6 bg-sand/50 border-t border-charcoal/10">
                <div className="space-y-2 mb-6 font-sans text-sm">
                  <div className="flex justify-between text-charcoal/60">
                    <span>Sous-total</span>
                    <span>{subtotal.toFixed(2)} TND</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-gold">
                      <span>Remise</span>
                      <span>-{discount.toFixed(2)} TND</span>
                    </div>
                  )}
                  <div className="flex justify-between text-charcoal/60">
                    <span>Livraison</span>
                    <span>Gratuit</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t border-charcoal/10">
                    <span>Total</span>
                    <span>{total.toFixed(2)} TND</span>
                  </div>
                </div>
                
                <div className="flex space-x-4">
                  {step === 2 && (
                    <button 
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-6 py-4 border border-charcoal text-charcoal rounded-full text-xs uppercase tracking-widest font-sans font-bold hover:bg-charcoal/5 transition-colors"
                    >
                      Retour
                    </button>
                  )}
                  <button 
                    type="submit"
                    form="checkout-form"
                    disabled={isSubmitting}
                    className={`flex-1 bg-charcoal text-cream py-4 rounded-full text-xs uppercase tracking-widest font-sans font-bold transition-colors ${
                      isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gold'
                    }`}
                  >
                    {isSubmitting ? "Traitement..." : (step === 1 ? "Continuer" : "Confirmer la commande")}
                  </button>
                </div>
              </div>
            )}
            
            {step === 3 && (
              <div className="p-6 border-t border-charcoal/10 flex space-x-4">
                <button 
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'Lunaria',
                        text: `J'ai commandé sur Lunaria ! (Commande ${orderNumber})`,
                        url: window.location.href,
                      }).catch(console.error);
                    } else {
                      addToast("Partage non supporté sur ce navigateur");
                    }
                  }}
                  className="px-6 py-4 border border-charcoal text-charcoal rounded-full text-xs uppercase tracking-widest font-sans font-bold hover:bg-charcoal/5 transition-colors"
                >
                  Partager
                </button>
                <button 
                  onClick={() => { onSuccess(); onClose(); }}
                  className="flex-1 bg-charcoal text-cream py-4 rounded-full text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors"
                >
                  Continuer mes achats
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- Main App ---

type ToastType = {
  id: number;
  message: string;
};

const ToastContainer = ({ toasts }: { toasts: ToastType[] }) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="bg-charcoal text-cream px-6 py-3 rounded-full text-sm font-sans font-medium shadow-xl flex items-center space-x-2"
          >
            <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const ShopPage: React.FC<{ 
  products: Product[]; 
  onProductOpen: (p: Product) => void; 
  onAddToCart: (p: Product) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  wishlist: Product[];
  onToggleWishlist: (p: Product) => void;
}> = ({ 
  products, 
  onProductOpen, 
  onAddToCart,
  searchQuery,
  onSearchChange,
  wishlist,
  onToggleWishlist
}) => {
  const { currentLang } = useLanguage();
  const t = translations[currentLang];
  const [filter, setFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const categories = ["All", ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesFilter = filter === "All" || p.category === filter;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto min-h-screen"
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-display mb-4">La Boutique</h1>
          <p className="text-charcoal/60 font-body">Découvrez notre collection complète.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          {/* Search */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none font-sans text-sm transition-colors"
            />
            <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-charcoal/40" />
          </div>
          
          {/* Filter */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 sm:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest font-sans font-bold whitespace-nowrap transition-colors ${
                  filter === cat ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:border-charcoal'
                }`}
              >
                {cat === "All" ? "Tous" : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-charcoal/60 font-sans">Aucun produit trouvé.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {paginatedProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onOpen={() => onProductOpen(product)}
                onAdd={() => onAddToCart(product)}
                isWishlisted={wishlist.some(p => p.id === product.id)}
                onToggleWishlist={() => onToggleWishlist(product)}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="mt-16 flex justify-center items-center space-x-4">
              <button 
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 1}
                className="p-2 border border-charcoal/20 text-charcoal disabled:opacity-30 hover:bg-charcoal/5 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex space-x-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentPage(i + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-8 h-8 flex items-center justify-center text-sm font-sans transition-colors ${
                      currentPage === i + 1 
                        ? "bg-charcoal text-cream" 
                        : "text-charcoal hover:bg-charcoal/10"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === totalPages}
                className="p-2 border border-charcoal/20 text-charcoal disabled:opacity-30 hover:bg-charcoal/5 transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

const AboutUs = () => {
  useEffect(() => {
    document.title = "Notre Histoire - Lunaria | Bijoux et Chaînes de Lunettes Fait Main";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", "Découvrez l'histoire de Lunaria, marque tunisienne d'artisanat spécialisée dans les bijoux, accessoires et chaînes de lunettes fait main avec des pierres naturelles. Livraison sur Tunis, Sousse, Sfax et toute la Tunisie.");
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-32 pb-24 px-6 md:px-12 max-w-4xl mx-auto min-h-screen">
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-display italic mb-12 text-center text-charcoal">À propos de Lunaria</h1>
      
      <div className="space-y-12 font-body text-charcoal/80 leading-relaxed text-lg">
        <section className="bg-sand/30 p-8 rounded-sm border border-charcoal/5">
          <h2 className="text-3xl font-display mb-6 text-charcoal">Notre Histoire : L'Artisanat Tunisien Réinventé</h2>
          <p className="mb-4">Née au cœur de <strong>Tunis</strong>, Lunaria est le fruit d'une passion profonde pour l'<strong>artisanat délicat</strong> et les <strong>pierres naturelles</strong>. Notre aventure a commencé avec une idée simple : créer des accessoires et des <strong>bijoux fait main</strong> qui ne sont pas seulement beaux, mais qui racontent une histoire et portent une énergie unique.</p>
          <p>Chaque pièce, qu'il s'agisse de nos célèbres <strong>chaînes de lunettes</strong> ou de nos colliers, est imaginée et assemblée à la main dans notre atelier en <strong>Tunisie</strong>. Nous combinons des techniques traditionnelles avec un design contemporain et épuré pour offrir des créations intemporelles.</p>
        </section>

        <section>
          <h2 className="text-3xl font-display mb-6 text-charcoal">Notre Mission & Nos Matériaux</h2>
          <p className="mb-4">Chez Lunaria, notre mission est de sublimer votre quotidien avec des créations uniques. Nous croyons que les détails font la différence. C'est pour cela que nous sélectionnons rigoureusement nos matériaux, en privilégiant des <strong>pierres semi-précieuses authentiques</strong> telles que l'améthyste, le quartz rose, l'œil de tigre et la pierre de lune.</p>
          <p>Nous nous engageons à offrir une qualité exceptionnelle tout en soutenant le savoir-faire local et l'<strong>artisanat tunisien</strong>. De la conception à la livraison partout en Tunisie (Grand Tunis, Sousse, Sfax, Djerba...), chaque étape est pensée pour vous offrir une expérience premium.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
          <div className="bg-cream p-6 rounded-sm shadow-sm border border-charcoal/5">
            <h3 className="text-xl font-display mb-3 text-charcoal">Authenticité</h3>
            <p className="text-base">Utilisation exclusive de pierres naturelles et de matériaux de haute qualité pour des bijoux durables.</p>
          </div>
          <div className="bg-cream p-6 rounded-sm shadow-sm border border-charcoal/5">
            <h3 className="text-xl font-display mb-3 text-charcoal">Fait Main (Handmade)</h3>
            <p className="text-base">Chaque bijou et accessoire de lunettes est assemblé à la main avec amour et précision dans notre atelier tunisien.</p>
          </div>
          <div className="bg-cream p-6 rounded-sm shadow-sm border border-charcoal/5">
            <h3 className="text-xl font-display mb-3 text-charcoal">Proximité & Service</h3>
            <p className="text-base">Livraison express sur toute la Tunisie et un service client personnalisé à l'écoute de notre communauté.</p>
          </div>
          <div className="bg-cream p-6 rounded-sm shadow-sm border border-charcoal/5">
            <h3 className="text-xl font-display mb-3 text-charcoal">Élégance Intemporelle</h3>
            <p className="text-base">Des designs minimalistes et chics qui s'adaptent à tous les styles et toutes les occasions.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

const ShippingReturns = () => (
  <div className="pt-32 pb-24 px-6 md:px-12 max-w-3xl mx-auto min-h-screen">
    <h1 className="text-4xl md:text-5xl font-display italic mb-12">Livraison & Retours</h1>
    <div className="space-y-8 font-body text-charcoal/80 leading-relaxed">
      <section>
        <h2 className="text-xl font-display mb-4 text-charcoal">Expédition en Tunisie</h2>
        <p>Nous sommes fiers de proposer une livraison rapide et sécurisée partout en Tunisie. Que vous soyez à Tunis, Sousse, Sfax, Djerba ou ailleurs, nos partenaires logistiques s'assurent que vos bijoux Lunaria arrivent à bon port.</p>
        <ul className="list-disc pl-5 mt-4 space-y-2">
          <li><strong>Délai de traitement :</strong> 1 à 2 jours ouvrables.</li>
          <li><strong>Délai de livraison :</strong> 24 à 48 heures ouvrables après expédition.</li>
          <li><strong>Frais de livraison :</strong> Gratuits pour toutes les commandes.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-display mb-4 text-charcoal">Politique de Retour</h2>
        <p>Votre satisfaction est notre priorité absolue. Si vous n'êtes pas entièrement satisfait de votre achat, vous pouvez nous le retourner sous 7 jours après réception.</p>
        <ul className="list-disc pl-5 mt-4 space-y-2">
          <li>Les articles doivent être non portés, dans leur état d'origine et avec leur emballage complet.</li>
          <li>Les articles personnalisés ne sont ni repris ni échangés.</li>
          <li>Les frais de retour sont à la charge du client, sauf en cas de défaut de fabrication.</li>
        </ul>
        <p className="mt-4">Pour initier un retour, veuillez nous contacter via notre page de contact ou sur Instagram @mylunariatn.</p>
      </section>
    </div>
  </div>
);

const CareGuide = () => (
  <div className="pt-32 pb-24 px-6 md:px-12 max-w-3xl mx-auto min-h-screen">
    <h1 className="text-4xl md:text-5xl font-display italic mb-12">Guide d'Entretien</h1>
    <div className="space-y-8 font-body text-charcoal/80 leading-relaxed">
      <p className="text-lg">Chaque création Lunaria est assemblée à la main avec soin. Pour préserver l'éclat de vos pierres naturelles et la brillance de vos chaînes, nous vous recommandons de suivre ces conseils simples.</p>
      <section>
        <h2 className="text-xl font-display mb-4 text-charcoal">Protéger vos bijoux</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Évitez l'eau et l'humidité :</strong> Retirez vos chaînes de lunettes et bijoux avant de vous doucher, de nager ou de faire du sport.</li>
          <li><strong>Attention aux produits chimiques :</strong> Le parfum, les lotions, la laque et les produits d'entretien peuvent ternir le métal et endommager certaines pierres poreuses.</li>
          <li><strong>Rangement :</strong> Conservez vos pièces dans leur pochette Lunaria d'origine, à l'abri de la lumière directe du soleil et de l'humidité. Ne les laissez pas s'emmêler.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-display mb-4 text-charcoal">Nettoyage des pierres naturelles</h2>
        <p>Les cristaux comme le quartz, l'améthyste ou la citrine peuvent accumuler de la poussière ou des résidus. Nettoyez-les délicatement avec un chiffon doux et sec. N'utilisez jamais de nettoyants abrasifs ou de machines à ultrasons.</p>
      </section>
    </div>
  </div>
);

const ContactUs = () => (
  <div className="pt-32 pb-24 px-6 md:px-12 max-w-3xl mx-auto min-h-screen">
    <h1 className="text-4xl md:text-5xl font-display italic mb-12">Contactez-nous</h1>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 font-body text-charcoal/80">
      <div>
        <p className="mb-8 leading-relaxed">Nous adorons échanger avec notre communauté. Que ce soit pour une question sur une commande, une demande de personnalisation ou simplement pour nous dire bonjour, n'hésitez pas à nous contacter.</p>
        <div className="space-y-6">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal mb-2">Email</h3>
            <a href="mailto:hello@mylunaria.tn" className="hover:text-gold transition-colors">hello@mylunaria.tn</a>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal mb-2">Réseaux Sociaux</h3>
            <a href="https://www.instagram.com/mylunariatn/" target="_blank" rel="noreferrer" className="hover:text-gold transition-colors block">Instagram: @mylunariatn</a>
            <a href="https://www.tiktok.com/@mylunariatn" target="_blank" rel="noreferrer" className="hover:text-gold transition-colors block mt-2">TikTok: @mylunariatn</a>
            <a href="https://www.facebook.com/myLunaria/" target="_blank" rel="noreferrer" className="hover:text-gold transition-colors block mt-2">Facebook: Lunaria</a>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal mb-2">Atelier</h3>
            <p>Tunis, Tunisie<br />(Sur rendez-vous uniquement)</p>
          </div>
        </div>
      </div>
      <div>
        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); alert('Message envoyé ! Nous vous répondrons très vite.'); }}>
          <div>
            <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Nom complet</label>
            <input type="text" required className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Email</label>
            <input type="email" required className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Message</label>
            <textarea required rows={4} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2 resize-none"></textarea>
          </div>
          <button type="submit" className="bg-charcoal text-cream px-8 py-3 text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors w-full">
            Envoyer
          </button>
        </form>
      </div>
    </div>
  </div>
);

const FAQ = () => (
  <div className="pt-32 pb-24 px-6 md:px-12 max-w-3xl mx-auto min-h-screen">
    <h1 className="text-4xl md:text-5xl font-display italic mb-12">Questions Fréquentes</h1>
    <div className="space-y-6">
      <Accordion title="Où êtes-vous situés ?" defaultOpen={true}>
        <p className="font-body text-charcoal/80 text-sm leading-relaxed">Nous sommes basés à Tunis, en Tunisie. Toutes nos créations sont imaginées, assemblées et expédiées depuis notre atelier tunisien.</p>
      </Accordion>
      <Accordion title="Les pierres sont-elles vraies ?">
        <p className="font-body text-charcoal/80 text-sm leading-relaxed">Oui, nous utilisons exclusivement des pierres naturelles semi-précieuses (améthyste, quartz rose, œil de tigre, etc.). En raison de leur nature, chaque pierre est unique et peut présenter de légères variations de couleur ou de forme.</p>
      </Accordion>
      <Accordion title="Faites-vous du sur-mesure ?">
        <p className="font-body text-charcoal/80 text-sm leading-relaxed">Absolument ! Si vous avez une idée précise en tête ou souhaitez combiner certaines pierres, contactez-nous sur Instagram ou par email. Nous serons ravis de créer une pièce unique pour vous.</p>
      </Accordion>
      <Accordion title="Quels sont les délais de livraison ?">
        <p className="font-body text-charcoal/80 text-sm leading-relaxed">La livraison prend généralement 24 à 48 heures ouvrables partout en Tunisie après le traitement de votre commande.</p>
      </Accordion>
    </div>
  </div>
);

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: string; 
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[200]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-cream p-8 z-[210] shadow-2xl rounded-sm"
          >
            <h3 className="text-xl font-display italic mb-4">{title}</h3>
            <p className="text-charcoal/70 font-body text-sm mb-8">{message}</p>
            <div className="flex space-x-4">
              <button 
                onClick={onClose}
                className="flex-1 py-3 text-xs uppercase tracking-widest font-sans font-bold border border-charcoal/10 hover:bg-sand transition-colors"
              >
                Annuler
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 py-3 text-xs uppercase tracking-widest font-sans font-bold bg-red-500 text-cream hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const CouponManagement = ({ addToast, orders }: { addToast: (msg: string) => void, orders: any[] }) => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    type: 'percentage',
    value: 0,
    active: true
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: string }>({ isOpen: false, id: '' });

  useEffect(() => {
    const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const couponsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      setCoupons(couponsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'coupons');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!formData.code || formData.value === undefined) {
        setIsSubmitting(false);
        return;
      }
      
      const couponData: Coupon = {
        code: formData.code.toUpperCase().trim(),
        type: formData.type as 'percentage' | 'fixed',
        value: formData.value,
        active: formData.active ?? true,
        usageCount: 0,
        createdAt: new Date().toISOString()
      };

      // Check if code already exists
      const existing = coupons.find(c => c.code === couponData.code);
      if (existing) {
        addToast("Ce code promo existe déjà");
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, 'coupons'), couponData);
      addToast("Code promo ajouté");
      setFormData({ code: '', type: 'percentage', value: 0, active: true });
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coupons');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      if (!coupon.id) return;
      await updateDoc(doc(db, 'coupons', coupon.id), { active: !coupon.active });
      addToast(coupon.active ? "Code désactivé" : "Code activé");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `coupons/${coupon.id}`);
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      addToast("Code promo supprimé");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `coupons/${id}`);
    }
  };

  const getUsageForCoupon = (code: string) => {
    return orders.filter(o => o.couponCode === code).length;
  };

  return (
    <div className="space-y-8">
      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: '' })}
        onConfirm={() => deleteCoupon(confirmDelete.id)}
        title="Supprimer le code promo"
        message="Êtes-vous sûr de vouloir supprimer ce code promo ? Cette action est irréversible."
      />
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-display">Gestion des Codes Promo</h3>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold bg-charcoal text-cream hover:bg-gold transition-colors"
        >
          {isAdding ? 'Annuler' : '+ Nouveau Code'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-sand/30 p-6 rounded-sm space-y-4 max-w-md">
          <div>
            <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Code</label>
            <input 
              type="text" 
              value={formData.code} 
              onChange={e => setFormData({...formData, code: e.target.value})} 
              className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2 uppercase" 
              placeholder="EX: SUMMER20"
              required 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Type</label>
              <select 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value as any})}
                className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2"
              >
                <option value="percentage">Pourcentage (%)</option>
                <option value="fixed">Montant Fixe (TND)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Valeur</label>
              <input 
                type="number" 
                value={formData.value} 
                onChange={e => setFormData({...formData, value: Number(e.target.value)})} 
                className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" 
                required 
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full bg-charcoal text-cream py-3 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gold'}`}
          >
            {isSubmitting ? 'Traitement...' : 'Créer le code'}
          </button>
        </form>
      )}

      <div className="bg-white border border-charcoal/10 rounded-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-sand/30 border-b border-charcoal/10">
                <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Code</th>
                <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Type</th>
                <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Valeur</th>
                <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Utilisations</th>
                <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Statut</th>
                <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-charcoal/60 font-sans">Aucun code promo créé.</td>
                </tr>
              ) : (
                coupons.map(coupon => (
                  <tr key={coupon.id} className="border-b border-charcoal/5 hover:bg-sand/10 transition-colors">
                    <td className="p-4 font-mono font-bold">{coupon.code}</td>
                    <td className="p-4 font-sans text-sm">{coupon.type === 'percentage' ? 'Pourcentage' : 'Fixe'}</td>
                    <td className="p-4 font-sans text-sm">{coupon.value}{coupon.type === 'percentage' ? '%' : ' TND'}</td>
                    <td className="p-4 font-sans text-sm">{getUsageForCoupon(coupon.code)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-sans font-bold rounded-sm ${coupon.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {coupon.active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex space-x-3">
                        <button 
                          onClick={() => toggleActive(coupon)}
                          className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal hover:text-gold transition-colors"
                        >
                          {coupon.active ? 'Désactiver' : 'Activer'}
                        </button>
                        <button 
                          onClick={() => coupon.id && setConfirmDelete({ isOpen: true, id: coupon.id })}
                          className="text-xs uppercase tracking-widest font-sans font-bold text-red-500 hover:text-red-700 transition-colors"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const OrderDetailsModal = ({ order, onClose }: { order: any, onClose: () => void }) => {
  if (!order) return null;
  return (
    <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-cream w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 hover:rotate-90 transition-transform">
          <X size={24} />
        </button>
        <h2 className="text-3xl font-display italic mb-8">Détails de la Commande {order.orderNumber}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold mb-4 border-b border-charcoal/10 pb-2">Client</h3>
            <p className="font-sans text-sm"><strong>Nom:</strong> {order.customer?.firstName} {order.customer?.lastName}</p>
            <p className="font-sans text-sm"><strong>Email:</strong> {order.customer?.email}</p>
            <p className="font-sans text-sm"><strong>Téléphone:</strong> {order.customer?.phone}</p>
            <p className="font-sans text-sm"><strong>Adresse:</strong> {order.customer?.address}, {order.customer?.gov}</p>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold mb-4 border-b border-charcoal/10 pb-2">Résumé</h3>
            <p className="font-sans text-sm"><strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}</p>
            <p className="font-sans text-sm"><strong>Statut:</strong> {order.status}</p>
            <p className="font-sans text-sm"><strong>Coupon:</strong> {order.couponCode || 'Aucun'}</p>
            <p className="font-sans text-sm"><strong>Total:</strong> {order.total} TND</p>
          </div>
        </div>

        <h3 className="text-xs uppercase tracking-widest font-sans font-bold mb-4 border-b border-charcoal/10 pb-2">Articles</h3>
        <div className="space-y-4">
          {order.items?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center space-x-4 border-b border-charcoal/5 pb-4">
              <img src={item.img1} alt={item.name} className="w-16 h-20 object-cover rounded-sm" />
              <div className="flex-1">
                <h4 className="font-display">{item.name}</h4>
                <p className="text-xs text-charcoal/60">
                  {item.selectedVariant ? `Couleur: ${item.selectedVariant.color}` : ''}
                </p>
                <p className="text-sm font-sans">{item.price} TND</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ products, blogs, addToast }: { products: Product[], blogs: BlogPost[], addToast: (msg: string) => void }) => {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);
  const [blogFormData, setBlogFormData] = useState<Partial<BlogPost>>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'customers' | 'coupons' | 'newsletters' | 'hero' | 'blogs'>('overview');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [newsletters, setNewsletters] = useState<any[]>([]);
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [heroCaptionFr, setHeroCaptionFr] = useState<string>('');
  const [heroCaptionEn, setHeroCaptionEn] = useState<string>('');

  useEffect(() => {
    if (activeTab === 'hero') {
      const docRef = doc(db, 'settings', 'home');
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.heroImages) setHeroImages(data.heroImages);
          if (data.heroCaptionFr !== undefined) setHeroCaptionFr(data.heroCaptionFr);
          if (data.heroCaptionEn !== undefined) setHeroCaptionEn(data.heroCaptionEn);
        }
      }, (error) => {
        console.error("Error fetching hero settings:", error);
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 2000;
          const MAX_HEIGHT = 2000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
          
          setHeroImages(prev => [...prev, dataUrl]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const saveHeroSettings = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'settings', 'home'), { 
        heroImages,
        heroCaptionFr,
        heroCaptionEn
      }, { merge: true });
      addToast("Paramètres de l'accueil sauvegardés");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/home');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'orders' || activeTab === 'customers') {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
      });
      return () => unsubscribe();
    }
    if (activeTab === 'newsletters') {
      const q = query(collection(db, 'newsletters'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNewsletters(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'newsletters');
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  const customers = useMemo(() => {
    const custMap = new Map();
    orders.forEach(o => {
      const key = o.customer?.email || o.customer?.phone;
      if (!key) return;
      if (!custMap.has(key)) {
        custMap.set(key, {
          name: `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim(),
          email: o.customer?.email,
          phone: o.customer?.phone,
          gov: o.customer?.gov,
          orderCount: 1,
          totalSpent: o.total || 0
        });
      } else {
        const c = custMap.get(key);
        c.orderCount += 1;
        c.totalSpent += (o.total || 0);
      }
    });
    return Array.from(custMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'img1' | 'img2' | `variant-${number}` | 'images') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (field === 'images') {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/webp', 0.8);
            
            setFormData(prev => ({
              ...prev,
              images: [...(prev.images || []), dataUrl]
            }));
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/webp', 0.8);
        
        if (field.startsWith('variant-')) {
          const index = parseInt(field.split('-')[1]);
          setFormData(prev => {
            const variants = [...(prev.variants || [])];
            if (variants[index]) {
              variants[index] = { ...variants[index], img: dataUrl };
            }
            return { ...prev, variants };
          });
        } else {
          setFormData(prev => ({ ...prev, [field]: dataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData(p);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setFormData({
      id: Date.now(),
      name: '',
      price: 0,
      category: 'Lunettes',
      badge: '',
      soldOut: false,
      img1: '',
      img2: '',
      alt: '',
      description: '',
      shortDesc: '',
      colors: [],
      tags: []
    });
  };

  const handleDelete = async (id: number) => {
    setConfirmDelete({ isOpen: true, id });
  };

  const confirmDeleteProduct = async () => {
    if (confirmDelete.id === null) return;
    try {
      await deleteDoc(doc(db, 'products', confirmDelete.id.toString()));
      addToast("Produit supprimé");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${confirmDelete.id}`);
    }
  };

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean, id: number | null }>({ isOpen: false, id: null });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!formData.id) {
        setIsSubmitting(false);
        return;
      }
      
      const productData = { ...formData } as Product;
      if (productData.alt === undefined) productData.alt = '';
      if (productData.description === undefined) productData.description = '';
      if (productData.name === undefined) productData.name = '';
      if (productData.category === undefined) productData.category = '';
      if (productData.img1 === undefined) productData.img1 = '';
      if (productData.img2 === undefined) productData.img2 = '';
      if (productData.price === undefined) productData.price = 0;
      if (productData.soldOut === undefined) productData.soldOut = false;
      
      // Clean up tags
      if (typeof productData.tags === 'string') {
        productData.tags = (productData.tags as string).split(',').map(t => t.trim()).filter(t => t);
      }
      
      await setDoc(doc(db, 'products', productData.id.toString()), productData);
      addToast(editingProduct ? "Produit mis à jour" : "Produit ajouté");
      setFormData({});
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `products/${formData.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const blogData = { ...blogFormData } as BlogPost;
      if (!blogData.id) {
        blogData.id = Date.now().toString();
        blogData.date = new Date().toISOString();
      }
      if (!blogData.slug) {
        blogData.slug = blogData.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || blogData.id;
      }
      if (blogData.published === undefined) blogData.published = false;

      await setDoc(doc(db, 'blogs', blogData.id), blogData);
      addToast(editingBlog ? "Blog mis à jour" : "Blog ajouté");
      setBlogFormData({});
      setEditingBlog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `blogs/${blogFormData.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBlog = async (id: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce blog ?")) {
      try {
        await deleteDoc(doc(db, 'blogs', id));
        addToast("Blog supprimé");
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `blogs/${id}`);
      }
    }
  };

  const exportToCSV = () => {
    if (orders.length === 0) return;
    
    const headers = ['N° Commande', 'Date', 'Client', 'Email', 'Téléphone', 'Adresse', 'Gouvernorat', 'Total (TND)', 'Statut'];
    const csvRows = [headers.join(',')];
    
    orders.forEach(order => {
      const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
      const customer = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim();
      const email = order.customer?.email || '';
      const phone = order.customer?.phone || '';
      const address = `"${(order.customer?.address || '').replace(/"/g, '""')}"`;
      const gov = order.customer?.gov || '';
      const total = order.total || 0;
      const status = order.status || 'pending';
      
      csvRows.push([order.orderNumber, date, customer, email, phone, address, gov, total, status].join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `commandes_willows_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  const handleDeleteOrder = (orderId: string) => {
    setConfirmDeleteOrder({ isOpen: true, id: orderId });
  };

  const executeDeleteOrder = async () => {
    if (!confirmDeleteOrder.id) return;
    try {
      await deleteDoc(doc(db, 'orders', confirmDeleteOrder.id));
      addToast("Commande supprimée");
      setConfirmDeleteOrder({ isOpen: false, id: null });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${confirmDeleteOrder.id}`);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      addToast("Statut mis à jour");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  return (
    <div className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto min-h-screen">
      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, id: null })}
        onConfirm={confirmDeleteProduct}
        title="Supprimer le produit"
        message="Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible."
      />
      <ConfirmModal 
        isOpen={confirmDeleteOrder.isOpen}
        onClose={() => setConfirmDeleteOrder({ isOpen: false, id: null })}
        onConfirm={executeDeleteOrder}
        title="Supprimer la commande"
        message="Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible."
      />
      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <h2 className="text-4xl font-display italic">Administration</h2>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'overview' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Vue d'ensemble
          </button>
          <button 
            onClick={() => setActiveTab('products')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'products' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Produits
          </button>
          <button 
            onClick={() => setActiveTab('orders')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'orders' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Commandes
          </button>
          <button 
            onClick={() => setActiveTab('customers')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'customers' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Clients
          </button>
          <button 
            onClick={() => setActiveTab('coupons')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'coupons' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Coupons
          </button>
          <button 
            onClick={() => setActiveTab('newsletters')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'newsletters' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Newsletters
          </button>
          <button 
            onClick={() => setActiveTab('hero')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'hero' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Accueil
          </button>
          <button 
            onClick={() => setActiveTab('blogs')} 
            className={`px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${activeTab === 'blogs' ? 'bg-charcoal text-cream' : 'border border-charcoal/20 text-charcoal hover:bg-charcoal/5'}`}
          >
            Blogs
          </button>
          {activeTab === 'orders' && (
            <button 
              onClick={exportToCSV}
              className="px-4 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors bg-gold text-charcoal hover:bg-gold/80"
            >
              Exporter CSV
            </button>
          )}
        </div>
      </div>
      
      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-sand/30 p-6 rounded-sm border border-charcoal/10">
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60 mb-2">Chiffre d'affaires</h3>
            <p className="text-3xl font-display">{orders.reduce((acc, o) => acc + (o.total || 0), 0).toLocaleString('fr-TN')} TND</p>
          </div>
          <div className="bg-sand/30 p-6 rounded-sm border border-charcoal/10">
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60 mb-2">Commandes</h3>
            <p className="text-3xl font-display">{orders.length}</p>
          </div>
          <div className="bg-sand/30 p-6 rounded-sm border border-charcoal/10">
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60 mb-2">Clients</h3>
            <p className="text-3xl font-display">{customers.length}</p>
          </div>
          <div className="bg-sand/30 p-6 rounded-sm border border-charcoal/10">
            <h3 className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60 mb-2">Produits</h3>
            <p className="text-3xl font-display">{products.length}</p>
          </div>
        </div>
      ) : activeTab === 'products' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <h3 className="text-xl font-display mb-6">{formData.id && !editingProduct ? 'Ajouter un produit' : editingProduct ? 'Modifier le produit' : 'Sélectionner un produit'}</h3>
          
          {formData.id !== undefined && (
            <form onSubmit={handleSubmit} className="space-y-4 bg-sand/30 p-6 rounded-sm">
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Nom</label>
                <input type="text" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Prix (TND)</label>
                  <input type="number" value={formData.price || 0} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" required />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Catégorie</label>
                  <input type="text" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" required />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Image 1</label>
                <div className="flex space-x-2">
                  <input type="text" value={formData.img1?.startsWith('data:') ? 'Image uploadée' : (formData.img1 || '')} onChange={e => setFormData({...formData, img1: e.target.value})} className="flex-1 border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" placeholder="URL de l'image" disabled={formData.img1?.startsWith('data:')} />
                  {formData.img1?.startsWith('data:') && (
                    <button type="button" onClick={() => setFormData({...formData, img1: ''})} className="px-2 text-charcoal/60 hover:text-charcoal">
                      <X size={16} />
                    </button>
                  )}
                  <label className="cursor-pointer bg-charcoal/5 hover:bg-charcoal/10 px-3 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors flex items-center">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'img1')} />
                  </label>
                </div>
                {formData.img1 && <img src={formData.img1} alt="Preview 1" className="mt-2 h-20 w-20 object-cover rounded-sm border border-charcoal/10" />}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Image 2</label>
                <div className="flex space-x-2">
                  <input type="text" value={formData.img2?.startsWith('data:') ? 'Image uploadée' : (formData.img2 || '')} onChange={e => setFormData({...formData, img2: e.target.value})} className="flex-1 border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" placeholder="URL de l'image" disabled={formData.img2?.startsWith('data:')} />
                  {formData.img2?.startsWith('data:') && (
                    <button type="button" onClick={() => setFormData({...formData, img2: ''})} className="px-2 text-charcoal/60 hover:text-charcoal">
                      <X size={16} />
                    </button>
                  )}
                  <label className="cursor-pointer bg-charcoal/5 hover:bg-charcoal/10 px-3 py-2 text-xs uppercase tracking-widest font-sans font-bold transition-colors flex items-center">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'img2')} />
                  </label>
                </div>
                {formData.img2 && <img src={formData.img2} alt="Preview 2" className="mt-2 h-20 w-20 object-cover rounded-sm border border-charcoal/10" />}
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Images supplémentaires</label>
                <div className="flex flex-col space-y-4">
                  <div className="flex flex-wrap gap-4">
                    {formData.images?.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt={`Additional ${idx}`} className="h-20 w-20 object-cover rounded-sm border border-charcoal/10" />
                        <button 
                          type="button" 
                          onClick={() => setFormData(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== idx) }))}
                          className="absolute -top-2 -right-2 bg-cream rounded-full p-1 text-charcoal hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <label className="cursor-pointer bg-charcoal/5 hover:bg-charcoal/10 h-20 w-20 flex flex-col items-center justify-center text-xs uppercase tracking-widest font-sans font-bold transition-colors rounded-sm border border-dashed border-charcoal/20">
                      <span className="text-2xl mb-1">+</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleImageUpload(e, 'images')} />
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Tags (séparés par des virgules)</label>
                <input type="text" value={Array.isArray(formData.tags) ? formData.tags.join(', ') : formData.tags || ''} onChange={e => setFormData({...formData, tags: e.target.value as any})} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" placeholder="-40%, nouveau, bestseller" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Badge</label>
                <input type="text" value={formData.badge || ''} onChange={e => setFormData({...formData, badge: e.target.value})} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Description courte</label>
                <input type="text" value={formData.shortDesc || ''} onChange={e => setFormData({...formData, shortDesc: e.target.value})} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" required />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Description complète</label>
                <textarea value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2 min-h-[100px]" required />
              </div>
              <div className="pt-4 border-t border-charcoal/10">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-xs uppercase tracking-widest font-sans font-bold">Variantes (Couleurs, Prix, Quantité)</label>
                  <button 
                    type="button" 
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      variants: [...(prev.variants || []), { color: '', img: '', price: prev.price || 0, quantity: 0 }] 
                    }))}
                    className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal hover:text-gold transition-colors"
                  >
                    + Ajouter
                  </button>
                </div>
                
                {formData.variants?.map((variant, index) => (
                  <div key={index} className="bg-white p-4 rounded-sm border border-charcoal/10 mb-4 space-y-4 relative">
                    <button 
                      type="button" 
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        variants: prev.variants?.filter((_, i) => i !== index)
                      }))}
                      className="absolute top-2 right-2 text-charcoal/40 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-1">Couleur</label>
                        <input 
                          type="text" 
                          value={variant.color} 
                          onChange={e => {
                            const newVariants = [...(formData.variants || [])];
                            newVariants[index].color = e.target.value;
                            setFormData({...formData, variants: newVariants});
                          }} 
                          className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-1 text-sm" 
                          placeholder="Ex: Or, Argent" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-1">Prix (TND)</label>
                        <input 
                          type="number" 
                          value={variant.price} 
                          onChange={e => {
                            const newVariants = [...(formData.variants || [])];
                            newVariants[index].price = parseFloat(e.target.value) || 0;
                            setFormData({...formData, variants: newVariants});
                          }} 
                          className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-1 text-sm" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-1">Quantité</label>
                        <input 
                          type="number" 
                          value={variant.quantity} 
                          onChange={e => {
                            const newVariants = [...(formData.variants || [])];
                            newVariants[index].quantity = parseInt(e.target.value) || 0;
                            setFormData({...formData, variants: newVariants});
                          }} 
                          className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-1 text-sm" 
                          required 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-sans font-bold mb-1">Image</label>
                        <div className="flex space-x-2">
                          <input 
                            type="text" 
                            value={variant.img?.startsWith('data:') ? 'Image uploadée' : (variant.img || '')} 
                            onChange={e => {
                              const newVariants = [...(formData.variants || [])];
                              newVariants[index].img = e.target.value;
                              setFormData({...formData, variants: newVariants});
                            }} 
                            className="flex-1 border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-1 text-sm" 
                            placeholder="URL" 
                            disabled={variant.img?.startsWith('data:')}
                          />
                          {variant.img?.startsWith('data:') && (
                            <button 
                              type="button" 
                              onClick={() => {
                                const newVariants = [...(formData.variants || [])];
                                newVariants[index].img = '';
                                setFormData({...formData, variants: newVariants});
                              }} 
                              className="px-2 text-charcoal/60 hover:text-charcoal"
                            >
                              <X size={16} />
                            </button>
                          )}
                          <label className="cursor-pointer bg-charcoal/5 hover:bg-charcoal/10 px-2 py-1 text-[10px] uppercase tracking-widest font-sans font-bold transition-colors flex items-center">
                            Upload
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, `variant-${index}`)} />
                          </label>
                        </div>
                        {variant.img && <img src={variant.img} alt={`Variant ${index}`} className="mt-2 h-12 w-12 object-cover rounded-sm border border-charcoal/10" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" checked={formData.soldOut || false} onChange={e => setFormData({...formData, soldOut: e.target.checked})} id="soldOut" />
                <label htmlFor="soldOut" className="text-sm font-sans">Épuisé (Sold Out)</label>
              </div>
              
              <div className="flex space-x-4 pt-6">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`flex-1 bg-charcoal text-cream py-3 text-xs uppercase tracking-widest font-sans font-bold transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gold'}`}
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button type="button" onClick={() => setFormData({})} className="px-4 border border-charcoal/20 text-charcoal hover:bg-charcoal/5 transition-colors">
                  Annuler
                </button>
              </div>
            </form>
          )}
          
          {formData.id === undefined && (
            <button onClick={handleAddNew} className="w-full py-4 border border-dashed border-charcoal/40 text-charcoal/60 hover:text-charcoal hover:border-charcoal transition-colors flex items-center justify-center space-x-2">
              <span>+ Ajouter un nouveau produit</span>
            </button>
          )}
        </div>
        
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {products.map(p => (
              <div key={p.id} className="flex border border-charcoal/10 p-4 rounded-sm items-center space-x-4">
                <div className="w-20 h-24 bg-sand flex-shrink-0">
                  <img src={p.img1} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-display truncate">{p.name}</h4>
                  <p className="text-sm text-charcoal/60">{p.price} TND</p>
                  <div className="flex space-x-2 mt-2">
                    <button onClick={() => handleEdit(p)} className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal hover:text-gold transition-colors">Modifier</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs uppercase tracking-widest font-sans font-bold text-red-500 hover:text-red-700 transition-colors">Supprimer</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : activeTab === 'orders' ? (
        <div className="bg-white border border-charcoal/10 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sand/30 border-b border-charcoal/10">
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">N° Commande</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Date</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Client</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Coupon</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Total</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Statut</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-charcoal/60 font-sans">Aucune commande pour le moment.</td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className="border-b border-charcoal/5 hover:bg-sand/10 transition-colors">
                      <td className="p-4 font-mono text-sm">{order.orderNumber}</td>
                      <td className="p-4 font-sans text-sm">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</td>
                      <td className="p-4 font-sans text-sm">
                        <div className="font-medium">{order.customer?.firstName} {order.customer?.lastName}</div>
                        <div className="text-charcoal/60 text-xs">{order.customer?.email}</div>
                        <div className="text-charcoal/60 text-xs">{order.customer?.phone}</div>
                        <div className="text-charcoal/60 text-xs">{order.customer?.gov}</div>
                      </td>
                      <td className="p-4 font-mono text-xs font-bold text-gold">{order.couponCode || '-'}</td>
                      <td className="p-4 font-sans font-bold">{order.total} TND</td>
                      <td className="p-4">
                        <select
                          value={order.status || 'pending'}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`px-2 py-1 text-[10px] uppercase tracking-widest font-sans font-bold rounded-sm outline-none cursor-pointer ${
                            order.status === 'pending' ? 'bg-gold/20 text-charcoal' : 
                            order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-charcoal/10 text-charcoal'
                          }`}
                        >
                          <option value="pending">En attente</option>
                          <option value="processing">En cours</option>
                          <option value="shipped">Expédié</option>
                          <option value="completed">Terminé</option>
                          <option value="cancelled">Annulé</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal hover:text-gold transition-colors"
                          >
                            Détails
                          </button>
                          <button 
                            onClick={() => handleDeleteOrder(order.id)}
                            className="text-xs uppercase tracking-widest font-sans font-bold text-red-500 hover:text-red-700 transition-colors"
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'coupons' ? (
        <CouponManagement addToast={addToast} orders={orders} />
      ) : activeTab === 'hero' ? (
        <div className="bg-white border border-charcoal/10 rounded-sm p-8">
          <h3 className="text-xl font-display mb-6">Paramètres de la section Accueil (Hero)</h3>
          
          <div className="mb-8 space-y-4">
            <h4 className="text-sm uppercase tracking-widest font-sans font-bold text-charcoal/80 border-b border-charcoal/10 pb-2">Titre principal</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Français</label>
                <input 
                  type="text" 
                  value={heroCaptionFr} 
                  onChange={e => setHeroCaptionFr(e.target.value)} 
                  className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" 
                  placeholder="Ex: Ornez Votre Vision Intérieure" 
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Anglais</label>
                <input 
                  type="text" 
                  value={heroCaptionEn} 
                  onChange={e => setHeroCaptionEn(e.target.value)} 
                  className="w-full border-b border-charcoal/20 bg-transparent focus:border-charcoal outline-none py-2" 
                  placeholder="Ex: Adorn Your Inner Vision" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-sm uppercase tracking-widest font-sans font-bold text-charcoal/80 border-b border-charcoal/10 pb-2">Images du Carrousel</h4>
            <p className="text-sm font-sans text-charcoal/60 mb-4">
              Ajoutez une ou plusieurs images pour la section d'accueil. Si vous ajoutez plusieurs images, elles défileront sous forme de carrousel. Les images s'adapteront automatiquement à l'écran.
            </p>
            <div className="flex flex-wrap gap-4">
              {heroImages.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img src={img} alt={`Hero ${idx + 1}`} className="h-32 w-32 object-cover rounded-sm border border-charcoal/10" />
                  <button 
                    type="button" 
                    onClick={() => setHeroImages(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-2 -right-2 bg-cream rounded-full p-1 text-charcoal hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <label className="cursor-pointer bg-charcoal/5 hover:bg-charcoal/10 h-32 w-32 flex flex-col items-center justify-center text-xs uppercase tracking-widest font-sans font-bold transition-colors rounded-sm border border-dashed border-charcoal/20">
                <span className="text-2xl mb-1">+</span>
                <span className="text-[10px] text-center px-2">Ajouter image</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleHeroImageUpload} />
              </label>
            </div>
            
            <button 
              onClick={saveHeroSettings}
              disabled={isSubmitting}
              className="mt-8 bg-charcoal text-cream px-8 py-3 text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
            </button>
          </div>
        </div>
      ) : activeTab === 'newsletters' ? (
        <div className="bg-white border border-charcoal/10 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sand/30 border-b border-charcoal/10">
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Email</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Date d'inscription</th>
                </tr>
              </thead>
              <tbody>
                {newsletters.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-charcoal/60 font-sans">Aucun abonné pour le moment.</td>
                  </tr>
                ) : (
                  newsletters.map((newsletter, idx) => (
                    <tr key={idx} className="border-b border-charcoal/5 hover:bg-sand/10 transition-colors">
                      <td className="p-4 font-sans text-sm font-medium">{newsletter.email}</td>
                      <td className="p-4 font-sans text-sm text-charcoal/80">
                        {newsletter.createdAt ? new Date(newsletter.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'blogs' ? (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-display">Gestion des Blogs</h3>
            <button 
              onClick={() => {
                setEditingBlog(null);
                setBlogFormData({});
              }}
              className="bg-charcoal text-cream px-6 py-2 text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors"
            >
              Nouveau Blog
            </button>
          </div>

          <form onSubmit={handleBlogSubmit} className="bg-white p-6 border border-charcoal/10 rounded-sm space-y-6">
            <h4 className="text-lg font-display mb-4">{editingBlog ? 'Modifier le blog' : 'Ajouter un blog'}</h4>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Titre</label>
                <input 
                  type="text" 
                  value={blogFormData.title || ''} 
                  onChange={e => setBlogFormData({...blogFormData, title: e.target.value})}
                  className="w-full border border-charcoal/20 p-3 text-sm focus:outline-none focus:border-charcoal"
                  required
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Slug (URL)</label>
                <input 
                  type="text" 
                  value={blogFormData.slug || ''} 
                  onChange={e => setBlogFormData({...blogFormData, slug: e.target.value})}
                  placeholder="Laissez vide pour générer automatiquement"
                  className="w-full border border-charcoal/20 p-3 text-sm focus:outline-none focus:border-charcoal"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest font-sans font-bold mb-2">Contenu</label>
                <textarea 
                  value={blogFormData.content || ''} 
                  onChange={e => setBlogFormData({...blogFormData, content: e.target.value})}
                  className="w-full border border-charcoal/20 p-3 text-sm focus:outline-none focus:border-charcoal h-64"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="published"
                  checked={blogFormData.published || false} 
                  onChange={e => setBlogFormData({...blogFormData, published: e.target.checked})}
                  className="w-4 h-4"
                />
                <label htmlFor="published" className="text-sm font-sans">Publié</label>
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-charcoal text-cream px-8 py-3 text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              {editingBlog && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingBlog(null);
                    setBlogFormData({});
                  }}
                  className="border border-charcoal/20 text-charcoal px-8 py-3 text-xs uppercase tracking-widest font-sans font-bold hover:bg-charcoal/5 transition-colors"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>

          <div className="bg-white border border-charcoal/10 rounded-sm overflow-hidden mt-8">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sand/30 border-b border-charcoal/10">
                    <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Titre</th>
                    <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Date</th>
                    <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Statut</th>
                    <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {blogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-charcoal/60 font-sans">Aucun blog trouvé.</td>
                    </tr>
                  ) : (
                    blogs.map((blog) => (
                      <tr key={blog.id} className="border-b border-charcoal/5 hover:bg-sand/10 transition-colors">
                        <td className="p-4 font-sans text-sm font-medium">{blog.title}</td>
                        <td className="p-4 font-sans text-sm text-charcoal/80">
                          {new Date(blog.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="p-4 font-sans text-sm">
                          <span className={`px-2 py-1 text-[10px] uppercase tracking-widest font-bold rounded-sm ${blog.published ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {blog.published ? 'Publié' : 'Brouillon'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setEditingBlog(blog);
                                setBlogFormData(blog);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="p-2 text-charcoal hover:bg-charcoal/10 rounded-sm transition-colors"
                              title="Modifier"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteBlog(blog.id)}
                              className="p-2 text-rose hover:bg-rose/10 rounded-sm transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-charcoal/10 rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-sand/30 border-b border-charcoal/10">
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Nom</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Email</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Téléphone</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Gouvernorat</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Commandes</th>
                  <th className="p-4 text-xs uppercase tracking-widest font-sans font-bold text-charcoal/60">Total Dépensé</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-charcoal/60 font-sans">Aucun client trouvé.</td>
                  </tr>
                ) : (
                  customers.map((customer, idx) => (
                    <tr key={idx} className="border-b border-charcoal/5 hover:bg-sand/10 transition-colors">
                      <td className="p-4 font-sans text-sm font-medium">{customer.name}</td>
                      <td className="p-4 font-sans text-sm text-charcoal/80">{customer.email || 'N/A'}</td>
                      <td className="p-4 font-sans text-sm text-charcoal/80">{customer.phone || 'N/A'}</td>
                      <td className="p-4 font-sans text-sm text-charcoal/80">{customer.gov || 'N/A'}</td>
                      <td className="p-4 font-sans text-sm">{customer.orderCount}</td>
                      <td className="p-4 font-sans font-bold">{customer.totalSpent} TND</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const CookieBanner = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', 'true');
    setIsVisible(false);
  };

  const declineCookies = () => {
    localStorage.setItem('cookieConsent', 'false');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-auto md:max-w-sm bg-charcoal text-cream p-5 z-[100] flex flex-col gap-4 shadow-2xl rounded-sm border border-cream/10">
      <div className="flex justify-between items-start gap-4">
        <div className="text-xs font-sans text-left leading-relaxed text-cream/90">
          Nous utilisons des cookies pour améliorer votre expérience, analyser le trafic et personnaliser le contenu.
        </div>
        <button onClick={declineCookies} className="text-cream/50 hover:text-cream shrink-0 p-1 -mt-1 -mr-1">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={acceptCookies}
          className="flex-1 bg-gold text-charcoal px-4 py-2.5 text-[10px] md:text-xs uppercase tracking-widest font-sans font-bold hover:bg-cream transition-colors rounded-sm"
        >
          Accepter
        </button>
        <button 
          onClick={declineCookies}
          className="flex-1 bg-transparent border border-cream/20 text-cream px-4 py-2.5 text-[10px] md:text-xs uppercase tracking-widest font-sans font-bold hover:bg-cream/10 transition-colors rounded-sm"
        >
          Refuser
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [currentLang, setCurrentLang] = useState<Language>('fr');
  const toggleLang = () => setCurrentLang(prev => prev === 'fr' ? 'en' : 'fr');

  const [currentView, setCurrentView] = useState<'home' | 'shop' | 'admin' | 'shipping' | 'care' | 'contact' | 'faq' | 'about' | 'blogs' | 'blog_post'>('home');
  const [currentBlog, setCurrentBlog] = useState<BlogPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Create user document if it doesn't exist
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || 'User',
              role: 'user',
              createdAt: new Date().toISOString()
            });
          } else {
            // Check if user is admin
            if (userDoc.data().role === 'admin') {
              setIsAdmin(true);
            }
          }
          
          // Fallback check for the initial admin email
          if (currentUser.email === ((import.meta as any).env.VITE_ADMIN_EMAIL || 'amine.nagatti@gmail.com')) {
             setIsAdmin(true);
          }
        } catch (error) {
          console.error("Error checking/creating user doc", error);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);
  const [cart, setCart] = useState<(Product & { selectedVariant?: ProductVariant })[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);

  useEffect(() => {
    if (!isAuthReady) return;

    const fetchProducts = async () => {
      try {
        const productsCol = collection(db, 'products');
        const productSnapshot = await getDocs(productsCol);
        
        if (productSnapshot.empty) {
          setProducts(PRODUCTS);
          
          // Attempt to seed products (will fail silently if not admin)
          if (user) {
            try {
              const batch = PRODUCTS.map(async (p) => {
                await setDoc(doc(db, 'products', p.id.toString()), p);
              });
              await Promise.all(batch);

              // Seed some reviews with Tunisian names
              const initialReviews = [
                { productId: 1, authorName: "Amira B.", rating: 5, text: "La Donna est magnifique ! La chaîne est d'une qualité exceptionnelle.", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
                { productId: 1, authorName: "Yassine T.", rating: 5, text: "Cadeau parfait pour ma femme, elle a adoré.", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
                { productId: 2, authorName: "Fatma M.", rating: 4, text: "Très beau design, livraison rapide à Sousse.", createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
                { productId: 3, authorName: "Sami K.", rating: 5, text: "Les couleurs sont parfaites pour l'été.", createdAt: new Date(Date.now() - 86400000 * 1).toISOString() },
                { productId: 4, authorName: "Nour H.", rating: 5, text: "La chaîne dorée est incroyable, je ne la quitte plus !", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() }
              ];
              const reviewBatch = initialReviews.map(async (r) => {
                await addDoc(collection(db, 'reviews'), r);
              });
              await Promise.all(reviewBatch);
            } catch (seedError) {
              console.warn("Skipping DB seed (insufficient permissions).");
            }
          }
        } else {
          const productList = productSnapshot.docs.map(doc => doc.data() as Product);
          setProducts(productList.sort((a, b) => a.id - b.id));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'products');
      }
    };

    const fetchBlogs = () => {
      const blogsCol = collection(db, 'blogs');
      const unsubscribe = onSnapshot(blogsCol, (snapshot) => {
        const blogList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
        setBlogs(blogList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      }, (error) => {
        console.error("Error fetching blogs:", error);
      });
      return unsubscribe;
    };

    fetchProducts();
    const unsubBlogs = fetchBlogs();

    return () => {
      unsubBlogs();
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    const handleOpenProduct = (e: CustomEvent<Product>) => {
      setSelectedProduct(e.detail);
    };
    window.addEventListener('openProduct', handleOpenProduct as EventListener);
    return () => window.removeEventListener('openProduct', handleOpenProduct as EventListener);
  }, []);

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const addToCart = (product: Product, quantity: number = 1, selectedVariant?: ProductVariant) => {
    if (product.variants && product.variants.length > 0 && !selectedVariant) {
      setSelectedProduct(product);
      return;
    }
    const itemToAdd = selectedVariant ? { ...product, selectedVariant } : product;
    const newItems = Array(quantity).fill(itemToAdd);
    setCart([...cart, ...newItems]);
    addToast(`${quantity}x ${product.name} ajouté au panier`);
    setTimeout(() => {
      setIsCartOpen(true);
    }, 500);
  };

  useEffect(() => {
    if (isAuthReady && user && products.length > 0) {
      const unsubscribe = onSnapshot(doc(db, 'wishlists', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const itemIds = docSnap.data().items as number[];
          const userWishlist = products.filter(p => itemIds.includes(p.id));
          setWishlist(userWishlist);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `wishlists/${user.uid}`);
      });
      return () => unsubscribe();
    } else if (isAuthReady && !user) {
      setWishlist([]);
    }
  }, [user, isAuthReady, products]);

  const toggleWishlist = async (product: Product) => {
    const exists = wishlist.some(p => p.id === product.id);
    let newWishlist;
    if (exists) {
      addToast(`${product.name} retiré de la wishlist`);
      newWishlist = wishlist.filter(p => p.id !== product.id);
    } else {
      addToast(`${product.name} ajouté à la wishlist`);
      newWishlist = [...wishlist, product];
    }
    
    setWishlist(newWishlist);

    if (user) {
      try {
        await setDoc(doc(db, 'wishlists', user.uid), {
          userId: user.uid,
          items: newWishlist.map(p => p.id),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `wishlists/${user.uid}`);
      }
    }
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleCheckoutSuccess = () => {
    setCart([]);
    addToast("Commande confirmée avec succès !");
  };

  const t = translations[currentLang];

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      addToast("Erreur lors de la connexion");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setWishlist([]);
      addToast("Déconnecté avec succès");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLang, toggleLang }}>
      <div className="min-h-screen bg-cream text-charcoal font-body selection:bg-gold/30">
        <GrainOverlay />
        <CookieBanner />
        <ToastContainer toasts={toasts} />
        <Navbar 
          cartCount={cart.length} 
          wishlistCount={wishlist.length}
          onCartOpen={() => setIsCartOpen(true)} 
          onWishlistOpen={() => setIsWishlistOpen(true)}
          onNavigate={(view) => {
            setCurrentView(view);
            setSelectedProduct(null);
            if (view === 'home') {
              window.scrollTo(0, 0);
            }
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          user={user}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
        <CartDrawer 
          isOpen={isCartOpen} 
          onClose={() => setIsCartOpen(false)} 
          cart={cart}
          onRemove={removeFromCart}
          onCheckout={() => setIsCheckoutOpen(true)}
        />
        <WishlistDrawer
          isOpen={isWishlistOpen}
          onClose={() => setIsWishlistOpen(false)}
          wishlist={wishlist}
          onRemove={(id) => setWishlist(prev => prev.filter(p => p.id !== id))}
          onAddToCart={(p) => addToCart(p, 1)}
        />
        <CheckoutOverlay 
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cart={cart}
          onSuccess={handleCheckoutSuccess}
          addToast={addToast}
          user={user}
        />
        <main>
          <AnimatePresence mode="wait">
            {selectedProduct ? (
              <ProductPage 
                key="product-page"
                product={selectedProduct} 
                products={products}
                onClose={() => setSelectedProduct(null)} 
                onAdd={(qty, variant) => addToCart(selectedProduct, qty, variant)} 
                isWishlisted={wishlist.some(p => p.id === selectedProduct.id)}
                onToggleWishlist={() => toggleWishlist(selectedProduct)}
              />
            ) : currentView === 'blogs' ? (
              <motion.div
                key="blogs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="pt-32 pb-24 px-6 md:px-12 max-w-7xl mx-auto min-h-screen"
              >
                <div className="text-center mb-16">
                  <h1 className="text-4xl md:text-5xl font-display text-charcoal mb-4">Le Journal</h1>
                  <p className="text-charcoal/60 font-body">Découvrez nos derniers articles, conseils et inspirations.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {blogs.filter(b => b.published).map((blog) => (
                    <div 
                      key={blog.id} 
                      className="group cursor-pointer border border-charcoal/10 hover:border-charcoal/30 transition-colors bg-white"
                      onClick={() => {
                        setCurrentBlog(blog);
                        setCurrentView('blog_post');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <div className="p-8">
                        <p className="text-xs text-charcoal/50 font-sans mb-4">
                          {new Date(blog.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <h2 className="text-2xl font-display text-charcoal mb-4 group-hover:text-gold transition-colors line-clamp-2">
                          {blog.title}
                        </h2>
                        <p className="text-charcoal/70 font-body line-clamp-3 mb-6">
                          {blog.content}
                        </p>
                        <span className="text-xs uppercase tracking-widest font-sans font-bold text-charcoal group-hover:text-gold transition-colors inline-flex items-center gap-2">
                          Lire l'article <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  ))}
                  {blogs.filter(b => b.published).length === 0 && (
                    <div className="col-span-full text-center py-12 text-charcoal/60 font-body">
                      Aucun article n'a été publié pour le moment.
                    </div>
                  )}
                </div>
              </motion.div>
            ) : currentView === 'blog_post' && currentBlog ? (
              <motion.div
                key="blog_post"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="pt-32 pb-24 px-6 md:px-12 max-w-4xl mx-auto min-h-screen"
              >
                <div className="mb-12 text-center">
                  <p className="text-sm text-charcoal/60 font-sans mb-4">
                    {new Date(currentBlog.date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <h1 className="text-4xl md:text-5xl font-display text-charcoal mb-8">{currentBlog.title}</h1>
                </div>
                <div className="max-w-3xl mx-auto font-body text-charcoal/80 text-lg">
                  {currentBlog.content.split('\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-6 leading-relaxed">{paragraph}</p>
                  ))}
                </div>
                <div className="mt-16 pt-8 border-t border-charcoal/10 text-center">
                  <button 
                    onClick={() => {
                      setCurrentView('home');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-sm uppercase tracking-widest font-sans font-bold text-charcoal hover:text-gold transition-colors"
                  >
                    Retour à l'accueil
                  </button>
                </div>
              </motion.div>
            ) : currentView === 'shop' ? (
              <ShopPage 
                key="shop-page"
                products={products}
                onProductOpen={(p) => setSelectedProduct(p)}
                onAddToCart={(p) => addToCart(p, 1)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                wishlist={wishlist}
                onToggleWishlist={toggleWishlist}
              />
            ) : currentView === 'admin' ? (
              isAdmin ? (
                <AdminDashboard products={products} blogs={blogs} addToast={addToast} />
              ) : (
                <div className="pt-48 pb-24 px-6 text-center min-h-screen max-w-md mx-auto">
                  <h1 className="text-3xl font-display italic mb-6">Accès Restreint</h1>
                  <p className="mb-8 text-charcoal/70 font-body">Veuillez vous connecter avec un compte administrateur autorisé pour accéder au tableau de bord.</p>
                  <button onClick={handleLogin} className="bg-charcoal text-cream px-8 py-3 text-xs uppercase tracking-widest font-sans font-bold hover:bg-gold transition-colors w-full">
                    Se connecter avec Google
                  </button>
                </div>
              )
            ) : currentView === 'shipping' ? (
              <ShippingReturns />
            ) : currentView === 'care' ? (
              <CareGuide />
            ) : currentView === 'contact' ? (
              <ContactUs />
            ) : currentView === 'faq' ? (
              <FAQ />
            ) : currentView === 'about' ? (
              <AboutUs />
            ) : (
              <motion.div 
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Hero />
                <Marquee />
                <ShopSection 
                  products={products}
                  onProductOpen={(p) => setSelectedProduct(p)} 
                  onAddToCart={addToCart}
                  wishlist={wishlist}
                  onToggleWishlist={toggleWishlist}
                />
                <StorySection onNavigate={(view) => setCurrentView(view)} />
                
                {/* Community Section */}
                <section id="contact" className="py-24 px-6 md:px-12 bg-sand/30 border-t border-charcoal/5">
                  <div className="max-w-4xl mx-auto text-center bg-cream/50 p-8 md:p-12 rounded-sm border border-charcoal/5 shadow-sm">
                    <h2 className="text-3xl md:text-5xl font-display italic text-charcoal mb-6">Rejoignez la Communauté</h2>
                    <p className="text-charcoal/60 font-body mb-8 text-lg max-w-2xl mx-auto">
                      Découvrez nos nouveautés, plongez dans notre univers et partagez vos looks avec nous sur vos réseaux préférés.
                    </p>
                    <a href="mailto:hello@mylunaria.tn" className="inline-block text-xl md:text-2xl font-display italic hover:text-gold transition-colors mb-12">hello@mylunaria.tn</a>
                    
                    <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-4">
                      <a href="https://www.instagram.com/mylunariatn/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-8 py-4 border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream transition-all rounded-full min-w-[200px] justify-center group bg-cream">
                        <Instagram size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-sans text-xs uppercase tracking-widest font-semibold">Instagram</span>
                      </a>
                      <a href="https://www.tiktok.com/@mylunariatn" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-8 py-4 border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream transition-all rounded-full min-w-[200px] justify-center group bg-cream">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                        </svg>
                        <span className="font-sans text-xs uppercase tracking-widest font-semibold">TikTok</span>
                      </a>
                      <a href="https://www.facebook.com/myLunaria/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-8 py-4 border border-charcoal text-charcoal hover:bg-charcoal hover:text-cream transition-all rounded-full min-w-[200px] justify-center group bg-cream">
                        <Facebook size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="font-sans text-xs uppercase tracking-widest font-semibold">Facebook</span>
                      </a>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Footer 
          isAdmin={isAdmin}
          user={user}
          onLogin={handleLogin}
          onLogout={handleLogout}
          blogs={blogs}
          onNavigate={(view) => {
            setCurrentView(view as any);
            setSelectedProduct(null);
            setCurrentBlog(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} 
        />
      </div>
    </LanguageContext.Provider>
  );
}


