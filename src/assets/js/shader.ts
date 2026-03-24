/**
 * WebGL shader engine — visual mood renderer.
 */

const VERT_SRC = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;

const FRAG_SRC = `
precision highp float;
uniform float t;
uniform vec2 r;
uniform vec2 mood;

vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}

float snoise(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1;
  i1=(x0.x>x0.y)?vec2(1,0):vec2(0,1);
  vec4 x12=x0.xyxy+C.xxzz;
  x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0,i1.y,1.))+i.x+vec3(0,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);
  m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.;
  vec3 h=abs(x)-.5;
  vec3 ox=floor(x+.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}

float fbm(vec2 p, float speed){
  float f=0.;
  f+=0.5000*snoise(p*1.0+t*speed);
  f+=0.2500*snoise(p*2.0-t*speed*1.3);
  f+=0.1250*snoise(p*4.0+t*speed*0.7);
  f+=0.0625*snoise(p*8.0-t*speed*0.9);
  return f;
}

vec3 palette(float valence, float arousal, float n){
  vec3 coldA = vec3(0.05, 0.05, 0.18);
  vec3 coldB = vec3(0.12, 0.08, 0.28);
  vec3 coldC = vec3(0.06, 0.16, 0.22);
  vec3 warmA = vec3(0.28, 0.15, 0.06);
  vec3 warmB = vec3(0.30, 0.10, 0.12);
  vec3 warmC = vec3(0.25, 0.20, 0.05);
  vec3 cold = mix(mix(coldA, coldB, n), coldC, sin(n*3.14)*.5+.5);
  vec3 warm = mix(mix(warmA, warmB, n), warmC, sin(n*3.14+1.)*.5+.5);
  vec3 base = mix(cold, warm, valence);
  float brightness = mix(0.6, 1.4, arousal);
  base *= brightness;
  return base;
}

void main(){
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = (gl_FragCoord.xy - r*.5) / min(r.x, r.y);
  float valence = mood.x;
  float arousal = mood.y;
  float speed = mix(0.03, 0.12, arousal);
  float n1 = fbm(p * 1.5 + vec2(0.0, 0.0), speed);
  float n2 = fbm(p * 1.2 + vec2(5.2, 1.3), speed * 0.7);
  float n3 = fbm(p * 0.8 + vec2(2.1, 7.8), speed * 0.5);
  float flow = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  vec2 warped = p + vec2(n1, n2) * mix(0.15, 0.4, arousal);
  float mainNoise = fbm(warped * 1.3, speed * 0.8);
  float colorIdx = mainNoise * 0.5 + 0.5;
  vec3 col = palette(valence, arousal, colorIdx);
  for(int i = 0; i < 4; i++){
    float fi = float(i);
    vec2 center = vec2(
      sin(t * speed * 2.0 + fi * 1.7) * 0.4,
      cos(t * speed * 1.5 + fi * 2.3) * 0.3
    );
    float dist = length(warped - center);
    float glow = exp(-dist * mix(3.0, 6.0, arousal)) * mix(0.08, 0.2, valence);
    vec3 glowCol = palette(valence, arousal, fi * 0.25 + flow * 0.3);
    col += glowCol * glow * mix(1.5, 3.0, arousal);
  }
  float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 1.2;
  col *= vig;
  float grain = (snoise(gl_FragCoord.xy * 0.5 + t * 100.0) * 0.02);
  col += grain;
  float breath = sin(t * mix(0.3, 0.8, arousal)) * mix(0.02, 0.06, arousal);
  col *= 1.0 + breath;
  col = col / (col + 0.8);
  col = pow(col, vec3(0.95));
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface ShaderEngine {
  render(elapsed: number, moodX: number, moodY: number): void;
}

function createShader(gl: WebGLRenderingContext, src: string, type: number): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}

export function initWebGL(canvas: HTMLCanvasElement): ShaderEngine {
  const gl = canvas.getContext('webgl')!;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, createShader(gl, VERT_SRC, gl.VERTEX_SHADER));
  gl.attachShader(prog, createShader(gl, FRAG_SRC, gl.FRAGMENT_SHADER));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const pAttr = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(pAttr);
  gl.vertexAttribPointer(pAttr, 2, gl.FLOAT, false, 0, 0);

  const uT = gl.getUniformLocation(prog, 't');
  const uR = gl.getUniformLocation(prog, 'r');
  const uMood = gl.getUniformLocation(prog, 'mood');

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    render(elapsed: number, moodX: number, moodY: number) {
      gl.uniform1f(uT, elapsed);
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform2f(uMood, moodX, moodY);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}