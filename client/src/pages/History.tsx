import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "../lib/formatUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function History() {
  const { data: transactions, isLoading, error } = useQuery({
    queryKey: ['/api/transactions']
  });
  
  if (isLoading) {
    return (
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
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
            <CardTitle>Transaction History</CardTitle>
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
          <CardTitle>Transaction History</CardTitle>
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
                  {transactions.map((transaction: any) => (
                    <tr key={transaction.id}>
                      <td className="px-3 py-3 text-sm text-gray-900">{formatDateTime(transaction.createdAt)}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">{transaction.lotId}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          transaction.transactionType === 'pick' ? 'bg-secondary/20 text-secondary-dark' :
                          transaction.transactionType === 'add' ? 'bg-success/20 text-success' :
                          transaction.transactionType === 'return' ? 'bg-primary/20 text-primary-dark' :
                          'bg-gray-200 text-gray-800'
                        }`}>
                          {transaction.transactionType}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900">{transaction.quantity}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">{transaction.destination || '-'}</td>
                      <td className="px-3 py-3 text-sm text-gray-900">{transaction.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="material-icons text-gray-400 text-5xl mb-3">history</span>
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
