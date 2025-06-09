// vite.config.ts
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  publicDir: path.resolve(__dirname, 'public'), // 用来拷贝 manifest.json + icons

  plugins: [
    // 把 HTML 入口“静态复制”到期望的目录
    viteStaticCopy({
      targets: [
        { src: 'src/popup/index.html', dest: 'popup' },
        { src: 'src/options/index.html', dest: 'options' },
      ]
    })
  ],

  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      // 只打包脚本入口
      input: {
        background: path.resolve(__dirname, 'src/background.ts'),
        content: path.resolve(__dirname, 'src/content/content.ts'),
        popup: path.resolve(__dirname, 'src/popup/popup.ts'),       // 注意：这里指向脚本，而不是 HTML
        options: path.resolve(__dirname, 'src/options/options.ts'), // 同上
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js'
          if (chunk.name === 'content')    return 'content/content.js'
          if (chunk.name === 'popup')      return 'popup/popup.js'
          if (chunk.name === 'options')    return 'options/options.js'
          return '[name].js'
        },
        chunkFileNames:    'chunks/[name]-[hash].js',
        assetFileNames:    'assets/[name]-[hash][extname]',
      }
    }
  }
})
