/**
 * Genera un Blob de imagen JPEG con el ticket térmico de la apuesta dibujado en un Canvas HTML5.
 * Es completamente síncrono en el cliente, ultra rápido y sin llamadas de red.
 *
 * @param {Object} bet - Datos de la apuesta (BetResource o similar)
 * @returns {Promise<Blob>}
 */
export function generateTicketImageBlob(bet) {
  return new Promise((resolve, reject) => {
    try {
      const scale = 2; // Factor de escala para resolución retina nítida
      const baseWidth = 360;
      const width = baseWidth * scale;

      const sequence = bet?.sequence || '000000';
      const pasador = bet?.user?.name || 'Agencia';

      let dateStr = '';
      if (bet?.created_at) {
        const d = new Date(bet.created_at);
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = String(d.getFullYear()).slice(-2);
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;
        }
      }
      if (!dateStr) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(-2);
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;
      }

      const draws = Array.isArray(bet?.draws) && bet.draws.length > 0
        ? bet.draws
        : (bet?.draw ? [bet.draw] : [{ id: 1, name: 'Sorteo' }]);

      const drawLotteries = Array.isArray(bet?.draw_lotteries) ? bet.draw_lotteries : [];
      const fallbackLotteries = Array.isArray(bet?.lotteries) ? bet.lotteries : [];

      const items = Array.isArray(bet?.items) ? bet.items : [];
      const redoblonas = Array.isArray(bet?.redoblonas) ? bet.redoblonas : [];

      const subtotal = Number(bet?.subtotal || 0);
      const total = Number(bet?.total || 0);

      const lineHeight = 18 * scale;
      const margin = 16 * scale;

      // Estimar altura total
      let estimatedLines = 14;
      for (const _draw of draws) {
        estimatedLines += 3;
        if (items.length > 0) estimatedLines += 3 + items.length;
        if (redoblonas.length > 0) estimatedLines += 4 + redoblonas.length;
      }
      const initialHeight = margin * 2 + estimatedLines * lineHeight + 40 * scale;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.max(initialHeight, 400 * scale);
      const ctx = canvas.getContext('2d');

      // Fondo blanco tipo papel térmico
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, canvas.height);

      ctx.fillStyle = '#111827';
      ctx.textBaseline = 'top';

      let y = margin;

      const drawText = (text, x, align = 'left', isBold = false, size = 12) => {
        ctx.font = `${isBold ? 'bold' : 'normal'} ${size * scale}px 'Courier New', Courier, monospace`;
        ctx.textAlign = align;
        ctx.fillText(text, x, y);
      };

      const drawDashedLine = (isDouble = false) => {
        ctx.save();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1 * scale;
        if (isDouble) {
          ctx.beginPath();
          ctx.moveTo(margin, y + 2 * scale);
          ctx.lineTo(width - margin, y + 2 * scale);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(margin, y + 6 * scale);
          ctx.lineTo(width - margin, y + 6 * scale);
          ctx.stroke();
          y += 12 * scale;
        } else {
          ctx.setLineDash([5 * scale, 3 * scale]);
          ctx.beginPath();
          ctx.moveTo(margin, y + 4 * scale);
          ctx.lineTo(width - margin, y + 4 * scale);
          ctx.stroke();
          y += 10 * scale;
        }
        ctx.restore();
      };

      // Encabezado
      drawText('TICKET', width / 2, 'center', true, 16);
      y += lineHeight * 1.3;
      drawText(`FECHA/HORA: ${dateStr}`, width / 2, 'center', false, 11);
      y += lineHeight;
      drawText(`PASADOR: ${pasador}`, width / 2, 'center', false, 11);
      y += lineHeight;

      drawDashedLine(false);

      // Secuencia
      drawText(`SECUENCIA: ${sequence}`, width / 2, 'center', true, 14);
      y += lineHeight * 1.1;

      drawDashedLine(false);

      let subSeq = 0;

      // Turnos
      for (let i = 0; i < draws.length; i++) {
        const draw = draws[i];
        let drawLots = drawLotteries.filter((dl) => dl.draw_id === draw.id);
        if (drawLots.length === 0 && fallbackLotteries.length > 0) {
          drawLots = fallbackLotteries.map((l) => ({
            draw_id: draw.id,
            lottery_initials: l.initials || l.name,
          }));
        }
        const lotCount = drawLots.length || 1;
        const lotInitials = drawLots
          .map((dl) => {
            const initials = dl.lottery_initials || '';
            if (draw.name === 'Vespertina' && ['CAT', 'SGO', 'TUC', 'LRT'].includes(initials)) {
              return `${initials} Tardecita`;
            }
            return initials;
          })
          .filter(Boolean)
          .join(' · ');

        drawText(draw.name.toUpperCase(), width / 2, 'center', true, 13);
        y += lineHeight;

        if (lotInitials) {
          drawText(`${lotInitials} (${lotCount} Lot)`, width / 2, 'center', true, 10);
          y += lineHeight * 1.1;
        }

        // Jugadas Simples
        if (items.length > 0) {
          subSeq++;
          drawText(`Jugada Simple Secuencia: ${sequence}-${subSeq}`, width / 2, 'center', false, 9);
          y += lineHeight;

          drawText('NUMERO', margin, 'left', true, 10);
          drawText('TIPO', width * 0.44, 'left', true, 10);
          drawText('IMPORTE', width - margin, 'right', true, 10);
          y += lineHeight;

          for (const item of items) {
            const typeStr = item.type === 'primera' ? '#1' : '#' + String(item.type).replace('a_los_', '');
            const itemAmount = (Number(item.amount) * lotCount).toLocaleString('es-AR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            drawText(String(item.number), margin, 'left', false, 11);
            drawText(typeStr, width * 0.44, 'left', false, 11);
            drawText(`$${itemAmount}`, width - margin, 'right', false, 11);
            y += lineHeight;
          }
        }

        // Redoblonas
        if (redoblonas.length > 0) {
          y += 4 * scale;
          drawDashedLine(false);
          drawText('REDOBLONA', width / 2, 'center', true, 12);
          y += lineHeight;
          subSeq++;
          drawText(`Redoblona Secuencia: ${sequence}-${subSeq}`, width / 2, 'center', false, 9);
          y += lineHeight;

          drawText('NUMERO', margin, 'left', true, 10);
          drawText('TIPO', width * 0.44, 'left', true, 10);
          drawText('IMPORTE', width - margin, 'right', true, 10);
          y += lineHeight;

          for (const red of redoblonas) {
            const numStr = `${String(red.first_number).padStart(2, '0')}-${String(red.second_number).padStart(2, '0')}`;
            const typeStr = `A los ${red.first_range} y ${red.second_range}`;
            const redAmount = (Number(red.amount) * lotCount).toLocaleString('es-AR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            drawText(numStr, margin, 'left', false, 11);
            drawText(typeStr, width * 0.44, 'left', false, 10);
            drawText(`$${redAmount}`, width - margin, 'right', false, 11);
            y += lineHeight;
          }
        }

        const drawSubtotal = (subtotal * lotCount).toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        drawText(`Subtotal ${draw.name}: $${drawSubtotal}`, width - margin, 'right', false, 10);
        y += lineHeight;

        if (i < draws.length - 1) {
          drawDashedLine(false);
        }
      }

      drawDashedLine(true);

      drawText('GRACIAS POR SU JUGADA', width / 2, 'center', false, 10);
      y += lineHeight * 1.1;

      const totalFormatted = total.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      drawText(`TOTAL: $${totalFormatted}`, width - margin, 'right', true, 14);
      y += lineHeight * 1.5;

      // Recortar exactamente a la altura dibujada
      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = width;
      trimmedCanvas.height = Math.ceil(y);
      const tCtx = trimmedCanvas.getContext('2d');
      tCtx.drawImage(canvas, 0, 0);

      trimmedCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('No se pudo convertir el canvas a Blob'));
          }
        },
        'image/jpeg',
        0.95
      );
    } catch (err) {
      reject(err);
    }
  });
}
