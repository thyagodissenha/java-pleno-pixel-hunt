"use strict";
/* ============================================================
   PixelHUD — header redesenhado, só status do jogador.
   Biblioteca (sem loop de demo) — usada por /qwen com o jogo real:
     const hud = new PixelHUD();
     // dentro do game loop existente:
     hud.draw(ctx, estadoDoJogador, tempoSec, dt);
   Tudo dentro de uma IIFE para não colidir com qwen-footer-lib.js
   (ambos declaram CFG/PAL/clamp/etc no top-level do script).
   ============================================================ */
(function () {
const CFG = { HP_DYNAMIC_COLOR:false, SCANLINES:true }; // true = HP verde>60/amarelo>30/vermelho<30

const PAL = {
  panel:"rgba(10,16,19,.92)", neonA:"#3dff7c", neonB:"#19c8ff",
  hp:"#ff3b3b", raj:"#ffe94d", pod:"#38c8ff",
  score:"#5cff9d", tag:"#9fb3a8",
};

/* ---------- pixel-art (mapas) ---------- */
const MAP_HEART  = [".XX.XX.","XXXXXXX","XXXXXXX",".XXXXX.","..XXX..","...X..."];
const MAP_BOLT   = ["..XXX",".XXX.","XXX..","XXXXX","..XXX",".XXX.","XXX..","X...."];
const MAP_BULLET = [".XXXX....","XXXXXX...",".XXXXXXX.","XXXXXX...",".XXXX...."];
// ===================== FACES DO PLAYER (estilo Doom) =====================
const MAP_FACE_NORMAL=["....HHHH....","...HHHHHH...","..HHHHHHHH..","..HFFFFFFH..",
  "..HFEFFEFH..","..HFFFFFFH..","...FFMMFF...","....FFFF....",
  "...SSSSSS...","..SSSSSSSS..",".SSSSSSSSSS."];

const MAP_FACE_HURT=["....HHHH....","...HHHHHH...","..HHHHHHHH..","..HFFFFFFH..",
  "..HFEEFEFH..","..HFFFFFFH..","...FFMMFF...","....F..F....",  // boca aberta
  "...SSSSSS...","..SSSSSSSS..",".SSSSSSSSSS."];

const MAP_FACE_PAIN=["....HHHH....","...HHHHHH...","..HHHHHHHH..","..HFFFFFFH..",
  "..HFEEEEFH..","..HFFFFFFH..","...FFFFFF...","....F..F....",  // olhos fechados, dor
  "...SSSSSS...","..SSSSSSSS..",".SSSSSSSSSS."];

const MAP_FACE_DEAD=["....HHHH....","...HHHHHH...","..HHHHHHHH..","..HFFFFFFH..",
  "..HFXXFXFH..","..HFFFFFFH..","...FFMMFF...","....FFFF....",  // X nos olhos
  "...SSSSSS...","..SSSSSSSS..",".SSSSSSSSSS."];

const FACE_COL={H:"#3a2a1c",F:"#e8b98a",E:"#20242c",M:"#b06a4a",S:"#25464f",X:"#8b0000"};

const clamp = v => Math.max(0, Math.min(1, v));
const mapSize = (m,s)=>({w:m[0].length*s, h:m.length*s});

function drawMap(ctx,map,x,y,s,colors){
  for(let r=0;r<map.length;r++)for(let c=0;c<map[r].length;c++){
    const ch=map[r][c]; if(ch===".")continue;
    ctx.fillStyle = typeof colors==="string"?colors:(colors[ch]||"#fff");
    ctx.fillRect(x+c*s, y+r*s, s, s);
  }
}
function txt(ctx,str,x,y,size,color,align="left",glow=0){
  ctx.save();
  ctx.font=size+'px "Press Start 2P", monospace';
  ctx.textAlign=align; ctx.textBaseline="top";
  if(glow){ctx.shadowColor=color;ctx.shadowBlur=glow;}
  ctx.fillStyle=color; ctx.fillText(str,x,y);
  ctx.restore();
}

class PixelHUD{
  constructor(){ this.prev={}; this.flash=0; this.pop=0; }

  draw(ctx,S,t,dt=0.016){
    // O painel do design original só ocupa x:38-922, y:25-138 dentro de um
    // canvas de 960x170 — sobrava moldura vazia nas quatro bordas. O canvas
    // real agora é criado 884x113 (a área realmente usada) e aqui
    // deslocamos o desenho em (-38,-25) para que essa região caia
    // exatamente em 0..884 / 0..113, com as próprias linhas neon do painel
    // encostando na arena.
    const W=ctx.canvas.width,H=ctx.canvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H); ctx.imageSmoothingEnabled=false;
    ctx.translate(-38,-25);

    if(this.prev.hp!==undefined && S.hp<this.prev.hp) this.flash=1;      // dano
    if(this.prev.score!==undefined && S.score!==this.prev.score) this.pop=1; // ponto
    this.prev={...S};
    this.flash=Math.max(0,this.flash-dt*2.2);
    this.pop  =Math.max(0,this.pop-dt*3);

    this.panel(ctx,t);
    this.avatar(ctx,S);
    this.hpBlock(ctx,S,t);
    this.rajadaBlock(ctx,S,t);
    this.poderBlock(ctx,S,t);
    this.scoreBlock(ctx,S);
    if(CFG.SCANLINES){ ctx.save(); ctx.globalAlpha=.14; ctx.fillStyle="#000";
      for(let y=40;y<132;y+=3)ctx.fillRect(38,y,884,1); ctx.restore(); }
  }

  panel(ctx,t){
    const x=38,y=38,w=884,h=94;
    ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(x+4,y+6,w,h);       // sombra
    ctx.fillStyle=PAL.panel;        ctx.fillRect(x,y,w,h);           // corpo
    const g=ctx.createLinearGradient(x,0,x+w,0);
    g.addColorStop(0,PAL.neonA); g.addColorStop(1,PAL.neonB);
    ctx.save();                                                       // neon top/bottom
    ctx.globalAlpha=.75+.25*Math.sin(t*2.4);
    ctx.shadowBlur=10; ctx.shadowColor=PAL.neonA; ctx.fillStyle=g; ctx.fillRect(x,y-2,w,2);
    ctx.shadowColor=PAL.neonB; ctx.fillRect(x,y+h,w,2); ctx.restore();
    const sx=x+((t*90)%(w+160))-80;                                   // sweep de luz
    const sg=ctx.createLinearGradient(sx-60,0,sx+60,0);
    sg.addColorStop(0,"rgba(255,255,255,0)");sg.addColorStop(.5,"rgba(160,255,200,.06)");
    sg.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=sg; ctx.fillRect(x,y,w,h);
  }

  avatar(ctx,S){
    const cx=110,cy=86,r=31;
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.clip();
    ctx.fillStyle="#2a3b47"; ctx.fillRect(cx-r,cy-r,r*2,r*2);

    // Escolhe o rosto baseado no dano (estilo Doom)
    const hurtTimer=S.hurtTimer||0;
    let faceMap=MAP_FACE_NORMAL;
    if(S.hp<=0) faceMap=MAP_FACE_DEAD;
    else if(hurtTimer>0.3) faceMap=MAP_FACE_PAIN;
    else if(hurtTimer>0) faceMap=MAP_FACE_HURT;

    const s=5,{w,h}=mapSize(faceMap,s);
    drawMap(ctx,faceMap,cx-w/2,cy-h/2+4,s,FACE_COL); ctx.restore();

    // Borda do avatar (vermelha se machucado)
    ctx.save(); ctx.strokeStyle=hurtTimer>0?"#ff3b3b":"#cfd8dc"; ctx.lineWidth=3;
    ctx.shadowColor=hurtTimer>0?"#ff3b3b":"#9ad7ff";
    ctx.shadowBlur=6+(hurtTimer>0?4:0);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.stroke(); ctx.restore();

    const bx=126,by=42,bw=36,bh=26;                                   // badge JDK
    ctx.save(); ctx.shadowColor="#ffcf5c"; ctx.shadowBlur=8;
    ctx.fillStyle="#e7b858"; ctx.fillRect(bx,by,bw,bh); ctx.shadowBlur=0;
    ctx.strokeStyle="#7a4b10"; ctx.lineWidth=2; ctx.strokeRect(bx+1,by+1,bw-2,bh-2);
    ctx.restore();
    txt(ctx,"JDK",bx+bw/2,by+4,7,"#5a3608","center");
    txt(ctx,String(S.jdk??8),bx+bw/2,by+13,9,"#3a2405","center");

    const label=`Onda ${S.onda} | Resets ${S.resets}`;                // tag de progressão
    ctx.font='8px "Press Start 2P", monospace';
    const tw=ctx.measureText(label).width, tx=cx-tw/2-8, ty=118;
    ctx.fillStyle="#141d1a"; ctx.fillRect(tx,ty,tw+16,20);
    ctx.strokeStyle=PAL.tag; ctx.lineWidth=2; ctx.strokeRect(tx+1,ty+1,tw+14,18);
    txt(ctx,label,cx,ty+6,8,"#cfe8d8","center");
  }

  bar(ctx,x,y,w,h,pct,color,hi,flash=0){
    ctx.save();
    ctx.shadowColor=color; ctx.shadowBlur=9; ctx.strokeStyle=color; ctx.lineWidth=2;
    ctx.strokeRect(x+1,y+1,w-2,h-2); ctx.shadowBlur=0;
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(x+3,y+3,w-6,h-6);
    const fw=Math.round((w-6)*pct);
    if(fw>0){
      const g=ctx.createLinearGradient(x,0,x+w,0);
      g.addColorStop(0,color); g.addColorStop(1,hi);
      ctx.fillStyle=g; ctx.fillRect(x+3,y+3,fw,h-6);
      ctx.fillStyle="rgba(255,255,255,.85)"; ctx.fillRect(x+3+fw-3,y+3,3,h-6);
    }
    if(flash>0){ ctx.globalAlpha=flash*.7; ctx.fillStyle="#fff";
      ctx.fillRect(x+3,y+3,w-6,h-6); }
    ctx.restore();
  }

  hpBlock(ctx,S,t){
    const x=200,y=78,w=132,h=20, pct=clamp(S.hp/S.hpMax), crit=pct<=.3;
    const blink=.5+.5*Math.sin(t*10);
    let col=PAL.hp;
    if(CFG.HP_DYNAMIC_COLOR) col=pct>.6?"#48ff7c":pct>.3?"#ffc23d":"#ff3b3b";
    txt(ctx,`HP ${Math.round(S.hp)}/${S.hpMax}`,x,y-22,12,(crit&&blink>.6)?"#fff":col,"left",8);
    this.bar(ctx,x,y,w,h,pct,col,"#ffb3a9",this.flash);
    const s=3,{w:hw,h:hh}=mapSize(MAP_HEART,s);                       // coração c/ batida
    const beat=1+(crit?.18:.08)*Math.max(0,Math.sin(t*(crit?12:5)));
    ctx.save(); ctx.translate(x+w+16+hw/2,y+h/2); ctx.scale(beat,beat);
    ctx.shadowColor=col; ctx.shadowBlur=8;
    drawMap(ctx,MAP_HEART,-hw/2,-hh/2,s,col);
    if(crit){ ctx.shadowBlur=0; ctx.fillStyle="#20060a";              // rachadura
      [[3,1],[2,2],[3,3]].forEach(p=>ctx.fillRect(-hw/2+p[0]*s,-hh/2+p[1]*s,s,s)); }
    ctx.restore();
  }

  rajadaBlock(ctx,S,t){
    const x=402,y=78,w=132,h=20, pct=clamp(S.rajada/100), full=pct>=1;
    txt(ctx,"Rajada",x,y-22,12,PAL.raj,"left",8);
    this.bar(ctx,x,y,w,h,pct,PAL.raj,"#fff6a9");
    if(full){ ctx.save(); ctx.globalAlpha=.35+.4*(.5+.5*Math.sin(t*6)); // pronta = pulso
      ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.strokeRect(x-1,y-1,w+2,h+2); ctx.restore(); }
    const s=3,{w:bw,h:bh}=mapSize(MAP_BULLET,s);
    ctx.save(); ctx.shadowColor=PAL.raj; ctx.shadowBlur=8;
    drawMap(ctx,MAP_BULLET,x+w+14,y+h/2-bh/2,s,PAL.raj); ctx.restore();
  }

  poderBlock(ctx,S,t){
    const x=604,y=78,w=132,h=20, pct=clamp(S.poder/100);
    txt(ctx,"Poder",x,y-22,12,PAL.pod,"left",8);
    this.bar(ctx,x,y,w,h,pct,PAL.pod,"#bfeaff");
    const s=3,{w:lw,h:lh}=mapSize(MAP_BOLT,s);
    ctx.save(); ctx.shadowColor=PAL.pod; ctx.shadowBlur=8;
    drawMap(ctx,MAP_BOLT,x+w+16,y+h/2-lh/2,s,PAL.pod); ctx.restore();
  }

  scoreBlock(ctx,S){
    const x=806,y=52,w=96,h=64;
    ctx.save(); ctx.shadowColor=PAL.score; ctx.shadowBlur=10;
    ctx.strokeStyle=PAL.score; ctx.lineWidth=2;
    ctx.strokeRect(x,y,w,h); ctx.strokeRect(x+4,y+4,w-8,h-8); ctx.shadowBlur=0;
    ctx.fillStyle="rgba(20,40,30,.5)"; ctx.fillRect(x+4,y+4,w-8,h-8); ctx.restore();
    txt(ctx,"SCORE",x+w/2,y+10,10,PAL.score,"center",6);
    const sc=1+.25*this.pop;                                          // "pop" ao pontuar
    ctx.save(); ctx.translate(x+w/2,y+44); ctx.scale(sc,sc);
    txt(ctx,String(S.score),0,-10,14,"#d8ffe9","center",8); ctx.restore();
  }
}

window.PixelHUD = PixelHUD;
})();
