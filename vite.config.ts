import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const isAnalyze = mode === 'analyze';

  return {
    plugins: [
      react({
        // 启用React Fast Refresh
        fastRefresh: true,
        // 启用JSX运行时优化
        jsxRuntime: 'automatic',
        // 启用Babel优化
        babel: {
          plugins: [
            // 移除开发时的console.log
            isProduction && 'transform-remove-console',
          ].filter(Boolean),
        },
      }),
      
      // Gzip压缩插件
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 10240, // 10KB以上才压缩
        deleteOriginFile: false,
      }),
      
      // Brotli压缩插件
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 10240,
        deleteOriginFile: false,
      }),
      
      // PWA插件
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\./,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24小时
                },
              },
            },
          ],
        },
        manifest: {
          name: '域名面板',
          short_name: '域名面板',
          description: '域名管理与展示面板',
          theme_color: '#007bff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/logo.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    
    // 构建配置
    build: {
      // 输出目录
      outDir: 'dist',
      
      // 源码映射
      sourcemap: isAnalyze, // 只在分析模式下生成sourcemap
      
      // 代码分割配置
      rollupOptions: {
        output: {
          // 手动代码分割
          manualChunks: (id) => {
            // React相关库单独打包
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react-vendor';
            }
            
            // 工具函数单独打包
            if (id.includes('/utils')) {
              return 'utils';
            }
            
            // 类型定义单独打包
            if (id.includes('/types')) {
              return 'types';
            }
            
            // API相关单独打包
            if (id.includes('/api')) {
              return 'api';
            }
            
            // Hooks单独打包
            if (id.includes('/hooks')) {
              return 'hooks';
            }
            
            // 组件单独打包
            if (id.includes('/components')) {
              return 'components';
            }
            
            // 其他第三方库
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
          
          // 文件名配置
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/\.(css)$/.test(assetInfo.name || '')) {
              return `css/[name]-[hash].${ext}`;
            }
            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(assetInfo.name || '')) {
              return `images/[name]-[hash].${ext}`;
            }
            return `assets/[name]-[hash].${ext}`;
          },
        },
        
        // 外部依赖配置
        external: [],
      },
      
      // 压缩配置
      minify: 'terser',
      terserOptions: {
        compress: {
          // 移除console.log
          drop_console: isProduction,
          // 移除debugger
          drop_debugger: isProduction,
          // 移除未使用的变量
          unused: true,
          // 移除死代码
          dead_code: true,
          // 优化条件表达式
          conditionals: true,
          // 优化布尔值
          booleans: true,
          // 优化if语句
          if_return: true,
          // 优化for循环
          loops: true,
          // 优化函数调用
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug', 'console.warn'] : [],
        },
        mangle: {
          // 混淆变量名
          toplevel: true,
          // 保留函数名（用于调试）
          keep_fnames: !isProduction,
        },
        format: {
          // 移除注释
          comments: false,
        },
      },
      
      // 目标浏览器配置
      target: ['es2015', 'chrome58', 'firefox57', 'safari11'],
      
      // 块大小警告限制
      chunkSizeWarningLimit: 1000,
      
      // 启用CSS代码分割
      cssCodeSplit: true,
      
      // 启用动态导入
      dynamicImportVarsOptions: {
        warnOnError: false,
        exclude: [],
      },
      
      // 报告包大小
      reportCompressedSize: true,
    },
    
    // 开发服务器配置
    server: {
      port: 3000,
      open: true,
      cors: true,
      // 启用HMR
      hmr: {
        overlay: true,
      },
    },
    
    // 预览服务器配置
    preview: {
      port: 4173,
      open: true,
    },
    
    // 路径别名配置
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@types': resolve(__dirname, 'src/types'),
        '@api': resolve(__dirname, 'src/api'),
      },
    },
    
    // 依赖优化配置
    optimizeDeps: {
      // 预构建包含的依赖
      include: ['react', 'react-dom'],
      // 预构建排除的依赖
      exclude: [],
      // 强制预构建
      force: false,
    },
    
    // CSS配置
    css: {
      // 启用CSS模块
      modules: {
        localsConvention: 'camelCase',
      },
      // PostCSS配置
      postcss: {
        plugins: [
          // 自动添加浏览器前缀
          require('autoprefixer'),
          // 压缩CSS
          isProduction && require('cssnano'),
        ].filter(Boolean),
      },
    },
    
    // 环境变量配置
    define: {
      // 全局常量
      __DEV__: JSON.stringify(!isProduction),
      __PROD__: JSON.stringify(isProduction),
    },
    
    // 日志级别
    logLevel: 'info',
    
    // 清除控制台
    clearScreen: false,
  };
}); 
