import React, { useState, useEffect, useRef } from 'react';
import { PalletWithLots, Lot } from '@shared/schema';
import { useWebSocket } from '@/lib/websocket';
import { isTC70 } from '@/lib/deviceDetection';
import { formatDate, formatQuantity } from '@/lib/formatUtils';
import { QrCode } from 'lucide-react';
import { useKeyboard } from '@/hooks/use-keyboard';

/**
 * A simplified UI specifically optimized for TC70 handheld devices and other low-power devices
 * This component provides a minimal, high-contrast interface focused on performance
 * with reduced animations, simpler rendering, and optimized for older browsers
 */
interface SimplifiedMobileUIProps {
  onSwitchToStandardUI?: () => void;
}

export function SimplifiedMobileUI({ onSwitchToStandardUI }: SimplifiedMobileUIProps) {
  // Force sync data when component loads - essential for TC70 devices
  // that might not support WebSockets properly
  const { pallets, syncData, connected, lastSync } = useWebSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPallet, setSelectedPallet] = useState<PalletWithLots | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Detect keyboard opening/closing to adjust layout
  const isKeyboardOpen = useKeyboard();
  
  // When keyboard opens, scroll the input into view
  useEffect(() => {
    if (isKeyboardOpen && contentRef.current) {
      // Scroll to make sure input is visible
      setTimeout(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [isKeyboardOpen]);
  
  // When first loaded, trigger a data sync
  useEffect(() => {
    syncData();
  }, [syncData]);
  
  // Filter pallets based on search query
  const filteredPallets = pallets.filter(pallet => {
    const query = searchQuery.toLowerCase();
    return (
      pallet.palletId.toLowerCase().includes(query) ||
      pallet.rmNumber.toLowerCase().includes(query) || 
      pallet.location.toLowerCase().includes(query)
    );
  });
  
  if (selectedPallet) {
    return (
      <div className="p-2 bg-white">
        <div className="mb-2 border-b pb-2">
          <button 
            onClick={() => setSelectedPallet(null)}
            className="px-4 py-2 bg-gray-200 font-bold rounded mb-2 w-full text-left"
          >
            &lt; Back to List
          </button>
          <h2 className="text-xl font-bold">Pallet: {selectedPallet.palletId}</h2>
          <p className="text-lg">RM#: {selectedPallet.rmNumber}</p>
          <p className="text-lg">Location: {selectedPallet.location}</p>
        </div>
        
        <h3 className="text-lg font-bold mb-2">Lots ({selectedPallet.lots.length})</h3>
        
        {selectedPallet.lots.length === 0 ? (
          <div className="p-2 bg-gray-100 text-center">
            No lots on this pallet
          </div>
        ) : (
          <div className="space-y-2">
            {selectedPallet.lots.map(lot => (
              <LotItem key={lot.id} lot={lot} />
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={`p-2 bg-white min-h-screen ${isKeyboardOpen ? 'pb-40' : ''}`}>
      <div 
        ref={contentRef} 
        className="content-area"
      >
        <div className="sticky-header sticky top-0 bg-white z-10 pb-2">
          <h1 className="text-xl font-bold mb-2">Warehouse Inventory</h1>
          
          <div className="relative mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={(e) => {
                // On mobile, scroll the input into view when focused
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }}
              placeholder="Search Pallet ID, RM#, Location..."
              className="w-full p-2 border rounded text-base"
              inputMode="search"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {searchQuery && (
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
          
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>{filteredPallets.length} pallets</span>
            </div>
            <button 
              onClick={syncData}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center gap-1"
            >
              <span className="inline-block">↻</span>
              <span>Refresh</span>
            </button>
          </div>
          
          <div className="text-xs text-gray-500 mb-2">
            Last updated: {lastSync ? new Date(lastSync).toLocaleTimeString() : 'Never'}
          </div>
          
          <button 
            onClick={() => window.openScanPalletModal?.()}
            className="w-full p-2 bg-orange-500 text-white rounded flex items-center justify-center gap-2 mb-2"
          >
            <QrCode size={20} />
            <span>Scan Pallet</span>
          </button>
        </div>
        
        {filteredPallets.length === 0 ? (
          <div className="p-4 text-center bg-gray-50 rounded">
            {searchQuery ? (
              <p>No pallets match your search</p>
            ) : (
              <p>No pallets found</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPallets.map(pallet => (
              <PalletItem 
                key={pallet.id} 
                pallet={pallet} 
                onClick={() => setSelectedPallet(pallet)} 
              />
            ))}
          </div>
        )}
        
        {/* Button to switch to standard UI */}
        {onSwitchToStandardUI && (
          <div className="mt-4 border-t pt-2">
            <button
              onClick={onSwitchToStandardUI}
              className="w-full p-2 bg-gray-200 rounded text-center text-gray-700"
            >
              Switch to Standard Interface
            </button>
            <p className="text-xs text-gray-500 mt-1 text-center">
              If you're having issues with this simplified interface, you can switch to the standard interface.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PalletItem({ pallet, onClick }: { pallet: PalletWithLots; onClick: () => void }) {
  const totalQuantity = pallet.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const lotCount = pallet.lots.length;
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 border rounded bg-gray-50 focus:bg-blue-50 active:bg-blue-100"
    >
      <div className="flex justify-between">
        <span className="font-bold">{pallet.palletId}</span>
        <span className="text-sm">{lotCount} lots</span>
      </div>
      <div className="text-sm truncate">RM# {pallet.rmNumber}</div>
      <div className="text-sm truncate">Location: {pallet.location}</div>
      <div className="text-sm font-medium">
        {totalQuantity > 0 ? `Total: ${formatQuantity(totalQuantity)}` : 'Empty'}
      </div>
    </button>
  );
}

function LotItem({ lot }: { lot: Lot }) {
  return (
    <div className="p-3 border rounded bg-gray-50">
      <div className="flex justify-between">
        <span className="font-bold">{lot.lotNumber}</span>
        <span className="font-medium">{formatQuantity(lot.quantity)} {lot.unit}</span>
      </div>
      <div className="text-sm">Expires: {formatDate(lot.expirationDate)}</div>
      <div className="text-sm text-gray-500">Created: {formatDate(lot.createdAt)}</div>
    </div>
  );
}