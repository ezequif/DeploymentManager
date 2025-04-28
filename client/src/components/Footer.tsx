import { useWebSocket } from "../lib/websocket";
import { formatElapsedTime } from "../lib/formatUtils";

export default function Footer() {
  const { userCount, lastSync } = useWebSocket();
  
  return (
    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          <span id="userCount" className="font-medium">{userCount} {userCount === 1 ? 'user' : 'users'}</span> connected
        </div>
        <div className="text-sm text-gray-600">
          Last sync: <span id="lastSync" className="font-medium">{formatElapsedTime(lastSync)}</span>
        </div>
      </div>
    </footer>
  );
}
