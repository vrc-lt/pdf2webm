# pdf2webm

## What is this?

pdf.jsとffmpeg.wasmを用いてPDFからWebMをブラウザ上で変換するツールです。

## build & usage

以下のコマンドにより`dist/`以下にファイルが生成されます。
```bash
npm run build
```

成果物をWebサイトとして公開することで利用できます。

## Development
[Vite](https://vitejs.dev/)を用いて開発しています。以下のコマンドで開発サーバーを立ち上げられます。

```bash
npm run dev
```

## LICENSE

[LICENSE](LICENSE) を参照ください。

例外として以下のファイルについては別途ライセンスを参照ください。

### pdf.js
`public/vXXXXXXXXX/pdf.worker.min.js`は[pdf.js](https://github.com/mozilla/pdf.js/)の成果物です。

### ffmpeg.wasm-core
`public/vXXXXXXXXX/ffmpeg-core.js`ならびに`public/vXXXXXXXX/ffmpeg-core.wasm`は[ffmpeg.wasm-core](https://github.com/ffmpegwasm/ffmpeg.wasm-core)の成果物です。

### Adobe CMap Resources
`public/vXXXXXXXXX/cmaps/`以下のファイルは[Adobe CMap Resources](https://github.com/adobe-type-tools/cmap-resources/)の成果物です。
