const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

async function renderOptionA() {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Base background
  ctx.fillStyle = '#060608';
  ctx.fillRect(0, 0, width, height);

  // Background artwork
  const bgPath = 'C:\\Users\\Dheraj\\.gemini\\antigravity\\brain\\9487e882-ea7d-4db4-aca7-d6e7241c0ff3\\ganesha_tech_tradition_1789358332624.jpg';
  const bg = await loadImage(bgPath);

  // Draw Ganesha slightly lowered to give majestic top headspace
  const bgSize = 1000;
  const bgX = (width - bgSize) / 2;
  const bgY = 55;
  ctx.drawImage(bg, bgX, bgY, bgSize, bgSize);

  // Smooth seamless vignette gradients
  // Top vignette
  const topGrad = ctx.createLinearGradient(0, 0, 0, 220);
  topGrad.addColorStop(0, 'rgba(6, 6, 8, 1.0)');
  topGrad.addColorStop(0.45, 'rgba(6, 6, 8, 0.88)');
  topGrad.addColorStop(1, 'rgba(6, 6, 8, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 220);

  // Bottom vignette
  const bottomGrad = ctx.createLinearGradient(0, height - 320, 0, height);
  bottomGrad.addColorStop(0, 'rgba(6, 6, 8, 0.0)');
  bottomGrad.addColorStop(0.35, 'rgba(6, 6, 8, 0.85)');
  bottomGrad.addColorStop(0.7, 'rgba(6, 6, 8, 0.98)');
  bottomGrad.addColorStop(1, 'rgba(6, 6, 8, 1.0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 320, width, 320);

  // Subtle corner vignette
  const radGrad = ctx.createRadialGradient(width / 2, height / 2, 420, width / 2, height / 2, 720);
  radGrad.addColorStop(0, 'rgba(6, 6, 8, 0.0)');
  radGrad.addColorStop(1, 'rgba(6, 6, 8, 0.7)');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, width, height);

  // ==========================================
  // TOP: BRANDING & CONCEPT
  // ==========================================
  const logo = await loadImage('public/promo_assets/icon_logo_badge.png');
  // Badge dimensions: 900 x 460
  const logoW = 210;
  const logoH = Math.round(logoW * (460 / 900));
  const logoX = (width - logoW) / 2;
  const logoY = 40;

  // Add a soft luxury golden halo behind the logo badge
  ctx.save();
  ctx.shadowColor = 'rgba(212, 175, 55, 0.35)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);
  ctx.restore();

  // Concept header line
  const conceptY = logoY + logoH + 20;
  ctx.save();
  ctx.font = '600 11px "Century Gothic", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(215, 185, 130, 0.9)';
  ctx.textAlign = 'center';
  ctx.fillText('TRADITION   •   TECHNOLOGY   •   INNOVATION', width / 2, conceptY);
  ctx.restore();

  // Thin subtle golden accent line
  const lineY = conceptY + 14;
  const lineGrad = ctx.createLinearGradient(width / 2 - 120, 0, width / 2 + 120, 0);
  lineGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  lineGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.5)');
  lineGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 120, lineY);
  ctx.lineTo(width / 2 + 120, lineY);
  ctx.stroke();

  // ==========================================
  // BOTTOM: FESTIVE GREETING & BLESSING
  // ==========================================
  // Decorative divider
  const divY = height - 210;
  const divGrad = ctx.createLinearGradient(width / 2 - 200, 0, width / 2 + 200, 0);
  divGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  divGrad.addColorStop(0.25, 'rgba(212, 175, 55, 0.6)');
  divGrad.addColorStop(0.5, 'rgba(255, 235, 175, 0.9)');
  divGrad.addColorStop(0.75, 'rgba(212, 175, 55, 0.6)');
  divGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 200, divY);
  ctx.lineTo(width / 2 + 200, divY);
  ctx.stroke();

  // Diamond emblem in center
  ctx.save();
  ctx.translate(width / 2, divY);
  ctx.rotate(45 * Math.PI / 180);
  ctx.fillStyle = '#f5d38a';
  ctx.shadowColor = 'rgba(240, 190, 80, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillRect(-3.5, -3.5, 7, 7);
  ctx.restore();

  // Headline: "Happy Vinayaka Chavithi"
  const titleY = height - 150;
  const titleGrad = ctx.createLinearGradient(width / 2 - 260, titleY - 35, width / 2 + 260, titleY);
  titleGrad.addColorStop(0, '#fff6e5');
  titleGrad.addColorStop(0.3, '#f2ca77');
  titleGrad.addColorStop(0.55, '#ffe5a0');
  titleGrad.addColorStop(0.8, '#d9a94f');
  titleGrad.addColorStop(1, '#f7d896');

  ctx.save();
  ctx.font = 'bold 44px "Georgia", "Palatino Linotype", serif';
  ctx.fillStyle = titleGrad;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(240, 190, 80, 0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 2;
  ctx.fillText('Happy Vinayaka Chavithi', width / 2, titleY);
  ctx.restore();

  // Secondary Line: "May Lord Ganesha bring wisdom, prosperity & new beginnings."
  const subY = height - 105;
  ctx.save();
  ctx.font = '300 16.5px "Century Gothic", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(245, 240, 230, 0.92)';
  ctx.textAlign = 'center';
  ctx.fillText('May Lord Ganesha bring wisdom, prosperity & new beginnings.', width / 2, subY);
  ctx.restore();

  // Subtle footer: "ICON TECH PRO  •  Technology. Innovation. Trust."
  const footerY = height - 58;
  ctx.save();
  ctx.font = '500 12px "Century Gothic", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(215, 180, 100, 0.75)';
  ctx.textAlign = 'center';
  ctx.fillText('WHERE INNOVATION MEETS TRADITION', width / 2, footerY);
  ctx.restore();

  // Save Option A
  fs.writeFileSync('public/promo_assets/poster_option_a.png', canvas.toBuffer('image/png'));
  console.log('Option A generated.');
}

async function renderOptionB() {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Base background
  ctx.fillStyle = '#060608';
  ctx.fillRect(0, 0, width, height);

  // Background artwork
  const bgPath = 'C:\\Users\\Dheraj\\.gemini\\antigravity\\brain\\9487e882-ea7d-4db4-aca7-d6e7241c0ff3\\ganesha_tech_tradition_1789358332624.jpg';
  const bg = await loadImage(bgPath);

  const bgSize = 980;
  const bgX = (width - bgSize) / 2;
  const bgY = 90;
  ctx.drawImage(bg, bgX, bgY, bgSize, bgSize);

  // Top vignette
  const topGrad = ctx.createLinearGradient(0, 0, 0, 260);
  topGrad.addColorStop(0, 'rgba(6, 6, 8, 1.0)');
  topGrad.addColorStop(0.5, 'rgba(6, 6, 8, 0.88)');
  topGrad.addColorStop(1, 'rgba(6, 6, 8, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 260);

  // Bottom vignette
  const bottomGrad = ctx.createLinearGradient(0, height - 280, 0, height);
  bottomGrad.addColorStop(0, 'rgba(6, 6, 8, 0.0)');
  bottomGrad.addColorStop(0.35, 'rgba(6, 6, 8, 0.88)');
  bottomGrad.addColorStop(0.7, 'rgba(6, 6, 8, 0.98)');
  bottomGrad.addColorStop(1, 'rgba(6, 6, 8, 1.0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 280, width, 280);

  // ==========================================
  // TOP: FESTIVE HEADLINE
  // ==========================================
  // Concept label
  ctx.save();
  ctx.font = '600 11px "Century Gothic", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(215, 185, 130, 0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('TRADITION   MEETS   TECHNOLOGY', width / 2, 58);
  ctx.restore();

  // Main Headline
  const titleY = 118;
  const titleGrad = ctx.createLinearGradient(width / 2 - 260, titleY - 35, width / 2 + 260, titleY);
  titleGrad.addColorStop(0, '#fff6e5');
  titleGrad.addColorStop(0.3, '#f2ca77');
  titleGrad.addColorStop(0.55, '#ffe5a0');
  titleGrad.addColorStop(0.8, '#d9a94f');
  titleGrad.addColorStop(1, '#f7d896');

  ctx.save();
  ctx.font = 'bold 46px "Georgia", "Palatino Linotype", serif';
  ctx.fillStyle = titleGrad;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(240, 190, 80, 0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 2;
  ctx.fillText('Happy Vinayaka Chavithi', width / 2, titleY);
  ctx.restore();

  // Secondary Line
  const subY = 158;
  ctx.save();
  ctx.font = '300 16px "Century Gothic", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(245, 240, 230, 0.92)';
  ctx.textAlign = 'center';
  ctx.fillText('May Lord Ganesha bring wisdom, prosperity & new beginnings.', width / 2, subY);
  ctx.restore();

  // Divider under top text
  const divY = 188;
  const divGrad = ctx.createLinearGradient(width / 2 - 160, 0, width / 2 + 160, 0);
  divGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  divGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.6)');
  divGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 160, divY);
  ctx.lineTo(width / 2 + 160, divY);
  ctx.stroke();

  // ==========================================
  // BOTTOM: BRANDING & TAGLINE
  // ==========================================
  const logo = await loadImage('public/promo_assets/icon_logo_badge.png');
  const logoW = 210;
  const logoH = Math.round(logoW * (460 / 900));
  const logoX = (width - logoW) / 2;
  const logoY = height - 160;

  ctx.save();
  ctx.shadowColor = 'rgba(212, 175, 55, 0.35)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);
  ctx.restore();

  // Tagline below logo
  const tagY = height - 38;
  ctx.save();
  ctx.font = '600 12.5px "Century Gothic", "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(215, 180, 100, 0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('TECHNOLOGY   •   INNOVATION   •   TRUST', width / 2, tagY);
  ctx.restore();

  // Save Option B
  fs.writeFileSync('public/promo_assets/poster_option_b.png', canvas.toBuffer('image/png'));
  console.log('Option B generated.');
}

async function run() {
  await renderOptionA();
  await renderOptionB();
}
run().catch(console.error);
