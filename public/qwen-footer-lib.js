"use strict";
/* ============================================================
   PixelFooter — rodapé redesenhado, só contexto do jogo.
   Biblioteca (sem loop de demo) — usada por /qwen com o jogo real:
     const foot = new PixelFooter();
     foot.draw(ctx, estadoDoMundo, tempoSec, dt);
   Tudo dentro de uma IIFE para não colidir com qwen-hud-lib.js
   (ambos declaram CFG/PAL/clamp/etc no top-level do script).
   ============================================================ */
(function () {
const CFG = { SCANLINES:true };

const PAL = {
  panel:"rgba(10,16,19,.92)", neonA:"#3dff7c", neonB:"#19c8ff",
  warn:"#ff5c3d", ok:"#5cff9d", info:"#5cc8ff",
  term:"#9fb3a8", termBg:"#0a1013",
  boss:"#ffd166", phase:"#cfd8dc",
};

/* ---------- pixel-art (mapas) ---------- */
const MAP_WARN   = [".XXX.","XXXXX","X.X.X","XXXXX",".XXX.",".X.X."]; // ⚠
const MAP_BUG    = ["..XXX.",".XXXXX","XXXXXXX","X.X.X.X","XXXXXXX",".XXXXX","..XXX."]; // bug
const MAP_MONKEY = [".XXXX.","XXXXXX","XX.X.XX","XXXXXX",".XXXX.","..X.X.."]; // deploy monkey
const MAP_FLAG   = ["X...","XXXX","X...","X...","X..."]; // fase

const clamp = v => Math.max(0, Math.min(1, v));
const mapSize = (m,s)=>({w:m[0].length*s, h:m.length*s});
function drawMap(ctx,map,x,y,s,color){
  for(let r=0;r<map.length;r++)for(let c=0;c<map[r].length;c++){
    if(map[r][c]===".")continue;
    ctx.fillStyle=color; ctx.fillRect(x+c*s, y+r*s, s, s);
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

class PixelFooter{
  constructor(){
    this.log=[];          // terminal log
    this.logTimer=0;
    this.incident=0;      // 0..1 (fade do PROD INCIDENT)
    this.incidentT=0;
  }

  draw(ctx,S,t,dt=0.016){
    // O painel do design original só ocupa x:38-922, y:16-134 dentro de um
    // canvas de 960x150 — sobrava moldura vazia nas quatro bordas. O canvas
    // real agora é criado 884x118 (a área realmente usada) e aqui
    // deslocamos o desenho em (-38,-16) para que essa região caia
    // exatamente em 0..884 / 0..118, com as próprias linhas neon do painel
    // encostando na arena.
    const W=ctx.canvas.width,H=ctx.canvas.height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H); ctx.imageSmoothingEnabled=false;
    ctx.translate(-38,-16);

    this.panel(ctx,t);
    this.buildStatus(ctx,S,t);
    this.bossBlock(ctx,S,t);
    this.phaseBlock(ctx,S);
    this.terminalLog(ctx,S,t,dt);
    this.incidentBanner(ctx,S,t,dt);
    if(CFG.SCANLINES){ ctx.save(); ctx.globalAlpha=.14; ctx.fillStyle="#000";
      for(let y=20;y<130;y+=3)ctx.fillRect(38,y,884,1); ctx.restore(); }
  }

  panel(ctx,t){
    const x=38,y=20,w=884,h=110;
    ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(x+4,y+6,w,h);
    ctx.fillStyle=PAL.panel;        ctx.fillRect(x,y,w,h);
    const g=ctx.createLinearGradient(x,0,x+w,0);
    g.addColorStop(0,PAL.neonA); g.addColorStop(1,PAL.neonB);
    ctx.save();
    ctx.globalAlpha=.75+.25*Math.sin(t*2.4+1);
    ctx.shadowBlur=10; ctx.shadowColor=PAL.neonA; ctx.fillStyle=g; ctx.fillRect(x,y-2,w,2);
    ctx.shadowColor=PAL.neonB; ctx.fillRect(x,y+h,w,2); ctx.restore();
    const sx=x+((t*70)%(w+160))-80;
    const sg=ctx.createLinearGradient(sx-60,0,sx+60,0);
    sg.addColorStop(0,"rgba(255,255,255,0)");sg.addColorStop(.5,"rgba(160,255,200,.05)");
    sg.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=sg; ctx.fillRect(x,y,w,h);
  }

  /* ---- BUILD STATUS (esquerda) ---- */
  buildStatus(ctx,S,t){
    const x=60,y=40;
    const unstable=S.buildInstavel;
    const col=unstable?PAL.warn:PAL.ok;
    const s=3,{w:bw,h:bh}=mapSize(MAP_BUG,s);
    ctx.save(); ctx.shadowColor=col; ctx.shadowBlur=8;
    drawMap(ctx,MAP_BUG,x,y,bh,s,col); ctx.restore();

    txt(ctx,"BUILD",x+bw+10,y-2,9,col,"left",6);
    txt(ctx,unstable?"INSTÁVEL":"OK",x+bw+10,y+10,9,
        unstable?(.5+.5*Math.sin(t*8))>.6?"#fff":col:col,"left",
        unstable?8:0);

    // mini-log de commits (decorativo)
    const commits=["$ tests... ok","$ lint... ok","$ build v1.4.2"];
    for(let i=0;i<3;i++){
      const a=.35+i*.12;
      ctx.globalAlpha=a;
      txt(ctx,commits[i],x+bw+10,y+26+i*11,6,PAL.term,"left");
    }
    ctx.globalAlpha=1;
  }

  /* ---- BOSS BLOCK (centro-esquerda) ---- */
  bossBlock(ctx,S,t){
    const x=260,y=40;
    const s=3,{w:fw,h:fh}=mapSize(MAP_FLAG,s);
    ctx.save(); ctx.shadowColor=PAL.boss; ctx.shadowBlur=8;
    drawMap(ctx,MAP_FLAG,x,y,fh,s,PAL.boss); ctx.restore();

    txt(ctx,"CHEFE",x+fw+8,y-2,9,PAL.boss,"left",6);
    txt(ctx,S.bossNome||"Gerente de Sprint",x+fw+8,y+10,9,"#fff2c2","left",4);

    // barra de progresso do chefe
    const bx=x+fw+8, by=y+26, bw=180, bh=14;
    const pct=clamp((S.bossProgress||0)/(S.bossTotal||14));
    ctx.save(); ctx.shadowColor=PAL.boss; ctx.shadowBlur=6;
    ctx.strokeStyle=PAL.boss; ctx.lineWidth=2;
    ctx.strokeRect(bx,by,bw,bh); ctx.shadowBlur=0;
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(bx+2,by+2,bw-4,bh-4);
    const fw2=Math.round((bw-4)*pct);
    if(fw2>0){
      const g=ctx.createLinearGradient(bx,0,bx+bw,0);
      g.addColorStop(0,PAL.boss); g.addColorStop(1,"#fff2c2");
      ctx.fillStyle=g; ctx.fillRect(bx+2,by+2,fw2,bh-4);
    }
    ctx.restore();
    txt(ctx,`${Math.floor((S.bossProgress||0))}/${S.bossTotal||14}`,bx+bw+8,by+3,9,PAL.boss,"left");
  }

  /* ---- PHASE BLOCK (centro-direita) ---- */
  phaseBlock(ctx,S){
    const x=540,y=40;
    txt(ctx,"FASE",x,y-2,9,PAL.phase,"left",4);
    txt(ctx,S.faseNome||"Escritório",x,y+10,10,"#e8eef0","left",6);

    // mini-mapa da fase (decorativo, 5x3)
    const mx=x, my=y+30, s=6;
    const mini=[
      "..##..##..",
      ".#....#...",
      "##..##..##",
    ];
    for(let r=0;r<mini.length;r++)for(let c=0;c<mini[r].length;c++){
      if(mini[r][c]==="#"){
        ctx.fillStyle="rgba(92,200,255,.35)";
        ctx.fillRect(mx+c*s, my+r*s, s, s);
      }
    }
    // player dot
    ctx.fillStyle=PAL.neonA;
    ctx.fillRect(mx+3*s, my+1*s, s, s);
  }

  /* ---- TERMINAL LOG (direita, rolando) ---- */
  terminalLog(ctx,S,t,dt){
    const x=700,y=30,w=210,h=90;
    // fundo terminal
    ctx.fillStyle=PAL.termBg; ctx.fillRect(x,y,w,h);
    ctx.strokeStyle="rgba(159,179,168,.4)"; ctx.lineWidth=1; ctx.strokeRect(x,y,w,h);

    // prompt
    txt(ctx,"$ ",x+6,y+6,8,PAL.neonA,"left",4);
    txt(ctx,"status --live",x+22,y+6,8,PAL.term,"left");

    // linhas do log
    const lines=[
      {t:"[OK] deploy prod",c:PAL.ok},
      {t:"[!!] meeting call",c:PAL.warn},
      {t:"[..] users: "+(S.users||101),c:PAL.info},
      {t:"[>>] sprint day "+(S.sprintDay||3),c:PAL.term},
    ];
    for(let i=0;i<lines.length;i++){
      const ly=y+22+i*14;
      const blink=i===0?(.5+.5*Math.sin(t*4))>.3?1:.3:1;
      ctx.globalAlpha=blink;
      txt(ctx,lines[i].t,x+6,ly,7,lines[i].c,"left");
    }
    ctx.globalAlpha=1;

    // cursor piscando
    const curOn=(Math.floor(t*2)%2)===1;
    if(curOn){
      ctx.fillStyle=PAL.neonA;
      ctx.fillRect(x+6,y+h-14,7,8);
    }
  }

  /* ---- INCIDENT BANNER (overlay temporário) ---- */
  incidentBanner(ctx,S,t,dt){
    if(S.incident){
      this.incident=Math.min(1,this.incident+dt*3);
      this.incidentT=t;
    }else{
      this.incident=Math.max(0,this.incident-dt*2);
    }
    if(this.incident<=0)return;
    const a=this.incident*(.5+.5*Math.sin(t*6));
    ctx.save(); ctx.globalAlpha=a;
    ctx.fillStyle="rgba(255,60,30,.15)";
    ctx.fillRect(38,20,884,110);
    txt(ctx,"⚠ PROD INCIDENT!",480,60,16,PAL.warn,"center",12);
    ctx.restore();
  }
}

window.PixelFooter = PixelFooter;
})();
