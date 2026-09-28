const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

function drawSpacedText(ctx, text, x, y, spacing, font, fillStyle, align = 'center') {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = 'left';
  const chars = text.split('');
  const totalWidth = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + (chars.length - 1) * spacing;
  let curX = align === 'center' ? x - totalWidth / 2 : x;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    ctx.fillText(ch, curX, y);
    curX += ctx.measureText(ch).width + spacing;
  }
  ctx.restore();
}

async function renderFilmPoster1() {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Base background
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, width, height);

  // Load Epic Artwork 1 (Sanctum)
  const bg = await loadImage('C:\\Users\\Dheraj\\.gemini\\antigravity\\brain\\9487e882-ea7d-4db4-aca7-d6e7241c0ff3\\cinematic_ganesha_epic_1789361862893.jpg');

  // Draw background image
  ctx.drawImage(bg, 0, 0, width, height);

  // Cinematic top grade vignette (for studio credit & title)
  const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
  topGrad.addColorStop(0, 'rgba(4, 4, 6, 0.95)');
  topGrad.addColorStop(0.5, 'rgba(4, 4, 6, 0.75)');
  topGrad.addColorStop(1, 'rgba(4, 4, 6, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 240);

  // Cinematic bottom grade vignette (for movie title & billing block)
  const bottomGrad = ctx.createLinearGradient(0, height - 320, 0, height);
  bottomGrad.addColorStop(0, 'rgba(4, 4, 6, 0.0)');
  bottomGrad.addColorStop(0.3, 'rgba(4, 4, 6, 0.85)');
  bottomGrad.addColorStop(0.7, 'rgba(4, 4, 6, 0.98)');
  bottomGrad.addColorStop(1, 'rgba(4, 4, 6, 1.0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 320, width, 320);

  // Film letterbox edge vignettes
  const leftGrad = ctx.createLinearGradient(0, 0, 70, 0);
  leftGrad.addColorStop(0, 'rgba(4, 4, 6, 0.8)');
  leftGrad.addColorStop(1, 'rgba(4, 4, 6, 0.0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, 70, height);

  const rightGrad = ctx.createLinearGradient(width - 70, 0, width, 0);
  rightGrad.addColorStop(0, 'rgba(4, 4, 6, 0.0)');
  rightGrad.addColorStop(1, 'rgba(4, 4, 6, 0.8)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(width - 70, 0, 70, height);

  // ==========================================
  // TOP: HOLLYWOOD / BLOCKBUSTER STUDIO BANNER
  // ==========================================
  // Subtle presenter line
  drawSpacedText(ctx, 'ICON TECH PRO  PRESENTS', width / 2, 44, 5.0, '600 11px "Century Gothic", sans-serif', 'rgba(215, 185, 125, 0.9)');

  // Thin golden horizontal rule with center jewel
  const topRuleY = 56;
  const trGrad = ctx.createLinearGradient(width / 2 - 160, 0, width / 2 + 160, 0);
  trGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  trGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.6)');
  trGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = trGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 160, topRuleY);
  ctx.lineTo(width / 2 + 160, topRuleY);
  ctx.stroke();

  // Concept subtitle
  drawSpacedText(ctx, 'TRADITION   MEETS   TECHNOLOGY', width / 2, 74, 3.8, '500 10.5px "Century Gothic", sans-serif', 'rgba(240, 230, 210, 0.75)');

  // ==========================================
  // BOTTOM: EPIC CINEMATIC MOVIE TITLE
  // ==========================================
  // Title Eyebrow / Pre-title
  drawSpacedText(ctx, 'CELEBRATING THE ARCHITECT OF WISDOM & NEW BEGINNINGS', width / 2, height - 228, 2.5, '600 10.5px "Century Gothic", sans-serif', 'rgba(215, 180, 115, 0.9)');

  // Blockbuster Main Title: "VINAYAKA CHAVITHI"
  const titleY = height - 170;
  const titleGrad = ctx.createLinearGradient(width / 2 - 300, titleY - 45, width / 2 + 300, titleY);
  titleGrad.addColorStop(0, '#fffbf0');
  titleGrad.addColorStop(0.2, '#f6d588');
  titleGrad.addColorStop(0.5, '#fff0c2');
  titleGrad.addColorStop(0.8, '#d4a148');
  titleGrad.addColorStop(1, '#f9dc9a');

  ctx.save();
  ctx.shadowColor = 'rgba(245, 195, 80, 0.6)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 2;
  // Use Bahnschrift or Felix Titling or Georgia for massive cinematic impact
  drawSpacedText(ctx, 'VINAYAKA CHAVITHI', width / 2, titleY, 9.0, 'bold 44px "Georgia", "Times New Roman", serif', titleGrad);
  ctx.restore();

  // Blessing Subtitle
  const subY = height - 132;
  drawSpacedText(ctx, 'May Lord Ganesha bring wisdom, prosperity & new beginnings.', width / 2, subY, 1.4, '300 15px "Century Gothic", sans-serif', 'rgba(245, 240, 230, 0.92)');

  // Thin luxury divider
  const botRuleY = height - 108;
  const brGrad = ctx.createLinearGradient(width / 2 - 220, 0, width / 2 + 220, 0);
  brGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  brGrad.addColorStop(0.3, 'rgba(212, 175, 55, 0.7)');
  brGrad.addColorStop(0.5, 'rgba(255, 240, 190, 0.95)');
  brGrad.addColorStop(0.7, 'rgba(212, 175, 55, 0.7)');
  brGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = brGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 220, botRuleY);
  ctx.lineTo(width / 2 + 220, botRuleY);
  ctx.stroke();

  // Diamond jewel on divider
  ctx.save();
  ctx.translate(width / 2, botRuleY);
  ctx.rotate(45 * Math.PI / 180);
  ctx.fillStyle = '#f8df9e';
  ctx.shadowColor = 'rgba(240, 190, 80, 0.8)';
  ctx.shadowBlur = 10;
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();

  // ==========================================
  // FOOTER: OFFICIAL BRAND IDENTITY & CINEMATIC BILLING
  // ==========================================
  // Draw official brand logo badge cleanly at the bottom
  const logo = await loadImage('public/images/logo-transparent.png');
  const logoW = 200;
  const logoH = Math.round(logoW * (287 / 969));
  const logoX = (width - logoW) / 2;
  const logoY = height - 92;

  // Ultra-refined satin pearl badge
  const padX = 18;
  const padY = 6;
  const pillX = logoX - padX;
  const pillY = logoY - padY;
  const pillW = logoW + padX * 2;
  const pillH = logoH + padY * 2;

  ctx.save();
  ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.drawImage(logo, logoX, logoY, logoW, logoH);

  // Cinematic billing / tagline line
  const tagY = height - 16;
  drawSpacedText(ctx, 'TECHNOLOGY   •   INNOVATION   •   TRUST   •   WWW.ICONTECHPRO.IN', width / 2, tagY, 2.5, '600 9.5px "Century Gothic", sans-serif', 'rgba(215, 185, 125, 0.75)');

  // Save poster
  fs.writeFileSync('public/promo_assets/cinematic_poster_sanctum.png', canvas.toBuffer('image/png'));
  console.log('Saved cinematic_poster_sanctum.png');
}

async function renderFilmPoster2() {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Base background
  ctx.fillStyle = '#050507';
  ctx.fillRect(0, 0, width, height);

  // Load Epic Artwork 2 (Titan / Low Angle Monolith)
  const bg = await loadImage('C:\\Users\\Dheraj\\.gemini\\antigravity\\brain\\9487e882-ea7d-4db4-aca7-d6e7241c0ff3\\cinematic_ganesha_monolith_1789361923052.jpg');
  ctx.drawImage(bg, 0, 0, width, height);

  // Top vignette
  const topGrad = ctx.createLinearGradient(0, 0, 0, 220);
  topGrad.addColorStop(0, 'rgba(4, 4, 6, 0.92)');
  topGrad.addColorStop(0.5, 'rgba(4, 4, 6, 0.65)');
  topGrad.addColorStop(1, 'rgba(4, 4, 6, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 220);

  // Bottom vignette
  const bottomGrad = ctx.createLinearGradient(0, height - 300, 0, height);
  bottomGrad.addColorStop(0, 'rgba(4, 4, 6, 0.0)');
  bottomGrad.addColorStop(0.3, 'rgba(4, 4, 6, 0.85)');
  bottomGrad.addColorStop(0.7, 'rgba(4, 4, 6, 0.98)');
  bottomGrad.addColorStop(1, 'rgba(4, 4, 6, 1.0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 300, width, 300);

  // Studio Header
  drawSpacedText(ctx, 'ICON TECH PRO  PRESENTS', width / 2, 42, 5.0, '600 11px "Century Gothic", sans-serif', 'rgba(215, 185, 125, 0.9)');
  
  const topRuleY = 54;
  const trGrad = ctx.createLinearGradient(width / 2 - 140, 0, width / 2 + 140, 0);
  trGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  trGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.55)');
  trGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = trGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 140, topRuleY);
  ctx.lineTo(width / 2 + 140, topRuleY);
  ctx.stroke();

  drawSpacedText(ctx, 'WHERE INNOVATION MEETS TRADITION', width / 2, 72, 3.5, '500 10.5px "Century Gothic", sans-serif', 'rgba(240, 230, 210, 0.75)');

  // Main Headline (Monumental Sci-Fi Titling)
  drawSpacedText(ctx, 'A SACRED CELEBRATION OF WISDOM & PROSPERITY', width / 2, height - 215, 2.8, '600 10px "Century Gothic", sans-serif', 'rgba(215, 180, 115, 0.9)');

  const titleY = height - 162;
  const titleGrad = ctx.createLinearGradient(width / 2 - 300, titleY - 45, width / 2 + 300, titleY);
  titleGrad.addColorStop(0, '#fffbf0');
  titleGrad.addColorStop(0.2, '#f6d588');
  titleGrad.addColorStop(0.5, '#fff0c2');
  titleGrad.addColorStop(0.8, '#d4a148');
  titleGrad.addColorStop(1, '#f9dc9a');

  ctx.save();
  ctx.shadowColor = 'rgba(245, 195, 80, 0.65)';
  ctx.shadowBlur = 32;
  drawSpacedText(ctx, 'HAPPY VINAYAKA CHAVITHI', width / 2, titleY, 7.5, 'bold 40px "Georgia", "Times New Roman", serif', titleGrad);
  ctx.restore();

  // Subtitle
  const subY = height - 124;
  drawSpacedText(ctx, 'May Lord Ganesha bring wisdom, prosperity & new beginnings.', width / 2, subY, 1.4, '300 15px "Century Gothic", sans-serif', 'rgba(245, 240, 230, 0.92)');

  // Divider
  const botRuleY = height - 100;
  const brGrad = ctx.createLinearGradient(width / 2 - 200, 0, width / 2 + 200, 0);
  brGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  brGrad.addColorStop(0.5, 'rgba(255, 240, 190, 0.9)');
  brGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = brGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 200, botRuleY);
  ctx.lineTo(width / 2 + 200, botRuleY);
  ctx.stroke();

  // Official Logo Badge
  const logo = await loadImage('public/images/logo-transparent.png');
  const logoW = 200;
  const logoH = Math.round(logoW * (287 / 969));
  const logoX = (width - logoW) / 2;
  const logoY = height - 86;

  const padX = 18;
  const padY = 6;
  const pillX = logoX - padX;
  const pillY = logoY - padY;
  const pillW = logoW + padX * 2;
  const pillH = logoH + padY * 2;

  ctx.save();
  ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.drawImage(logo, logoX, logoY, logoW, logoH);

  // Tagline
  const tagY = height - 14;
  drawSpacedText(ctx, 'TECHNOLOGY   •   INNOVATION   •   TRUST', width / 2, tagY, 3.0, '600 10px "Century Gothic", sans-serif', 'rgba(215, 185, 125, 0.8)');

  // Save poster
  fs.writeFileSync('public/promo_assets/cinematic_poster_titan.png', canvas.toBuffer('image/png'));
  console.log('Saved cinematic_poster_titan.png');
}

async function run() {
  await renderFilmPoster1();
  await renderFilmPoster2();
}
run().catch(console.error);
