const http = require('http')
http.createServer((req, res) => {
  let b = ''
  req.on('data', (c) => (b += c))
  req.on('end', () => {
    const auth = req.headers.authorization || ''
    let p = {}; try { p = JSON.parse(b) } catch {}
    console.log(`RESEND ${req.method} ${req.url} | مفتاح: ${auth.slice(0,14)}… | من: ${p.from} | إلى: ${p.to} | الموضوع: ${p.subject} | مرفقات: ${(p.attachments||[]).length}`)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id: 'fake-' + Date.now() }))
  })
}).listen(3999, '127.0.0.1', () => console.log('RESEND الواجهةُ الوهميّةُ تستمع على 3999'))
