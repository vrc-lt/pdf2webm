import {getDocument, GlobalWorkerOptions} from 'pdfjs-dist'
import {createFFmpeg} from '@ffmpeg/ffmpeg'

const vender_version = '1663764183'
GlobalWorkerOptions.workerSrc = `/v${vender_version}/pdf.worker.min.js`
const output_file = 'result.webm'
const output_mime = 'video/webm'
const ffmpeg_args = ['-y', '-pattern_type', 'glob', '-r', '1/2', '-i', 'page*.png', '-r', '30', '-c:v', 'libvpx', '-pix_fmt', 'yuv420p', output_file]

const r = document.getElementById("resolution")
const f = document.getElementById("file")
const ires = document.getElementById("input_resolution")
const ores = document.getElementById("output_resolution")

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
  const tmp = base64.split(',')
  const binstr = atob(tmp[1])
  const len = binstr.length
  const buf = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    buf[i] = binstr.charCodeAt(i)
  }
  return buf
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
    ffmpeg.FS("writeFile", `page${num}.png`, data)
  }
  canvas.remove()
  return numPages
}

function downloadLink(data){
  const blob = new Blob([data], {type: output_mime})
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style = 'display: none'
  a.href = url
  a.download = output_file
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ページ読み込み時にffmpegの立ち上げる
const ffmpeg = createFFmpeg({
  log: true,
  mainName: "main",
  corePath: `/v${vender_version}/ffmpeg-core.js`,
})
const loadwait = ffmpeg.load()

async function run() {
  // ffmpegの立ち上げ完了を待つ
  await loadwait
  const numPages = await pdfToPNGList(ffmpeg)
  await ffmpeg.run(...ffmpeg_args)
  const result = ffmpeg.FS('readFile', output_file)
  downloadLink(result)
  // cleanup fs
  ffmpeg.FS("unlink", output_file)
  for(let i = 0; i < numPages; i++){
    const num = `00${i}`.slice(-3)
    ffmpeg.FS("unlink", `page${num}.png`)
  }
}

f.addEventListener("change", e => check_pdf(e.target).then(calc_resolusion))
r.addEventListener("change", calc_resolusion)
document.getElementById("run").addEventListener('click', (e) => run())