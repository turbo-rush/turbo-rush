import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";

type Tab = "race" | "garage" | "rating" | "shop";
type Car = { name: string; className: string; speed: number; color: number; price: number };

const cars: Car[] = [
  { name: "NEON SPRINT", className: "D · STARTER", speed: 1, color: 0x36c5f0, price: 0 },
  { name: "VOLT GT", className: "C · STREET", speed: 2, color: 0xffb52e, price: 3000 },
  { name: "PHANTOM R", className: "B · SPORT", speed: 3, color: 0xf05270, price: 8000 },
  { name: "NOVA X", className: "A · SUPER", speed: 4, color: 0x9b7bff, price: 20000 },
  { name: "APEX ONE", className: "S · LEGEND", speed: 5, color: 0xf2f4f8, price: 50000 }
];

class RaceScene extends Phaser.Scene {
private player!: Phaser.GameObjects.Container;
  private obstacles: Phaser.GameObjects.Rectangle[] = [];
  private road!: Phaser.GameObjects.Graphics;
  private score = 0;
  private speed = 4;
  private lane = 1;
  private spawnTimer = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private nitro = 100;
  private nitroText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private onFinish: (score: number) => void;
  private finished = false;

  constructor(onFinish: (score: number) => void) { super("RaceScene"); this.onFinish = onFinish; }

  create() {
    const { width, height } = this.scale;
    this.road = this.add.graphics();
    this.drawRoad(width, height);
    // Создаём автомобиль из отдельных деталей
const carBody = this.add.rectangle(0, 0, 38, 66, 0x28c9f4)
  .setStrokeStyle(3, 0xffffff);

const windshield = this.add.rectangle(0, -12, 26, 19, 0x153d59);

const rearWindow = this.add.rectangle(0, 15, 25, 12, 0x153d59);

const leftWheelFront = this.add.rectangle(-22, -19, 8, 17, 0x111111);
const rightWheelFront = this.add.rectangle(22, -19, 8, 17, 0x111111);
const leftWheelBack = this.add.rectangle(-22, 20, 8, 17, 0x111111);
const rightWheelBack = this.add.rectangle(22, 20, 8, 17, 0x111111);

const lights = [
  this.add.rectangle(-11, -32, 8, 4, 0xffffff),
  this.add.rectangle(11, -32, 8, 4, 0xffffff)
];

this.player = this.add.container(
  width / 2,
  height - 105,
  [
    leftWheelFront,
    rightWheelFront,
    leftWheelBack,
    rightWheelBack,
    carBody,
    windshield,
    rearWindow,
    ...lights
  ]
);
    this.scoreText = this.add.text(16, 14, "DISTANCE  0", { fontFamily: "Arial", fontSize: "16px", color: "#ffffff", fontStyle: "bold" });
    this.nitroText = this.add.text(width - 16, 14, "NITRO 100%", { fontFamily: "Arial", fontSize: "14px", color: "#70e7ff" }).setOrigin(1, 0);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.moveLane(p.x < width / 2 ? -1 : 1));
    // Управление клавиатурой
this.input.keyboard?.on("keydown-LEFT", () => this.moveLane(-1));
this.input.keyboard?.on("keydown-RIGHT", () => this.moveLane(1));
this.input.keyboard?.on("keydown-SPACE", () => this.useNitro());

// Управление через кнопки интерфейса
const controlHandler = (event: Event) => {
  const action = (event as CustomEvent).detail;

  if (action === "left") this.moveLane(-1);
  if (action === "right") this.moveLane(1);
  if (action === "nitro") this.useNitro();
};

window.addEventListener("turbo-control", controlHandler);

this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
  window.removeEventListener("turbo-control", controlHandler);
});

// Управление свайпами
let touchStartX = 0;

this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
  touchStartX = p.x;
});

this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
  const difference = p.x - touchStartX;

  if (difference < -25) this.moveLane(-1);
  if (difference > 25) this.moveLane(1);
});
    this.time.delayedCall(35000, () => this.finish());
  }

  private drawRoad(w: number, h: number) {
    this.road.clear();
    this.road.fillStyle(0x101c2d, 1).fillRect(0, 0, w, h);
    this.road.fillStyle(0x25364b, 1).fillRect(w * .12, 0, w * .76, h);
    this.road.lineStyle(4, 0xffffff, .55);
    this.road.lineBetween(w * .12, 0, w * .12, h);
    this.road.lineBetween(w * .88, 0, w * .88, h);
    this.road.lineStyle(2, 0x91a4ba, .5);
    this.road.lineBetween(w * .373, 0, w * .373, h);
    this.road.lineBetween(w * .626, 0, w * .626, h);
  }

  private moveLane(dir: number) {
    if (this.finished) return;
    this.lane = Phaser.Math.Clamp(this.lane + dir, 0, 2);
    const x = this.scale.width * (.247 + this.lane * .253);
    this.tweens.add({ targets: this.player, x, duration: 100, ease: "Sine.easeOut" });
  }

  private useNitro() {
    if (this.nitro < 25 || this.finished) return;
    this.nitro -= 25;
    this.speed = 7;
    this.time.delayedCall(1600, () => this.speed = 4);
    this.nitroText.setText(`NITRO ${this.nitro}%`);
  }

  update(_time: number, delta: number) {
    if (this.finished) return;
    this.spawnTimer += delta;
    if (this.spawnTimer > 650) {
      this.spawnTimer = 0;
      const lane = Phaser.Math.Between(0, 2);
      const x = this.scale.width * (.247 + lane * .253);
      const obstacle = this.add.rectangle(x, -40, 32, 48, Phaser.Utils.Array.GetRandom([0xff5964, 0xffc857, 0x9b7bff]));
      this.obstacles.push(obstacle);
    }
    this.obstacles = this.obstacles.filter(o => {
      o.y += this.speed * (delta / 8);
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), o.getBounds())) {
        this.cameras.main.shake(120, .008);
        this.finish();
      }
      if (o.y > this.scale.height + 50) { o.destroy(); return false; }
      return true;
    });
    this.score += delta * .012;
    this.scoreText.setText(`DISTANCE  ${Math.floor(this.score)} m`);
    if (this.nitro < 100) this.nitro = Math.min(100, this.nitro + delta * .002);
    this.nitroText.setText(`NITRO ${Math.floor(this.nitro)}%`);
  }

  private finish() {
    if (this.finished) return;
    this.finished = true;
    this.physics?.world?.pause?.();
    this.time.delayedCall(350, () => this.onFinish(Math.floor(this.score)));
  }
}

export default function App() {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserRef = useRef<Phaser.Game | null>(null);
  const [tab, setTab] = useState<Tab>("race");
  const [coins, setCoins] = useState(1200);
  const [selected, setSelected] = useState(0);
  const [race, setRace] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [races, setRaces] = useState(0);

  useEffect(() => {
    if (!race || !gameRef.current) return;
    phaserRef.current?.destroy(true);
    phaserRef.current = new Phaser.Game({
      type: Phaser.AUTO, parent: gameRef.current, width: gameRef.current.clientWidth,
      height: Math.min(560, window.innerHeight * .62), backgroundColor: "#101c2d",
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: new RaceScene((score) => {
        const reward = Math.max(40, Math.floor(score / 2) + 60);
        setCoins(c => c + reward); setResult(score); setRaces(r => r + 1); setRace(false);
      })
    });
    return () => { phaserRef.current?.destroy(true); phaserRef.current = null; };
  }, [race]);

  const startRace = () => { setResult(null); setRace(true); };
  const buyCar = (i: number) => {
    if (cars[i].price <= coins) { setCoins(c => c - cars[i].price); setSelected(i); }
  };

  return <main className="app-shell">
    <header className="topbar">
      <div><div className="brand">TURBO <span>RUSH</span></div><div className="subbrand">ARCADE STREET LEAGUE</div></div>
      <div className="wallet"><span>₵ {coins.toLocaleString("en-US")}</span><b>◆ 0</b></div>
    </header>

    {race ? <section className="race-panel">
      <div className="race-head"><b>STREET RUN · CITY 01</b><span>Свайп / ← → · SPACE — нитро</span></div>
      <div className="game-wrap" ref={gameRef}></div>
      <div className="race-controls">
  <button onClick={() =>
    window.dispatchEvent(new CustomEvent("turbo-control", {
      detail: "left"
    }))
  }>←</button>

  <button className="nitro" onClick={() =>
    window.dispatchEvent(new CustomEvent("turbo-control", {
      detail: "nitro"
    }))
  }>NITRO</button>

  <button onClick={() =>
    window.dispatchEvent(new CustomEvent("turbo-control", {
      detail: "right"
    }))
  }>→</button>
</div>
    </section> : <>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow">YOUR NEXT RACE STARTS NOW</div><h1>OWN THE<br/><em>STREETS.</em></h1><p>Гоняй. Улучшай. Бросай вызов друзьям.</p></div>
        <div className="car-art"><div className="car-glow"></div><div className="car-shape">▰</div><div className="speed-lines"></div></div>
        <div className="hero-stats"><span>🏁 {races} гонок</span><span>🏆 Новичок</span><span>🚘 {cars[selected].name}</span></div>
        <button className="primary" onClick={startRace}>НАЧАТЬ ГОНКУ <span>→</span></button>
        {result !== null && <div className="result">Финиш! Дистанция: <b>{result} м</b> · Награда начислена</div>}
      </section>
      <section className="quick-grid">
        <button onClick={() => setTab("garage")}><span>🚗</span><b>ГАРАЖ</b><small>Машины и тюнинг</small></button>
        <button onClick={() => setTab("rating")}><span>🏆</span><b>РЕЙТИНГ</b><small>Лучшие гонщики</small></button>
        <button onClick={() => setTab("shop")}><span>🛒</span><b>МАГАЗИН</b><small>Бонусы и наборы</small></button>
      </section>
      {tab === "garage" && <section className="content-card"><h2>ТВОЙ ГАРАЖ</h2>{cars.map((car,i)=><div className="car-row" key={car.name}><div className="car-icon" style={{background:`#${car.color.toString(16).padStart(6,"0")}`}}>▰</div><div className="car-info"><b>{car.name}</b><small>{car.className} · SPEED {car.speed}/5</small></div>{selected===i?<span className="owned">ВЫБРАНА</span>:<button className="small-btn" onClick={()=>buyCar(i)}>{car.price===0?"ВЫБРАТЬ":`₵ ${car.price.toLocaleString("en-US")}`}</button>}</div>)}</section>}
      {tab === "rating" && <section className="content-card"><h2>РЕЙТИНГ ГОНОЩИКОВ</h2><div className="leader"><b>1</b><span>NeonPilot</span><strong>12 840 pts</strong></div><div className="leader"><b>2</b><span>StreetFox</span><strong>11 920 pts</strong></div><div className="leader"><b>3</b><span>TurboKid</span><strong>10 450 pts</strong></div><div className="leader you"><b>—</b><span>Ты · Новичок</span><strong>{races*120} pts</strong></div></section>}
      {tab === "shop" && <section className="content-card"><h2>МАГАЗИН</h2><p>Премиальные товары появятся после подключения Telegram Stars.</p><div className="shop-item"><span>◆</span><div><b>Gems Pack</b><small>Премиальная валюта</small></div><strong>Скоро</strong></div><div className="shop-item"><span>⭐</span><div><b>VIP Club</b><small>Бонусы и эксклюзивный стиль</small></div><strong>Скоро</strong></div></section>}
    </>}

    <nav className="bottom-nav">
      {(["race","garage","rating","shop"] as Tab[]).map((t)=><button className={tab===t?"active":""} key={t} onClick={()=>{setTab(t);setRace(false);}}><span>{({race:"🏁",garage:"🚗",rating:"🏆",shop:"🛒"})[t]}</span>{({race:"ГОНКА",garage:"ГАРАЖ",rating:"РЕЙТИНГ",shop:"МАГАЗИН"})[t]}</button>)}
    </nav>
    <footer>DEMO BUILD 0.1 · GAME PROGRESS IS LOCAL ONLY</footer>
  </main>;
}
