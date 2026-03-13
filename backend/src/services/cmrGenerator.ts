import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generates a CMR Document PDF
 * MVP stub implementation.
 * Outputs to /tmp/ or a configured storage dir in real-world scenarios.
 */
export const generateCMR = (bookingData: any, outputPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(outputPath);

      doc.pipe(writeStream);

      // Add basic CMR content
      doc.fontSize(20).text('CMR Transport Document', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Booking Reference: ${bookingData.id || 'N/A'}`);
      doc.text(`Carrier: ${bookingData.carrier_name || 'N/A'}`);
      doc.text(`Shipper: ${bookingData.shipper_name || 'N/A'}`);
      
      doc.moveDown();
      doc.text(`Origin: ${bookingData.origin_address || 'N/A'}`);
      doc.text(`Destination: ${bookingData.destination_address || 'N/A'}`);
      doc.text(`Cargo Weight: ${bookingData.weight_kg || '0'} kg`);

      doc.end();

      writeStream.on('finish', () => {
        resolve(outputPath);
      });
      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
};
