import {getDocument, GlobalWorkerOptions} from 'pdfjs-dist/build/pdf'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'
import {FFmpeg} from '@ffmpeg/ffmpeg'

const vender_version = '1663764183'
GlobalWorkerOptions.workerSrc = pdfjsWorker
let y_size = 720
let input_file = 'result.pdf'
let log_text = ''
const format = document.getElementById("format")
const interval = document.getElementById("interval")
const output_file = () => `result.${format.value}`
const output_mime = () => `video/${format.value}`
const quality = () => {
  switch(document.getElementById("quality").value) {
    case 'low':
      return []
    case 'best':
      return ['-crf', '4', '-b:v', '5000000', '-quality', 'best', '-speed', '4']
    default:
      return ['-crf', '4', '-b:v', '5000000']
  }
}
const dl_filename = () => `${input_file.replace(/\.[^.]+$/, '')}.${y_size}p.t${interval.value}.${format.value}`
const encode_args = () => format.value == 'mp4'? ['-c:v', 'libx264', '-r', '30']: ['-c:v', 'libvpx', ...quality(),]
const framerate = () => {
  switch(interval.value) {
    case '1': return '1'
    case '2': return '1/2'
  }
}
const ffmpeg_args = () => ['-y', '-pattern_type', 'glob', '-r', framerate(), '-i', 'page*.png', ...encode_args(), '-pix_fmt', 'yuv420p', output_file()]

const r = document.getElementById("resolution")
const f = document.getElementById("file")
const q = document.getElementById("quality")
const ires = document.getElementById("input_resolution")
const ores = document.getElementById("output_resolution")
const runBtn = document.getElementById("run")
const progress = document.getElementById("progress")
const logtext = document.getElementById("logtext")

// pdf object
let pdf = null;
let scale = 1;
let width = 0;
let height = 0;

// ユークリッド互除法
function gcd(x, y) {
  while(y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function format_res(x,y){
  const c = gcd(Math.round(x), Math.round(y))
  return `${x}x${y}(${x/c}:${y/c})`
}

function innerFit(x, y, h){
  if(x/y > 16/9) {
    // 16:9より横長の場合
    const w = (16/9)*h
    return w/x
  } else {
    // 16:9以下の縦長の場合
    return h/y
  }
}

// input[type=file]のノードにPDFファイルが設定された場合PDFを解析し解像度を出力する
async function check_pdf(file_node){
  let file = null;
  if(file_node.files instanceof FileList){
    if(file_node.files.length > 0) {
      file = file_node.files[0]
    }
  }
  if (file === null){
    pdf = null
    ires.innerText = 'N/A'
    return
  }
  input_file = file.name
  log_text = `[pdf] ${file.name}\n`
  logtext.value = log_text
  const fileData = await readFileAsync(file)
  // PDFファイルのパース
  pdf = await getDocument({
    cMapPacked: true,
    cMapUrl: `/v${vender_version}/cmaps/`,
    data: fileData,
  }).promise

  // check resolusion
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({scale: 1})
  width = viewport.width
  height = viewport.height
  ires.innerText = format_res(width, height)

  // progress init
  progress.value = 0
  progress.innerText = ''
  runBtn.removeAttribute('disabled')
}

async function calc_resolusion() {
  if (pdf === null) {
    scale = null
    ores.innerText = `N/A`
    return
  }
  switch(r.value){
  case "original": scale = 1; break
  case "double": scale = 2; break
  case "720":
  case "1080":
  case "1440":
  case "2160":
    const num = parseInt(r.value, 10)
    if (isNaN(num)) {
      scale = 1
    } else {
      scale = innerFit(width, height, num)
    }
    break
  default:
    scale = 1
  }
  y_size = Math.round(height*scale)
  ores.innerText = format_res(width*scale, height*scale)
}

// input type="file"要素からファイルのバイト列を取り出す
function readFileAsync(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result)
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// PNGオブジェクトをCanvasを用いて指定のページをPNG化する
async function pdfToPNG(page, canvas) {
  // canvasにレンダリング
  const viewport = page.getViewport({ scale: scale })
  canvas.height = viewport.height
  canvas.width = viewport.width
  const context = canvas.getContext('2d')
  var task = page.render({
    canvasContext: context,
    viewport: viewport,
  })
  await task.promise

  // レンダリング結果をPNG化
  const base64 = canvas.toDataURL('image/png')
  return Uint8Array.from(Array.prototype.map.call(atob(base64.split(',')[1]), x => x.charCodeAt(0)))
}

async function pdfToPNGList(ffmpeg) {
  if(pdf === null) {
    return null
  }
  // render pages
  const numPages = pdf.numPages
  const canvas = document.createElement('canvas')
  for(let i = 0; i < numPages; i++){
    const page = await pdf.getPage(i+1)
    const data = await pdfToPNG(page, canvas)
    const num = `00${i}`.slice(-3)
    await ffmpeg.writeFile(`page${num}.png`, data)
  }
  canvas.remove()
  return numPages
}

function downloadLink(data){
  const blob = new Blob([data], {type: output_mime()})
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style = 'display: none'
  a.href = url
  a.download = dl_filename()
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ページ読み込み時にffmpegの立ち上げる
const ffmpeg = new FFmpeg()
ffmpeg.on("log", ({type, message}) => {
  log_text += `[${type}] ${message}\n`
  logtext.value = log_text
  logtext.scroll(0, logtext.scrollHeight);
})
ffmpeg.on("progress", (d) => {
  log_text += `[progress] ${(d.progress * 100).toFixed(2)}% done\n`
  logtext.value = log_text
  logtext.scroll(0, logtext.scrollHeight);
  progress.value = d.progress;
  progress.innerText = `${(d.progress * 100).toFixed(2)}% done`
})
const loadwait = ffmpeg.load({
  log: true,
  coreURL: `/v1694948356/ffmpeg-core.js`,
})

async function run() {
  // form disable
  r.setAttribute('disabled', '')
  f.setAttribute('disabled', '')
  q.setAttribute('disabled', '')
  format.setAttribute('disabled', '')
  runBtn.setAttribute('disabled', '')
  // ffmpegの立ち上げ完了を待つ
  progress.innerText = ''
  progress.removeAttribute('value')
  await loadwait
  const numPages = await pdfToPNGList(ffmpeg)
  await ffmpeg.exec(ffmpeg_args())
  const result = await ffmpeg.readFile(output_file())
  downloadLink(result)
  // cleanup fs
  ffmpeg.deleteFile(output_file())
  for(let i = 0; i < numPages; i++){
    const num = `00${i}`.slice(-3)
    ffmpeg.deleteFile(`page${num}.png`)
  }
  // form enable
  r.removeAttribute('disabled')
  f.removeAttribute('disabled')
  q.removeAttribute('disabled')
  format.removeAttribute('disabled')
  runBtn.removeAttribute('disabled')
}

f.addEventListener("change", e => check_pdf(e.target).then(calc_resolusion))
r.addEventListener("change", calc_resolusion)
runBtn.setAttribute('disabled', '')
runBtn.addEventListener('click', _ => run())
