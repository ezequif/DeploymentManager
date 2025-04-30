import JsBarcode from 'jsbarcode';
import { createRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { isMobileOrTablet } from './deviceDetection';

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

// Print the label with support for both desktop and mobile devices
export function printPalletLabel(palletId: string, rmNumber: string, location: string): void {
  // Display a success message first
  toast({
    title: "Preparing Label",
    description: `Preparing pallet ${palletId} label for printing...`,
  });
  
  const isMobile = isMobileOrTablet();
  console.log("Device is mobile or tablet:", isMobile);
  
  // Create a temporary div to hold our print content
  const printDiv = document.createElement('div');
  printDiv.id = 'print-container';
  printDiv.style.position = 'absolute';
  printDiv.style.left = '-9999px';
  printDiv.style.top = '-9999px';
  document.body.appendChild(printDiv);
  
  try {
    // Create the label
    const label = createPalletLabel(palletId, rmNumber, location);
    printDiv.appendChild(label);
    
    // Prepare the print content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Pallet Label - ${palletId}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: 8in 2.5in;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
            }
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .label-container {
              width: 8in;
              height: 2.5in;
              box-sizing: border-box;
              border: 1px solid #ccc;
              page-break-inside: avoid;
            }
            .instructions {
              margin: 20px;
              padding: 15px;
              background-color: #f0f0f0;
              border-radius: 5px;
              max-width: 600px;
              display: ${isMobile ? 'block' : 'none'};
            }
            @media print {
              .instructions { 
                display: none; 
              }
              .label-container {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          ${isMobile ? `
            <div class="instructions">
              <h3>Mobile Device Detected</h3>
              <p>On mobile devices, you can:</p>
              <ul>
                <li>Take a screenshot of this label</li>
                <li>Save it to your photos</li>
                <li>Print it later from a computer</li>
                <li>Or use the print option in your browser if available</li>
              </ul>
              <p><strong>Tap the label to toggle fullscreen view</strong></p>
            </div>
          ` : ''}
          <div class="label-container">${printDiv.innerHTML}</div>
          <script>
            // For mobile: toggle fullscreen on tap
            document.querySelector('.label-container').addEventListener('click', function() {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                  console.log('Error attempting to enable fullscreen:', err);
                });
              } else {
                if (document.exitFullscreen) {
                  document.exitFullscreen();
                }
              }
            });
            
            // Auto-print on desktop
            ${!isMobile ? `
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  // Don't close immediately to allow for manual printing if auto-print fails
                }, 1000);
              };
            ` : ''}
          </script>
        </body>
      </html>
    `;
    
    // Create a new window for displaying/printing
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // For desktop browsers: focus and trigger print
      if (!isMobile) {
        // Give the browser a moment to render the new window
        setTimeout(() => {
          try {
            printWindow.focus();
            
            toast({
              title: "Print Dialog Opened",
              description: `Print dialog for pallet ${palletId} should now be open.`,
            });
          } catch (error) {
            console.error('Error focusing print window:', error);
            toast({
              title: "Printing Error",
              description: "Failed to open print dialog. Please try again or check browser settings.",
              variant: "destructive",
            });
          }
        }, 500);
      } else {
        // For mobile devices: just show a success message
        toast({
          title: "Label Ready",
          description: `Pallet ${palletId} label is now displayed in a new tab.`,
        });
      }
    } else {
      // If window.open failed (likely due to popup blocker)
      toast({
        title: "Popup Blocked",
        description: "Popup blocker prevented opening the label window. Please allow popups for this site and try again.",
        variant: "destructive",
      });
    }
  } catch (error) {
    console.error('Error in print process:', error);
    toast({
      title: "Error",
      description: "An unexpected error occurred during label preparation.",
      variant: "destructive",
    });
  } finally {
    // Clean up
    if (printDiv && printDiv.parentNode) {
      printDiv.parentNode.removeChild(printDiv);
    }
  }
}
