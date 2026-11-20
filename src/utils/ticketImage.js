/**
 * Genera un Blob de imagen JPEG con el ticket térmico de la apuesta dibujado en un Canvas HTML5.
 * Diseñado con tipografía aumentada (+3px), alto contraste y estilos en negrita para máxima legibilidad.
 *
 * @param {Object} bet - Datos de la apuesta (BetResource o similar)
 * @returns {Promise<Blob>}
 */
export function generateTicketImageBlob(bet) {
  return new Promise((resolve, reject) => {
    try {
      const scale = 2; // Factor de escala para resolución retina ultra nítida
      const baseWidth = 440;
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

      const lineHeight = 27 * scale;
      const margin = 20 * scale;

      // Estimar altura total generosa para evitar cualquier recorte previo
      let estimatedLines = 18;
      for (const _draw of draws) {
        estimatedLines += 4;
        if (items.length > 0) estimatedLines += 4 + items.length;
        if (redoblonas.length > 0) estimatedLines += 5 + redoblonas.length;
      }
      const initialHeight = margin * 2 + estimatedLines * lineHeight + 120 * scale;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.max(initialHeight, 600 * scale);
      const ctx = canvas.getContext('2d');

      // Fondo blanco papel térmico
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, canvas.height);

      // Negro absoluto para contraste perfecto
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';

      let y = margin;

      const drawText = (text, x, align = 'left', isBold = false, size = 16) => {
        ctx.font = `${isBold ? 'bold' : '600'} ${size * scale}px 'Courier New', Courier, monospace`;
        ctx.textAlign = align;
        ctx.fillText(text, x, y);
      };

      const drawDashedLine = (isDouble = false) => {
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.8 * scale;
        if (isDouble) {
          ctx.beginPath();
          ctx.moveTo(margin, y + 4 * scale);
          ctx.lineTo(width - margin, y + 4 * scale);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(margin, y + 10 * scale);
          ctx.lineTo(width - margin, y + 10 * scale);
          ctx.stroke();
          y += 18 * scale;
        } else {
          ctx.setLineDash([7 * scale, 5 * scale]);
          ctx.beginPath();
          ctx.moveTo(margin, y + 6 * scale);
          ctx.lineTo(width - margin, y + 6 * scale);
          ctx.stroke();
          y += 16 * scale;
        }
        ctx.restore();
      };

      // 1. Encabezado principal (+3px: 22)
      drawText('T I C K E T', width / 2, 'center', true, 22);
      y += lineHeight * 1.35;
      drawText(`FECHA/HORA: ${dateStr}`, width / 2, 'center', true, 16);
      y += lineHeight * 1.05;
      drawText(`PASADOR: ${pasador}`, width / 2, 'center', true, 16);
      y += lineHeight * 1.1;

      drawDashedLine(false);

      // 2. Secuencia en tamaño grande y negrita (+3px: 20)
      drawText(`SECUENCIA: ${sequence}`, width / 2, 'center', true, 20);
      y += lineHeight * 1.2;

      drawDashedLine(false);

      let subSeq = 0;

      // 3. Turnos y jugadas
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

        // Turno (+3px: 19)
        drawText(draw.name.toUpperCase(), width / 2, 'center', true, 19);
        y += lineHeight * 1.1;

        if (lotInitials) {
          // Loterías (+3px: 15)
          drawText(`${lotInitials} (${lotCount} Lot)`, width / 2, 'center', true, 15);
          y += lineHeight * 1.2;
        }

        // Jugadas Simples
        if (items.length > 0) {
          subSeq++;
          // (+3px: 14)
          drawText(`Jugada Simple Secuencia: ${sequence}-${subSeq}`, width / 2, 'center', false, 14);
          y += lineHeight * 1.05;

          // Cabecera de la tabla (+3px: 15.5)
          drawText('NUMERO', margin, 'left', true, 15.5);
          drawText('TIPO', width * 0.42, 'left', true, 15.5);
          drawText('IMPORTE', width - margin, 'right', true, 15.5);
          y += lineHeight * 1.1;

          for (const item of items) {
            const typeStr = item.type === 'primera' ? '#1' : '#' + String(item.type).replace('a_los_', '');
            const itemAmount = (Number(item.amount) * lotCount).toLocaleString('es-AR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            // Número (+3px: 17), Tipo (+3px: 16), Importe (+3px: 16.5)
            drawText(String(item.number), margin, 'left', true, 17);
            drawText(typeStr, width * 0.42, 'left', true, 16);
            drawText(`$${itemAmount}`, width - margin, 'right', true, 16.5);
            y += lineHeight;
          }
        }

        // Redoblonas
        if (redoblonas.length > 0) {
          y += 6 * scale;
          drawDashedLine(false);
          // (+3px: 17)
          drawText('REDOBLONA', width / 2, 'center', true, 17);
          y += lineHeight * 1.05;
          subSeq++;
          // (+3px: 14)
          drawText(`Redoblona Secuencia: ${sequence}-${subSeq}`, width / 2, 'center', false, 14);
          y += lineHeight * 1.05;

          drawText('NUMERO', margin, 'left', true, 15.5);
          drawText('TIPO', width * 0.42, 'left', true, 15.5);
          drawText('IMPORTE', width - margin, 'right', true, 15.5);
          y += lineHeight * 1.1;

          for (const red of redoblonas) {
            const numStr = `${String(red.first_number).padStart(2, '0')}-${String(red.second_number).padStart(2, '0')}`;
            const typeStr = `A los ${red.first_range} y ${red.second_range}`;
            const redAmount = (Number(red.amount) * lotCount).toLocaleString('es-AR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            drawText(numStr, margin, 'left', true, 17);
            drawText(typeStr, width * 0.42, 'left', true, 15);
            drawText(`$${redAmount}`, width - margin, 'right', true, 16.5);
            y += lineHeight;
          }
        }

        const drawSubtotal = (subtotal * lotCount).toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        y += 2 * scale;
        // Subtotal (+3px: 15.5)
        drawText(`Subtotal ${draw.name}: $${drawSubtotal}`, width - margin, 'right', true, 15.5);
        y += lineHeight * 1.1;

        if (i < draws.length - 1) {
          drawDashedLine(false);
        }
      }

      drawDashedLine(true);

      // Gracias (+3px: 15.5)
      drawText('GRACIAS POR SU JUGADA', width / 2, 'center', true, 15.5);
      y += lineHeight * 1.2;

      const totalFormatted = total.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      // TOTAL (+3px: 20)
      drawText(`TOTAL: $${totalFormatted}`, width - margin, 'right', true, 20);
      y += lineHeight * 1.6;

      // Recortar exactamente a la altura requerida
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
