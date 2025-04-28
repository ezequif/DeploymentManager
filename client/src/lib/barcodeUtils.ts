import JsBarcode from 'jsbarcode';
import { createRef } from 'react';

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

// Print the label
export function printPalletLabel(palletId: string, rmNumber: string, location: string): void {
  const label = createPalletLabel(palletId, rmNumber, location);
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(`
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
          </style>
        </head>
        <body>
          ${label.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  }
}
