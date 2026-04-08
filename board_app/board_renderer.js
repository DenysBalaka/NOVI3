// === ФАЙЛ: board_app/board_renderer.js ===
import { debounce } from '../utils.js'; 

window.$ = (s,el=document) => el.querySelector(s);
window.$$ = (s,el=document) => Array.from(el.querySelectorAll(s));
// === ВИПРАВЛЕНО: Прибрано зайвий \ в кінці рядка ===
window.esc = (str) => String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let canvas, ctx, bgCanvas, bgCtx, boardFilePath = null;
let boardData = { strokes: [], images: [], texts: [], shapes: [], template: 'blank' };
let imageCache = {}; 
let viewport = { x: 0, y: 0, scale: 1 }; 
let isPanning = false, lastPanPoint = { x: 0, y: 0 };
let editorState = 'idle', selectedObject = null, dragStart = { x: 0, y: 0 }, initialObjectState = null; 
let activeTool = 'pen', penColor = '#FF0000', penWidth = 5, eraserWidth = 30;
let currentStroke = null; 
const shapeTools = ['line', 'rect', 'circle', 'triangle', 'cylinder', 'star', 'rhombus', 'hexagon', 'arrow'];
let currentShapeIndex = 0; 
let historyStack = [], redoStack = []; const MAX_HISTORY = 50;
const ZOOM_MIN = 0.1, ZOOM_MAX = 10;

function toWorld(sx, sy) { return { x: (sx - viewport.x) / viewport.scale, y: (sy - viewport.y) / viewport.scale }; }
function toScreen(wx, wy) { return { x: wx * viewport.scale + viewport.x, y: wy * viewport.scale + viewport.y }; }

document.addEventListener('DOMContentLoaded', async () => {
  canvas = window.$("#board-canvas"); ctx = canvas.getContext('2d');
  bgCanvas = window.$("#board-canvas-bg"); bgCtx = bgCanvas.getContext('2d');

  window.$("#board-win-min").onclick = () => window.tj.boardWinMin();
  window.$("#board-win-max").onclick = () => window.tj.boardWinMax();
  window.$("#board-win-close").onclick = async () => { await saveBoardNow(); window.tj.boardWinClose(); };
  bindToolbar(); bindCanvasEvents(); bindDraggableToolbar(); bindKeyEvents();
  window.addEventListener('resize', debounce(resizeCanvas, 100)); resizeCanvas();
  window.tj.on('board-init-data', async (fp) => {
    boardFilePath = fp; window.$("#board-title").innerHTML = `🎨 <b>Дошка:</b> ${window.esc(fp.split('\\').pop())}`;
    await loadBoard();
  });
});

async function loadBoard() {
  if (!boardFilePath) return;
  try {
    const data = await window.tj.readJSON(boardFilePath);
    if (data) {
      boardData = { ...data, strokes: data.strokes||[], images: data.images||[], texts: data.texts||[], shapes: data.shapes||[], template: data.template||'blank', viewport: data.viewport||{x:0,y:0,scale:1} };
      viewport = boardData.viewport; window.$("#template-select").value = boardData.template;
      pushHistory(); await cacheAllImages(); redrawAll(); updateZoomUI();
    }
  } catch (e) { console.error(e); }
}
async function saveBoardNow() { if (boardFilePath) { boardData.template = window.$("#template-select").value; boardData.viewport = viewport; await window.tj.writeJSON(boardFilePath, boardData); } }
const saveBoard = debounce(saveBoardNow, 1000);
async function cacheAllImages() { await Promise.all(boardData.images.map(img => new Promise(res => { if (imageCache[img.dataURL]) return res(); const i = new Image(); i.onload = () => { imageCache[img.dataURL] = i; res(); }; i.onerror = res; i.src = img.dataURL; }))); }
function pushHistory() { const s = JSON.stringify(boardData); if (!historyStack.length || historyStack[historyStack.length-1] !== s) { historyStack.push(s); if (historyStack.length > MAX_HISTORY) historyStack.shift(); redoStack = []; updateUndoRedoUI(); } }
function undo() { if (historyStack.length > 1) { redoStack.push(historyStack.pop()); boardData = JSON.parse(historyStack[historyStack.length-1]); cacheAllImages().then(redrawAll); updateUndoRedoUI(); } }
function redo() { if (redoStack.length > 0) { const s = redoStack.pop(); historyStack.push(s); boardData = JSON.parse(s); cacheAllImages().then(redrawAll); updateUndoRedoUI(); } }
function updateUndoRedoUI() { window.$("#tool-undo").disabled = historyStack.length <= 1; window.$("#tool-redo").disabled = redoStack.length === 0; }

function resizeCanvas() {
  const w = window.innerWidth, h = window.innerHeight - 40;
  canvas.width = w; canvas.height = h;
  bgCanvas.width = w; bgCanvas.height = h;
  redrawAll();
}

function redrawAll() {
  const { width, height } = canvas;
  bgCtx.resetTransform(); bgCtx.clearRect(0, 0, width, height);
  drawBackground(bgCtx);
  ctx.resetTransform(); ctx.clearRect(0, 0, width, height);
  ctx.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.x, viewport.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  boardData.images.forEach(o => drawObject(ctx, o, 'image'));
  boardData.shapes.forEach(o => drawObject(ctx, o, 'shape'));
  boardData.strokes.forEach(o => drawStroke(ctx, o));
  boardData.texts.forEach((o, i) => { if (!(editorState==='editing_text' && selectedObject?.index===i && selectedObject?.type==='text')) drawObject(ctx, o, 'text'); });
  if (editorState === 'drawing' && currentStroke) drawStroke(ctx, currentStroke);
  if (selectedObject && editorState !== 'editing_text') drawSelectionBox(ctx, selectedObject);
  updateZoomUI();
}

function drawBackground(context) {
  const t = boardData.template; context.save();
  if (t === 'dark') context.fillStyle = '#0b0b0f';
  else context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  if (t === 'grid' || t === 'lines') {
    context.strokeStyle = t === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(2,6,23,0.10)';
    context.lineWidth = 1;
    const gs = 25 * viewport.scale, ox = viewport.x % gs, oy = viewport.y % gs;
    context.beginPath();
    if (t === 'grid') for (let x = ox; x < context.canvas.width; x += gs) { context.moveTo(x, 0); context.lineTo(x, context.canvas.height); }
    for (let y = oy; y < context.canvas.height; y += gs) { context.moveTo(0, y); context.lineTo(context.canvas.width, y); }
    context.stroke();
  }
  context.restore();
}

function drawObject(c, obj, type) {
  c.save(); const center = getCenter(obj, type);
  c.translate(center.x, center.y); c.rotate(obj.rotation || 0); c.translate(-center.x, -center.y);
  if (type === 'image') { const img = imageCache[obj.dataURL]; if (img) c.drawImage(img, obj.x, obj.y, obj.width, obj.height); }
  else if (type === 'text') {
    c.font = `${obj.size}px Segoe UI`; c.fillStyle = obj.color; c.textBaseline = 'top';
    obj.content.split('\n').forEach((l, i) => c.fillText(l, obj.x, obj.y + (i * obj.size * 1.2)));
  } else if (type === 'shape') drawStroke(c, obj);
  c.restore();
}

function drawStroke(c, s) {
  if (!s.points?.length) return;
  c.beginPath(); c.strokeStyle = s.color; c.lineWidth = s.width;
  c.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  const [x1, y1] = s.points[0];
  if (s.tool === 'pen' || s.tool === 'eraser') {
    c.moveTo(x1, y1); for (let i = 1; i < s.points.length; i++) c.lineTo(s.points[i][0], s.points[i][1]); c.stroke();
  } else {
    const [x2, y2] = s.points[1] || [x1, y1], w = x2-x1, h = y2-y1;
    if (s.tool === 'line') { c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    else if (s.tool === 'rect') c.strokeRect(x1, y1, w, h);
    else if (s.tool === 'circle') { c.beginPath(); c.ellipse(x1+w/2, y1+h/2, Math.abs(w)/2, Math.abs(h)/2, 0, 0, Math.PI*2); c.stroke(); }
    else if (s.tool === 'triangle') { c.beginPath(); c.moveTo(x1+w/2, y1); c.lineTo(x1, y2); c.lineTo(x2, y2); c.closePath(); c.stroke(); }
    else if (s.tool === 'rhombus') { c.beginPath(); c.moveTo(x1+w/2, y1); c.lineTo(x2, y1+h/2); c.lineTo(x1+w/2, y2); c.lineTo(x1, y1+h/2); c.closePath(); c.stroke(); }
    else if (s.tool === 'hexagon') {
       const cx=x1+w/2, cy=y1+h/2, rx=Math.abs(w)/2, ry=Math.abs(h)/2; c.beginPath();
       for(let i=0;i<6;i++){ const a=Math.PI/3*i, px=cx+rx*Math.cos(a), py=cy+ry*Math.sin(a); i===0?c.moveTo(px,py):c.lineTo(px,py); } c.closePath(); c.stroke();
    }
    else if (s.tool === 'star') {
        const cx=x1+w/2, cy=y1+h/2, or=Math.min(Math.abs(w), Math.abs(h))/2, ir=or/2.5; c.beginPath();
        for(let i=0;i<10;i++){ const a=Math.PI/5*i-Math.PI/2, r=i%2===0?or:ir; i===0?c.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):c.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a)); } c.closePath(); c.stroke();
    }
    else if (s.tool === 'cylinder') {
        const rx=Math.abs(w)/2, ry=Math.min(Math.abs(h)/6, 20);
        c.beginPath(); c.ellipse(x1+w/2, y1+ry, rx, ry, 0, 0, Math.PI*2); c.stroke();
        c.beginPath(); c.moveTo(x1, y1+ry); c.lineTo(x1, y2-ry); c.moveTo(x2, y1+ry); c.lineTo(x2, y2-ry); c.stroke();
        c.beginPath(); c.ellipse(x1+w/2, y2-ry, rx, ry, 0, 0, Math.PI); c.stroke();
    }
    else if (s.tool === 'arrow') {
        const hl=Math.max(15, s.width*3), ang=Math.atan2(y2-y1, x2-x1);
        c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x2-hl*Math.cos(ang-Math.PI/6), y2-hl*Math.sin(ang-Math.PI/6));
        c.moveTo(x2, y2); c.lineTo(x2-hl*Math.cos(ang+Math.PI/6), y2-hl*Math.sin(ang+Math.PI/6)); c.stroke();
    }
  }
  c.globalCompositeOperation = 'source-over';
}

function drawSelectionBox(c, sel) {
  const obj = getObjectData(sel); if (!obj) return;
  const box = getBoundingBox(obj, sel.type), center = getCenter(obj, sel.type);
  c.save(); c.translate(center.x, center.y); c.rotate(obj.rotation || 0); c.translate(-center.x, -center.y);
  c.strokeStyle = '#5865F2'; c.lineWidth = 2/viewport.scale;
  c.setLineDash([5/viewport.scale, 5/viewport.scale]); c.strokeRect(box.x, box.y, box.width, box.height);
  c.setLineDash([]); c.fillStyle = '#fff'; const hs = 12/viewport.scale;
  c.fillRect(box.x+box.width-hs/2, box.y+box.height-hs/2, hs, hs); c.strokeRect(box.x+box.width-hs/2, box.y+box.height-hs/2, hs, hs);
  c.beginPath(); c.arc(box.x+box.width/2, box.y-30/viewport.scale, hs/2, 0, Math.PI*2); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(box.x+box.width/2, box.y); c.lineTo(box.x+box.width/2, box.y-30/viewport.scale+hs/2); c.stroke();
  c.restore();
}

function getObjectData(sel) { return sel.type==='image'?boardData.images[sel.index]:(sel.type==='text'?boardData.texts[sel.index]:boardData.shapes[sel.index]); }
function getBoundingBox(obj, type) {
  if (type==='image') return {x:obj.x,y:obj.y,width:obj.width,height:obj.height};
  if (type==='text') { ctx.font=`${obj.size}px Segoe UI`; const lines=obj.content.split('\n'); let mw=0; lines.forEach(l=>mw=Math.max(mw,ctx.measureText(l).width)); return {x:obj.x,y:obj.y,width:mw,height:lines.length*obj.size*1.2}; }
  const [p0,p1]=obj.points; return {x:Math.min(p0[0],p1[0]),y:Math.min(p0[1],p1[1]),width:Math.abs(p1[0]-p0[0]),height:Math.abs(p1[1]-p0[1])};
}
function getCenter(o,t) { const b=getBoundingBox(o,t); return {x:b.x+b.width/2,y:b.y+b.height/2}; }
function isPointInRotatedBox(wx, wy, obj, type) {
  const box = getBoundingBox(obj, type);
  const center = { x: box.x + box.width/2, y: box.y + box.height/2 };
  const angle = -(obj.rotation || 0);
  const rx = (wx - center.x) * Math.cos(angle) - (wy - center.y) * Math.sin(angle) + center.x;
  const ry = (wx - center.x) * Math.sin(angle) + (wy - center.y) * Math.cos(angle) + center.y;
  return rx >= box.x && rx <= box.x + box.width && ry >= box.y && ry <= box.y + box.height;
}
function hitTest(wx, wy) {
  if (selectedObject) {
    const obj=getObjectData(selectedObject), b=getBoundingBox(obj,selectedObject.type), c={x:b.x+b.width/2,y:b.y+b.height/2}, a=-(obj.rotation||0);
    const rx=(wx-c.x)*Math.cos(a)-(wy-c.y)*Math.sin(a)+c.x, ry=(wx-c.x)*Math.sin(a)+(wy-c.y)*Math.cos(a)+c.y, hs=(12/viewport.scale)+10;
    if(Math.abs(rx-(b.x+b.width))<hs && Math.abs(ry-(b.y+b.height))<hs) return {action:'resize',...selectedObject};
    if(Math.abs(rx-(b.x+b.width/2))<hs && Math.abs(ry-(b.y-30/viewport.scale))<hs) return {action:'rotate',...selectedObject};
  }
  const check=(o,t,i)=> {
    return isPointInRotatedBox(wx, wy, o, t) ? {type:t,index:i,action:'drag'} : null;
  }
  for(let i=boardData.texts.length-1;i>=0;i--) { const h=check(boardData.texts[i],'text',i); if(h) return h; }
  for(let i=boardData.shapes.length-1;i>=0;i--) { const h=check(boardData.shapes[i],'shape',i); if(h) return h; }
  for(let i=boardData.images.length-1;i>=0;i--) { const h=check(boardData.images[i],'image',i); if(h) return h; }
  return null;
}

function bindCanvasEvents() {
  canvas.addEventListener('wheel', (e) => {
    if (selectedObject && activeTool === 'select') {
      const obj = getObjectData(selectedObject);
      if (obj) {
        e.preventDefault();
        const f = e.deltaY < 0 ? 1.05 : 1 / 1.05;
        const center = getCenter(obj, selectedObject.type);
        
        if (selectedObject.type === 'text') {
          obj.size = Math.max(5, (obj.size || 16) * f);
          const newCenter = getCenter(obj, 'text');
          obj.x += center.x - newCenter.x;
          obj.y += center.y - newCenter.y;
          
        } else if (selectedObject.type === 'image') {
          obj.width = Math.max(10, obj.width * f);
          obj.height = Math.max(10, obj.height * f);
          const newCenter = getCenter(obj, 'image');
          obj.x += center.x - newCenter.x;
          obj.y += center.y - newCenter.y;
          
        } else if (selectedObject.type === 'shape') {
          obj.points = obj.points.map(p => {
            return [
              center.x + (p[0] - center.x) * f,
              center.y + (p[1] - center.y) * f
            ];
          });
        }
        redrawAll();
        saveBoard();
        return;
      }
    }
    
    e.preventDefault();
    if (activeTool === 'hand' || e.ctrlKey) {
      const f = e.deltaY < 0 ? 1.1 : 1/1.1;
      zoomAt(e.offsetX, e.offsetY, f);
    } else if (activeTool === 'pen' || shapeTools.includes(activeTool) || activeTool === 'text') {
      penWidth = Math.max(1, Math.min(100, penWidth + (e.deltaY < 0 ? 2 : -2)));
      window.$("#tool-stroke").value = penWidth; window.$("#stroke-value").textContent = penWidth;
      
      if (editorState === 'editing_text') {
          const i = window.$("#text-input-overlay");
          if (i.style.display === 'block') {
              i.style.fontSize = `${Math.max(12, penWidth*2*viewport.scale)}px`;
          }
      }
      
      if (currentStroke) { currentStroke.width = penWidth; redrawAll(); }
    } else if (activeTool === 'eraser') {
      eraserWidth = Math.max(5, Math.min(200, eraserWidth + (e.deltaY < 0 ? 5 : -5)));
      window.$("#tool-eraser-stroke").value = eraserWidth; window.$("#eraser-stroke-value").textContent = eraserWidth;
    }
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    if (editorState === 'editing_text') {
        const i = window.$("#text-input-overlay");
        if (i.style.display === 'block') {
            i.blur();
        }
        return; 
    }

    if (e.button !== 0 && e.button !== 1) return;
    if (activeTool === 'hand' || e.button === 1) { isPanning = true; lastPanPoint = {x:e.clientX,y:e.clientY}; canvas.style.cursor = 'grabbing'; return; }
    
    const {x:wx,y:wy} = toWorld(e.offsetX,e.offsetY);
    
    if (activeTool === 'select') {
      const h = hitTest(wx, wy);
      if (h) { selectedObject={type:h.type,index:h.index}; editorState=h.action==='rotate'?'rotating':(h.action==='resize'?'resizing':'dragging'); const o=getObjectData(selectedObject); initialObjectState=JSON.parse(JSON.stringify(o)); dragStart={x:wx,y:wy,centerX:getCenter(o,h.type).x,centerY:getCenter(o,h.type).y,initialRotation:o.rotation||0,startAngle:Math.atan2(wy-getCenter(o,h.type).y,wx-getCenter(o,h.type).x)}; redrawAll(); }
      else { selectedObject=null; isPanning=true; lastPanPoint={x:e.clientX,y:e.clientY}; canvas.style.cursor='grabbing'; redrawAll(); }
    } else if (activeTool === 'text') {
      showTextInput(e.offsetX, e.offsetY, wx, wy);
    } else {
      editorState='drawing'; dragStart={x:wx,y:wy}; currentStroke={tool:activeTool,color:penColor,width:activeTool==='eraser'?eraserWidth:penWidth,points:[[wx,wy]]}; redrawAll();
    }
  });

  window.addEventListener('pointermove', (e) => {
    if (isPanning) { viewport.x += e.clientX-lastPanPoint.x; viewport.y += e.clientY-lastPanPoint.y; lastPanPoint={x:e.clientX,y:e.clientY}; redrawAll(); return; }
    const {x:wx,y:wy}=toWorld(e.offsetX,e.offsetY);
    
    if (editorState==='drawing') {
      if(activeTool==='pen'||activeTool==='eraser') currentStroke.points.push([wx,wy]); else currentStroke.points[1]=[wx,wy]; redrawAll();
    } else if (selectedObject && initialObjectState) {
      const o=getObjectData(selectedObject), dx=wx-dragStart.x, dy=wy-dragStart.y;
      if (editorState==='dragging') { if(selectedObject.type==='shape') o.points=initialObjectState.points.map(p=>[p[0]+dx,p[1]+dy]); else { o.x=initialObjectState.x+dx; o.y=initialObjectState.y+dy; } }
      else if (editorState==='resizing') { 
        if(selectedObject.type==='shape') o.points[1]=[wx,wy]; 
        else if(selectedObject.type==='image') { o.width=Math.max(10,initialObjectState.width+(wx-dragStart.x)); o.height=Math.max(10,initialObjectState.height+(wy-dragStart.y)); }
        else if (selectedObject.type === 'text') {
          const initialBox = getBoundingBox(initialObjectState, 'text');
          const oldDist = Math.hypot(dragStart.x - initialBox.x, dragStart.y - initialBox.y);
          if (oldDist > 1) {
            const newDist = Math.hypot(wx - initialBox.x, wy - initialBox.y);
            const scaleFactor = newDist / oldDist;
            o.size = Math.max(5, initialObjectState.size * scaleFactor);
          }
        }
      }
      else if (editorState==='rotating') o.rotation=dragStart.initialRotation+(Math.atan2(wy-dragStart.centerY,wx-dragStart.centerX)-dragStart.startAngle);
      redrawAll();
    }
  });

  window.addEventListener('pointerup', () => {
    if (isPanning) { isPanning=false; updateCursor(); return; }
    if (editorState==='drawing'&&currentStroke?.points.length>1) { if(!shapeTools.includes(activeTool)||currentStroke.points[1]){ (shapeTools.includes(activeTool)?boardData.shapes:boardData.strokes).push(currentStroke); pushHistory(); saveBoard(); } }
    else if(['dragging','resizing','rotating'].includes(editorState)) { pushHistory(); saveBoard(); }
    editorState='idle'; currentStroke=null; initialObjectState=null; redrawAll();
  });

  canvas.addEventListener('dblclick', (e) => {
    const {x:wx,y:wy} = toWorld(e.offsetX,e.offsetY), h = hitTest(wx,wy);
    if (h) {
      if (h.type==='text') { 
        selectedObject={type:'text',index:h.index}; 
        const t=boardData.texts[h.index], s=toScreen(t.x,t.y); 
        showTextInput(s.x,s.y,t.x,t.y,t); 
      } else if (h.type==='image' || h.type==='shape') {
        setActiveTool('select');
        selectedObject = { type: h.type, index: h.index };
        redrawAll();
      }
    }
  });
}

function showTextInput(sx, sy, wx, wy, existing = null) {
  const i = window.$("#text-input-overlay");
  i.style.display='block'; i.style.left=`${sx}px`; i.style.top=`${sy}px`;
  i.style.fontSize=`${Math.max(12, penWidth*2*viewport.scale)}px`; i.style.color=penColor;
  i.value=existing?existing.content:"";
  setTimeout(() => i.focus(), 10);
  editorState='editing_text';
  const finish = () => {
    if(i.style.display==='none')return; const val=i.value.trim();
    if(val) { 
      if(existing){
        existing.content=val;existing.color=penColor;existing.size=parseInt(i.style.fontSize)/viewport.scale;
      } else {
        const newText = {content:val,x:wx,y:wy,color:penColor,size:parseInt(i.style.fontSize)/viewport.scale,rotation:0};
        boardData.texts.push(newText);
        selectedObject = { type: 'text', index: boardData.texts.length - 1 };
        setActiveTool('select');
      }
      pushHistory(); 
      saveBoard(); 
    }
    else if(existing) { boardData.texts.splice(selectedObject.index,1); selectedObject=null; pushHistory(); saveBoard(); }
    i.style.display='none'; i.value=""; editorState='idle'; redrawAll();
  };
  i.onblur=finish; i.onkeydown=(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();i.blur();}};
}

function bindToolbar() {
  window.$("#tool-undo").onclick = undo; window.$("#tool-redo").onclick = redo;
  window.$("#tool-hand").onclick = () => setActiveTool('hand');
  window.$("#tool-select").onclick = () => setActiveTool('select');
  window.$("#tool-pen").onclick = () => setActiveTool('pen');
  window.$("#tool-eraser").onclick = () => setActiveTool('eraser');
  window.$("#tool-text").onclick = () => setActiveTool('text');
  window.$("#tool-shape-cycle").onclick = cycleShapeTool;
  window.$("#tool-color").onchange = (e) => penColor = e.target.value;
  window.$("#tool-stroke").oninput = (e) => { penWidth = parseInt(e.target.value); window.$("#stroke-value").textContent = penWidth; };
  window.$("#tool-eraser-stroke").oninput = (e) => { eraserWidth = parseInt(e.target.value); window.$("#eraser-stroke-value").textContent = eraserWidth; };
  window.$("#template-select").onchange = (e) => { boardData.template = e.target.value; saveBoard(); redrawAll(); };
  window.$("#tool-zoom-in").onclick = () => zoomAt(canvas.width/2, canvas.height/2, 1.15);
  window.$("#tool-zoom-out").onclick = () => zoomAt(canvas.width/2, canvas.height/2, 1/1.15);
  window.$("#tool-zoom-reset").onclick = () => resetView();
  window.$("#tool-export").onclick = () => exportAsPng();
  window.$("#tool-clear").onclick = () => clearBoard();
  window.$("#tool-image").onclick = async () => {
    const f = await window.tj.chooseFiles(); if(f?.length) for(const p of f) { const d = await window.tj.readFileAsDataUrl(p); if(d) { const i=new Image(); i.onload=()=>{const c=toWorld(canvas.width/2,canvas.height/2);boardData.images.push({dataURL:d,x:c.x-i.width/4,y:c.y-i.height/4,width:i.width/2,height:i.height/2,rotation:0});imageCache[d]=i;pushHistory();saveBoard();redrawAll();}; i.src=d; } }
  };
}

function setActiveTool(t) {
  activeTool=t; window.$$(".tool-btn").forEach(b=>b.classList.remove('active'));
  (shapeTools.includes(t)?window.$("#tool-shape-cycle"):window.$(`#tool-${t}`))?.classList.add('active');
  window.$("#pen-settings").style.display=(t==='pen'||shapeTools.includes(t)||t==='text')?'flex':'none';
  window.$("#eraser-settings").style.display=t==='eraser'?'flex':'none';
  updateCursor(); 
  if (t !== 'select') {
    selectedObject=null; 
  }
  redrawAll();
}

function updateCursor() {
  if (activeTool === 'hand') canvas.style.cursor = 'grab';
  else if (activeTool === 'select') canvas.style.cursor = 'default';
  else if (activeTool === 'text') canvas.style.cursor = 'text';
  else canvas.style.cursor = 'crosshair';
}

function cycleShapeTool() {
  currentShapeIndex = (currentShapeIndex+1)%shapeTools.length; const t=shapeTools[currentShapeIndex];
  window.$("#tool-shape-cycle").innerHTML = window.$(`#icon-${t}`).innerHTML; setActiveTool(t);
}

function bindKeyEvents() {
  document.addEventListener('keydown', (e) => {
    if (editorState==='editing_text') return;
    if (e.ctrlKey && (e.key==='z' || e.key === 'я')) undo(); 
    if (e.ctrlKey && (e.key==='y' || e.key === 'ч')) redo();
    if (e.ctrlKey && (e.key === '0' || e.key === 'о')) { e.preventDefault(); resetView(); }
    if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomAt(canvas.width/2, canvas.height/2, 1.15); }
    if (e.ctrlKey && e.key === '-') { e.preventDefault(); zoomAt(canvas.width/2, canvas.height/2, 1/1.15); }
    if (e.ctrlKey && (e.key.toLowerCase() === 'e' || e.key === 'у')) { e.preventDefault(); exportAsPng(); }
    if (e.ctrlKey && (e.key.toLowerCase() === 'l' || e.key === 'д')) { e.preventDefault(); clearBoard(); }
    if (e.ctrlKey && (e.key.toLowerCase() === 's' || e.key === 'і')) { e.preventDefault(); saveBoardNow(); }
    if ((e.key==='Delete' || e.key === 'Backspace') && selectedObject) {
       if(selectedObject.type==='image') boardData.images.splice(selectedObject.index,1);
       if(selectedObject.type==='text') boardData.texts.splice(selectedObject.index,1);
       if(selectedObject.type==='shape') boardData.shapes.splice(selectedObject.index,1);
       selectedObject=null; pushHistory(); saveBoard(); redrawAll();
    }
    if(!e.ctrlKey && !e.altKey) {
      if(e.key==='h' || e.key === 'р')setActiveTool('hand'); 
      if(e.key==='v' || e.key === 'м')setActiveTool('select');
      if(e.key==='p' || e.key === 'з')setActiveTool('pen'); 
      if(e.key==='e' || e.key === 'у')setActiveTool('eraser');
      if(e.key==='t' || e.key === 'е')setActiveTool('text');
    }
  });
}

function updateZoomUI() {
  const el = window.$("#zoom-indicator");
  if (!el) return;
  const pct = Math.round((viewport.scale || 1) * 100);
  el.textContent = `${pct}%`;
}

function zoomAt(sx, sy, factor) {
  const m1 = toWorld(sx, sy);
  viewport.scale = Math.max(ZOOM_MIN, Math.min(viewport.scale * factor, ZOOM_MAX));
  const m2 = toWorld(sx, sy);
  viewport.x += (m2.x - m1.x) * viewport.scale;
  viewport.y += (m2.y - m1.y) * viewport.scale;
  redrawAll();
  saveBoard();
}

function resetView() {
  viewport = { x: 0, y: 0, scale: 1 };
  redrawAll();
  saveBoard();
}

async function exportAsPng() {
  try {
    const res = await window.tj.showSaveDialog({
      title: "Експорт дошки",
      defaultPath: "board.png",
      filters: [{ name: "PNG", extensions: ["png"] }]
    });
    if (!res || res.canceled || !res.filePath) return;
    const dataUrl = canvas.toDataURL("image/png");
    const wr = await window.tj.writeBase64File(res.filePath, dataUrl);
    if (wr && wr.error) throw new Error(wr.error);
  } catch (e) {
    console.error(e);
    // Без модалок: це вікно-дошка, краще не блокувати роботу
  }
}

async function clearBoard() {
  if (editorState === 'editing_text') return;
  boardData.strokes = [];
  boardData.shapes = [];
  boardData.texts = [];
  boardData.images = [];
  selectedObject = null;
  pushHistory();
  redrawAll();
  saveBoard();
}

function bindDraggableToolbar() {
  const t = window.$("#floating-toolbar");
  const h = window.$("#toolbar-drag-handle");
  let isD = false, dx, dy;

  // Обробник початку перетягування (залишається на 'h')
  h.onpointerdown = (e) => {
    isD = true;
    const r = t.getBoundingClientRect();
    dx = e.clientX - r.left;
    dy = e.clientY - r.top;
    
    t.style.transform = 'none';
    t.classList.remove('docked-left', 'docked-right');
    h.style.cursor = 'grabbing';
    
    // ВАЖЛИВО: Прив'язуємо 'move' та 'up' до 'window'
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  };

  // Обробник руху (на 'window')
  function onDragMove(e) {
    if (!isD) return; 
    // Оновлюємо позицію плавно
    t.style.left = `${e.clientX - dx}px`;
    t.style.top = `${e.clientY - dy}px`;
  }

  // Обробник відпускання кнопки (на 'window')
  function onDragEnd(e) {
    if (!isD) return; // Запобігаємо подвійному спрацюванню
    isD = false;
    h.style.cursor = 'grab';

    // ВАЖЛИВО: Прибираємо слухачі з 'window'
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);

    // Логіка "приліпання" до країв
    const r = t.getBoundingClientRect(); 
    if (r.left < 20) {
      t.classList.add('docked-left');
      t.style.left = '';
      t.style.top = Math.max(10, Math.min(window.innerHeight - r.height - 10, r.top)) + 'px';
    } else if (r.right > window.innerWidth - 20) {
      t.classList.add('docked-right');
      t.style.left = '';
      t.style.top = Math.max(10, Math.min(window.innerHeight - r.height - 10, r.top)) + 'px';
    }
  }
}