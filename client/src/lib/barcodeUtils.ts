import JsBarcode from 'jsbarcode';
import { createRef } from 'react';
import { toast } from '@/hooks/use-toast';

// Generate barcode SVG element
export function generateBarcodeSVG(value: string): SVGSVGElement {
  const svgRef = createRef<SVGSVGElement>();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  
  JsBarcode(svg, value, {
    format: 'CODE128',
    displayValue: true,
    fontSize: 14,
    height: 50,
    margin: 10,
  });
  
  return svg;
}

// Create printable pallet label (8" x 2.5")
export function createPalletLabel(palletId: string, rmNumber: string, location: string): HTMLDivElement {
  // Create container
  const container = document.createElement('div');
  container.style.width = '8in';
  container.style.height = '2.5in';
  container.style.padding = '0.25in';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.boxSizing = 'border-box';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '0.25in';
  
  // Create header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  
  // Create pallet ID header
  const palletIdHeader = document.createElement('div');
  palletIdHeader.style.fontSize = '24pt';
  palletIdHeader.style.fontWeight = 'bold';
  palletIdHeader.textContent = palletId;
  
  // Create date
  const dateDiv = document.createElement('div');
  dateDiv.style.fontSize = '12pt';
  dateDiv.textContent = new Date().toLocaleDateString();
  
  header.appendChild(palletIdHeader);
  header.appendChild(dateDiv);
  
  // Create info section
  const infoSection = document.createElement('div');
  infoSection.style.display = 'flex';
  infoSection.style.gap = '0.5in';
  
  // Create RM number
  const rmDiv = document.createElement('div');
  rmDiv.innerHTML = `<strong>RM#:</strong> ${rmNumber}`;
  rmDiv.style.fontSize = '14pt';
  
  // Create location
  const locationDiv = document.createElement('div');
  locationDiv.innerHTML = `<strong>Location:</strong> ${location}`;
  locationDiv.style.fontSize = '14pt';
  
  infoSection.appendChild(rmDiv);
  infoSection.appendChild(locationDiv);
  
  // Create barcode
  const barcodeDiv = document.createElement('div');
  barcodeDiv.style.flex = '1';
  barcodeDiv.style.display = 'flex';
  barcodeDiv.style.justifyContent = 'center';
  barcodeDiv.style.alignItems = 'center';
  
  const svg = generateBarcodeSVG(palletId);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  
  barcodeDiv.appendChild(svg);
  
  // Assemble the label
  container.appendChild(header);
  container.appendChild(infoSection);
  container.appendChild(barcodeDiv);
  
  return container;
}

// Print the label - even more direct approach
export function printPalletLabel(palletId: string, rmNumber: string, location: string): void {
  // Display a success message first
  toast({
    title: "Preparing Label",
    description: `Preparing pallet ${palletId} label for printing...`,
  });

  // Create a temporary div to hold our print content
  const printDiv = document.createElement('div');
  printDiv.id = 'print-container';
  printDiv.style.position = 'absolute';
  printDiv.style.left = '-9999px';
  printDiv.style.top = '-9999px';
  document.body.appendChild(printDiv);
  
  // Store the current body content
  const originalContent = document.body.innerHTML;
  
  try {
    // Create the label
    const label = createPalletLabel(palletId, rmNumber, location);
    printDiv.appendChild(label);
    
    // Replace the entire body with just our print content
    const printContent = `
      <html>
        <head>
          <title>Print Pallet Label - ${palletId}</title>
          <style>
            @page {
              size: 8in 2.5in;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            @media print {
              body {
                width: 8in;
                height: 2.5in;
              }
            }
          </style>
        </head>
        <body>
          ${printDiv.innerHTML}
        </body>
      </html>
    `;
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Give the browser a moment to render the new window
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          
          // Close the print window after printing or after a timeout
          setTimeout(() => {
            try {
              printWindow.close();
            } catch (e) {
              console.error('Error closing print window:', e);
            }
          }, 1000);
          
          toast({
            title: "Print Dialog Opened",
            description: `Print dialog for pallet ${palletId} should now be open.`,
          });
        } catch (error) {
          console.error('Error printing:', error);
          toast({
            title: "Printing Error",
            description: "Failed to open print dialog. Please try again or check browser settings.",
            variant: "destructive",
          });
        }
      }, 500);
    } else {
      // If window.open failed (likely due to popup blocker)
      toast({
        title: "Printing Blocked",
        description: "Popup blocker prevented opening the print window. Please allow popups for this site and try again.",
        variant: "destructive",
      });
    }
  } catch (error) {
    console.error('Error in print process:', error);
    toast({
      title: "Printing Error",
      description: "An unexpected error occurred during print preparation.",
      variant: "destructive",
    });
  } finally {
    // Clean up
    if (printDiv && printDiv.parentNode) {
      printDiv.parentNode.removeChild(printDiv);
    }
  }
}
