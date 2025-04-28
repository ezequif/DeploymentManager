import { useWebSocket } from "../lib/websocket";

export default function Header() {
  const { connected } = useWebSocket();
  
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="material-icons text-3xl">inventory</span>
          <h1 className="text-xl font-bold">Warehouse Pallet System</h1>
        </div>
        <div className="flex items-center">
          <div className={`${connected ? 'bg-success' : 'bg-destructive'} text-white px-3 py-2 rounded-lg font-medium flex items-center`}>
            <span className="material-icons mr-1">sync</span>
            <span className="hidden sm:inline">{connected ? 'Synced' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
