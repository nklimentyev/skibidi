'use strict';

const canvas = document.querySelector('#chalk');
const board = document.querySelector('#board');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const cleanStatus = document.querySelector('#clean-status');
const cleanMessage = document.querySelector('.board-clean');
const cloth = document.querySelector('#cloth');
const wipeButton = document.querySelector('#wipe-board');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let surfaceWidth = 0;
let surfaceHeight = 0;
let dragging = false;
let lastPoint = null;
let progress = 0;
let animationFrame = null;
let erasedCells = new Set();
const gridColumns = 24;
const gridRows = 20;

function reportProgress(value) {
  progress = Math.min(100, Math.round(value));
  cleanStatus.innerHTML = 'Чистота: <strong>' + progress + '%</strong>';
  cleanMessage.classList.toggle('visible', progress === 100);
  cloth.style.opacity = progress === 100 ? '0' : '1';
  wipeButton.disabled = progress === 100;
  wipeButton.innerHTML = progress === 100 ? 'Зачёт! ✓' : 'Стереть всё <span><svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg></span>';
}

function drawBoard() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  dragging = false;
  lastPoint = null;
  surfaceWidth = board.clientWidth;
  surfaceHeight = board.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(surfaceWidth * dpr);
  canvas.height = Math.round(surfaceHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#17212c';
  ctx.fillRect(0, 0, surfaceWidth, surfaceHeight);
  const scale = surfaceWidth / 450;
  ctx.save();
  ctx.scale(scale, surfaceHeight / 360);
  // Subtle chalk smudges give the training board its classroom texture.
  for (let i = 0; i < 65; i++) {
    ctx.strokeStyle = 'rgba(220,230,202,' + (0.009 + (i % 5) * .003) + ')';
    ctx.lineWidth = 8 + i % 19;
    ctx.beginPath();
    ctx.moveTo((i * 79) % 450, (i * 43) % 360);
    ctx.lineTo((i * 79) % 450 + 90, (i * 43) % 360 - 18);
    ctx.stroke();
  }
  ctx.fillStyle = '#e5e8d5';
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillText('Тема: чистое будущее', 31, 47);
  ctx.strokeStyle = '#c6d2b6';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(29, 59); ctx.lineTo(272, 56); ctx.stroke();
  ctx.font = 'italic 42px Georgia, serif';
  ctx.fillText('E = mc²', 54, 132);
  ctx.fillStyle = '#d9ddbd';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.fillText('∫ вода · dt = сухо', 103, 201);
  ctx.fillStyle = '#b3c6ab';
  ctx.font = 'italic 19px Georgia, serif';
  ctx.fillText('отжим → ∞', 43, 272);
  ctx.font = '13px monospace';
  ctx.fillText('ДАНО: тряпка', 270, 98);
  ctx.fillText('НАЙТИ: дзен', 270, 118);
  ctx.strokeStyle = '#d8dec2'; ctx.lineWidth = 1.5;
  ctx.beginPath();ctx.moveTo(334, 166);ctx.lineTo(334, 227);ctx.lineTo(407, 227);ctx.moveTo(332, 168);ctx.lineTo(328, 176);ctx.moveTo(334, 166);ctx.lineTo(339, 175);ctx.moveTo(406, 227);ctx.lineTo(398, 222);ctx.moveTo(406, 227);ctx.lineTo(398, 231);ctx.stroke();
  ctx.beginPath();ctx.moveTo(342, 215);ctx.bezierCurveTo(355, 210, 359, 186, 395, 180);ctx.stroke();
  ctx.fillStyle = '#d9ddbd';ctx.font = 'italic 13px Georgia, serif';ctx.fillText('успех', 350, 158);
  ctx.font = 'italic 15px Georgia, serif';ctx.fillText('Всё начинается с тряпки.', 37, 325);
  ctx.restore();
  erasedCells.clear();
  cloth.style.left = ''; cloth.style.top = '';
  cloth.style.right = ''; cloth.style.bottom = '';
  reportProgress(0);
}

function pointFromEvent(event) {
  // getBoxQuads is not universal; invert the board's small decorative rotation.
  const rect = board.getBoundingClientRect();
  const angle = 0;
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  return {x: dx * Math.cos(angle) - dy * Math.sin(angle) + surfaceWidth / 2,
    y: dx * Math.sin(angle) + dy * Math.cos(angle) + surfaceHeight / 2};
}

function erase(point, previous) {
  const radius = Math.max(28, surfaceWidth * .075);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = radius * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();ctx.moveTo(previous?.x ?? point.x, previous?.y ?? point.y);ctx.lineTo(point.x, point.y);ctx.stroke();
  ctx.beginPath();ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);ctx.fill();
  const start = previous || point;
  const distance = Math.hypot(point.x-start.x, point.y-start.y);
  const samples = Math.max(1, Math.ceil(distance / (radius / 2)));
  for (let s=0;s<=samples;s++) {
    const x = start.x + (point.x-start.x)*s/samples;
    const y = start.y + (point.y-start.y)*s/samples;
    for (let row=0;row<gridRows;row++) for (let col=0;col<gridColumns;col++) {
      const gx=(col+.5)*surfaceWidth/gridColumns, gy=(row+.5)*surfaceHeight/gridRows;
      if (Math.hypot(gx-x,gy-y) < radius) erasedCells.add(row*gridColumns+col);
    }
  }
  cloth.style.left = (point.x - 45) + 'px';
  cloth.style.top = (point.y - 25) + 'px';
  cloth.style.right = 'auto'; cloth.style.bottom = 'auto';
  const amount=erasedCells.size/(gridColumns*gridRows)*100;
  if (amount >= 94) {ctx.clearRect(0,0,surfaceWidth,surfaceHeight);reportProgress(100);}
  else reportProgress(amount);
}

canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || progress === 100 || animationFrame) return;
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  lastPoint = pointFromEvent(event);
  erase(lastPoint);
});
canvas.addEventListener('pointermove', event => {
  if (!dragging) return;
  const point = pointFromEvent(event);
  erase(point,lastPoint);
  lastPoint = point;
});
function stopDrawing() {dragging = false;lastPoint=null;}
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointercancel', stopDrawing);
canvas.addEventListener('lostpointercapture', stopDrawing);
wipeButton.addEventListener('click', () => {
  if (progress === 100 || animationFrame) return;
  if (reduceMotion.matches) {ctx.clearRect(0,0,surfaceWidth,surfaceHeight);reportProgress(100);return;}
  const start = performance.now();
  const startProgress = progress;
  let lastX = 0;
  wipeButton.disabled = true;
  function animate(now) {
    const fraction = Math.min((now-start)/1000,1);
    const x = fraction*surfaceWidth;
    ctx.clearRect(lastX,0,x-lastX+2,surfaceHeight);
    cloth.style.left = (x-40)+'px';cloth.style.top = (surfaceHeight/2-25)+'px';
    cloth.style.right='auto';cloth.style.bottom='auto';
    lastX=x;
    reportProgress(startProgress + fraction*(100-startProgress));
    wipeButton.disabled = true;
    if (fraction < 1) animationFrame=requestAnimationFrame(animate);
    else {animationFrame=null;ctx.clearRect(0,0,surfaceWidth,surfaceHeight);reportProgress(100);}
  }
  animationFrame=requestAnimationFrame(animate);
});
document.querySelector('#reset-board').addEventListener('click',drawBoard);
let boardWidth = 0;
new ResizeObserver(() => {
  if (board.clientWidth !== boardWidth) {boardWidth=board.clientWidth;drawBoard();}
}).observe(board);

const dialog=document.querySelector('#enroll-dialog');
const form=document.querySelector('#enroll-form');
const formView=document.querySelector('#enroll-form-view');
const successView=document.querySelector('#enroll-success');
const nameInput=document.querySelector('#student-name');
const courseSelect=document.querySelector('#course-select');
let enrolledName='';
let enrolledCourse='';

function showForm() {formView.hidden=false;successView.hidden=true;}
document.querySelectorAll('[data-enroll]').forEach(button => {
  button.addEventListener('click',() => {
    showForm();courseSelect.value=button.dataset.enroll;
    dialog.showModal();document.body.classList.add('modal-open');
  });
});
document.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>document.body.classList.remove('modal-open'));
dialog.addEventListener('click',event=>{
  const rect=dialog.getBoundingClientRect();
  if(event.target===dialog && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)) dialog.close();
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  enrolledName=nameInput.value.trim();
  if (!enrolledName) {nameInput.setCustomValidity('Нужно хотя бы имя. Тряпка должна знать своего героя.');nameInput.reportValidity();return;}
  enrolledCourse=courseSelect.value;
  document.querySelector('#graduate-name').textContent=enrolledName;
  formView.hidden=true;successView.hidden=false;
  document.querySelector('#download-certificate').focus();
});
nameInput.addEventListener('input',()=>nameInput.setCustomValidity(''));
document.querySelector('#enroll-again').addEventListener('click',()=>{showForm();nameInput.focus();});

document.querySelector('#download-certificate').addEventListener('click',async()=>{
  const button=document.querySelector('#download-certificate');
  button.disabled=true;
  try {
    await document.fonts.ready;
    const certificate=document.createElement('canvas');certificate.width=1600;certificate.height=1100;
    const c=certificate.getContext('2d');
    c.fillStyle='#f5f5f7';c.fillRect(0,0,1600,1100);
    c.strokeStyle='#1d1d1f';c.lineWidth=2;c.strokeRect(40,40,1520,1020);
    c.strokeStyle='#d2d2d7';c.strokeRect(55,55,1490,990);
    c.textAlign='center';c.fillStyle='#0071e3';c.font='700 26px Manrope, Arial';
    c.fillText('ДАВЫДОВ / ШКОЛА ЧИСТОЙ ДОСКИ / 916',800,140);
    c.fillStyle='#1d1d1f';c.font='italic 100px Georgia';c.fillText('Сертификат',800,290);
    c.font='500 22px Manrope, Arial';c.fillText('ШУТОЧНЫЙ. ЗАТО КАКОЙ КРАСИВЫЙ.',800,350);
    let fontSize=65;c.font='700 '+fontSize+'px Manrope, Arial';
    while(c.measureText(enrolledName).width>1340 && fontSize>25){fontSize--;c.font='700 '+fontSize+'px Manrope, Arial';}
    c.fillText(enrolledName,800,480);
    c.strokeStyle='#0071e3';c.beginPath();c.moveTo(480,520);c.lineTo(1120,520);c.stroke();
    c.font='400 28px Manrope, Arial';c.fillText('успешно вообразил(а) прохождение программы',800,590);
    c.font='600 36px Manrope, Arial';c.fillText('«'+enrolledCourse+'»',800,655);
    c.font='italic 29px Georgia';c.fillText('и получает почётное звание магистра влажных наук.',800,725);
    c.font='500 20px Manrope, Arial';c.fillText('КОМИССИЯ: ВЫ, ТРЯПКА И ОТРАЖЕНИЕ ЛАМПЫ',800,850);
    c.fillStyle='#6e6e73';c.font='400 18px Manrope, Arial';
    c.fillText('Пародия. Не является документом об образовании. Не связан с НИУ МАИ.',800,970);
    c.font='400 16px Manrope, Arial';c.fillText('Выдан '+new Date().toLocaleDateString('ru-RU')+' · Реальных занятий и платежей нет.',800,1005);
    const blob=await new Promise(resolve=>certificate.toBlob(resolve,'image/png'));
    if (!blob) throw new Error('Не удалось создать изображение');
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=url;anchor.download='sertifikat-magistra-otzhima.png';document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  } catch (error) {
    button.textContent='Не удалось скачать. Попробовать ещё раз';
  } finally {button.disabled=false;}
});
