import { useEffect, useRef, useState } from "react";

type Props = { carColor: number; carModel: number; onFinish: (score: number) => void };

type Point = { x: number; y: number };
type Driver = { progress: number; lane: number; speed: number; color: string; isPlayer: boolean; name: string };

const CONTROL_POINTS: Point[] = [
  { x: 0, y: 0 }, { x: 150, y: -10 }, { x: 255, y: -80 },
  { x: 270, y: -190 }, { x: 210, y: -275 }, { x: 80, y: -300 },
  { x: -70, y: -285 }, { x: -190, y: -220 }, { x: -245, y: -110 },
  { x: -230, y: 20 }, { x: -150, y: 115 }, { x: -20, y: 145 },
  { x: 100, y: 100 }
];

function sampleTrack(points: Point[], count: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * points.length;
    const index = Math.floor(t);
    const f = t - index;
    const p0 = points[(index - 1 + points.length) % points.length];
    const p1 = points[index % points.length];
    const p2 = points[(index + 1) % points.length];
    const p3 = points[(index + 2) % points.length];
    const f2 = f * f, f3 = f2 * f;
    result.push({
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * f + (2*p0.x - 5*p1.x + 4*p2.x - p3.x)*f2 + (-p0.x + 3*p1.x - 3*p2.x + p3.x)*f3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * f + (2*p0.y - 5*p1.y + 4*p2.y - p3.y)*f2 + (-p0.y + 3*p1.y - 3*p2.y + p3.y)*f3)
    });
  }
  return result;
}

const TRACK = sampleTrack(CONTROL_POINTS, 720);
const TRACK_WIDTH = 118;
const TOTAL_LAPS = 3;

function pointAt(progress: number): Point {
  const i = ((Math.floor(progress * TRACK.length) % TRACK.length) + TRACK.length) % TRACK.length;
  return TRACK[i];
}
function tangentAt(progress: number): Point {
  const a = pointAt(progress), b = pointAt(progress + 0.002);
  const length = Math.hypot(b.x-a.x, b.y-a.y) || 1;
  return { x: (b.x-a.x)/length, y: (b.y-a.y)/length };
}
function positionAt(progress: number, lane = 0): Point {
  const p = pointAt(progress), t = tangentAt(progress);
  return { x: p.x - t.y * lane, y: p.y + t.x * lane };
}

export default function RaceCore({ carColor, carModel, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef({ left: false, right: false, throttle: true, brake: false, nitro: false });
  const finishRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [hud, setHud] = useState({ lap: 1, speed: 0, position: 4, time: 0 });
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;
    let width = 1, height = 1, raf = 0, last = 0, hudClock = 0;
    let elapsed = 0, progress = 0, speed = 0, lateral = 0, lateralVelocity = 0;
    let heading = Math.atan2(tangentAt(0).y, tangentAt(0).x);
    let damage = 0;
    const ai: Driver[] = [
      { progress: 0.002, lane: -25, speed: 0.00245, color: "#ffcc45", isPlayer: false, name: "VOLT" },
      { progress: 0.995, lane: 25, speed: 0.0023, color: "#fa5570", isPlayer: false, name: "PHANTOM" },
      { progress: 0.988, lane: -5, speed: 0.00215, color: "#a88aff", isPlayer: false, name: "NOVA" }
    ];
    const player: Driver = { progress: 0, lane: 0, speed: 0, color: "#" + carColor.toString(16).padStart(6, "0"), isPlayer: true, name: "YOU" };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawCar = (x: number, y: number, angle: number, color: string, isPlayer: boolean) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(-13, -23, 30, 50);
      ctx.fillStyle = "#10151c";
      ctx.fillRect(-15, -15, 6, 13); ctx.fillRect(9, -15, 6, 13);
      ctx.fillRect(-15, 7, 6, 13); ctx.fillRect(9, 7, 6, 13);
      ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-12, -24, 24, 48, 7); ctx.fill();
      ctx.fillStyle = "#172f46"; ctx.beginPath(); ctx.roundRect(-8.5, -12, 17, 19, 4); ctx.fill();
      ctx.fillStyle = "#eaf7ff"; ctx.fillRect(-8, -21, 5, 3); ctx.fillRect(3, -21, 5, 3);
      ctx.fillStyle = "#ff454f"; ctx.fillRect(-8, 19, 5, 2); ctx.fillRect(3, 19, 5, 2);
      if (isPlayer) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.strokeRect(-12, -24, 24, 48); }
      ctx.restore();
    };

    const draw = () => {
      const center = positionAt(progress, lateral);
      const forward = tangentAt(progress);
      const cameraX = center.x, cameraY = center.y;
      ctx.fillStyle = "#328b4c"; ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 - cameraX, height * 0.58 - cameraY);
      // Outer asphalt shoulder and track surface
      const path = (offset: number) => {
        ctx.beginPath();
        TRACK.forEach((p, i) => {
          const t = tangentAt(i / TRACK.length);
          const x = p.x - t.y * offset, y = p.y + t.x * offset;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      };
      path(TRACK_WIDTH / 2 + 16); ctx.fillStyle = "#e9e4d9"; ctx.lineWidth = 2; ctx.fill();
      path(TRACK_WIDTH / 2 + 9); ctx.fillStyle = "#e94d4d"; ctx.fill();
      path(TRACK_WIDTH / 2); ctx.fillStyle = "#30343b"; ctx.fill();
      // Track center dashes
      ctx.setLineDash([13, 17]); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,.36)";
      ctx.beginPath(); TRACK.forEach((p, i) => { if (!i) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      // Start / finish line
      const start = pointAt(0), st = tangentAt(0), nx = -st.y, ny = st.x;
      ctx.save(); ctx.translate(start.x, start.y); ctx.rotate(Math.atan2(st.y, st.x));
      for (let i=0;i<8;i++) for(let j=0;j<2;j++){ctx.fillStyle=(i+j)%2?"#20242b":"#fff";ctx.fillRect(-5+i*1.3,-TRACK_WIDTH/2+j*TRACK_WIDTH/2,1.4,TRACK_WIDTH/2);}
      ctx.restore();
      // AI cars
      ai.forEach(d => { const p=positionAt(d.progress,d.lane); const t=tangentAt(d.progress); drawCar(p.x,p.y,Math.atan2(t.y,t.x)+Math.PI/2,d.color,false); });
      drawCar(center.x, center.y, heading + Math.PI/2, player.color, true);
      ctx.restore();

      // Track minimap from the exact same centerline
      const mapW=112,mapH=118,mx=14,my=14;
      ctx.fillStyle="rgba(7,15,25,.86)"; ctx.strokeStyle="rgba(255,255,255,.32)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(mx,my,mapW,mapH,12); ctx.fill(); ctx.stroke();
      const scale=Math.min((mapW-22)/510,(mapH-22)/460);
      const mapX=(p:Point)=>mx+mapW/2+p.x*scale;
      const mapY=(p:Point)=>my+mapH/2+p.y*scale;
      ctx.beginPath(); TRACK.forEach((p,i)=>{if(!i)ctx.moveTo(mapX(p),mapY(p));else ctx.lineTo(mapX(p),mapY(p));}); ctx.closePath();
      ctx.lineWidth=11;ctx.strokeStyle="#101820";ctx.lineJoin="round";ctx.stroke();
      ctx.lineWidth=6;ctx.strokeStyle="#d9d5ca";ctx.stroke();
      ctx.beginPath();TRACK.forEach((p,i)=>{if(!i)ctx.moveTo(mapX(p),mapY(p));else ctx.lineTo(mapX(p),mapY(p));});ctx.closePath();
      ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.strokeStyle="#fff";ctx.stroke();ctx.setLineDash([]);
      const marker=positionAt(progress,0);ctx.fillStyle="#36c5f0";ctx.strokeStyle="#fff";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(mapX(marker),mapY(marker),4,0,Math.PI*2);ctx.fill();ctx.stroke();
      ai.forEach(d=>{const p=positionAt(d.progress,d.lane);ctx.fillStyle=d.color;ctx.beginPath();ctx.arc(mapX(p),mapY(p),2.5,0,Math.PI*2);ctx.fill();});
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - (last || now)) / 1000, 0.04); last = now;
      if (!finishRef.current) {
        elapsed += dt;
        const c = controls.current;
        const maxSpeed = c.nitro ? 330 : 245;
        const acceleration = c.brake ? -440 : c.throttle ? 250 : -95;
        speed = Math.max(0, Math.min(maxSpeed, speed + acceleration * dt));
        const steer = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        const steerPower = 0.7 + Math.min(speed / 180, 1) * 1.5;
        lateralVelocity += steer * steerPower * 145 * dt;
        lateralVelocity *= Math.exp(-4.8 * dt);
        lateral += lateralVelocity * dt;
        lateral = Math.max(-90, Math.min(90, lateral));
        const offRoad = Math.abs(lateral) > TRACK_WIDTH / 2 - 17;
        if (offRoad) { speed *= Math.exp(-2.7 * dt); damage = Math.min(100, damage + dt * 2); }
        const trackMetersPerLap = 1;
        progress += (speed * dt) / 1700;
        player.progress = progress;
        ai.forEach(d => { d.progress += d.speed * (dt * 60); });
        const lap = Math.min(TOTAL_LAPS, Math.floor(progress) + 1);
        const place = 1 + ai.filter(d => d.progress > progress).length;
        hudClock += dt;
        if (hudClock > 0.12) {
          setHud({ lap, speed: Math.round(speed * 0.72), position: place, time: elapsed });
          hudClock = 0;
        }
        if (elapsed >= 96) {
          finishRef.current = true; setFinished(true); onFinish(Math.max(100, Math.round(1000 - elapsed * 3 + place * 100)));
        }
      }
      const p = pointAt(progress), t = tangentAt(progress);
      heading = Math.atan2(t.y, t.x);
      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [carColor, carModel]);

  const press = (key: keyof typeof controls.current, value: boolean) => { controls.current[key] = value; };
  const controlStyle: React.CSSProperties = { border: "1px solid #49627b", borderRadius: 14, background: "rgba(12,27,44,.92)", color: "#eaf4ff", fontWeight: 900, fontSize: 17, minHeight: 52, touchAction: "none", userSelect: "none" };
  return <div style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 16, background: "#328b4c" }}>
    <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "min(66vh, 590px)", touchAction: "none" }} />
    <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 7, color: "white", fontSize: 12, fontWeight: 900, textShadow: "0 1px 3px #000" }}>
      <span>POS {hud.position}/4</span><span>·</span><span>LAP {hud.lap}/{TOTAL_LAPS}</span><span>·</span><span>{hud.speed} KM/H</span>
    </div>
    <div style={{ position: "absolute", left: 14, bottom: 12, color: "#fff", fontSize: 11, fontWeight: 800, textShadow: "0 1px 3px #000" }}>TIME {hud.time.toFixed(1)}s</div>
    {finished && <div style={{ position: "absolute", inset: 0, background: "#07111dcc", display: "grid", placeItems: "center", color: "white", fontWeight: 900, fontSize: 26 }}>FINISH!</div>}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7, padding: 9, background: "#0c1a2b" }}>
      <button style={controlStyle} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);press("left",true)}} onPointerUp={()=>press("left",false)} onPointerCancel={()=>press("left",false)}>◀</button>
      <button style={controlStyle} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);press("right",true)}} onPointerUp={()=>press("right",false)} onPointerCancel={()=>press("right",false)}>▶</button>
      <button style={controlStyle} onPointerDown={()=>press("brake",true)} onPointerUp={()=>press("brake",false)} onPointerCancel={()=>press("brake",false)}>BRAKE</button>
      <button style={{...controlStyle,background:"#e96a20"}} onPointerDown={()=>press("nitro",true)} onPointerUp={()=>press("nitro",false)} onPointerCancel={()=>press("nitro",false)}>NITRO</button>
    </div>
    <div style={{ display:"flex",justifyContent:"center",padding:"0 10px 10px",background:"#0c1a2b" }}>
      <button style={{...controlStyle,flex:1,background:"#164b65"}} onPointerDown={()=>press("throttle",true)} onPointerUp={()=>press("throttle",false)} onPointerCancel={()=>press("throttle",false)}>ACCELERATE</button>
    </div>
  </div>;
}
