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
      
      <main className="flex-grow container mx-auto px-2 sm:px-4 py-2 sm:py-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-t-lg border-b border-gray-200">
          <div className="flex overflow-x-auto">
            <a 
              href="/" 
              className={`px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium flex items-center ${location === '/' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="whitespace-nowrap">Pallets</span>
            </a>
            <a 
              href="/history" 
              className={`px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium flex items-center ${location === '/history' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <History className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="whitespace-nowrap">History</span>
            </a>
            <a 
              href="/settings" 
              className={`px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium flex items-center ${location === '/settings' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-primary'}`}
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="whitespace-nowrap">Settings</span>
            </a>
          </div>
        </div>
        
        {children}
      </main>
      
      <Footer />
    </div>
  );
}
