const http = require('http')
http.createServer((req, res) => {
  let b=''; req.on('data',c=>b+=c); req.on('end',()=>{
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ name: 'invalid_api_key', message: 'API key is invalid' }))
  })
}).listen(3998, '127.0.0.1', () => console.log('ready'))
