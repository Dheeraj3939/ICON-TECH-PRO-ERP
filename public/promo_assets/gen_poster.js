const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');

GlobalFonts.registerFromPath('public/promo_assets/Cinzel-SemiBold.ttf', 'Cinzel');
GlobalFonts.registerFromPath('public/promo_assets/Montserrat-Medium.ttf', 'Montserrat');
GlobalFonts.registerFromPath('public/promo_assets/Montserrat-Light.ttf', 'Montserrat-Light');

async function buildPoster() {
  const width = 1080;
  const height = 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bgPath = 'C:\\Users\\Dheraj\\.gemini\\antigravity\\brain\\9487e882-ea7d-4db4-aca7-d6e7241c0ff3\\ganesha_tech_tradition_1789358332624.jpg';
  const bg = await loadImage(bgPath);

  // Fill base deep obsidian background
  ctx.fillStyle = '#060608';
  ctx.fillRect(0, 0, width, height);

  // Draw background image centered with slight vertical offset
  const bgSize = 980;
  const bgX = (width - bgSize) / 2;
  const bgY = 90;
  ctx.drawImage(bg, bgX, bgY, bgSize, bgSize);

  // Top vignette to blend artwork seamlessly
  const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
  topGrad.addColorStop(0, 'rgba(6, 6, 8, 1.0)');
  topGrad.addColorStop(0.5, 'rgba(6, 6, 8, 0.85)');
  topGrad.addColorStop(1, 'rgba(6, 6, 8, 0.0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 240);

  // Bottom vignette for typography
  const bottomGrad = ctx.createLinearGradient(0, height - 310, 0, height);
  bottomGrad.addColorStop(0, 'rgba(6, 6, 8, 0.0)');
  bottomGrad.addColorStop(0.35, 'rgba(6, 6, 8, 0.85)');
  bottomGrad.addColorStop(0.7, 'rgba(6, 6, 8, 0.98)');
  bottomGrad.addColorStop(1, 'rgba(6, 6, 8, 1.0)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 310, width, 310);

  // Left & right edge subtle blend
  const leftGrad = ctx.createLinearGradient(0, 0, 90, 0);
  leftGrad.addColorStop(0, 'rgba(6, 6, 8, 0.95)');
  leftGrad.addColorStop(1, 'rgba(6, 6, 8, 0.0)');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, 90, height);

  const rightGrad = ctx.createLinearGradient(width - 90, 0, width, 0);
  rightGrad.addColorStop(0, 'rgba(6, 6, 8, 0.0)');
  rightGrad.addColorStop(1, 'rgba(6, 6, 8, 0.95)');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(width - 90, 0, 90, height);

  // ----------------------------------------------------
  // BRAND HEADER (Top)
  // ----------------------------------------------------
  const logo = await loadImage('public/images/logo-transparent.png');
  const logoW = 280;
  const logoH = Math.round(logoW * (287 / 969));
  const logoX = (width - logoW) / 2;
  const logoY = 46;

  // Render a sleek luxury pill container for the official logo
  const padX = 24;
  const padY = 9;
  const badgeX = logoX - padX;
  const badgeY = logoY - padY;
  const badgeW = logoW + padX * 2;
  const badgeH = logoH + padY * 2;
  const badgeRadius = 14;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeRadius);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
  ctx.shadowColor = 'rgba(212, 168, 83, 0.45)';
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  
  // Refined metallic gold hairline border around badge
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Draw official logo pristine and unaltered
  ctx.drawImage(logo, logoX, logoY, logoW, logoH);

  // Subtle luxury line accent under brand header
  const accentY = logoY + logoH + 22;
  const accentGrad = ctx.createLinearGradient(width / 2 - 140, 0, width / 2 + 140, 0);
  accentGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  accentGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.7)');
  accentGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = accentGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 140, accentY);
  ctx.lineTo(width / 2 + 140, accentY);
  ctx.stroke();

  // Small refined concept label below accent line
  ctx.font = '500 10.5px Montserrat';
  ctx.fillStyle = 'rgba(230, 195, 130, 0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('TRADITION   MEETS   TECHNOLOGY', width / 2, accentY + 16);

  // ----------------------------------------------------
  // TYPOGRAPHY (Bottom Section)
  // ----------------------------------------------------
  // Subtle decorative divider line with central diamond
  const divY = height - 212;
  const divGrad = ctx.createLinearGradient(width / 2 - 190, 0, width / 2 + 190, 0);
  divGrad.addColorStop(0, 'rgba(212, 175, 55, 0.0)');
  divGrad.addColorStop(0.3, 'rgba(212, 175, 55, 0.75)');
  divGrad.addColorStop(0.5, 'rgba(255, 240, 190, 0.95)');
  divGrad.addColorStop(0.7, 'rgba(212, 175, 55, 0.75)');
  divGrad.addColorStop(1, 'rgba(212, 175, 55, 0.0)');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 190, divY);
  ctx.lineTo(width / 2 + 190, divY);
  ctx.stroke();

  // Center diamond on divider
  ctx.save();
  ctx.translate(width / 2, divY);
  ctx.rotate(45 * Math.PI / 180);
  ctx.fillStyle = '#f5d38a';
  ctx.fillRect(-3.5, -3.5, 7, 7);
  ctx.restore();

  // Main Headline: 'Happy Vinayaka Chavithi'
  const titleY = height - 158;
  const titleGrad = ctx.createLinearGradient(width / 2 - 250, titleY - 30, width / 2 + 250, titleY);
  titleGrad.addColorStop(0, '#fff4de');
  titleGrad.addColorStop(0.25, '#f3cb7a');
  titleGrad.addColorStop(0.5, '#ffe5a3');
  titleGrad.addColorStop(0.75, '#deb057');
  titleGrad.addColorStop(1, '#fad794');

  ctx.save();
  ctx.font = '600 42px Cinzel';
  ctx.fillStyle = titleGrad;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(240, 190, 80, 0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 2;
  ctx.fillText('HAPPY VINAYAKA CHAVITHI', width / 2, titleY);
  ctx.restore();

  // Secondary line: 'May Lord Ganesha bring wisdom, prosperity & new beginnings.'
  const subY = height - 114;
  ctx.save();
  ctx.font = '300 16px Montserrat';
  ctx.fillStyle = 'rgba(245, 240, 230, 0.92)';
  ctx.textAlign = 'center';
  ctx.fillText('May Lord Ganesha bring wisdom, prosperity & new beginnings.', width / 2, subY);
  ctx.restore();

  // Tagline: 'Technology • Innovation • Trust'
  const tagY = height - 68;
  ctx.save();
  ctx.font = '500 12.5px Montserrat';
  ctx.fillStyle = 'rgba(215, 180, 100, 0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('TECHNOLOGY   •   INNOVATION   •   TRUST', width / 2, tagY);
  ctx.restore();

  const outPath = 'public/promo_assets/vinayaka_chavithi_poster_1080x1080.png';
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log('Successfully generated poster at:', outPath);
}

buildPoster().catch(console.error);
