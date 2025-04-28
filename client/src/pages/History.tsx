import { useQuery } from "@tanstack/react-query";
import { formatDateTime, formatQuantity } from "../lib/formatUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClockIcon, HistoryIcon } from "lucide-react";
import { Transaction, PalletWithLots, TransactionType } from "@shared/schema";

// Extend the Transaction type to include unit
type TransactionWithUnit = Transaction & { 
  unit?: string;
  transactionType: TransactionType; 
};

export default function History() {
  const { data: transactions, isLoading, error } = useQuery<TransactionWithUnit[]>({
    queryKey: ['/api/transactions']
  });
  
  const { data: pallets } = useQuery<PalletWithLots[]>({
    queryKey: ['/api/pallets'],
    // We use this to get lot information to display unit
  });
  
  // Function to find the lot and unit for a transaction
  const getUnitForTransaction = (transaction: Transaction) => {
    if (!pallets || !Array.isArray(pallets)) return undefined;
    
    let unit: string | undefined;
    
    pallets.forEach((pallet: PalletWithLots) => {
      pallet.lots.forEach(lot => {
        if (lot.id === transaction.lotId) {
          unit = lot.unit;
        }
      });
    });
    
    return unit;
  };
  
  if (isLoading) {
    return (
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              <span>Transaction History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              <span>Transaction History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              <div className="flex items-center">
                <span className="material-icons mr-2">error</span>
                <span className="font-medium">Error loading transaction history</span>
              </div>
              <p className="mt-1 text-sm">
                {(error as Error).message}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" />
            <span>Transaction History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot ID</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction: TransactionWithUnit) => {
                    const unit = getUnitForTransaction(transaction);
                    
                    return (
                      <tr key={transaction.id}>
                        <td className="px-3 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <ClockIcon className="h-3 w-3 text-gray-400" />
                            <span>{formatDateTime(transaction.createdAt)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900">{transaction.lotId}</td>
                        <td className="px-3 py-3 text-sm text-gray-900">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            transaction.transactionType === 'pick' ? 'bg-orange-100 text-orange-800' :
                            transaction.transactionType === 'add' ? 'bg-green-100 text-green-800' :
                            transaction.transactionType === 'return' ? 'bg-blue-100 text-blue-800' :
                            transaction.transactionType === 'edit' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {transaction.transactionType}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">
                          {formatQuantity(transaction.quantity)} {unit || ''}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900">{transaction.destination || '-'}</td>
                        <td className="px-3 py-3 text-sm text-gray-900">{transaction.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <HistoryIcon className="h-16 w-16 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-800 mb-1">No transaction history</h3>
              <p className="text-gray-500">
                Transaction records will appear here once you start working with pallets and lots.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
