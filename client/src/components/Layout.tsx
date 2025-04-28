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
              <LayoutGrid className="h-5 w-5 mr-2" />
              Pallets
            </a>
            <a 
              href="/history" 
              className={`px-6 py-4 font-medium flex items-center ${location === '/history' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <History className="h-5 w-5 mr-2" />
              History
            </a>
            <a 
              href="/settings" 
              className={`px-6 py-4 font-medium flex items-center ${location === '/settings' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <Settings className="h-5 w-5 mr-2" />
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
