import { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import { useLocation } from "wouter";
import { LayoutGrid, History, Settings } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-t-lg border-b border-gray-200">
          <div className="flex overflow-x-auto">
            <a 
              href="/" 
              className={`px-6 py-4 font-medium flex items-center ${location === '/' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <span className="material-icons mr-2">view_list</span>
              Pallets
            </a>
            <a 
              href="/history" 
              className={`px-6 py-4 font-medium flex items-center ${location === '/history' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <span className="material-icons mr-2">history</span>
              History
            </a>
            <a 
              href="/settings" 
              className={`px-6 py-4 font-medium flex items-center ${location === '/settings' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <span className="material-icons mr-2">settings</span>
              Settings
            </a>
          </div>
        </div>
        
        {children}
      </main>
      
      <Footer />
    </div>
  );
}
