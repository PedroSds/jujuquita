const cropDialog = document.querySelector('#photo-crop-dialog');

function validProductPhoto(file) {
  return ['image/png','image/jpeg','image/webp'].includes(file.type) && file.size <= 25 * 1024 * 1024;
}

function canvasBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function compressedCrop(canvas) {
  const exportCanvas = document.createElement('canvas');
  for (const size of [800, 640, 480]) {
    exportCanvas.width = exportCanvas.height = size;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(canvas, 0, 0, size, size);
    for (const quality of [.9, .78, .64, .5]) {
      const blob = await canvasBlob(exportCanvas, 'image/jpeg', quality);
      if (blob && blob.size <= 500000) return readPhoto(blob);
    }
  }
  throw Error('Não foi possível preparar esta foto. Escolha outra imagem.');
}

async function cropProductPhoto(file, title) {
  const url = URL.createObjectURL(file);
  const photo = new Image();
  try {
    photo.src = url;
    await photo.decode();
    if (!photo.naturalWidth || !photo.naturalHeight) throw Error('Foto inválida.');
    return await new Promise((resolve, reject) => {
      const canvas = cropDialog.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const zoom = cropDialog.querySelector('#crop-zoom');
      const horizontal = cropDialog.querySelector('#crop-x');
      const vertical = cropDialog.querySelector('#crop-y');
      const apply = cropDialog.querySelector('#crop-apply');
      const cancel = cropDialog.querySelector('#crop-cancel');
      const reset = cropDialog.querySelector('#crop-reset');
      let side, x, y, drag, result = null, busy = false, error = null;
      cropDialog.querySelector('#crop-title').textContent = title;
      function draw() {
        side = Math.min(photo.naturalWidth, photo.naturalHeight) / Number(zoom.value);
        const maxX = photo.naturalWidth - side, maxY = photo.naturalHeight - side;
        horizontal.disabled = maxX < .1;
        vertical.disabled = maxY < .1;
        x = maxX * Number(horizontal.value) / 100;
        y = maxY * Number(vertical.value) / 100;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(photo, x, y, side, side, 0, 0, canvas.width, canvas.height);
      }
      function resetPosition() {
        zoom.value = 1;
        horizontal.value = vertical.value = 50;
        draw();
      }
      zoom.oninput = horizontal.oninput = vertical.oninput = draw;
      reset.onclick = resetPosition;
      cancel.onclick = () => { if (!busy) cropDialog.close(); };
      cropDialog.oncancel = event => { if (busy) event.preventDefault(); };
      canvas.onpointerdown = event => {
        if (busy || drag || event.button !== 0) return;
        drag = {id:event.pointerId, clientX:event.clientX, clientY:event.clientY, x, y, scale:side/canvas.clientWidth};
        canvas.setPointerCapture(event.pointerId);
      };
      canvas.onpointermove = event => {
        if (busy || !drag || drag.id !== event.pointerId) return;
        const maxX = photo.naturalWidth - side, maxY = photo.naturalHeight - side;
        const percent = (value, max) => max ? Math.max(0, Math.min(100, value * 100 / max)) : 50;
        horizontal.value = percent(drag.x - (event.clientX - drag.clientX) * drag.scale, maxX);
        vertical.value = percent(drag.y - (event.clientY - drag.clientY) * drag.scale, maxY);
        draw();
      };
      canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = () => { drag = null; };
      apply.onclick = async () => {
        if (busy) return;
        busy = true;
        apply.disabled = cancel.disabled = reset.disabled = zoom.disabled = horizontal.disabled = vertical.disabled = true;
        apply.textContent = 'Preparando…';
        try { result = await compressedCrop(canvas); }
        catch (err) { error = err; }
        finally { cropDialog.close(); }
      };
      cropDialog.addEventListener('close', () => {
        zoom.oninput = horizontal.oninput = vertical.oninput = null;
        canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = null;
        apply.onclick = cancel.onclick = reset.onclick = cropDialog.oncancel = null;
        apply.disabled = cancel.disabled = reset.disabled = zoom.disabled = false;
        apply.textContent = 'Aplicar recorte';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (error) reject(error); else resolve(result);
      }, {once:true});
      resetPosition();
      cropDialog.showModal();
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
