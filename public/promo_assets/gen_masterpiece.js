const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

async function renderMasterpiece() {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Deep obsidian dark background
  ctx.fillStyle = '#070709';
  ctx.fillRect(0, 0, width, height);

  // Background artwork
  const bgPath = 'C:\\Users\\Dheraj\\.gemini\\antigravity\\brain\\9487e882-ea7d-4db4-aca7-d6e7241c0ff3\\ganesha_tech_tradition_1789358332624.jpg';
  const bg = await loadImage(bgPath);

  // Perfectly position Ganesha in center
  const bgSize = 980;
  const bgX = (width - bgSize) / 2;
  const bgY = 85;
  ctx.drawImage(bg, bgX, bgY, bgSize, bgSize);

  // Top vignette: Smooth luxury dark fade for top text
  const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
  topGrad.addColorStop(0, 'rgba(7, 7, 9, 1.0)');
  topGrad.addColorStop(0.5, 'rgba(7, 7, 9, 0.90)');
  topGrad.addColorStop(0.85, 'rgba(7, 7, 9, 0.40)');
  topGrad.addColorStop(1, 'rgba(7, 7, 9, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 240);

  // Bottom vignette: Keep rangoli visible, softly darken the footer area
  const bottomGrad = ctx.createLinearGradient(0, height - 210, 0, height);
  bottomGrad.addColorStop(0, 'rgba(7, 7, 9, 0.0)');
  bottomGrad.addColorStop(0.35, 'rgba(7, 7, 9, 0.85)');
  bottomGrad.addColorStop(0.75, 'rgba(7, 7, 9, 0.98)');
  bottomGrad.addColorStop(1, 'rgba(7, 7, 9, 1.0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 210, width, 210);

  // Left & right edge gentle dark framing
  const leftGrad = ctx.createLinearGradient(0, 0, 80, 0);
  leftGrad.addColorStop(0, 'rgba(7, 7, 9, 0.92)');
  leftGrad.addColorStop(1, 'rgba(7, 7, 9, 0.0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, 80, height);

  const rightGrad = ctx.createLinearGradient(width - 80, 0, width, 0);
  rightGrad.addColorStop(0, 'rgba(7, 7, 9, 0.0)');
  rightGrad.addColorStop(1, 'rgba(7, 7, 9, 0.92)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(width - 80, 0, 80, height);

  // ==========================================
  // TOP: FESTIVE HEADLINE & TYPOGRAPHY
  // ==========================================
  // Helper to draw spaced text
  function drawSpacedText(text, x, y, spacing, font, fillStyle) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = fillStyle;
    ctx.textAlign = 'center';
    const chars = text.split('');
    const totalWidth = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + (chars.length - 1) * spacing;
    let curX = x - totalWidth / 2;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const w = ctx.measureText(ch).width;
      ctx.fillText(ch, curX + w / 2, y);
      curX += w + spacing;
    }
    ctx.restore();
  }

  // Concept eyebrow label: "TRADITION MEETS TECHNOLOGY"
  drawSpacedText('TRADITION MEETS TECHNOLOGY', width / 2, 55, 4.5, '600 10.5px "Century Gothic", "Segoe UI", sans-serif', 'rgba(215, 185, 125, 0.85)');

  // Main Headline: "Happy Vinayaka Chavithi"
  const titleY = 112;
  const titleGrad = ctx.createLinearGradient(width / 2 - 240, titleY - 30, width / 2 + 240, titleY);
  titleGrad.addColorStop(0, '#fff5e0');
  titleGrad.addColorStop(0.25, '#f5d182');
  titleGrad.addColorStop(0.5, '#ffe9b3');
  titleGrad.addColorStop(0.75, '#deb055');
  titleGrad.addColorStop(1, '#f9dc9b');

  ctx.save();
  ctx.font = 'bold 46px "Georgia", "Palatino Linotype", serif';
  ctx.fillStyle = titleGrad;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(240, 190, 80, 0.45)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 2;
  ctx.fillText('Happy Vinayaka Chavithi', width / 2, titleY);
  ctx.restore();

  // Secondary Line: "May Lord Ganesha bring wisdom, prosperity & new beginnings."
  const subY = 152;
  drawSpacedText('May Lord Ganesha bring wisdom, prosperity & new beginnings.', width / 2, subY, 1.2, '300 15px "Century Gothic", "Segoe UI", sans-serif', 'rgba(245, 240, 230, 0.90)');

  // Elegant divider under top text
  const divY = 180;
  const divGrad = ctx.createLinearGradient(width / 2 - 140, 0, width / 2 + 140, 0);
  divGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  divGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.55)');
  divGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 140, divY);
  ctx.lineTo(width / 2 + 140, divY);
  ctx.stroke();

  // ==========================================
  // BOTTOM: ICON TECH PRO BRANDING & FOOTER
  // ==========================================
  // Load official logo
  const logo = await loadImage('public/images/logo-transparent.png');
  // Dimensions of logo-transparent.png: 969 x 287
  const logoW = 236;
  const logoH = Math.round(logoW * (287 / 969));
  const logoX = (width - logoW) / 2;
  const logoY = height - 132;

  // Ultra-luxurious Pill Container for the Logo
  const padX = 22;
  const padY = 8;
  const pillX = logoX - padX;
  const pillY = logoY - padY;
  const pillW = logoW + padX * 2;
  const pillH = logoH + padY * 2;
  const pillRadius = 14;

  ctx.save();
  // Soft ambient golden halo behind badge
  ctx.shadowColor = 'rgba(212, 175, 55, 0.45)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillRadius);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.fill();

  // Fine metallic gold border
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  // Draw official logo pristine and unaltered
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);

  // Tagline below logo
  const tagY = height - 36;
  drawSpacedText('TECHNOLOGY   •   INNOVATION   •   TRUST', width / 2, tagY, 3.5, '600 11px "Century Gothic", "Segoe UI", sans-serif', 'rgba(215, 185, 125, 0.82)');

  // Save the master Instagram poster
  const masterPath = 'public/promo_assets/icon_tech_pro_vinayaka_chavithi_poster.png';
  fs.writeFileSync(masterPath, canvas.toBuffer('image/png'));
  console.log('Masterpiece poster saved at:', masterPath);
}

renderMasterpiece().catch(console.error);
