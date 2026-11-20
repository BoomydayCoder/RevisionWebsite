// Parametric drawings for Folio. Render at display resolution so the ruled lines stay fine.
const tau = Math.PI * 2
const palette = {
  algebra: ['#e0e7dc','#305b4d'], analysis: ['#e1e6f0','#485f8b'],
  cosmology: ['#ebe0d6','#9f5a3a'], linguistics: ['#e9e2ed','#825e8e']
}
function draw(canvas) {
  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(rect.width * ratio)
  canvas.height = Math.round(rect.height * ratio)
  const g = canvas.getContext('2d')
  if (!g) return
  const w = rect.width, h = rect.height, type = canvas.dataset.art
  g.scale(ratio, ratio)
  const stroke = (points, colour, width = .7) => {
    g.strokeStyle = colour; g.lineWidth = width; g.beginPath()
    points.forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y))
    g.stroke()
  }
  const curve = (f, colour, width, steps=100) => {
    const pts = []
    for(let j=0;j<=steps;j++) pts.push(f(j/steps))
    stroke(pts,colour,width)
  }
  let seed=1019
  const random=()=>{seed=seed*16807%2147483647;return seed/2147483647}
  if(type==='feature'){
    const cx=w*.53, cy=h*.5, sc=Math.min(w*.29,h*.52)
    g.fillStyle='#253f8d';g.fillRect(0,0,w,h)
    for(let i=0;i<320;i++){g.fillStyle='rgba(238,237,205,'+(.1+random()*.48)+')';const s=random()>.95?1.6:.8;g.fillRect(random()*w,random()*h,s,s)}
    // Two families of straight lines lie on x² + y² − z² = 1.
    const project=(x,y,z)=>{
      const a=.62*x, b=.62*(.38*y-.925*z)
      return [cx+sc*(.91*a+.415*b),cy+sc*(-.415*a+.91*b)]
    }
    const guide='rgba(218,228,253,.22)'
    curve(t=>[cx+sc*1.43*Math.cos(t*tau),cy+sc*1.43*Math.sin(t*tau)],guide,.6)
    stroke([[cx-sc*1.7,cy],[cx+sc*1.65,cy]],guide,.65)
    stroke([[cx,cy-sc*1.55],[cx,cy+sc*1.5]],guide,.65)
    for(let i=0;i<59;i++){
      const a=tau*i/59, x=Math.cos(a), y=Math.sin(a)
      for(const sign of [-1,1]){
        const line=z=>project(x-sign*y*z,y+sign*x*z,z)
        stroke([line(-1.30),line(1.30)],sign===1?'rgba(249,237,206,.7)':'rgba(207,226,245,.46)',.68)
      }
    }
    for(let i=0;i<=22;i++){
      const z=-1.30+2.60*i/22, r=Math.hypot(1,z)
      curve(t=>project(r*Math.cos(t*tau),r*Math.sin(t*tau),z),i===0||i===22?'#edc69d':'rgba(239,237,218,.57)',i===0||i===22?1.15:.6,120)
    }
    curve(t=>{const a=t*tau;return project(1.96*Math.cos(a),1.96*Math.sin(a),0)},'rgba(221,163,109,.68)',.8,140)
    for(let i=0;i<6;i++){const a=(i+.25)*tau/6,x=cx+sc*1.43*Math.cos(a),y=cy+sc*1.43*Math.sin(a);stroke([[x-3,y],[x+3,y]],'#bfc7dc',.65);stroke([[x,y-3],[x,y+3]],'#bfc7dc',.65)}
    return
  }
  const [bg,ink]=palette[type]||palette.algebra
  g.fillStyle=bg;g.fillRect(0,0,w,h)
  const cx=w*.52,cy=h*.54,sc=Math.min(w*.30,h*.67)
  g.globalAlpha=.24;g.fillStyle=ink
  for(let x=6;x<w;x+=9)for(let y=6;y<h;y+=9)g.fillRect(x,y,.65,.65)
  g.globalAlpha=.87
  if(type==='algebra'){
    function p(u,v){let a=tau*u,b=tau*v;let x=(.82+.32*Math.cos(b))*Math.cos(a),y=(.82+.32*Math.cos(b))*Math.sin(a),z=.32*Math.sin(b);return [cx+sc*(.92*x+.29*y-.2*z),cy+sc*(-.32*x+.48*y-.86*z)]}
    for(let i=0;i<35;i++)curve(v=>p(i/35,v),ink,.75,52)
    for(let i=0;i<16;i++)curve(u=>p(u,i/16),ink,.65,85)
  }else if(type==='analysis'){
    function p(x,y){let z=.38*Math.sin(2.4*x+.6*y)-.25*Math.cos(2*y-x);return [cx+sc*(x*.85+y*.47),cy+sc*(x*.23-y*.26-z*.83)]}
    for(let i=0;i<24;i++)curve(t=>p(t*2.3-1.15,i/23*2-1),ink,.7,60)
    for(let i=0;i<20;i++)curve(t=>p(i/19*2.3-1.15,t*2-1),ink,.65,60)
  }else if(type==='cosmology'){
    for(let i=0;i<9;i++){const a=i/9*tau;curve(t=>{let b=a+t*4.5,r=.1+t*1.09;return [cx+sc*r*Math.cos(b),cy+sc*.63*r*Math.sin(b)-sc*.22*r*Math.cos(b)]},ink,.52,65)}
    for(let i=0;i<1000;i++){let a=(i%3)*tau/3,r=Math.pow(random(),.64)*1.18,b=a+r*4.1+(random()-.5)*(.3+r*.62),x=r*Math.cos(b),y=r*Math.sin(b);g.fillStyle=ink;g.globalAlpha=.2+.58*random();g.fillRect(cx+sc*x,cy+sc*(.59*y-.23*x),1.05,1.05)}
  }else{
    for(let i=0;i<30;i++){const d=(i-14.5)/14.5;curve(t=>{const x=t*2-1,env=Math.exp(-1.8*x*x);let y=Math.sin(x*6.5+d*2.2)*(.38+.2*Math.cos(d))*env+d*.32;return[cx+sc*x*1.52,cy+sc*y]},ink,.77,85)}
  }
}
let observer
export function paintArt(root=document){
  if(!observer && window.ResizeObserver)observer=new ResizeObserver(items=>items.forEach(item=>draw(item.target)))
  root.querySelectorAll('canvas[data-art]').forEach(canvas=>{draw(canvas);observer?.observe(canvas)})
}
