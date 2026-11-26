(() => {
  const canvas = document.querySelector('canvas.hero-heart');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const width = 480;
  const height = 320;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const sail = new Path2D('M -3 -17 C -6 -52 -20 -77 -47 -71 C -78 -64 -92 -35 -81 4 C -74 32 -58 62 -39 82 C -4 67 34 50 61 27 C 87 6 93 -22 75 -35 C 55 -51 24 -45 -3 -17 Z');
  const seam = new Path2D('M -11 -4 C -13 -40 -25 -65 -45 -61 C -68 -55 -79 -31 -70 2 C -64 27 -49 55 -35 69 C -4 56 31 41 55 20 C 76 3 81 -18 68 -27 C 49 -40 19 -35 -11 -4 Z');
  const fabric = ctx.createLinearGradient(-65, -55, 66, 65);
  fabric.addColorStop(0, '#66a5f6');
  fabric.addColorStop(.45, '#5699f1');
  fabric.addColorStop(1, '#4588dd');
  const sheen = ctx.createRadialGradient(-48, -31, 0, -48, -31, 68);
  sheen.addColorStop(0, 'rgba(231,248,255,.18)');
  sheen.addColorStop(1, 'rgba(231,248,255,0)');

  function flight(time) {
    const breeze = Math.sin(time * .96);
    const gust = Math.sin(time * 1.63 + .7);
    return {
      x: 198 + 12 * breeze + 3 * gust,
      y: 111 + 8 * Math.sin(time * .96 + 1.45) + 2 * Math.cos(time * 2.05),
      angle: .12 * Math.cos(time * .96 + .28) + .035 * gust,
      width: 1 + .024 * Math.sin(time * 1.6)
    };
  }

  function lineAnchor(pose) {
    const x = 37 * pose.width;
    const y = 45;
    const cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
    return [pose.x + x * cos - y * sin, pose.y + x * sin + y * cos];
  }

  function drawLine(time) {
    ctx.beginPath();
    for (let step = 0; step <= 32; step++) {
      const distance = step / 32;
      // The wind reaches the free end later than the attachment point.
      const [anchorX, anchorY] = lineAnchor(flight(time - distance * 1.2));
      const wave = Math.PI * 2 * (distance * 1.19 - time * .36);
      const x = anchorX + 124 * distance ** 1.37 + 17 * distance * Math.sin(wave);
      const y = anchorY + 113 * distance + 14 * distance * Math.cos(wave);
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.setLineDash([8, 10]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(245,251,255,.96)';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawSail(pose) {
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle);
    ctx.scale(pose.width, 1);
    ctx.fillStyle = fabric;
    ctx.fill(sail);
    ctx.fillStyle = sheen;
    ctx.fill(sail);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#3679c8';
    ctx.stroke(sail);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(245,251,255,.9)';
    ctx.setLineDash([9, 10]);
    ctx.stroke(seam);
    ctx.restore();
  }

  let elapsed = .5;
  let previous;
  let frame;
  let visible = false;

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawLine(elapsed);
    drawSail(flight(elapsed));
  }
  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    draw();
  }
  function canFly() {
    return visible && !document.hidden && !reducedMotion.matches;
  }
  function tick(now) {
    frame = undefined;
    if (!canFly()) return;
    if (previous !== undefined) elapsed += Math.min((now - previous) / 1000, .05);
    previous = now;
    draw();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (canFly()) {
      if (frame === undefined) frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      frame = undefined;
      previous = undefined;
    }
  }
  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
})();
