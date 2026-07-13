(function () {
  'use strict';

  const colors = ['#2869a6','#c14b16','#168449','#7b3df0','#c70f43','#087d75','#a96400','#3e37c9','#2d75b8','#cb4310','#17883c','#7435e8','#be0d3e','#117f78','#a86500'];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function mount(host, payload) {
    host.innerHTML = '<canvas role="img"></canvas><div class="report-umap-key">Gray: smaller or catch-all archetypes</div><div class="report-umap-controls" aria-label="Plot zoom controls"><button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="reset">Reset</button></div><div class="report-umap-tooltip"></div>';
    const canvas = host.querySelector('canvas');
    canvas.setAttribute('aria-label', host.dataset.label || 'Deck similarity map');
    const ctx = canvas.getContext('2d');
    const tooltip = host.querySelector('.report-umap-tooltip');
    const points = payload.points;
    const groups = payload.meta.labeledArchetypes;
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const bounds = {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
    let width=0,height=0,dpr=1,zoom=1,panX=0,panY=0,hovered=null,down=null,moved=false;

    function resize() {
      const rect=canvas.getBoundingClientRect(); width=rect.width; height=rect.height; dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr); canvas.height=Math.round(height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); draw();
    }
    function basePoint(point) {
      const pad=42, innerW=width-pad*2, innerH=height-pad*2;
      return {x:pad+(point.x-bounds.minX)/Math.max(.001,bounds.maxX-bounds.minX)*innerW,y:height-pad-(point.y-bounds.minY)/Math.max(.001,bounds.maxY-bounds.minY)*innerH};
    }
    function screenPoint(point) { const base=basePoint(point); return {x:width/2+(base.x-width/2)*zoom+panX,y:height/2+(base.y-height/2)*zoom+panY}; }
    function drawLabels() {
      ctx.font='600 11px system-ui, sans-serif'; ctx.textBaseline='middle'; const occupied=[];
      groups.forEach(group => {
        const groupPoints=points.filter(point=>point.archetype===group.name).map(screenPoint);
        const center={x:groupPoints.reduce((sum,point)=>sum+point.x,0)/groupPoints.length,y:groupPoints.reduce((sum,point)=>sum+point.y,0)/groupPoints.length};
        const textWidth=ctx.measureText(group.name).width;
        const box={x:Math.max(4,Math.min(width-textWidth-12,center.x+7)),y:Math.max(4,Math.min(height-20,center.y-18)),w:textWidth+8,h:17};
        for(let tries=0;tries<10&&occupied.some(other=>box.x<other.x+other.w&&box.x+box.w>other.x&&box.y<other.y+other.h&&box.y+box.h>other.y);tries++) box.y=Math.min(height-box.h-4,box.y+box.h+2);
        occupied.push(box); ctx.fillStyle='rgba(255,255,255,.84)'; ctx.fillRect(box.x,box.y,box.w,box.h); ctx.fillStyle='#17212b'; ctx.fillText(group.name,box.x+4,box.y+box.h/2);
      });
    }
    function draw() {
      ctx.clearRect(0,0,width,height); ctx.strokeStyle='#dde1e3'; ctx.lineWidth=1;
      for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(width*i/4,0);ctx.lineTo(width*i/4,height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,height*i/4);ctx.lineTo(width,height*i/4);ctx.stroke();}
      points.filter(point=>point.colorIndex<0).concat(points.filter(point=>point.colorIndex>=0)).forEach(point=>{const screen=screenPoint(point),active=point===hovered;ctx.beginPath();ctx.arc(screen.x,screen.y,active?7:4.4,0,Math.PI*2);ctx.fillStyle=point.colorIndex>=0?colors[point.colorIndex%colors.length]:'#a2acb8';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=active?2.5:1.3;ctx.stroke();});
      drawLabels();
    }
    function hit(x,y) { let best=null,bestDistance=11; points.forEach(point=>{const screen=screenPoint(point),distance=Math.hypot(screen.x-x,screen.y-y);if(distance<bestDistance){best=point;bestDistance=distance;}});return best; }
    function tooltipHtml(point) {
      if (point.player) return '<strong>'+escapeHtml(point.player)+'</strong>'+escapeHtml(point.archetype)+'<br>Rank '+escapeHtml(point.rank)+' · '+escapeHtml(point.record);
      return '<strong>'+escapeHtml(point.archetype)+'</strong>'+escapeHtml(point.source.replaceAll('_',' '));
    }
    function showTooltip(point) {
      if(!point){tooltip.style.opacity='0';return;} const screen=screenPoint(point); tooltip.innerHTML=tooltipHtml(point); tooltip.style.opacity='1';
      const tw=tooltip.offsetWidth,th=tooltip.offsetHeight; tooltip.style.left=Math.max(8,Math.min(width-tw-8,screen.x+12))+'px'; tooltip.style.top=Math.max(8,Math.min(height-th-8,screen.y+12))+'px';
    }
    function pointer(event) { const rect=canvas.getBoundingClientRect(); return {x:event.clientX-rect.left,y:event.clientY-rect.top}; }
    canvas.addEventListener('pointerdown',event=>{const point=pointer(event);down={...point,panX,panY};moved=false;canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
    canvas.addEventListener('pointermove',event=>{const point=pointer(event);if(down){const dx=point.x-down.x,dy=point.y-down.y;if(Math.hypot(dx,dy)>3)moved=true;panX=down.panX+dx;panY=down.panY+dy;tooltip.style.opacity='0';draw();return;}const next=hit(point.x,point.y);if(next!==hovered){hovered=next;draw();showTooltip(next);}});
    canvas.addEventListener('pointerup',event=>{canvas.releasePointerCapture(event.pointerId);canvas.classList.remove('dragging');if(!moved){const point=hit(pointer(event).x,pointer(event).y);if(point&&point.url)window.open(point.url,'_blank','noopener');}down=null;});
    canvas.addEventListener('pointerleave',()=>{if(!down){hovered=null;draw();showTooltip(null);}});
    canvas.addEventListener('wheel',event=>{event.preventDefault();const point=pointer(event),old=zoom,factor=event.deltaY<0?1.18:.85;zoom=Math.max(.55,Math.min(8,zoom*factor));panX=point.x-width/2-(point.x-width/2-panX)*(zoom/old);panY=point.y-height/2-(point.y-height/2-panY)*(zoom/old);draw();},{passive:false});
    function setZoom(next){zoom=Math.max(.55,Math.min(8,next));draw();}
    host.querySelector('[data-zoom="in"]').onclick=()=>setZoom(zoom*1.25); host.querySelector('[data-zoom="out"]').onclick=()=>setZoom(zoom*.8); host.querySelector('[data-zoom="reset"]').onclick=()=>{zoom=1;panX=0;panY=0;draw();};
    new ResizeObserver(resize).observe(host); resize();
  }

  async function initialize(host) {
    try { const response=await fetch(host.dataset.src); if(!response.ok) throw new Error('HTTP '+response.status); mount(host,await response.json()); }
    catch(error) { host.innerHTML='<div class="report-umap-error">Could not load deck similarity data: '+escapeHtml(error.message||error)+'</div>'; }
  }
  function initializeAll() { document.querySelectorAll('[data-pauper-umap]').forEach(initialize); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initializeAll); else initializeAll();
}());
