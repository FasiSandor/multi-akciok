'use client';

import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export function CodeDisplay({ value, format, large = false }: { value: string; format: 'qr' | 'barcode'; large?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!value) return;
    try {
      if (format === 'barcode' && svgRef.current) {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          displayValue: large,
          margin: 0,
          height: large ? 110 : 42,
          width: large ? 2.4 : 1.4,
          fontSize: 16,
          background: '#ffffff',
          lineColor: '#071a36'
        });
      }
      if (format === 'qr' && canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, value, {
          width: large ? 260 : 74,
          margin: 0,
          errorCorrectionLevel: 'M',
          color: { dark: '#071a36', light: '#ffffff' }
        }).catch(() => setFailed(true));
      }
    } catch {
      setFailed(true);
    }
  }, [value, format, large]);

  if (failed) return <span className="code-fallback">{value}</span>;
  return format === 'qr' ? <canvas ref={canvasRef} className={large ? 'qr-large' : 'qr-small'} /> : <svg ref={svgRef} className={large ? 'barcode-large' : 'barcode-small'} />;
}
