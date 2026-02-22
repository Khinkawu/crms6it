import { useState } from "react";
import { Product } from "@/types";
import toast from "react-hot-toast";

interface UseQRBulkActionsProps {
    products: Product[];
    filteredProducts: Product[];
    selectedProductIds: Set<string>;
}

export function useQRBulkActions({ products, filteredProducts, selectedProductIds }: UseQRBulkActionsProps) {
    const [isDownloading, setIsDownloading] = useState(false);

    const getTargetItems = () => {
        return selectedProductIds.size > 0
            ? products.filter(p => p.id && selectedProductIds.has(p.id))
            : filteredProducts;
    };

    const handleBulkPrint = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (!printWindow) return;

        const origin = window.location.origin;
        const qrCodeUrl = (id: string) =>
            `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${origin}/product/${id}`)}`;

        const items = getTargetItems();

        const htmlContent = `
            <html>
                <head>
                    <title>Print QR Codes</title>
                    <style>
                        body { font-family: 'Sarabun', sans-serif; padding: 20px; }
                        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 15px; }
                        .card { 
                            border: 2px solid #000; 
                            padding: 10px; 
                            text-align: center; 
                            border-radius: 8px; 
                            page-break-inside: avoid;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                        }
                        img { width: 100px; height: 100px; display: block; margin-bottom: 5px; }
                        .name { font-size: 14px; font-weight: bold; line-height: 1.2; margin-bottom: 2px; }
                        .id { font-size: 10px; color: #555; font-family: monospace; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <h1 class="no-print">QR Codes (${items.length} items)</h1>
                    <button class="no-print" onclick="window.print()" style="padding: 10px 20px; margin-bottom: 20px; cursor: pointer; font-size: 16px;">Print Now</button>
                    <div class="grid">
                        ${items.map(p => `
                            <div class="card">
                                <img src="${qrCodeUrl(p.id!)}" alt="QR Code" />
                                <div class="name">${p.name}</div>
                                <div class="id">${p.stockId || p.id}</div>
                            </div>
                        `).join('')}
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handleBulkDownload = async () => {
        setIsDownloading(true);
        try {
            const JSZip = (await import('jszip')).default;
            const { saveAs } = await import('file-saver');

            const zip = new JSZip();
            const origin = window.location.origin;
            const items = getTargetItems();

            if (items.length === 0) {
                toast.error("No items to download");
                return;
            }

            const promises = items.map(async (p) => {
                if (!p.id) return;
                try {
                    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${origin}/product/${p.id}`)}`;
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const safeName = p.name.replace(/[^a-z0-9]/gi, '_').slice(0, 20);
                    zip.file(`${safeName}_${p.stockId || p.id}.png`, blob);
                } catch (err) {
                    console.error("Failed to fetch QR for", p.name, err);
                }
            });

            await Promise.all(promises);

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `qr_codes_${new Date().toISOString().slice(0, 10)}.zip`);
            toast.success("Downloaded QR Codes");
        } catch (error) {
            console.error("Bulk download error:", error);
            toast.error("Failed to create zip file");
        } finally {
            setIsDownloading(false);
        }
    };

    return { handleBulkPrint, handleBulkDownload, isDownloading };
}
