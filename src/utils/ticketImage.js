/**
 * Formatea un monto en formato argentino ($1.500,00).
 */
function formatMoney(value) {
  return Number(value || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formatea fecha/hora de forma segura en todos los navegadores (incluyendo iOS Safari).
 */
function formatTicketDate(rawDate) {
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const match = rawDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1].slice(-2)} ${match[4]}:${match[5]}`;
    }
    const parsed = new Date(rawDate.replace(' ', 'T'));
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = String(parsed.getFullYear()).slice(-2);
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
  }
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Normaliza una apuesta individual o un array de apuestas (múltiples turnos de la misma secuencia)
 * en secciones ordenadas por turno, reflejando exactamente la vista previa.
 */
function buildTicketSections(betOrBets) {
  const betsList = Array.isArray(betOrBets)
    ? betOrBets.filter(Boolean)
    : (betOrBets ? [betOrBets] : []);

  const firstBet = betsList[0] || {};
  const sections = [];
  let grandTotal = 0;

  for (const bet of betsList) {
    const draws = Array.isArray(bet?.draws) && bet.draws.length > 0
      ? bet.draws
      : (bet?.draw ? [bet.draw] : [{ id: 1, name: 'Sorteo' }]);

    const drawLotteries = Array.isArray(bet?.draw_lotteries) ? bet.draw_lotteries : [];
    const fallbackLotteries = Array.isArray(bet?.lotteries) ? bet.lotteries : [];
    const items = Array.isArray(bet?.items) ? bet.items : [];
    const redoblonas = Array.isArray(bet?.redoblonas) ? bet.redoblonas : [];

    const simpleBase = items.reduce((acc, i) => acc + Number(i.amount || 0), 0);
    const redBase = redoblonas.reduce((acc, r) => acc + Number(r.amount || 0), 0);

    for (const draw of draws) {
      let drawLots = drawLotteries.filter((dl) => dl.draw_id === draw.id);
      if (drawLots.length === 0 && fallbackLotteries.length > 0) {
        drawLots = fallbackLotteries.map((l) => ({
          draw_id: draw.id,
          lottery_initials: l.initials || l.name,
        }));
      }

      const lotCount = drawLots.length || 1;
      const lotLabels = drawLots
        .map((dl) => {
          const initials = dl.lottery_initials || '';
          if (draw.name === 'Vespertina' && ['CAT', 'SGO', 'TUC', 'LRT'].includes(initials)) {
            return `${initials} Tardecita`;
          }
          return initials;
        })
        .filter(Boolean);

      const simpleTotal = simpleBase * lotCount;
      const redTotal = redBase * lotCount;
      const sectionTotal = simpleTotal + redTotal;
      grandTotal += sectionTotal;

      sections.push({
        drawId: draw.id,
        drawName: draw.name || 'Sorteo',
        lotCount,
        lotLabels,
        items,
        redoblonas,
        simpleTotal,
        redTotal,
        sectionTotal,
      });
    }
  }

  if (grandTotal <= 0) {
    grandTotal = betsList.reduce((acc, b) => acc + Number(b?.total || 0), 0);
  }

  return {
    sequence: firstBet?.sequence || '000000',
    pasador: firstBet?.user?.name || 'Agencia',
    dateStr: formatTicketDate(firstBet?.created_at),
    sections,
    grandTotal,
  };
}

/**
 * Genera un Blob de imagen JPEG con el ticket térmico de la apuesta dibujado en un Canvas HTML5.
 * Soporta uno o múltiples turnos (array de apuestas de la misma secuencia) reflejando la vista previa.
 * Diseñado con tipografía aumentada (+3px), alto contraste y estilos en negrita para máxima legibilidad.
 *
 * @param {Object|Object[]} betOrBets - Apuesta única o array de apuestas de la misma secuencia
 * @returns {Promise<Blob>}
 */
export function generateTicketImageBlob(betOrBets) {
  return new Promise((resolve, reject) => {
    try {
      const scale = 2; // Factor de escala para resolución retina ultra nítida
      const baseWidth = 440;
      const width = baseWidth * scale;

      const { sequence, pasador, dateStr, sections, grandTotal } = buildTicketSections(betOrBets);

      const lineHeight = 27 * scale;
      const margin = 20 * scale;
      const maxContentWidth = width - margin * 2;

      // Estimar altura total generosa para evitar cualquier recorte previo (incluso con muchos turnos)
      let estimatedLines = 20;
      for (const sec of sections) {
        const lotWrapLines = Math.max(1, Math.ceil((sec.lotLabels.length + 1) / 4));
        estimatedLines += 4 + lotWrapLines;
        if (sec.items.length > 0) estimatedLines += 6 + sec.items.length;
        if (sec.redoblonas.length > 0) estimatedLines += 6 + sec.redoblonas.length;
      }
      const initialHeight = margin * 2 + estimatedLines * lineHeight + 180 * scale;

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

      const drawWrappedCenterTokens = (prefix, tokens, size = 15, stepMultiplier = 1.05) => {
        ctx.font = `bold ${size * scale}px 'Courier New', Courier, monospace`;
        ctx.textAlign = 'center';

        const parts = prefix
          ? (tokens.length > 0 ? [`${prefix} ${tokens[0]}`, ...tokens.slice(1)] : [prefix])
          : [...tokens];

        const lines = [];
        let current = '';
        for (let idx = 0; idx < parts.length; idx++) {
          const piece = idx === 0 ? parts[idx] : ` · ${parts[idx]}`;
          const candidate = current ? current + piece : parts[idx];
          if (current && ctx.measureText(candidate).width > maxContentWidth) {
            lines.push(current);
            current = parts[idx];
          } else {
            current = candidate;
          }
        }
        if (current) lines.push(current);

        for (const line of lines) {
          ctx.fillText(line, width / 2, y);
          y += lineHeight * stepMultiplier;
        }
      };

      const drawDashedLine = (isDouble = false, compact = false) => {
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = (compact ? 1.4 : 1.8) * scale;
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
          ctx.moveTo(margin, y + 5 * scale);
          ctx.lineTo(width - margin, y + 5 * scale);
          ctx.stroke();
          y += (compact ? 12 : 16) * scale;
        }
        ctx.restore();
      };

      // 1. Encabezado principal (+3px: 22)
      drawText('B O L E T A', width / 2, 'center', true, 22);
      y += lineHeight * 1.3;
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

      // 3. Turnos y jugadas (idéntico a la vista previa)
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];

        // Turno (+3px: 19)
        drawText(sec.drawName, width / 2, 'center', true, 19);
        y += lineHeight * 1.1;

        // Loterías con badge "(N Lot)" y salto de línea automático si hay muchas
        drawWrappedCenterTokens(`(${sec.lotCount} Lot)`, sec.lotLabels, 15, 1.1);
        y += 4 * scale;

        // Jugadas Simples
        if (sec.items.length > 0) {
          subSeq++;
          // Cabecera de la tabla (+3px: 15.5)
          drawText('NUMERO', margin, 'left', true, 15.5);
          drawText('POS', width * 0.48, 'center', true, 15.5);
          drawText('IMPORTE', width - margin, 'right', true, 15.5);
          y += lineHeight * 0.95;
          drawDashedLine(false, true);

          // Subtítulo (+3px: 14.5)
          drawText(`Jugada Simple (${sequence}-${subSeq})`, width / 2, 'center', true, 14.5);
          y += lineHeight * 1.05;

          for (const item of sec.items) {
            const posStr = item.position
              ? `#${item.position}`
              : (item.type === 'primera' ? '#1' : '#' + String(item.type).replace('a_los_', ''));
            // Importe unitario (igual que en vista previa)
            drawText(String(item.number), margin, 'left', true, 17);
            drawText(posStr, width * 0.48, 'center', true, 16);
            drawText(`$${formatMoney(item.amount)}`, width - margin, 'right', true, 16.5);
            y += lineHeight;
          }

          drawDashedLine(false, true);
          drawText(`Jugada Simple x ${sec.lotCount} Lot`, margin, 'left', true, 15);
          drawText(`$${formatMoney(sec.simpleTotal)}`, width - margin, 'right', true, 15.5);
          y += lineHeight * 1.1;
        }

        // Redoblonas
        if (sec.redoblonas.length > 0) {
          if (sec.items.length > 0) {
            y += 4 * scale;
          }
          subSeq++;
          drawText('NUMERO', margin, 'left', true, 15.5);
          drawText('RANGOS', width * 0.48, 'center', true, 15.5);
          drawText('IMPORTE', width - margin, 'right', true, 15.5);
          y += lineHeight * 0.95;
          drawDashedLine(false, true);

          drawText(`REDOBLONA (${sequence}-${subSeq})`, width / 2, 'center', true, 14.5);
          y += lineHeight * 1.05;

          for (const red of sec.redoblonas) {
            const numStr = `${String(red.first_number).padStart(2, '0')}-${String(red.second_number).padStart(2, '0')}`;
            const rangesStr = `${String(red.first_range).padStart(2, '0')} y ${String(red.second_range).padStart(2, '0')}`;
            drawText(numStr, margin, 'left', true, 17);
            drawText(rangesStr, width * 0.48, 'center', true, 15.5);
            drawText(`$${formatMoney(red.amount)}`, width - margin, 'right', true, 16.5);
            y += lineHeight;
          }

          drawDashedLine(false, true);
          drawText(`Redoblona x ${sec.lotCount} Lot`, margin, 'left', true, 15);
          drawText(`$${formatMoney(sec.redTotal)}`, width - margin, 'right', true, 15.5);
          y += lineHeight * 1.1;
        }

        if (i < sections.length - 1) {
          drawDashedLine(false);
        }
      }

      drawDashedLine(true);

      // Gracias (+3px: 15.5)
      drawText('GRACIAS POR SU JUGADA', width / 2, 'center', true, 15.5);
      y += lineHeight * 1.2;

      // TOTAL (+3px: 20)
      drawText('TOTAL', margin, 'left', true, 20);
      drawText(`$${formatMoney(grandTotal)}`, width - margin, 'right', true, 20);
      y += lineHeight * 1.5;

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
